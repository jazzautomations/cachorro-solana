#!/usr/bin/env python3
"""Read-only git history adapter with bounded output."""

from __future__ import annotations

import re
from pathlib import Path

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict, untrusted_json


SAFE_REVISION = re.compile(r"^(HEAD|[a-f0-9]{7,64}|[A-Za-z0-9._/-]{1,120})$")


class GitHistoryAdapter:
    name = "git-history"

    def __init__(self, git: Path):
        self.git = git.resolve()

    def plan(self, repository: Path, *, revision: str = "HEAD", limit: int = 100) -> ExecutionPlan:
        repository = repository.resolve()
        if not SAFE_REVISION.fullmatch(revision) or revision.startswith("-") or ".." in revision:
            raise ValueError("unsafe git revision")
        if not 1 <= limit <= 1000:
            raise ValueError("git history limit must be between 1 and 1000")
        return ExecutionPlan(
            adapter=self.name,
            capability="history.reconstruct",
            action="history.read",
            target=str(repository),
            side_effect="workspace_write",
            argv=(
                str(self.git), "-C", str(repository), "--no-pager", "log", "--no-decorate",
                "--no-show-signature", f"--max-count={limit}",
                "--format=%H%x09%aI%x09%P%x09%s", revision,
            ),
            cwd=str(repository),
            timeout_seconds=120,
            max_output_bytes=4_000_000,
        )

    def run(
        self,
        *,
        agent_name: str,
        repository: Path,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
        revision: str = "HEAD",
    ) -> AdapterOutcome:
        plan = self.plan(repository, revision=revision)
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        commits = []
        for line in result.stdout.splitlines():
            parts = line.decode("utf-8", errors="replace").split("\t", 3)
            if len(parts) == 4:
                commits.append(
                    {"commit": parts[0], "authored_at": parts[1], "parents": parts[2].split(), "subject": untrusted_json(parts[3].encode())}
                )
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=artifacts,
            normalized={"commits": commits},
        )
