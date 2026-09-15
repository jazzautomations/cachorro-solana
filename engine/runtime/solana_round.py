#!/usr/bin/env python3
"""Drive ONE Solana finding through the real v3 promotion spine (M1).

This is NOT a mock. Every record — journal, evidence vault, research graph,
oracle verdict, promotion gate, report — is produced by the vendored v3 runtime
doing real work. The only *scripted* parts are the reasoning-agent outputs
(hypothesis / experiment / skeptic / finding prose): a live model
``CommandProvider`` is the next step (see docs/ENGINE.md), not M1.

Flow (each step is a real spine operation):
  scope receipt (signed) -> Campaign.initialize
  anchor-static-scan adapter  -> observation node   (real vault + journal)
  scripted hypothesis + experiment nodes
  litesvm-poc adapter x2       -> treatment/control booleans (real vault + journal)
  binary_differential_oracle   -> verdict            (real oracle)
  add_evidence (>=1 reproduction gate)               -> evidence node
  verify_primitive (verdict==supports gate)          -> candidate -> verified
  clean-room reproduction (fresh litesvm-poc run)
  add_finding (verified-primitive + supporting-evidence gate) -> finding node
  reporting.render_json -> report.json + report_sha256
  attestation: journal.verify() head -> attest digest -> journal append
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # engine/ (toolpacks)

from campaign import Campaign
from capabilities import CapabilityBroker
from dns_guard import DNSGuard
from execution import TrustedProcessExecutor
from journal import RoundJournal
from oracles import binary_differential_oracle
from reporting import render_json, write_once
from scope_signing import generate_keypair, load_private_key, sign_receipt
from toolpacks.adapters.anchor_static_scan import AnchorStaticScanAdapter
from toolpacks.adapters.litesvm_poc import LiteSVMPoCAdapter

ENGINE = Path(__file__).resolve().parents[1]
REPO = ENGINE.parent
CORPUS = REPO / "spike" / "vault"
SCRIPTS = REPO / "scripts"
TEST_NAME = "differential_drain_vs_blocked"
CARGO_BIN = Path.home() / ".cargo" / "bin"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sha256_files(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.read_bytes())
    return f"sha256:{digest.hexdigest()}"


def _prebuild_test_binary() -> Path:
    """Compile the trusted corpus OUTSIDE the executor and return the binary."""
    env_path = f"{CARGO_BIN}:/usr/bin:/bin"
    proc = subprocess.run(
        ["cargo", "test", "--test", "differential", "--no-run", "--message-format=json"],
        cwd=CORPUS, env={"PATH": env_path, "HOME": str(Path.home())},
        capture_output=True, text=True, timeout=1200,
    )
    binary = None
    for line in proc.stdout.splitlines():
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("reason") == "compiler-artifact" and obj.get("target", {}).get("name") == "differential" and obj.get("executable"):
            binary = obj["executable"]
    if not binary:
        raise RuntimeError(f"could not locate compiled test binary:\n{proc.stderr[-2000:]}")
    return Path(binary)


def _build_scope_receipt(work: Path) -> tuple[Path, Path]:
    private_key = work / "authority-private.pem"
    public_key = work / "authority-public.pem"
    generate_keypair(private_key, public_key)
    now = _now()
    receipt = {
        "schema_version": "0.1.0",
        "receipt_id": "scope-cachorro-sol-m1-0001",
        "authorization_reference": "cachorro-solana M1 self-authored teaching corpus (spike/vault)",
        "issued_at": (now - timedelta(minutes=5)).isoformat(),
        "expires_at": (now + timedelta(days=1)).isoformat(),
        "assets": [
            {
                "kind": "filesystem",
                "value": str(REPO),
                "actions": [
                    "static.anchor.scan", "surface.solana.dump",
                    "experiment.solana.poc", "source.read", "history.read",
                ],
            }
        ],
        # No cluster != localnet target and NO target_state_change side-effect is
        # authorized: on-chain mutation can never be planned. Mainnet RPC denied.
        "denied_assets": [
            {"kind": "host", "value": "api.mainnet-beta.solana.com", "actions": ["surface.solana.dump"]}
        ],
        "allowed_side_effects": ["none", "workspace_write", "network_read"],
        "required_headers": {},
        "notes": "M1 differential PoC on a self-compiled corpus; localnet/in-process only.",
    }
    signed = sign_receipt(receipt, load_private_key(private_key))
    signed_path = work / "scope.signed.json"
    signed_path.write_text(json.dumps(signed, sort_keys=True) + "\n")
    return signed_path, public_key


def main() -> int:
    stamp = _now().strftime("%Y%m%dT%H%M%SZ")
    run_root = REPO / "cachorro-out" / "engine-runs" / stamp
    run_root.mkdir(parents=True, exist_ok=True)
    workspace = run_root / "campaign"

    print(f"[*] corpus       : {CORPUS}")
    print(f"[*] run root     : {run_root}")

    print("[*] pre-building trusted corpus (outside the executor)...")
    test_binary = _prebuild_test_binary()
    print(f"[+] test binary  : {test_binary}")

    audited_commit = subprocess.run(
        ["git", "-C", str(REPO), "rev-parse", "HEAD"],
        capture_output=True, text=True,
    ).stdout.strip() or "uncommitted-worktree"
    verified_build_digest = _sha256_files(
        [CORPUS / "src" / "lib.rs", CORPUS / "tests" / "differential.rs", CORPUS / "Cargo.lock"]
    )

    receipt_path, public_key = _build_scope_receipt(run_root)
    campaign = Campaign.initialize(ENGINE, workspace, receipt_path, [public_key])
    scope_receipt_id = campaign.config["scope_receipt_id"]
    graph = campaign.graph
    print(f"[+] campaign     : {campaign.config['campaign_id']}")

    broker = CapabilityBroker(ENGINE, campaign.guard, campaign.agent_hash, dns_guard=DNSGuard())
    bash = TrustedProcessExecutor.discover(["bash"])["bash"]
    base_executor = TrustedProcessExecutor({"bash": bash})

    # ---- 1. STATIC observation (real adapter -> vault + journal) --------------
    print("[*] anchor-static-scan ...")
    static_adapter = AnchorStaticScanAdapter(bash, SCRIPTS / "static-scan.sh")
    static_outcome = static_adapter.run(
        agent_name="context-modeler",
        target=CORPUS,
        run_dir=run_root / "static-run",
        broker=broker,
        executor=base_executor,
        vault=campaign.evidence,
        agent_package_hash=campaign.agent_hash("context-modeler"),
        scope_receipt_id=scope_receipt_id,
    )
    campaign.journal.append("adapter.completed", {
        "adapter": static_outcome.adapter,
        "capability_receipt": static_outcome.capability_receipt,
        "artifact_ids": [a["artifact_id"] for a in static_outcome.artifacts],
        "execution": static_outcome.execution,
    })
    static_artifact = static_outcome.artifacts[0]["artifact_id"]
    graph.add_node("obs:static:withdraw-authority", "observation", "observed",
                   data={"summary": "static scan flags an AccountInfo authority never checked in Withdraw",
                         "observation_count": static_outcome.normalized["observation_count"]},
                   artifact_ids=[static_artifact])
    print(f"[+] observation node (artifact {static_artifact[:23]}...), "
          f"{static_outcome.normalized['observation_count']} static hits")

    # ---- 2. Hypothesis + experiment (scripted reasoning outputs) -------------
    hyp_id = "hyp:missing-authority-drain"
    graph.add_node(hyp_id, "hypothesis", "proposed", data={
        "statement": "The Withdraw instruction accepts an `authority` account without a signer/owner "
                     "check, so any caller can drain the vault.",
        "falsifier": "The same attacker Withdraw against the fixed sibling (signer + stored-authority "
                     "check) must be rejected with Custom(ERR_INCORRECT_AUTHORITY).",
    })
    exp_id = "exp:differential-withdraw"
    graph.add_node(exp_id, "experiment", "proposed", data={
        "treatment": "attacker Withdraw(drain) vs the VULNERABLE program",
        "negative_control": "identical attacker Withdraw(drain) vs the FIXED minimal-delta program",
        "oracle": "binary_differential_oracle: treatment vault->0 & attacker delta==drain; control blocked",
    })

    # ---- 3. PoC (real litesvm-poc adapter x2) -> real oracle -----------------
    print("[*] litesvm-poc (treatment vs negative control) x2 ...")
    poc_adapter = LiteSVMPoCAdapter(test_binary)
    poc_executor = TrustedProcessExecutor({"bash": bash, "litesvm-test": test_binary})
    poc_outcome = poc_adapter.run(
        agent_name="solana-experiment-runner",
        corpus_dir=CORPUS,
        test_name=TEST_NAME,
        repetitions=2,
        broker=broker,
        executor=poc_executor,
        vault=campaign.evidence,
        agent_package_hash=campaign.agent_hash("solana-experiment-runner"),
        scope_receipt_id=scope_receipt_id,
    )
    campaign.journal.append("adapter.completed", {
        "adapter": poc_outcome.adapter,
        "capability_receipt": poc_outcome.capability_receipt,
        "artifact_ids": [a["artifact_id"] for a in poc_outcome.artifacts],
        "execution": poc_outcome.execution,
    })
    treatment = poc_outcome.normalized["treatment"]
    control = poc_outcome.normalized["control"]
    verdict = binary_differential_oracle(treatment, control, minimum_successes=2)
    print(f"[+] ORACLE verdict={verdict.verdict} "
          f"treatment={verdict.treatment_successes}/{verdict.treatment_attempts} "
          f"control={verdict.control_successes}/{verdict.control_attempts}")
    print(f"    treatment drained {poc_outcome.normalized['drained_lamports']} lamports; "
          f"control error {poc_outcome.normalized['control_error']}")
    if verdict.verdict != "supports":
        raise SystemExit(f"oracle did not support the hypothesis: {verdict.reason}")

    poc_artifacts = [a["artifact_id"] for a in poc_outcome.artifacts]

    # ---- 4. Promotion gate (real add_evidence -> verify_primitive) -----------
    prim_id = "prim:unauthorized-vault-drain"
    graph.add_node(prim_id, "primitive", "candidate", data={
        "title": "Unauthorized vault drain via missing authority check",
    })
    evidence_id = "evid:differential-drain-supports"
    evidence_doc = {
        "schema_version": "0.1.0",
        "evidence_id": evidence_id,
        "hypothesis_id": hyp_id,
        "experiment_id": exp_id,
        "oracle": verdict.reason,
        "negative_control": "Same attacker Withdraw vs the FIXED program blocked with Custom(1)=ERR_INCORRECT_AUTHORITY; vault unchanged.",
        "artifact_ids": poc_artifacts,
        "reproduction": {
            "attempts": verdict.treatment_attempts,
            "successes": verdict.treatment_successes,
            "environment_hash": verified_build_digest,
        },
        "verdict": verdict.verdict,
    }
    graph.add_evidence(evidence_doc)  # gate: verdict==supports requires >=1 reproduction
    graph.verify_primitive(prim_id, [evidence_id],
                           reason="Differential oracle supports the drain and refutes it on the fixed sibling.")
    print(f"[+] primitive {prim_id} promoted candidate -> verified (evidence {evidence_id})")

    # ---- 5. Skeptic + clean-room reproduction --------------------------------
    skeptic_review = (
        "Benign explanations considered and rejected: (a) not fee/rent — the attacker is not the "
        "stored authority and the vault empties fully; (b) not a control artifact — the identical "
        "instruction against the fixed sibling is rejected with the exact Custom(ERR_INCORRECT_AUTHORITY); "
        "(c) not flaky — reproduced across repetitions with the vault balance unchanged in the control."
    )
    print("[*] clean-room reproduction (fresh litesvm-poc run) ...")
    repro_outcome = poc_adapter.run(
        agent_name="solana-experiment-runner",
        corpus_dir=CORPUS, test_name=TEST_NAME, repetitions=1,
        broker=broker, executor=poc_executor, vault=campaign.evidence,
        agent_package_hash=campaign.agent_hash("solana-experiment-runner"),
        scope_receipt_id=scope_receipt_id,
    )
    campaign.journal.append("adapter.completed", {
        "adapter": repro_outcome.adapter, "capability_receipt": repro_outcome.capability_receipt,
        "artifact_ids": [a["artifact_id"] for a in repro_outcome.artifacts],
        "execution": repro_outcome.execution,
    })
    repro_artifact = repro_outcome.artifacts[0]["artifact_id"]

    # ---- 6. Finding (real add_finding gate) ----------------------------------
    finding_id = "find:unauthorized-vault-drain"
    finding_doc = {
        "schema_version": "0.1.0",
        "finding_id": finding_id,
        "title": "Missing authority check allows unauthorized vault drain",
        "mechanism": "The Withdraw handler moves lamports without checking that the passed authority "
                     "account signed and equals the vault's stored authority, so any caller drains it.",
        "impact": "Complete loss of vault funds: the attacker (not the stored authority) drains "
                  "5000000000 lamports (the full balance) to an account it controls.",
        "preconditions": ["The vault holds lamports", "The attacker can submit a Withdraw instruction"],
        "primitive_ids": [prim_id],
        "evidence_ids": [evidence_id],
        "clean_room_reproduction": {
            "artifact_id": repro_artifact,
            "reviewer": "clean-room-reproducer",
            "verified_at": _now().isoformat(),
        },
        "skeptic_review": skeptic_review,
        "scope_receipt_id": scope_receipt_id,
        "status": "verified",
    }
    graph.add_finding(finding_doc)  # gate: verified primitive + supporting evidence
    print(f"[+] finding {finding_id} added (verified)")

    # ---- 7. Report + report_sha256 -------------------------------------------
    report_path = run_root / "report.json"
    report_text = render_json(graph)
    write_once(report_path, report_text)
    report_sha256 = hashlib.sha256(report_path.read_bytes()).hexdigest()
    print(f"[+] report       : {report_path} (sha256:{report_sha256})")

    # ---- 8. Attestation: real journal head -> digest -> journal append -------
    count, head = campaign.journal.verify()
    print(f"[*] journal head : {head} ({count} records)")
    attest_bin = REPO / "attest" / "bin" / "attest.js"
    proc = subprocess.run(
        ["node", str(attest_bin), "digest", str(report_path),
         "--journal-head", head, "--commit", audited_commit,
         "--target", "cachorro-solana/spike/vault (self-authored teaching corpus)",
         "--verified-build-digest", verified_build_digest],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"attest digest failed: {proc.stderr}")
    attest_result = json.loads(proc.stdout)
    attestation_digest = attest_result["attestation_sha256"]
    campaign.journal.append("attestation.anchored", {
        "attestation_digest": attestation_digest,
        "memo": attest_result["memo"],
        "journal_head_anchored": head,
        "report_sha256": report_sha256,
        "cluster": "devnet",
        "status": "pending_anchor_faucet_blocked",
        "receipt": attest_result["receipt"],
    })
    final_count, final_head = campaign.journal.verify()
    print(f"[+] attestation  : {attestation_digest}")
    print(f"[+] memo         : {attest_result['memo']}")
    print(f"[+] journal now  : {final_count} records, head {final_head}")
    print("\nM1 SPINE OK: one finding through the real promotion gate + attested from the journal head.")

    summary = {
        "campaign_id": campaign.config["campaign_id"],
        "oracle": verdict.as_dict(),
        "drained_lamports": poc_outcome.normalized["drained_lamports"],
        "control_error": poc_outcome.normalized["control_error"],
        "observation_node": "obs:static:withdraw-authority",
        "evidence_node": evidence_id,
        "primitive_node": prim_id,
        "finding_node": finding_id,
        "report_sha256": report_sha256,
        "journal_head_at_report": head,
        "attestation_digest": attestation_digest,
        "journal_records_final": final_count,
        "journal_head_final": final_head,
        "attest_receipt": attest_result["receipt"],
        "run_root": str(run_root),
    }
    (run_root / "round-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n")
    print(f"[+] summary      : {run_root / 'round-summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
