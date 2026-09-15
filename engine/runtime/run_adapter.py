#!/usr/bin/env python3
"""Execute a built-in bounded adapter through scope and capability mediation."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from campaign import Campaign
from capabilities import CapabilityBroker
from dns_guard import DNSGuard
from execution import TrustedProcessExecutor
from toolpacks.adapters.git_history import GitHistoryAdapter
from toolpacks.adapters.hexstrike_passive import HexStrikePassiveAdapter, PROFILES
from toolpacks.adapters.http_observe import HTTPObserveAdapter
from toolpacks.adapters.sqli_differential import SQLiDifferentialAdapter
from toolpacks.adapters.source_search import SourceSearchAdapter
from toolpacks.adapters.anchor_static_scan import AnchorStaticScanAdapter
from toolpacks.adapters.solana_program_dump import SolanaProgramDumpAdapter
from toolpacks.adapters.litesvm_poc import LiteSVMPoCAdapter

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("workspace", type=Path)
    commands = parser.add_subparsers(dest="command", required=True)
    source = commands.add_parser("source-search")
    source.add_argument("root", type=Path)
    source.add_argument("query")
    history = commands.add_parser("git-history")
    history.add_argument("repository", type=Path)
    history.add_argument("--revision", default="HEAD")
    http = commands.add_parser("http-observe")
    http.add_argument("url")
    http.add_argument("--method", choices=("GET", "HEAD"), default="GET")
    sqli = commands.add_parser("sqli-differential")
    sqli.add_argument("url")
    sqli.add_argument("parameter")
    sqli.add_argument("--repetitions", type=int, choices=(1, 2, 3), default=2)
    sqli.add_argument("--delay-seconds", type=float, default=12.0)
    hexstrike = commands.add_parser("hexstrike-passive")
    hexstrike.add_argument("profile", choices=tuple(sorted(PROFILES)))
    hexstrike.add_argument("target")
    hexstrike.add_argument("--server-url", default="http://127.0.0.1:8888")
    static = commands.add_parser("anchor-static-scan")
    static.add_argument("target", type=Path)
    static.add_argument("run_dir", type=Path)
    dump = commands.add_parser("solana-program-dump")
    dump.add_argument("program_id")
    dump.add_argument("cluster")
    dump.add_argument("dest", type=Path)
    litesvm = commands.add_parser("litesvm-poc")
    litesvm.add_argument("test_binary", type=Path)
    litesvm.add_argument("corpus_dir", type=Path)
    litesvm.add_argument("test_name")
    litesvm.add_argument("--repetitions", type=int, default=2)
    args = parser.parse_args()
    try:
        campaign = Campaign(args.bundle, args.workspace)
        paths = TrustedProcessExecutor.discover(["rg", "git", "curl", "bash"])
        executor = TrustedProcessExecutor(paths)
        dns = DNSGuard()
        broker = CapabilityBroker(args.bundle, campaign.guard, campaign.agent_hash, dns_guard=dns)
        common = {
            "broker": broker,
            "executor": executor,
            "vault": campaign.evidence,
            "scope_receipt_id": campaign.config["scope_receipt_id"],
        }
        if args.command == "source-search":
            adapter = SourceSearchAdapter(paths["rg"])
            outcome = adapter.run(
                agent_name="context-modeler",
                root=args.root,
                query=args.query,
                agent_package_hash=campaign.agent_hash("context-modeler"),
                **common,
            )
        elif args.command == "git-history":
            adapter = GitHistoryAdapter(paths["git"])
            outcome = adapter.run(
                agent_name="patch-archaeologist",
                repository=args.repository,
                revision=args.revision,
                agent_package_hash=campaign.agent_hash("patch-archaeologist"),
                **common,
            )
        elif args.command == "http-observe":
            adapter = HTTPObserveAdapter(paths["curl"], dns)
            outcome = adapter.run(
                agent_name="cartographer",
                url=args.url,
                method=args.method,
                scope_guard=campaign.guard,
                agent_package_hash=campaign.agent_hash("cartographer"),
                **common,
            )
        elif args.command == "sqli-differential":
            adapter = SQLiDifferentialAdapter(paths["curl"], dns)
            outcome = adapter.run(
                agent_name="web-experiment-runner",
                url=args.url,
                parameter=args.parameter,
                repetitions=args.repetitions,
                delay_seconds=args.delay_seconds,
                scope_guard=campaign.guard,
                agent_package_hash=campaign.agent_hash("web-experiment-runner"),
                **common,
            )
        elif args.command == "anchor-static-scan":
            adapter = AnchorStaticScanAdapter(paths["bash"], SCRIPTS / "static-scan.sh")
            outcome = adapter.run(
                agent_name="context-modeler",
                target=args.target,
                run_dir=args.run_dir,
                agent_package_hash=campaign.agent_hash("context-modeler"),
                **common,
            )
        elif args.command == "solana-program-dump":
            adapter = SolanaProgramDumpAdapter(paths["bash"], SCRIPTS / "fetch-target.sh")
            outcome = adapter.run(
                agent_name="cartographer",
                program_id=args.program_id,
                cluster=args.cluster,
                dest=args.dest,
                agent_package_hash=campaign.agent_hash("cartographer"),
                **common,
            )
        elif args.command == "litesvm-poc":
            binary = args.test_binary.resolve()
            adapter = LiteSVMPoCAdapter(binary)
            poc_executor = TrustedProcessExecutor({**paths, "litesvm-test": binary})
            outcome = adapter.run(
                agent_name="solana-experiment-runner",
                corpus_dir=args.corpus_dir,
                test_name=args.test_name,
                repetitions=args.repetitions,
                broker=broker,
                executor=poc_executor,
                vault=campaign.evidence,
                scope_receipt_id=campaign.config["scope_receipt_id"],
                agent_package_hash=campaign.agent_hash("solana-experiment-runner"),
            )
        else:
            adapter = HexStrikePassiveAdapter(args.server_url)
            outcome = adapter.run(
                agent_name="cartographer",
                profile_name=args.profile,
                target=args.target,
                scope_guard=campaign.guard,
                broker=broker,
                vault=campaign.evidence,
                agent_package_hash=campaign.agent_hash("cartographer"),
                scope_receipt_id=campaign.config["scope_receipt_id"],
            )
        document = asdict(outcome)
        campaign.journal.append(
            "adapter.completed",
            {
                "adapter": outcome.adapter,
                "capability_receipt": outcome.capability_receipt,
                "artifact_ids": [item["artifact_id"] for item in outcome.artifacts],
                "execution": outcome.execution,
            },
        )
        print(json.dumps(document, indent=2, sort_keys=True))
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
