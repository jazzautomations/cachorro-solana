#!/usr/bin/env python3
"""Campaign workspace that composes scope, scheduling, journal, graph and evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from evidence_vault import EvidenceVault
from journal import RoundJournal
from research_graph import ResearchGraph
from scheduler import RankedProposal, select_portfolio, validate_proposals
from scope import ScopeDenied, ScopeGuard
from scope_signing import load_public_key, public_key_id
from validate_bundle import validate_bundle


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _write_once(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as handle:
            handle.write(data)
    except FileExistsError:
        if path.read_bytes() != data:
            raise RuntimeError(f"refusing to overwrite campaign state: {path}")


def _tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    excluded = {".git", "__pycache__", ".pytest_cache", "dist", "workspaces"}
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        if not path.is_file() or path.is_symlink() or any(part in excluded for part in path.relative_to(root).parts):
            continue
        relative = path.relative_to(root).as_posix().encode("utf-8")
        digest.update(relative + b"\0" + hashlib.sha256(path.read_bytes()).digest() + b"\n")
    return f"sha256:{digest.hexdigest()}"


class Campaign:
    def __init__(self, bundle_root: Path, workspace: Path):
        self.bundle_root = bundle_root.resolve()
        self.workspace = workspace.resolve()
        config_path = self.workspace / "campaign.json"
        if not config_path.is_file():
            raise FileNotFoundError(f"campaign is not initialized: {self.workspace}")
        self.config = json.loads(config_path.read_text(encoding="utf-8"))
        current_hash = _tree_hash(self.bundle_root)
        if current_hash != self.config["framework_hash"]:
            raise RuntimeError(
                "framework source changed after campaign initialization; start a new campaign or restore the pinned bundle"
            )
        trusted_keys = [
            load_public_key(path)
            for path in sorted((self.workspace / "scope/trusted_keys").glob("*.pem"))
        ]
        self.guard = ScopeGuard.from_files(
            self.workspace / "scope/receipt.json",
            self.bundle_root / "schemas/scope-receipt.schema.json",
            trusted_keys=trusted_keys,
            require_signature=True,
        )
        self.journal = RoundJournal(self.workspace / "journal/rounds.jsonl")
        self.graph = ResearchGraph(self.workspace / "graph/research.sqlite3", self.bundle_root / "schemas")
        self.evidence = EvidenceVault(self.workspace / "evidence")

    @classmethod
    def initialize(
        cls,
        bundle_root: Path,
        workspace: Path,
        receipt_path: Path,
        trusted_public_keys: list[Path],
    ) -> "Campaign":
        bundle_root = bundle_root.resolve()
        workspace = workspace.resolve()
        if workspace.exists() and any(workspace.iterdir()):
            raise FileExistsError(f"campaign workspace must be empty: {workspace}")
        validation = validate_bundle(bundle_root)
        if not validation.ok:
            raise ValueError("cannot initialize campaign from an invalid bundle:\n" + "\n".join(validation.errors))
        workspace.mkdir(parents=True, exist_ok=True)

        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        schema = json.loads((bundle_root / "schemas/scope-receipt.schema.json").read_text(encoding="utf-8"))
        if not trusted_public_keys:
            raise ValueError("at least one trusted scope-authority public key is required")
        public_keys = [load_public_key(path) for path in trusted_public_keys]
        guard = ScopeGuard(receipt, schema, trusted_keys=public_keys, require_signature=True)
        now = datetime.now(timezone.utc)
        if now < guard.issued or now >= guard.expires:
            raise ScopeDenied("scope receipt is not currently active")

        receipt_bytes = _canonical(receipt) + b"\n"
        receipt_hash = f"sha256:{hashlib.sha256(_canonical(receipt)).hexdigest()}"
        framework = __import__("yaml").safe_load((bundle_root / "framework.yaml").read_text(encoding="utf-8"))
        config = {
            "schema_version": "0.1.0",
            "campaign_id": f"campaign:{receipt['receipt_id']}",
            "scope_receipt_id": receipt["receipt_id"],
            "scope_receipt_hash": receipt_hash,
            "framework_version": framework["version"],
            "framework_hash": _tree_hash(bundle_root),
            "created_at": now.isoformat(),
        }
        _write_once(workspace / "scope/receipt.json", receipt_bytes)
        for path, key in zip(trusted_public_keys, public_keys, strict=True):
            key_name = public_key_id(key).split(":", 1)[1]
            _write_once(workspace / f"scope/trusted_keys/{key_name}.pem", path.read_bytes())
        _write_once(workspace / "campaign.json", _canonical(config) + b"\n")
        campaign = cls(bundle_root, workspace)
        campaign.journal.append("campaign.started", config)
        return campaign

    def schedule(self, proposals: list[dict[str, Any]], *, slots: int) -> dict[str, Any]:
        schema = json.loads((self.bundle_root / "schemas/proposal.schema.json").read_text(encoding="utf-8"))
        validated = validate_proposals(proposals, schema)
        authorized: list[dict[str, Any]] = []
        rejected: list[dict[str, str]] = []
        for proposal in validated:
            try:
                self.guard.authorize(
                    proposal["action"],
                    proposal["target"],
                    side_effect=proposal["side_effect"],
                )
                authorized.append(proposal)
            except (ScopeDenied, ValueError) as exc:
                rejected.append({"proposal_id": proposal["proposal_id"], "reason": str(exc)})

        selected: list[RankedProposal] = select_portfolio(
            authorized,
            slots,
            orthogonal_slots=1 if slots > 1 else 0,
        )
        result = {
            "graph_revision": self.graph.revision(),
            "selected": [
                {"proposal_id": item.proposal["proposal_id"], "lane": item.proposal["lane"], "score": item.score}
                for item in selected
            ],
            "rejected": rejected,
            "deferred": [
                proposal["proposal_id"]
                for proposal in authorized
                if proposal["proposal_id"] not in {item.proposal["proposal_id"] for item in selected}
            ],
        }
        self.journal.append("portfolio.scheduled", result)
        return result

    def record_round(self, document: dict[str, Any]) -> dict[str, Any]:
        import jsonschema

        schema = json.loads((self.bundle_root / "schemas/round.schema.json").read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator(schema).validate(document)
        if document["scope_receipt_id"] != self.config["scope_receipt_id"]:
            raise ScopeDenied("round references a different scope receipt")
        if document["agent_package_hash"] != self.agent_hash(document["agent_name"]):
            raise ValueError("round agent_package_hash does not match the selected agent folder")
        if document["graph_revision_in"] > document["graph_revision_out"]:
            raise ValueError("round graph revision cannot move backwards")
        if document["graph_revision_out"] != self.graph.revision():
            raise ValueError("round graph_revision_out does not match persisted graph")
        return self.journal.append("round.completed", document)

    def agent_hash(self, agent_name: str) -> str:
        agent_dir = self.bundle_root / "agents" / agent_name
        if not agent_dir.is_dir() or not (agent_dir / "manifest.yaml").is_file():
            raise KeyError(f"unknown agent package: {agent_name}")
        return _tree_hash(agent_dir)

    def status(self) -> dict[str, Any]:
        count, head = self.journal.verify()
        return {
            "campaign_id": self.config["campaign_id"],
            "scope_receipt_id": self.config["scope_receipt_id"],
            "journal_records": count,
            "journal_head": head,
            "graph_revision": self.graph.revision(),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    init = subparsers.add_parser("init")
    init.add_argument("bundle", type=Path)
    init.add_argument("workspace", type=Path)
    init.add_argument("receipt", type=Path)
    init.add_argument("--trusted-key", action="append", required=True, type=Path)
    schedule = subparsers.add_parser("schedule")
    schedule.add_argument("bundle", type=Path)
    schedule.add_argument("workspace", type=Path)
    schedule.add_argument("proposals", type=Path)
    schedule.add_argument("--slots", type=int, default=2)
    status = subparsers.add_parser("status")
    status.add_argument("bundle", type=Path)
    status.add_argument("workspace", type=Path)
    args = parser.parse_args()

    try:
        if args.command == "init":
            result = Campaign.initialize(
                args.bundle,
                args.workspace,
                args.receipt,
                args.trusted_key,
            ).status()
        elif args.command == "schedule":
            campaign = Campaign(args.bundle, args.workspace)
            proposals = json.loads(args.proposals.read_text(encoding="utf-8"))
            result = campaign.schedule(proposals, slots=args.slots)
        else:
            result = Campaign(args.bundle, args.workspace).status()
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
