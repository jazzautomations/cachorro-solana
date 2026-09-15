#!/usr/bin/env python3
"""Command plans, bounded trusted execution and hardened container execution."""

from __future__ import annotations

import hashlib
import json
import os
import resource
import shutil
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True)
class ExecutionPlan:
    adapter: str
    capability: str
    action: str
    target: str
    side_effect: str
    argv: tuple[str, ...]
    cwd: str
    timeout_seconds: int = 60
    max_output_bytes: int = 2_000_000
    network: bool = False
    control_plane: str | None = None
    environment: dict[str, str] = field(default_factory=dict)

    @property
    def digest(self) -> str:
        return f"sha256:{hashlib.sha256(_canonical(asdict(self))).hexdigest()}"


@dataclass(frozen=True)
class ExecutionResult:
    plan_digest: str
    returncode: int
    stdout: bytes
    stderr: bytes
    timed_out: bool
    truncated: bool


class TrustedProcessExecutor:
    """Execute pinned host tools. This is not a sandbox for untrusted code."""

    def __init__(self, allowed_executables: dict[str, Path]):
        self.allowed = {name: path.resolve() for name, path in allowed_executables.items()}

    @staticmethod
    def discover(names: list[str]) -> dict[str, Path]:
        found: dict[str, Path] = {}
        for name in names:
            path = shutil.which(name)
            if path:
                found[name] = Path(path)
        return found

    @staticmethod
    def _limits() -> None:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024 * 1024, 64 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
        resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))

    def run(self, plan: ExecutionPlan, authorized_plan_digest: str) -> ExecutionResult:
        if plan.digest != authorized_plan_digest:
            raise PermissionError("execution plan changed after capability authorization")
        if not plan.argv:
            raise ValueError("execution plan has no argv")
        executable = Path(plan.argv[0]).resolve()
        if executable not in self.allowed.values():
            raise PermissionError(f"executable is not pinned in trusted adapter allowlist: {executable}")
        cwd = Path(plan.cwd).resolve()
        if not cwd.is_dir():
            raise ValueError(f"execution cwd is not a directory: {cwd}")
        environment = {
            "PATH": os.pathsep.join(sorted({str(path.parent) for path in self.allowed.values()})),
            "LANG": "C.UTF-8",
            "LC_ALL": "C.UTF-8",
            **plan.environment,
        }
        with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
            process = subprocess.Popen(
                plan.argv,
                cwd=cwd,
                env=environment,
                stdin=subprocess.DEVNULL,
                stdout=stdout,
                stderr=stderr,
                shell=False,
                start_new_session=True,
                preexec_fn=self._limits,
            )
            timed_out = False
            try:
                process.wait(timeout=plan.timeout_seconds)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(process.pid, 9)
                process.wait()
            stdout.seek(0)
            stderr.seek(0)
            out = stdout.read(plan.max_output_bytes + 1)
            err = stderr.read(plan.max_output_bytes + 1)
        truncated = len(out) > plan.max_output_bytes or len(err) > plan.max_output_bytes
        return ExecutionResult(
            plan_digest=plan.digest,
            returncode=process.returncode,
            stdout=out[: plan.max_output_bytes],
            stderr=err[: plan.max_output_bytes],
            timed_out=timed_out,
            truncated=truncated,
        )


class ContainerSandbox:
    """Build a fail-closed Docker/gVisor command for untrusted code execution."""

    def __init__(self, docker: Path, *, runtime: str = "runsc"):
        self.docker = docker.resolve()
        self.runtime = runtime

    def command(
        self,
        *,
        image: str,
        workspace: Path,
        argv: list[str],
        network: bool = False,
        memory: str = "1g",
        cpus: str = "1",
        pids_limit: int = 128,
    ) -> list[str]:
        if "@sha256:" not in image:
            raise ValueError("sandbox image must be pinned by sha256 digest")
        if network:
            raise PermissionError("untrusted-code sandbox has no direct network; use mediated adapters")
        workspace = workspace.resolve()
        if not workspace.is_dir():
            raise ValueError("sandbox workspace must exist")
        return [
            str(self.docker), "run", "--rm", "--runtime", self.runtime,
            "--network", "none", "--read-only", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges", "--pids-limit", str(pids_limit),
            "--memory", memory, "--cpus", cpus,
            "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=256m",
            "--mount", f"type=bind,src={workspace},dst=/workspace,readonly=false",
            "--workdir", "/workspace", image, *argv,
        ]
