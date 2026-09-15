#!/usr/bin/env python3
"""Plan or execute an approved, digest-pinned, networkless fuzz container."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from approvals import ApprovalDirectory  # noqa: E402
from campaign import Campaign  # noqa: E402
from capabilities import CapabilityBroker  # noqa: E402
from execution import ContainerSandbox, ExecutionPlan, TrustedProcessExecutor  # noqa: E402
from scope_signing import load_public_key  # noqa: E402
from toolpacks.adapters.container_fuzz import ContainerFuzzAdapter  # noqa: E402


def write_once(path: Path, value: dict) -> None:
    if path.exists():
        raise FileExistsError(f"refusing to overwrite: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_plan(path: Path) -> ExecutionPlan:
    value = json.loads(path.read_text(encoding="utf-8"))
    value["argv"] = tuple(value["argv"])
    return ExecutionPlan(**value)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    plan_command = commands.add_parser("plan")
    plan_command.add_argument("workspace", type=Path)
    plan_command.add_argument("image")
    plan_command.add_argument("output", type=Path)
    plan_command.add_argument("container_argv", nargs=argparse.REMAINDER)
    execute = commands.add_parser("execute")
    execute.add_argument("bundle", type=Path)
    execute.add_argument("campaign_workspace", type=Path)
    execute.add_argument("plan", type=Path)
    execute.add_argument("approval", type=Path)
    execute.add_argument("--trusted-key", action="append", required=True, type=Path)
    args = parser.parse_args()
    try:
        docker = shutil.which("docker")
        if not docker:
            raise RuntimeError("docker is unavailable")
        adapter = ContainerFuzzAdapter(ContainerSandbox(Path(docker), runtime="runsc"))
        if args.command == "plan":
            if not args.container_argv:
                raise ValueError("container argv cannot be empty")
            plan = adapter.plan(
                workspace=args.workspace,
                image=args.image,
                argv=args.container_argv,
            )
            write_once(args.output, asdict(plan))
            result = {"plan": str(args.output), "plan_digest": plan.digest}
        else:
            runtime_check = subprocess.run(
                [docker, "info", "--format", "{{json .Runtimes}}"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            runtimes = json.loads(runtime_check.stdout) if runtime_check.returncode == 0 else {}
            if "runsc" not in runtimes:
                raise RuntimeError("strong sandbox runtime runsc is unavailable; refusing code execution")
            campaign = Campaign(args.bundle, args.campaign_workspace)
            plan = load_plan(args.plan)
            approval_document = json.loads(args.approval.read_text(encoding="utf-8"))
            approval_dir = args.approval.parent
            expected_path = approval_dir / f"{approval_document['approval_id']}.json"
            if expected_path.resolve() != args.approval.resolve():
                raise ValueError("approval filename must be <approval_id>.json")
            verifier = ApprovalDirectory(
                approval_dir,
                args.bundle / "schemas/approval.schema.json",
                [load_public_key(path) for path in args.trusted_key],
                campaign.config["scope_receipt_id"],
            )
            broker = CapabilityBroker(
                args.bundle,
                campaign.guard,
                campaign.agent_hash,
                approval_verifier=verifier.verify,
            )
            capability = broker.authorize(
                "fuzz-campaign",
                plan,
                approval_id=approval_document["approval_id"],
            )
            executor = TrustedProcessExecutor({"docker": Path(docker)})
            execution = executor.run(plan, capability.plan_digest)
            artifact_common = {
                "tool": "container-fuzz",
                "tool_version": "adapter-0.1.0",
                "agent_package_hash": campaign.agent_hash("fuzz-campaign"),
                "scope_receipt_id": campaign.config["scope_receipt_id"],
            }
            stdout = campaign.evidence.put(
                execution.stdout,
                media_type="application/octet-stream",
                source="container-fuzz:stdout",
                **artifact_common,
            )
            stderr = campaign.evidence.put(
                execution.stderr,
                media_type="application/octet-stream",
                source="container-fuzz:stderr",
                **artifact_common,
            )
            result = {
                "capability_receipt": capability.as_dict(),
                "returncode": execution.returncode,
                "timed_out": execution.timed_out,
                "truncated": execution.truncated,
                "artifact_ids": [stdout["artifact_id"], stderr["artifact_id"]],
            }
            campaign.journal.append("fuzz.execution", result)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
