#!/usr/bin/env python3
"""Run one contracted agent package through an operator-provided model bridge."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from agent_runner import AgentRegistry, AgentRunner, CommandProvider
from campaign import Campaign


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("agent")
    parser.add_argument("input", type=Path)
    parser.add_argument("--emit-event")
    parser.add_argument("--provider-command", nargs=argparse.REMAINDER, required=True)
    args = parser.parse_args()
    if not args.provider_command:
        parser.error("--provider-command requires an executable and arguments")
    try:
        campaign = Campaign(args.bundle, args.workspace)
        registry = AgentRegistry(args.bundle)
        runner = AgentRunner(
            registry,
            CommandProvider(args.provider_command),
            campaign.journal,
            campaign.evidence,
            scope_receipt_id=campaign.config["scope_receipt_id"],
            agent_hasher=campaign.agent_hash,
        )
        result = runner.run(args.agent, json.loads(args.input.read_text(encoding="utf-8")))
        if args.emit_event:
            registry.assert_emits(args.agent, args.emit_event)
            campaign.journal.append(
                "agent.event",
                {"agent_name": args.agent, "event": args.emit_event, "consumers": registry.consumers(args.emit_event)},
            )
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

