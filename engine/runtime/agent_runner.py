#!/usr/bin/env python3
"""Load an agent folder, call a model provider and enforce its contracts."""

from __future__ import annotations

import json
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol

import jsonschema
import yaml
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from evidence_vault import EvidenceVault
from journal import RoundJournal


@dataclass(frozen=True)
class ModelRequest:
    agent_name: str
    instruction: str
    skills: tuple[str, ...]
    input: dict[str, Any]
    output_schema: dict[str, Any]
    validation_feedback: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ModelResponse:
    output: Any
    model: str
    model_version: str
    usage: dict[str, Any]


class ModelProvider(Protocol):
    def complete(self, request: ModelRequest) -> ModelResponse: ...


class CommandProvider:
    """Operator-configured JSON stdin/stdout model bridge. Never uses a shell."""

    def __init__(self, argv: list[str], *, timeout_seconds: int = 300, max_output_bytes: int = 4_000_000):
        if not argv:
            raise ValueError("provider command cannot be empty")
        self.argv = tuple(argv)
        self.timeout_seconds = timeout_seconds
        self.max_output_bytes = max_output_bytes

    def complete(self, request: ModelRequest) -> ModelResponse:
        process = subprocess.run(
            self.argv,
            input=json.dumps(request.as_dict(), ensure_ascii=False).encode(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            timeout=self.timeout_seconds,
            check=False,
        )
        if process.returncode != 0:
            raise RuntimeError(
                f"model provider failed with {process.returncode}: "
                + process.stderr[:2000].decode("utf-8", errors="replace")
            )
        if len(process.stdout) > self.max_output_bytes:
            raise RuntimeError("model provider output exceeds configured bound")
        document = json.loads(process.stdout)
        return ModelResponse(
            output=document["output"],
            model=document["model"],
            model_version=document["model_version"],
            usage=document.get("usage", {}),
        )


class AgentPackage:
    def __init__(self, directory: Path):
        self.directory = directory.resolve()
        self.manifest = yaml.safe_load((self.directory / "manifest.yaml").read_text(encoding="utf-8"))
        self.routes = yaml.safe_load((self.directory / "routes.yaml").read_text(encoding="utf-8"))
        self.instruction = (self.directory / self.manifest["instruction"]).read_text(encoding="utf-8")
        self.input_path = self.directory / self.manifest["contracts"]["input"]
        self.output_path = self.directory / self.manifest["contracts"]["output"]
        self.input_schema = json.loads(self.input_path.read_text(encoding="utf-8"))
        self.output_schema = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.bundle_root = self.directory.parents[1]
        self.skills = tuple(
            (self.directory / path).read_text(encoding="utf-8")
            for path in self.manifest.get("skills", [])
        )

    def _validator(self, schema: dict[str, Any], path: Path) -> jsonschema.Draft202012Validator:
        registry = Registry()
        for schema_path in self.bundle_root.rglob("*.schema.json"):
            contents = json.loads(schema_path.read_text(encoding="utf-8"))
            contents.setdefault("$id", schema_path.resolve().as_uri())
            registry = registry.with_resource(
                schema_path.resolve().as_uri(),
                Resource.from_contents(contents, default_specification=DRAFT202012),
            )
        root_schema = dict(schema)
        root_schema.setdefault("$id", path.resolve().as_uri())
        return jsonschema.Draft202012Validator(root_schema, registry=registry)

    def validate_input(self, value: dict[str, Any]) -> None:
        self._validator(self.input_schema, self.input_path).validate(value)

    def output_errors(self, value: Any) -> list[str]:
        validator = self._validator(self.output_schema, self.output_path)
        return [
            f"{'.'.join(str(part) for part in error.path) or '$'}: {error.message}"
            for error in sorted(validator.iter_errors(value), key=lambda item: list(item.path))
        ]


class AgentRegistry:
    def __init__(self, bundle_root: Path):
        self.bundle_root = bundle_root.resolve()
        self.packages: dict[str, AgentPackage] = {}
        for manifest in sorted((self.bundle_root / "agents").rglob("manifest.yaml")):
            package = AgentPackage(manifest.parent)
            self.packages[package.manifest["name"]] = package

    def package(self, name: str) -> AgentPackage:
        try:
            return self.packages[name]
        except KeyError as exc:
            raise KeyError(f"unknown agent: {name}") from exc

    def consumers(self, event: str) -> tuple[str, ...]:
        return tuple(
            sorted(
                name
                for name, package in self.packages.items()
                if event in package.routes["accepts"]
            )
        )

    def assert_emits(self, agent_name: str, event: str) -> None:
        if event not in self.package(agent_name).routes["emits"]:
            raise ValueError(f"agent {agent_name!r} cannot emit event {event!r}")


class AgentRunner:
    def __init__(
        self,
        registry: AgentRegistry,
        provider: ModelProvider,
        journal: RoundJournal,
        vault: EvidenceVault,
        *,
        scope_receipt_id: str,
        agent_hasher,
    ):
        self.registry = registry
        self.provider = provider
        self.journal = journal
        self.vault = vault
        self.scope_receipt_id = scope_receipt_id
        self.agent_hasher = agent_hasher

    def run(self, agent_name: str, input_value: dict[str, Any], *, max_attempts: int = 3) -> dict[str, Any]:
        package = self.registry.package(agent_name)
        package.validate_input(input_value)
        allowed_attempts = min(max_attempts, int(package.manifest["budgets"]["max_turns"]))
        feedback: tuple[str, ...] = ()
        agent_hash = self.agent_hasher(agent_name)
        for attempt in range(1, allowed_attempts + 1):
            request = ModelRequest(
                agent_name=agent_name,
                instruction=package.instruction,
                skills=package.skills,
                input=input_value,
                output_schema=package.output_schema,
                validation_feedback=feedback,
            )
            response = self.provider.complete(request)
            raw = json.dumps(response.output, ensure_ascii=False, sort_keys=True).encode()
            artifact = self.vault.put(
                raw,
                media_type="application/json",
                source=f"model:{response.model}:{agent_name}:attempt:{attempt}",
                tool="model-provider",
                tool_version=response.model_version,
                agent_package_hash=agent_hash,
                scope_receipt_id=self.scope_receipt_id,
            )
            errors = package.output_errors(response.output)
            self.journal.append(
                "agent.attempt",
                {
                    "agent_name": agent_name,
                    "agent_package_hash": agent_hash,
                    "attempt": attempt,
                    "model": response.model,
                    "model_version": response.model_version,
                    "usage": response.usage,
                    "output_artifact_id": artifact["artifact_id"],
                    "contract_errors": errors,
                },
            )
            if not errors:
                return response.output
            feedback = tuple(errors)
        raise RuntimeError(f"agent output failed contract after {allowed_attempts} attempts: {feedback}")
