#!/usr/bin/env python3
"""Report framework, adapter and strong-sandbox readiness."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import shutil
import subprocess
from pathlib import Path

from validate_bundle import validate_bundle


def doctor(bundle: Path) -> dict[str, object]:
    validation = validate_bundle(bundle)
    commands = {
        name: shutil.which(name)
        for name in ("rg", "git", "curl", "docker", "runsc", "semgrep", "codeql", "joern")
    }
    packages = {}
    for name in ("PyYAML", "jsonschema", "cryptography"):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    docker_runtimes: list[str] = []
    if commands["docker"]:
        try:
            result = subprocess.run(
                [commands["docker"], "info", "--format", "{{json .Runtimes}}"],
                capture_output=True,
                timeout=10,
                check=False,
                text=True,
            )
            if result.returncode == 0:
                docker_runtimes = sorted(json.loads(result.stdout).keys())
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
            pass
    strong_sandbox = "runsc" in docker_runtimes
    return {
        "bundle_valid": validation.ok,
        "bundle_errors": validation.errors,
        "commands": commands,
        "python_packages": packages,
        "docker_runtimes": docker_runtimes,
        "read_only_adapters_ready": all(commands[name] for name in ("rg", "git", "curl")),
        "untrusted_code_execution_ready": bool(commands["docker"] and strong_sandbox),
        "fail_closed_reasons": [] if strong_sandbox else ["Docker runtime runsc is unavailable"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", nargs="?", default=".", type=Path)
    result = doctor(parser.parse_args().bundle)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["bundle_valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

