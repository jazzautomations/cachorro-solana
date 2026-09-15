#!/usr/bin/env python3
"""Create a capability-bound Docker/gVisor plan for a pinned fuzz image."""

from __future__ import annotations

from pathlib import Path

from execution import ContainerSandbox, ExecutionPlan


class ContainerFuzzAdapter:
    name = "container-fuzz"

    def __init__(self, sandbox: ContainerSandbox):
        self.sandbox = sandbox

    def plan(
        self,
        *,
        workspace: Path,
        image: str,
        argv: list[str],
        capability: str = "fuzz.execute",
        timeout_seconds: int = 3600,
    ) -> ExecutionPlan:
        workspace = workspace.resolve()
        command = self.sandbox.command(
            image=image,
            workspace=workspace,
            argv=argv,
            network=False,
        )
        return ExecutionPlan(
            adapter=self.name,
            capability=capability,
            action="harness.execute",
            target=str(workspace),
            side_effect="code_execution",
            argv=tuple(command),
            cwd=str(workspace),
            timeout_seconds=timeout_seconds,
            max_output_bytes=8_000_000,
            network=False,
        )

    def minimize_plan(
        self,
        *,
        workspace: Path,
        image: str,
        harness_binary: str,
        crash_artifact: str,
        output_artifact: str,
        timeout_seconds: int = 900,
    ) -> ExecutionPlan:
        for value in (harness_binary, crash_artifact, output_artifact):
            if not value.startswith("/") or ".." in Path(value).parts:
                raise ValueError("container fuzz paths must be absolute and traversal-free")
        return self.plan(
            workspace=workspace,
            image=image,
            argv=[
                harness_binary,
                "-minimize_crash=1",
                f"-exact_artifact_path={output_artifact}",
                f"-max_total_time={timeout_seconds}",
                crash_artifact,
            ],
            timeout_seconds=timeout_seconds + 60,
        )
