from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from capabilities import CapabilityBroker, CapabilityReceipt
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, ExecutionResult, TrustedProcessExecutor
from untrusted import envelope


@dataclass(frozen=True)
class AdapterOutcome:
    adapter: str
    capability_receipt: dict[str, object]
    execution: dict[str, object]
    artifacts: tuple[dict[str, Any], ...]
    normalized: dict[str, Any]


def execute_and_capture(
    *,
    agent_name: str,
    plan: ExecutionPlan,
    broker: CapabilityBroker,
    executor: TrustedProcessExecutor,
    vault: EvidenceVault,
    agent_package_hash: str,
    scope_receipt_id: str,
) -> tuple[CapabilityReceipt, ExecutionResult, tuple[dict[str, Any], ...]]:
    capability = broker.authorize(agent_name, plan)
    result = executor.run(plan, capability.plan_digest)
    base = {
        "tool": plan.adapter,
        "tool_version": "adapter-0.1.0",
        "agent_package_hash": agent_package_hash,
        "scope_receipt_id": scope_receipt_id,
    }
    stdout = vault.put(
        result.stdout,
        media_type="application/octet-stream",
        source=f"{plan.adapter}:stdout",
        **base,
    )
    stderr = vault.put(
        result.stderr,
        media_type="application/octet-stream",
        source=f"{plan.adapter}:stderr",
        **base,
    )
    return capability, result, (stdout, stderr)


def execution_dict(result: ExecutionResult) -> dict[str, object]:
    value = asdict(result)
    value.pop("stdout")
    value.pop("stderr")
    return value


def untrusted_json(data: bytes) -> dict[str, Any]:
    return envelope(data).as_dict()

