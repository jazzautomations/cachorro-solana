#!/usr/bin/env python3
"""Read-only Anchor/Solana static-scan adapter.

Wraps cachorro's existing ``scripts/static-scan.sh`` (cargo-audit + grep-based
Anchor lint heuristics) as a bounded capability. It analyses source only — it
never compiles the target, so it does not trigger ``build.rs`` — and emits
graph *observations*, never findings. Same contract as ``git_history.py``:
``plan() -> ExecutionPlan`` executed through ``execute_and_capture`` (broker
authorize -> trusted executor -> evidence vault -> journal).
"""

from __future__ import annotations

from pathlib import Path

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict


class AnchorStaticScanAdapter:
    name = "anchor-static-scan"
    capability = "static.anchor.scan"
    action = "static.anchor.scan"

    def __init__(self, bash: Path, script: Path):
        self.bash = bash.resolve()
        self.script = script.resolve()

    def plan(self, target: Path, run_dir: Path) -> ExecutionPlan:
        target = target.resolve()
        run_dir = run_dir.resolve()
        if not target.is_dir():
            raise ValueError(f"static-scan target is not a directory: {target}")
        run_dir.mkdir(parents=True, exist_ok=True)
        return ExecutionPlan(
            adapter=self.name,
            capability=self.capability,
            action=self.action,
            target=str(target),
            side_effect="workspace_write",
            argv=(str(self.bash), str(self.script), str(target), str(run_dir)),
            cwd=str(target),
            timeout_seconds=240,
            max_output_bytes=4_000_000,
            # HOME + SKIP_CLIPPY keep the scan deterministic under the executor's
            # minimal env: grep heuristics are the observation signal; the heavy
            # clippy compile (which needs the anchor toolchain) is skipped.
            environment={"HOME": "/root", "SKIP_CLIPPY": "1"},
        )

    def run(
        self,
        *,
        agent_name: str,
        target: Path,
        run_dir: Path,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
    ) -> AdapterOutcome:
        plan = self.plan(target, run_dir)
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        static_dir = run_dir.resolve() / "static"
        base = {
            "tool": self.name,
            "tool_version": "adapter-0.1.0",
            "agent_package_hash": agent_package_hash,
            "scope_receipt_id": scope_receipt_id,
        }
        sections: dict[str, str] = {}
        extra_artifacts: list[dict[str, object]] = []
        for report_name in ("grep_lints.txt", "summary.txt", "zk_surface.txt"):
            report_path = static_dir / report_name
            if not report_path.is_file():
                continue
            data = report_path.read_bytes()
            sections[report_name] = data.decode("utf-8", errors="replace")
            extra_artifacts.append(
                vault.put(data, media_type="text/plain", source=f"{self.name}:{report_name}", **base)
            )

        lints = sections.get("grep_lints.txt", "")
        current_header = "preamble"
        observations: list[dict[str, object]] = []
        for line in lints.splitlines():
            stripped = line.strip()
            if stripped.startswith("###"):
                current_header = stripped.strip("# ").strip()
            elif stripped and ":" in stripped and current_header != "preamble":
                observations.append({"lint": current_header, "hit": stripped[:400]})

        normalized = {
            "classification": "static_observations",
            "candidate_only": True,
            "target": str(target.resolve()),
            "sections": sorted(sections.keys()),
            "summary": sections.get("summary.txt", "").strip(),
            "observation_count": len(observations),
            "observations": observations,
        }
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=tuple(artifacts) + tuple(extra_artifacts),
            normalized=normalized,
        )
