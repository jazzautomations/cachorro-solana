#!/usr/bin/env python3
"""Bounded ripgrep JSON adapter for exact source retrieval."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict, untrusted_json


class SourceSearchAdapter:
    name = "source-browser"

    def __init__(self, rg: Path):
        self.rg = rg.resolve()

    def plan(self, root: Path, query: str, *, capability: str = "context.compile", max_count: int = 500) -> ExecutionPlan:
        root = root.resolve()
        if not 1 <= len(query) <= 500:
            raise ValueError("source query length must be between 1 and 500")
        if not 1 <= max_count <= 5000:
            raise ValueError("max_count must be between 1 and 5000")
        return ExecutionPlan(
            adapter=self.name,
            capability=capability,
            action="source.read",
            target=str(root),
            side_effect="workspace_write",
            argv=(
                str(self.rg), "--json", "--no-config", "--hidden", "--glob", "!.git/**",
                "--max-count", str(max_count), "--", query, str(root),
            ),
            cwd=str(root),
            timeout_seconds=120,
            max_output_bytes=4_000_000,
        )

    @staticmethod
    def _normalize(stdout: bytes) -> dict[str, Any]:
        matches: list[dict[str, Any]] = []
        malformed = 0
        for raw in stdout.splitlines():
            try:
                item = json.loads(raw)
            except json.JSONDecodeError:
                malformed += 1
                continue
            if item.get("type") != "match":
                continue
            data = item["data"]
            matches.append(
                {
                    "path": data["path"].get("text"),
                    "line_number": data.get("line_number"),
                    "lines": untrusted_json(data["lines"].get("text", "").encode()),
                    "submatches": data.get("submatches", []),
                }
            )
        return {"matches": matches, "malformed_records": malformed}

    def run(
        self,
        *,
        agent_name: str,
        root: Path,
        query: str,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
    ) -> AdapterOutcome:
        plan = self.plan(root, query)
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=artifacts,
            normalized=self._normalize(result.stdout),
        )
