#!/usr/bin/env python3
"""In-process differential Solana PoC adapter (the M1 escape hatch).

Runs a Rust differential PoC (``solana-program-test`` / litesvm / gmsol-model
style) that executes the SAME attacker instruction against a VULNERABLE and a
FIXED build of the target in one in-process runtime. Because the corpus is one
**we** compiled ourselves, the PoC runs as a TRUSTED PROCESS through
``TrustedProcessExecutor`` (a pinned test binary), so M1 needs NEITHER a runsc
sandbox NOR a validator NOR the devnet faucet. (Running an *untrusted*
third-party target build is the M2 gate: ``code_execution`` side-effect +
Ed25519 approval + ``ContainerSandbox`` runsc — see docs/ENGINE.md.)

The adapter only *measures*: per repetition it parses the PoC's treatment and
control outcome markers into booleans. The causal decision is made by the real
v3 ``oracles.binary_differential_oracle`` in the round driver — this adapter
never asserts a verdict itself.
"""

from __future__ import annotations

import re
from pathlib import Path

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict


_ORACLE = re.compile(rb"treatment_successes=(\d+)\s+control_successes=(\d+)")
_DRAIN = re.compile(rb"attacker dest lamports \d+ -> \d+ \(delta \+(\d+)\)")
_VAULT = re.compile(rb"\[TREATMENT vulnerable\] vault lamports (\d+) -> (\d+)")
_CONTROL_ERR = re.compile(rb"\[CONTROL fixed\] result=(Err\([^\n]*)")


class LiteSVMPoCAdapter:
    name = "litesvm-poc"
    capability = "experiment.solana.poc"
    action = "experiment.solana.poc"

    def __init__(self, test_binary: Path):
        self.test_binary = test_binary.resolve()

    def plan(self, corpus_dir: Path, test_name: str) -> ExecutionPlan:
        corpus_dir = corpus_dir.resolve()
        if not corpus_dir.is_dir():
            raise ValueError(f"corpus dir does not exist: {corpus_dir}")
        if not re.fullmatch(r"[A-Za-z0-9_]{1,120}", test_name):
            raise ValueError("unsafe test name")
        return ExecutionPlan(
            adapter=self.name,
            capability=self.capability,
            action=self.action,
            target=str(corpus_dir),
            # M1: trusted, self-compiled corpus -> workspace_write, no approval.
            side_effect="workspace_write",
            argv=(str(self.test_binary), "--exact", test_name, "--nocapture", "--test-threads", "1"),
            cwd=str(corpus_dir),
            timeout_seconds=120,
            max_output_bytes=2_000_000,
            environment={"HOME": "/root"},
        )

    def _parse(self, stdout: bytes) -> dict[str, object]:
        oracle = _ORACLE.search(stdout)
        drain = _DRAIN.search(stdout)
        vault = _VAULT.search(stdout)
        control_err = _CONTROL_ERR.search(stdout)
        treatment_ok = bool(oracle) and int(oracle.group(1)) >= 1
        control_ok = bool(oracle) and int(oracle.group(2)) >= 1
        return {
            "treatment_success": treatment_ok,
            "control_success": control_ok,
            "drained_lamports": int(drain.group(1)) if drain else 0,
            "vault_before": int(vault.group(1)) if vault else None,
            "vault_after": int(vault.group(2)) if vault else None,
            "control_error": control_err.group(1).decode("utf-8", "replace")[:200] if control_err else None,
        }

    def run(
        self,
        *,
        agent_name: str,
        corpus_dir: Path,
        test_name: str,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
        repetitions: int = 2,
    ) -> AdapterOutcome:
        if not 1 <= repetitions <= 5:
            raise ValueError("repetitions must be between 1 and 5")
        plan = self.plan(corpus_dir, test_name)
        treatment: list[bool] = []
        control: list[bool] = []
        runs: list[dict[str, object]] = []
        artifacts: list[dict[str, object]] = []
        receipts: list[dict[str, object]] = []
        for repetition in range(1, repetitions + 1):
            capability, result, captured = execute_and_capture(
                agent_name=agent_name,
                plan=plan,
                broker=broker,
                executor=executor,
                vault=vault,
                agent_package_hash=agent_package_hash,
                scope_receipt_id=scope_receipt_id,
            )
            parsed = self._parse(result.stdout)
            treatment.append(bool(parsed["treatment_success"]))
            control.append(bool(parsed["control_success"]))
            runs.append(
                {
                    "repetition": repetition,
                    "returncode": result.returncode,
                    "artifact_ids": [item["artifact_id"] for item in captured],
                    **parsed,
                }
            )
            artifacts.extend(captured)
            receipts.append(capability.as_dict())

        drained = max((int(r["drained_lamports"]) for r in runs), default=0)
        control_error = next((r["control_error"] for r in runs if r["control_error"]), None)
        normalized = {
            "classification": "candidate_solana_poc",
            "candidate_only": True,
            "test_name": test_name,
            "repetitions": repetitions,
            # boolean vectors consumed by the real v3 binary_differential_oracle
            "treatment": treatment,
            "control": control,
            "drained_lamports": drained,
            "control_error": control_error,
            "runs": runs,
        }
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt={"runs": receipts},
            execution=execution_dict(result),
            artifacts=tuple(artifacts),
            normalized=normalized,
        )
