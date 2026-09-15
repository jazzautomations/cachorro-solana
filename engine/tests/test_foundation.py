from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import jsonschema
import yaml


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "runtime"))

from package_bundle import package_bundle  # noqa: E402
from campaign import Campaign  # noqa: E402
from capabilities import CapabilityBroker  # noqa: E402
from dns_guard import DNSDenied, DNSGuard  # noqa: E402
from evidence_vault import EvidenceVault  # noqa: E402
from execution import ContainerSandbox, ExecutionPlan, TrustedProcessExecutor  # noqa: E402
from journal import JournalCorruption, RoundJournal  # noqa: E402
from research_graph import ResearchGraph  # noqa: E402
from scheduler import load_and_select, proposal_score  # noqa: E402
from scope import ScopeDenied, ScopeGuard  # noqa: E402
from scope_signing import (  # noqa: E402
    generate_keypair,
    load_private_key,
    load_public_key,
    sign_receipt,
    verify_receipt,
)
from validate_bundle import validate_bundle  # noqa: E402
from toolpacks.adapters.git_history import GitHistoryAdapter  # noqa: E402
from toolpacks.adapters.hexstrike_passive import (  # noqa: E402
    HexStrikeLoopbackExecutor,
    HexStrikePassiveAdapter,
    loopback_service,
    normalize_domain,
)
from toolpacks.adapters.http_observe import HTTPObserveAdapter  # noqa: E402
from toolpacks.adapters.sqli_differential import SQLiDifferentialAdapter, _mutated_urls  # noqa: E402
from toolpacks.adapters.source_search import SourceSearchAdapter  # noqa: E402


def signed_scope(temporary: Path) -> tuple[Path, Path]:
    private_key = temporary / "authority-private.pem"
    public_key = temporary / "authority-public.pem"
    generate_keypair(private_key, public_key)
    receipt = json.loads((ROOT / "fixtures/scope.valid.json").read_text())
    signed = sign_receipt(receipt, load_private_key(private_key))
    signed_path = temporary / "scope.signed.json"
    signed_path.write_text(json.dumps(signed, sort_keys=True) + "\n")
    return signed_path, public_key


class FoundationTests(unittest.TestCase):
    def test_bundle_is_valid(self) -> None:
        report = validate_bundle(ROOT)
        self.assertTrue(report.ok, "\n".join(report.errors))
        self.assertEqual(
            report.agents,
            [
                "cartographer",
                "chain-synthesizer",
                "clean-room-reproducer",
                "context-modeler",
                "coverage-analyst",
                "experiment-designer",
                "fuzz-campaign",
                "harness-factory",
                "hypothesis-builder",
                "patch-archaeologist",
                "round-director",
                "skeptic",
                "solana-experiment-runner",
                "web-experiment-runner",
            ],
        )

    def test_hypothesis_fixture_matches_schema(self) -> None:
        schema = json.loads((ROOT / "schemas/hypothesis.schema.json").read_text())
        fixture = json.loads((ROOT / "fixtures/hypothesis.valid.json").read_text())
        jsonschema.Draft202012Validator(schema).validate(fixture)

    def test_scope_guard_allows_exact_action_and_applies_explicit_deny(self) -> None:
        guard = ScopeGuard.from_files(
            ROOT / "fixtures/scope.valid.json",
            ROOT / "schemas/scope-receipt.schema.json",
        )
        moment = datetime(2027, 1, 1, tzinfo=timezone.utc)
        decision = guard.authorize(
            "http.observe",
            "https://docs.example.test/path",
            side_effect="network_read",
            at=moment,
        )
        self.assertEqual(decision.matched_asset, "*.example.test")
        with self.assertRaises(ScopeDenied):
            guard.authorize(
                "http.observe",
                "https://billing.example.test/",
                side_effect="network_read",
                at=moment,
            )
        self.assertEqual(guard.required_headers, {"X-Hackerone": "fixture-researcher"})

    def test_scope_host_glob_supports_explicit_staging_deny(self) -> None:
        receipt = json.loads((ROOT / "fixtures/scope.valid.json").read_text())
        receipt["denied_assets"].append(
            {
                "kind": "host-glob",
                "value": "staging*.example.test",
                "actions": ["http.observe"],
            }
        )
        guard = ScopeGuard(
            receipt,
            json.loads((ROOT / "schemas/scope-receipt.schema.json").read_text()),
        )
        moment = datetime(2027, 1, 1, tzinfo=timezone.utc)
        with self.assertRaises(ScopeDenied):
            guard.authorize(
                "http.observe",
                "https://staging7.example.test/",
                side_effect="network_read",
                at=moment,
            )
        with self.assertRaises(ScopeDenied):
            guard.authorize(
                "http.observe",
                "https://example.test/",
                side_effect="network_read",
                at=moment,
            )

    def test_scope_receipt_signature_detects_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt_path, public_path = signed_scope(temp)
            receipt = json.loads(receipt_path.read_text())
            key = load_public_key(public_path)
            verify_receipt(receipt, [key])
            receipt["assets"][0]["value"] = "*.attacker.test"
            from cryptography.exceptions import InvalidSignature

            with self.assertRaises(InvalidSignature):
                verify_receipt(receipt, [key])

    def test_scheduler_penalizes_repetition_and_reserves_an_orthogonal_lane(self) -> None:
        selected = load_and_select(
            ROOT / "fixtures/proposals.valid.json",
            ROOT / "schemas/proposal.schema.json",
            slots=2,
        )
        self.assertEqual({item.proposal["lane"] for item in selected}, {"source.variant", "runtime.state"})
        proposals = json.loads((ROOT / "fixtures/proposals.valid.json").read_text())
        self.assertGreater(proposal_score(proposals[0]), proposal_score(proposals[2]))

    def test_campaign_filters_scope_before_scheduling_and_journals_decision(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            workspace = temp / "campaign"
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, workspace, receipt, [public_key])
            proposals = json.loads((ROOT / "fixtures/proposals.valid.json").read_text())
            rejected = dict(proposals[0])
            rejected["proposal_id"] = "prop-denied-001"
            rejected["target"] = "https://billing.example.test/private"
            result = campaign.schedule(proposals + [rejected], slots=2)
            self.assertEqual(len(result["selected"]), 2)
            self.assertEqual(result["rejected"][0]["proposal_id"], "prop-denied-001")
            status = campaign.status()
            self.assertEqual(status["journal_records"], 2)
            self.assertEqual(status["graph_revision"], 0)

    def test_campaign_pins_agent_folder_hash_in_each_round(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            workspace = temp / "campaign"
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, workspace, receipt, [public_key])
            document = {
                "schema_version": "0.1.0",
                "round_id": "round-000001",
                "cycle_id": "cycle-000001",
                "kind": "synthesis",
                "objective": "Select the next bounded research trajectory.",
                "agent_name": "round-director",
                "agent_package_hash": campaign.agent_hash("round-director"),
                "graph_revision_in": 0,
                "scope_receipt_id": "scope-example-0001",
                "budget": {"max_turns": 6},
                "hypothesis_ids": [],
                "experiment_ids": [],
                "artifact_ids": [],
                "observation_ids": [],
                "graph_revision_out": 0,
                "contradiction_ids": [],
                "decision": "continue",
                "decision_reason": "An orthogonal context trajectory remains within budget.",
                "next_candidates": ["prop-source-001"],
            }
            campaign.record_round(document)
            self.assertEqual(campaign.status()["journal_records"], 2)
            document["agent_package_hash"] = "sha256:" + "0" * 64
            with self.assertRaises(ValueError):
                campaign.record_round(document)

    def test_dns_pin_rejects_private_answers_and_rebinding(self) -> None:
        guard = ScopeGuard.from_files(
            ROOT / "fixtures/scope.valid.json",
            ROOT / "schemas/scope-receipt.schema.json",
        )
        private = DNSGuard(lambda _host, _port: ["127.0.0.1"])
        with self.assertRaises(DNSDenied):
            private.pin("https://docs.example.test/", "http.observe", guard)

        answers = iter([["93.184.216.34"], ["93.184.216.35"]])
        changing = DNSGuard(lambda _host, _port: next(answers))
        pin = changing.pin("https://docs.example.test/", "http.observe", guard)
        with self.assertRaises(DNSDenied):
            changing.revalidate(pin, guard, "http.observe")

    def test_capability_receipt_binds_exact_plan_and_executor_rejects_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, temp / "campaign", receipt, [public_key])
            rg_path = Path(TrustedProcessExecutor.discover(["rg"])["rg"])
            plan = ExecutionPlan(
                adapter="source-browser",
                capability="context.compile",
                action="source.read",
                target=str(ROOT),
                side_effect="workspace_write",
                argv=(str(rg_path), "--version"),
                cwd=str(ROOT),
            )
            broker = CapabilityBroker(ROOT, campaign.guard, campaign.agent_hash)
            capability = broker.authorize("context-modeler", plan)
            executor = TrustedProcessExecutor({"rg": rg_path})
            result = executor.run(plan, capability.plan_digest)
            self.assertEqual(result.returncode, 0)
            changed = ExecutionPlan(**{**plan.__dict__, "argv": (str(rg_path), "--help")})
            with self.assertRaises(PermissionError):
                executor.run(changed, capability.plan_digest)

    def test_container_sandbox_is_digest_pinned_and_networkless(self) -> None:
        sandbox = ContainerSandbox(Path("/usr/bin/docker"))
        command = sandbox.command(
            image="example.invalid/research@sha256:" + "a" * 64,
            workspace=ROOT,
            argv=["python3", "harness.py"],
        )
        self.assertIn("--network", command)
        self.assertIn("none", command)
        self.assertIn("no-new-privileges", command)
        with self.assertRaises(ValueError):
            sandbox.command(image="example.invalid/research:latest", workspace=ROOT, argv=["true"])
        with self.assertRaises(PermissionError):
            sandbox.command(
                image="example.invalid/research@sha256:" + "a" * 64,
                workspace=ROOT,
                argv=["true"],
                network=True,
            )

    def test_source_and_git_adapters_execute_through_broker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, temp / "campaign", receipt, [public_key])
            executables = TrustedProcessExecutor.discover(["rg", "git"])
            executor = TrustedProcessExecutor(executables)
            broker = CapabilityBroker(ROOT, campaign.guard, campaign.agent_hash)

            source = SourceSearchAdapter(executables["rg"])
            source_outcome = source.run(
                agent_name="context-modeler",
                root=ROOT,
                query="class Campaign",
                broker=broker,
                executor=executor,
                vault=campaign.evidence,
                agent_package_hash=campaign.agent_hash("context-modeler"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )
            self.assertGreaterEqual(len(source_outcome.normalized["matches"]), 1)

            history = GitHistoryAdapter(executables["git"])
            history_outcome = history.run(
                agent_name="patch-archaeologist",
                repository=ROOT.parent,
                broker=broker,
                executor=executor,
                vault=campaign.evidence,
                agent_package_hash=campaign.agent_hash("patch-archaeologist"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )
            self.assertGreaterEqual(len(history_outcome.normalized["commits"]), 1)

    def test_http_adapter_plan_is_dns_pinned_read_only_and_no_redirect(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, temp / "campaign", receipt, [public_key])
            dns = DNSGuard(lambda _host, _port: ["93.184.216.34"])
            curl = TrustedProcessExecutor.discover(["curl"])["curl"]
            adapter = HTTPObserveAdapter(curl, dns)
            pin = dns.pin("https://docs.example.test/path", "http.observe", campaign.guard)
            plan = adapter.plan(
                "https://docs.example.test/path",
                pin,
                required_headers=campaign.guard.required_headers,
            )
            broker = CapabilityBroker(
                ROOT,
                campaign.guard,
                campaign.agent_hash,
                dns_guard=dns,
            )
            capability = broker.authorize("cartographer", plan)
            self.assertEqual(capability.dns_pin["addresses"], ("93.184.216.34",))
            self.assertIn("--resolve", plan.argv)
            self.assertIn("--max-redirs", plan.argv)
            self.assertNotIn("--location", plan.argv)
            header_index = plan.argv.index("--header")
            self.assertEqual(plan.argv[header_index + 1], "X-Hackerone: fixture-researcher")
            with self.assertRaises(PermissionError):
                adapter.plan("https://docs.example.test/path", pin, method="POST")

    def test_hexstrike_bridge_rejects_remote_control_plane_and_shell_input(self) -> None:
        with self.assertRaises(ValueError):
            loopback_service("http://192.0.2.10:8888")
        with self.assertRaises(ValueError):
            loopback_service("http://localhost:8888")
        with self.assertRaises(ValueError):
            normalize_domain("docs.example.test;id")
        with self.assertRaises(ValueError):
            normalize_domain("https://docs.example.test")

        adapter = HexStrikePassiveAdapter()
        plan = adapter.plan("subfinder-passive", "docs.example.test")
        payload = json.loads(plan.argv[3])
        self.assertEqual(
            payload,
            {
                "additional_args": "",
                "all_sources": False,
                "domain": "docs.example.test",
                "silent": True,
            },
        )
        self.assertEqual(plan.target, "docs.example.test")
        self.assertEqual(plan.action, "http.observe")
        self.assertEqual(plan.control_plane, "http://127.0.0.1:8888")

        active = ExecutionPlan(
            **{
                **plan.__dict__,
                "argv": (
                    "hexstrike-loopback",
                    "http://127.0.0.1:8888",
                    "/api/tools/nmap",
                    "{}",
                ),
            }
        )
        with self.assertRaises(PermissionError):
            HexStrikeLoopbackExecutor(lambda *_args: (200, b"{}")).run(active, active.digest)

        guard = ScopeGuard.from_files(
            ROOT / "fixtures/scope.valid.json",
            ROOT / "schemas/scope-receipt.schema.json",
        )
        broker = CapabilityBroker(ROOT, guard, lambda _name: "sha256:" + "a" * 64)
        unauthorized_adapter = ExecutionPlan(
            adapter="http-observe",
            capability="surface.http.observe",
            action="http.observe",
            target="docs.example.test",
            side_effect="network_read",
            argv=("unused",),
            cwd="/tmp",
            network=True,
            control_plane="http://127.0.0.1:8888",
        )
        with self.assertRaises(PermissionError):
            broker.authorize("cartographer", unauthorized_adapter)

    def test_hexstrike_passive_output_is_evidence_not_a_finding(self) -> None:
        calls = []

        def transport(host, port, endpoint, body, timeout, limit):
            calls.append((host, port, endpoint, json.loads(body), timeout, limit))
            return 200, json.dumps(
                {
                    "success": True,
                    "return_code": 0,
                    "stdout": "api.docs.example.test\nnot-in-scope.invalid\n",
                    "stderr": "",
                }
            ).encode()

        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, temp / "campaign", receipt, [public_key])
            dns = DNSGuard(lambda _host, _port: ["93.184.216.34"])
            broker = CapabilityBroker(ROOT, campaign.guard, campaign.agent_hash, dns_guard=dns)
            adapter = HexStrikePassiveAdapter(transport=transport)
            outcome = adapter.run(
                agent_name="cartographer",
                profile_name="subfinder-passive",
                target="docs.example.test",
                scope_guard=campaign.guard,
                broker=broker,
                vault=campaign.evidence,
                agent_package_hash=campaign.agent_hash("cartographer"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )

        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0:3], ("127.0.0.1", 8888, "/api/tools/subfinder"))
        self.assertEqual(outcome.normalized["classification"], "observation_only")
        self.assertFalse(outcome.normalized["promotion_eligible"])
        self.assertEqual(outcome.normalized["candidates"], ["api.docs.example.test"])
        self.assertIsNone(outcome.capability_receipt["dns_pin"])
        self.assertEqual(outcome.capability_receipt["control_plane"], "http://127.0.0.1:8888")
        self.assertEqual(len(outcome.artifacts), 2)

        changed = ExecutionPlan(**{**adapter.plan("subfinder-passive", "docs.example.test").__dict__, "target": "evil.test"})
        with self.assertRaises(PermissionError):
            HexStrikeLoopbackExecutor(transport).run(changed, "sha256:" + "0" * 64)

    def test_sqli_adapter_uses_closed_boolean_grammar_and_identification(self) -> None:
        numeric = _mutated_urls("https://docs.example.test/items?id=7&view=small", "id")
        self.assertIn("id=7+AND+1%3D1", numeric["predicate_true"])
        self.assertIn("id=7+AND+1%3D2", numeric["predicate_false"])
        string = _mutated_urls("https://docs.example.test/search?q=pizza", "q")
        self.assertIn("q=pizza%27+AND+%271%27%3D%271", string["predicate_true"])
        with self.assertRaises(ValueError):
            _mutated_urls("https://docs.example.test/search?q=a&q=b", "q")

        guard = ScopeGuard.from_files(
            ROOT / "fixtures/scope.valid.json",
            ROOT / "schemas/scope-receipt.schema.json",
        )
        dns = DNSGuard(lambda _host, _port: ["93.184.216.34"])
        curl = TrustedProcessExecutor.discover(["curl"])["curl"]
        adapter = SQLiDifferentialAdapter(curl, dns)
        pin = dns.pin("https://docs.example.test/items?id=7", "http.sqli.differential", guard)
        plan = adapter.plan(
            numeric["predicate_true"],
            pin,
            guard.required_headers,
        )
        self.assertIn("X-Hackerone: fixture-researcher", plan.argv)
        self.assertNotIn("--location", plan.argv)
        with self.assertRaises(PermissionError):
            adapter.plan(numeric["predicate_true"], pin, {})

    def test_sqli_adapter_executes_one_bounded_pair_through_broker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            receipt, public_key = signed_scope(temp)
            campaign = Campaign.initialize(ROOT, temp / "campaign", receipt, [public_key])
            executable = TrustedProcessExecutor.discover(["true"])["true"]
            executor = TrustedProcessExecutor({"true": executable})
            dns = DNSGuard(lambda _host, _port: ["93.184.216.34"])
            broker = CapabilityBroker(ROOT, campaign.guard, campaign.agent_hash, dns_guard=dns)
            adapter = SQLiDifferentialAdapter(executable, dns, sleeper=lambda _seconds: None)
            outcome = adapter.run(
                agent_name="web-experiment-runner",
                url="https://docs.example.test/items?id=7",
                parameter="id",
                repetitions=1,
                delay_seconds=12,
                scope_guard=campaign.guard,
                broker=broker,
                executor=executor,
                vault=campaign.evidence,
                agent_package_hash=campaign.agent_hash("web-experiment-runner"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )
            self.assertEqual(outcome.execution["requests_sent"], 3)
            self.assertEqual(outcome.normalized["classification"], "no_deterministic_signal")
            self.assertEqual(len(outcome.capability_receipt["requests"]), 3)

    def test_journal_detects_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "rounds.jsonl"
            journal = RoundJournal(path)
            journal.append("campaign.started", {"scope_receipt_id": "scope-example-0001"})
            journal.append("round.proposed", {"proposal_id": "prop-source-001"})
            self.assertEqual(journal.verify()[0], 2)
            lines = path.read_text().splitlines()
            record = json.loads(lines[0])
            record["payload"]["scope_receipt_id"] = "tampered"
            lines[0] = json.dumps(record, sort_keys=True)
            path.write_text("\n".join(lines) + "\n")
            with self.assertRaises(JournalCorruption):
                journal.verify()

    def test_evidence_vault_is_content_addressed_and_integrity_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = EvidenceVault(Path(temporary))
            receipt = vault.put(
                b"reproducible artifact",
                media_type="text/plain",
                source="unit-test",
                tool="fixture",
                tool_version="1.0.0",
                agent_package_hash="sha256:" + "a" * 64,
                scope_receipt_id="scope-example-0001",
                captured_at="2027-01-01T00:00:00+00:00",
            )
            self.assertEqual(vault.read(receipt["artifact_id"]), b"reproducible artifact")
            second = vault.put(
                b"reproducible artifact",
                media_type="text/plain",
                source="unit-test",
                tool="fixture",
                tool_version="1.0.0",
                agent_package_hash="sha256:" + "a" * 64,
                scope_receipt_id="scope-example-0001",
                captured_at="2027-01-01T00:00:00+00:00",
            )
            self.assertEqual(receipt, second)

    def test_graph_tracks_revisions_and_rejects_status_skips(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            graph = ResearchGraph(Path(temporary) / "graph.sqlite3")
            graph.add_node(
                "obs-00000001",
                "observation",
                "observed",
                data={"statement": "candidate path reached"},
                artifact_ids=["sha256:" + "b" * 64],
            )
            graph.add_node(
                "hyp-00000001",
                "hypothesis",
                "proposed",
                data={"mechanism": "ownership transition"},
            )
            graph.add_edge("edge-00000001", "obs-00000001", "hyp-00000001", "supports")
            graph.transition_node(
                "hyp-00000001",
                "testing",
                reason="A bounded experiment has been defined.",
            )
            self.assertEqual(graph.node("hyp-00000001")["status"], "testing")
            self.assertEqual(graph.revision(), 4)
            with self.assertRaises(ValueError):
                graph.transition_node(
                    "hyp-00000001",
                    "verified",
                    reason="Skipping evidence gates must not be possible.",
                )

    def test_graph_requires_evidence_gate_before_verified_finding(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            graph = ResearchGraph(Path(temporary) / "graph.sqlite3")
            graph.add_node("hyp-00000001", "hypothesis", "proposed")
            with self.assertRaises(ValueError):
                graph.add_node("primitive-001", "primitive", "verified")
            graph.add_node("primitive-001", "primitive", "candidate")
            evidence = {
                "schema_version": "0.1.0",
                "evidence_id": "evidence-0001",
                "hypothesis_id": "hyp-00000001",
                "experiment_id": "experiment-01",
                "oracle": "The instrumented ownership violation is emitted only in treatment.",
                "negative_control": "The same replay with serialized ownership produces no violation.",
                "artifact_ids": ["sha256:" + "c" * 64],
                "reproduction": {
                    "attempts": 3,
                    "successes": 3,
                    "environment_hash": "sha256:" + "d" * 64,
                },
                "verdict": "supports",
            }
            graph.add_evidence(evidence)
            graph.verify_primitive(
                "primitive-001",
                ["evidence-0001"],
                reason="The semantic oracle survives its negative control in three clean runs.",
            )
            finding = {
                "schema_version": "0.1.0",
                "finding_id": "finding-0001",
                "title": "Ownership transition violates object lifetime invariant",
                "mechanism": "Concurrent transitions retain and consume an object after ownership moves.",
                "impact": "An authorized clean fixture observes a deterministic lifetime safety violation.",
                "preconditions": ["Two transitions overlap in the tested state"],
                "primitive_ids": ["primitive-001"],
                "evidence_ids": ["evidence-0001"],
                "clean_room_reproduction": {
                    "artifact_id": "artifact-clean-0001",
                    "reviewer": "independent-fixture",
                    "verified_at": "2027-01-01T00:00:00Z",
                },
                "skeptic_review": "Negative control and alternate timing explanation were independently rejected.",
                "scope_receipt_id": "scope-example-0001",
                "status": "verified",
            }
            graph.add_finding(finding)
            self.assertEqual(graph.node("finding-0001")["status"], "verified")

    def test_package_is_deterministic_and_contains_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temp = Path(temporary)
            first = temp / "first.zip"
            second = temp / "second.zip"
            first_digest = package_bundle(ROOT, first)
            second_digest = package_bundle(ROOT, second)
            self.assertEqual(first_digest, second_digest)
            self.assertEqual(hashlib.sha256(first.read_bytes()).hexdigest(), first_digest)

            import zipfile

            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
                self.assertIn(f"{ROOT.name}/MANIFEST.sha256", names)
                self.assertNotIn("__pycache__", "\n".join(names))

    def test_manifest_name_must_match_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            copy = Path(temporary) / "bundle"
            shutil.copytree(ROOT, copy)
            manifest_path = copy / "agents/skeptic/manifest.yaml"
            manifest = yaml.safe_load(manifest_path.read_text())
            manifest["name"] = "not-the-directory"
            manifest_path.write_text(yaml.safe_dump(manifest, sort_keys=False))
            report = validate_bundle(copy)
            self.assertFalse(report.ok)
            self.assertTrue(any("must match directory" in error for error in report.errors))

    def test_unknown_handoff_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            copy = Path(temporary) / "bundle"
            shutil.copytree(ROOT, copy)
            routes_path = copy / "agents/skeptic/routes.yaml"
            routes = yaml.safe_load(routes_path.read_text())
            routes["routes"][0]["handoff"] = "agent-that-does-not-exist"
            routes_path.write_text(yaml.safe_dump(routes, sort_keys=False))
            report = validate_bundle(copy)
            self.assertFalse(report.ok)
            self.assertTrue(any("unknown handoff target" in error for error in report.errors))

    def test_missing_shared_contract_reference_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            copy = Path(temporary) / "bundle"
            shutil.copytree(ROOT, copy)
            (copy / "schemas/hypothesis.schema.json").unlink()
            report = validate_bundle(copy)
            self.assertFalse(report.ok)
            self.assertTrue(
                any("unresolved local $ref" in error or "invalid JSON" in error for error in report.errors)
            )

    def test_symlinks_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            copy = Path(temporary) / "bundle"
            shutil.copytree(ROOT, copy)
            (copy / "agents/skeptic/escape").symlink_to(Path("/tmp"))
            report = validate_bundle(copy)
            self.assertFalse(report.ok)
            self.assertTrue(any("symlinks are forbidden" in error for error in report.errors))


if __name__ == "__main__":
    unittest.main()
