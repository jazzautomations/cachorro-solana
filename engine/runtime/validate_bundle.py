#!/usr/bin/env python3
"""Validate a Pentest-Agent v3 bundle without executing agent code."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import jsonschema
import yaml


@dataclass
class ValidationReport:
    root: Path
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    agents: list[str] = field(default_factory=list)
    handoffs: list[tuple[str, str]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "root": str(self.root),
            "agents": sorted(self.agents),
            "errors": self.errors,
            "warnings": self.warnings,
        }


def _inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _load_yaml(path: Path, report: ValidationReport) -> Any | None:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle)
    except (OSError, yaml.YAMLError) as exc:
        report.errors.append(f"{path}: invalid YAML: {exc}")
        return None


def _load_json(path: Path, report: ValidationReport) -> Any | None:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        report.errors.append(f"{path}: invalid JSON: {exc}")
        return None


def _schema_errors(instance: Any, schema: dict[str, Any]) -> list[str]:
    validator = jsonschema.Draft202012Validator(schema)
    errors: list[str] = []
    for error in sorted(validator.iter_errors(instance), key=lambda item: list(item.path)):
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        errors.append(f"{location}: {error.message}")
    return errors


def _validate_schema_refs(
    value: Any,
    schema_path: Path,
    bundle_root: Path,
    report: ValidationReport,
) -> None:
    if isinstance(value, dict):
        reference = value.get("$ref")
        if isinstance(reference, str) and not reference.startswith("#"):
            if "://" in reference:
                report.errors.append(f"{schema_path}: remote $ref is forbidden in portable bundles: {reference}")
            else:
                relative = reference.split("#", 1)[0]
                target = (schema_path.parent / relative).resolve()
                if not _inside(bundle_root, target):
                    report.errors.append(f"{schema_path}: $ref escapes bundle: {reference}")
                elif not target.is_file():
                    report.errors.append(f"{schema_path}: unresolved local $ref: {reference}")
        for child in value.values():
            _validate_schema_refs(child, schema_path, bundle_root, report)
    elif isinstance(value, list):
        for child in value:
            _validate_schema_refs(child, schema_path, bundle_root, report)


def _relative_reference(
    agent_dir: Path,
    value: str,
    label: str,
    report: ValidationReport,
    *,
    must_exist: bool = True,
) -> Path | None:
    reference = agent_dir / value
    if Path(value).is_absolute() or not _inside(agent_dir, reference):
        report.errors.append(f"{agent_dir}: {label} escapes its agent package: {value}")
        return None
    if must_exist and not reference.is_file():
        report.errors.append(f"{agent_dir}: missing {label}: {value}")
        return None
    return reference


def _validate_skill(skill_file: Path, report: ValidationReport) -> None:
    try:
        text = skill_file.read_text(encoding="utf-8")
    except OSError as exc:
        report.errors.append(f"{skill_file}: cannot read skill: {exc}")
        return
    if not text.startswith("---\n"):
        report.errors.append(f"{skill_file}: SKILL.md must start with YAML frontmatter")
        return
    marker = text.find("\n---\n", 4)
    if marker < 0:
        report.errors.append(f"{skill_file}: SKILL.md frontmatter is not closed")
        return
    try:
        frontmatter = yaml.safe_load(text[4:marker])
    except yaml.YAMLError as exc:
        report.errors.append(f"{skill_file}: invalid frontmatter: {exc}")
        return
    if not isinstance(frontmatter, dict):
        report.errors.append(f"{skill_file}: frontmatter must be an object")
        return
    for key in ("name", "description"):
        if not isinstance(frontmatter.get(key), str) or not frontmatter[key].strip():
            report.errors.append(f"{skill_file}: frontmatter requires non-empty {key}")


def _validate_agent(
    agent_dir: Path,
    manifest_schema: dict[str, Any],
    routes_schema: dict[str, Any],
    required_files: list[str],
    agent_root: Path,
    max_nesting: int,
    report: ValidationReport,
) -> None:
    relative = agent_dir.relative_to(agent_root)
    nesting = len(relative.parts)
    if nesting > max_nesting:
        report.errors.append(
            f"{agent_dir}: nesting {nesting} exceeds framework limit {max_nesting}"
        )

    for required in required_files:
        path = agent_dir / required
        if not path.is_file():
            report.errors.append(f"{agent_dir}: missing required file {required}")

    manifest_path = agent_dir / "manifest.yaml"
    routes_path = agent_dir / "routes.yaml"
    if not manifest_path.is_file() or not routes_path.is_file():
        return

    manifest = _load_yaml(manifest_path, report)
    routes = _load_yaml(routes_path, report)
    if manifest is None or routes is None:
        return

    for error in _schema_errors(manifest, manifest_schema):
        report.errors.append(f"{manifest_path}: {error}")
    for error in _schema_errors(routes, routes_schema):
        report.errors.append(f"{routes_path}: {error}")
    if not isinstance(manifest, dict):
        return

    expected_name = agent_dir.name
    if manifest.get("name") != expected_name:
        report.errors.append(
            f"{manifest_path}: name {manifest.get('name')!r} must match directory {expected_name!r}"
        )
    report.agents.append(str(relative))
    if isinstance(routes, dict):
        for route in routes.get("routes", []):
            if isinstance(route, dict) and isinstance(route.get("handoff"), str):
                report.handoffs.append((str(relative), route["handoff"]))

    instruction = manifest.get("instruction")
    if isinstance(instruction, str):
        _relative_reference(agent_dir, instruction, "instruction", report)

    contracts = manifest.get("contracts")
    if isinstance(contracts, dict):
        for key in ("input", "output"):
            value = contracts.get(key)
            if isinstance(value, str):
                schema_path = _relative_reference(agent_dir, value, f"{key} contract", report)
                if schema_path:
                    schema = _load_json(schema_path, report)
                    if isinstance(schema, dict):
                        _validate_schema_refs(schema, schema_path, agent_root.parent, report)
                        try:
                            jsonschema.Draft202012Validator.check_schema(schema)
                        except jsonschema.SchemaError as exc:
                            report.errors.append(f"{schema_path}: invalid JSON Schema: {exc.message}")

    for skill in manifest.get("skills", []):
        if isinstance(skill, str):
            skill_path = _relative_reference(agent_dir, skill, "skill", report)
            if skill_path:
                _validate_skill(skill_path, report)

    for child in manifest.get("child_agents", []):
        if not isinstance(child, str):
            continue
        child_manifest = _relative_reference(agent_dir, child, "child agent manifest", report)
        if child_manifest and child_manifest.name != "manifest.yaml":
            report.errors.append(f"{agent_dir}: child agent reference must end in manifest.yaml: {child}")

    side_effects = set(manifest.get("side_effects", []))
    if "none" in side_effects and len(side_effects) > 1:
        report.errors.append(f"{manifest_path}: side_effects 'none' cannot be combined")
    for tool in manifest.get("tools", []):
        if not isinstance(tool, dict):
            continue
        if tool.get("mutates_target") and "target_state_change" not in side_effects:
            report.errors.append(
                f"{manifest_path}: mutating tool {tool.get('name')!r} requires target_state_change"
            )
        if tool.get("mutates_target") and not tool.get("requires_approval"):
            report.errors.append(
                f"{manifest_path}: mutating tool {tool.get('name')!r} requires explicit approval"
            )


def validate_bundle(root: Path) -> ValidationReport:
    root = root.resolve()
    report = ValidationReport(root=root)
    if root == Path("/"):
        report.errors.append("refusing to validate filesystem root")
        return report
    if not root.is_dir():
        report.errors.append(f"bundle root does not exist or is not a directory: {root}")
        return report

    for path in root.rglob("*"):
        if path.is_symlink():
            report.errors.append(f"symlinks are forbidden in portable bundles: {path}")

    framework_path = root / "framework.yaml"
    if not framework_path.is_file():
        report.errors.append(f"missing framework.yaml: {framework_path}")
        return report
    framework = _load_yaml(framework_path, report)
    if not isinstance(framework, dict):
        report.errors.append(f"{framework_path}: framework must be an object")
        return report

    for key in ("schema_version", "name", "version", "agent_roots", "schemas", "runtime"):
        if key not in framework:
            report.errors.append(f"{framework_path}: missing required key {key}")

    schema_refs = framework.get("schemas", {})
    loaded_schemas: dict[str, dict[str, Any]] = {}
    if isinstance(schema_refs, dict):
        for name, value in schema_refs.items():
            if not isinstance(value, str):
                report.errors.append(f"{framework_path}: schema reference {name} must be a path")
                continue
            path = root / value
            if not _inside(root, path):
                report.errors.append(f"{framework_path}: schema path escapes bundle: {value}")
                continue
            schema = _load_json(path, report)
            if isinstance(schema, dict):
                try:
                    jsonschema.Draft202012Validator.check_schema(schema)
                    loaded_schemas[name] = schema
                except jsonschema.SchemaError as exc:
                    report.errors.append(f"{path}: invalid JSON Schema: {exc.message}")

    if "agent_manifest" not in loaded_schemas or "routes" not in loaded_schemas:
        report.errors.append("agent_manifest and routes schemas must load before agent validation")
        return report

    runtime = framework.get("runtime", {})
    required_files = runtime.get("required_agent_files", []) if isinstance(runtime, dict) else []
    max_nesting = runtime.get("max_agent_nesting", 1) if isinstance(runtime, dict) else 1
    if not isinstance(required_files, list) or not all(isinstance(item, str) for item in required_files):
        report.errors.append(f"{framework_path}: runtime.required_agent_files must be a string array")
        return report
    if not isinstance(max_nesting, int) or max_nesting < 1:
        report.errors.append(f"{framework_path}: runtime.max_agent_nesting must be a positive integer")
        return report

    agent_roots = framework.get("agent_roots", [])
    if not isinstance(agent_roots, list):
        report.errors.append(f"{framework_path}: agent_roots must be an array")
        return report
    for value in agent_roots:
        if not isinstance(value, str):
            report.errors.append(f"{framework_path}: each agent root must be a path")
            continue
        agent_root = root / value
        if not _inside(root, agent_root):
            report.errors.append(f"{framework_path}: agent root escapes bundle: {value}")
            continue
        if not agent_root.is_dir():
            report.errors.append(f"{framework_path}: agent root does not exist: {value}")
            continue
        for manifest_path in sorted(agent_root.rglob("manifest.yaml")):
            _validate_agent(
                manifest_path.parent,
                loaded_schemas["agent_manifest"],
                loaded_schemas["routes"],
                required_files,
                agent_root,
                max_nesting,
                report,
            )

    discovered_names = [Path(agent).name for agent in report.agents]
    duplicate_names = sorted({name for name in discovered_names if discovered_names.count(name) > 1})
    for name in duplicate_names:
        report.errors.append(f"duplicate agent package name makes handoffs ambiguous: {name}")
    available = set(discovered_names)
    for source, target in report.handoffs:
        if target not in available:
            report.errors.append(f"agents/{source}/routes.yaml: unknown handoff target {target!r}")

    if not report.agents:
        report.warnings.append("bundle contains no discoverable agent packages")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".", type=Path)
    parser.add_argument("--json", action="store_true", dest="json_output")
    args = parser.parse_args()

    report = validate_bundle(args.root)
    if args.json_output:
        print(json.dumps(report.as_dict(), indent=2, sort_keys=True))
    else:
        status = "VALID" if report.ok else "INVALID"
        print(f"{status}: {report.root}")
        print(f"agents: {len(report.agents)}")
        for warning in report.warnings:
            print(f"warning: {warning}")
        for error in report.errors:
            print(f"error: {error}", file=sys.stderr)
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
