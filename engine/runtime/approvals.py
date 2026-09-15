#!/usr/bin/env python3
"""Signed, time-bounded, exact-plan approvals for high-risk capabilities."""

from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import jsonschema
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from execution import ExecutionPlan
from scope_signing import public_key_id
from scope_signing import load_private_key, load_public_key


def _canonical(document: dict[str, Any]) -> bytes:
    unsigned = {key: value for key, value in document.items() if key != "signature"}
    return json.dumps(unsigned, sort_keys=True, separators=(",", ":")).encode()


def sign_approval(document: dict[str, Any], private_key: Ed25519PrivateKey) -> dict[str, Any]:
    signed = {key: value for key, value in document.items() if key != "signature"}
    signed["signature"] = {
        "algorithm": "Ed25519",
        "key_id": public_key_id(private_key.public_key()),
        "value": base64.b64encode(private_key.sign(_canonical(signed))).decode("ascii"),
    }
    return signed


def verify_approval(
    document: dict[str, Any],
    *,
    schema: dict[str, Any],
    trusted_keys: list[Ed25519PublicKey],
    plan: ExecutionPlan,
    scope_receipt_id: str,
    agent_name: str,
) -> bool:
    jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(document)
    trusted = {public_key_id(key): key for key in trusted_keys}
    signature = document["signature"]
    key = trusted.get(signature["key_id"])
    if key is None:
        raise InvalidSignature("approval signing key is not trusted")
    key.verify(base64.b64decode(signature["value"], validate=True), _canonical(document))
    now = datetime.now(timezone.utc)
    issued = datetime.fromisoformat(document["issued_at"].replace("Z", "+00:00"))
    expires = datetime.fromisoformat(document["expires_at"].replace("Z", "+00:00"))
    if now < issued or now >= expires:
        raise PermissionError("approval is not currently active")
    expected = {
        "scope_receipt_id": scope_receipt_id,
        "agent_name": agent_name,
        "capability": plan.capability,
        "adapter": plan.adapter,
        "action": plan.action,
        "target": plan.target,
        "side_effect": plan.side_effect,
        "plan_digest": plan.digest,
    }
    for key_name, value in expected.items():
        if document[key_name] != value:
            raise PermissionError(f"approval does not match execution plan field {key_name}")
    return True


class ApprovalDirectory:
    def __init__(
        self,
        root: Path,
        schema_path: Path,
        trusted_keys: list[Ed25519PublicKey],
        scope_receipt_id: str,
    ):
        self.root = root.resolve()
        self.schema = json.loads(schema_path.read_text(encoding="utf-8"))
        self.trusted_keys = trusted_keys
        self.scope_receipt_id = scope_receipt_id

    def verify(self, approval_id: str, agent_name: str, plan: ExecutionPlan) -> bool:
        if not approval_id or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-" for character in approval_id):
            return False
        path = self.root / f"{approval_id}.json"
        if not path.is_file():
            return False
        try:
            return verify_approval(
                json.loads(path.read_text(encoding="utf-8")),
                schema=self.schema,
                trusted_keys=self.trusted_keys,
                plan=plan,
                scope_receipt_id=self.scope_receipt_id,
                agent_name=agent_name,
            )
        except Exception:
            return False


def _plan(path: Path) -> ExecutionPlan:
    document = json.loads(path.read_text(encoding="utf-8"))
    document["argv"] = tuple(document["argv"])
    return ExecutionPlan(**document)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    template = commands.add_parser("template")
    template.add_argument("plan", type=Path)
    template.add_argument("output", type=Path)
    template.add_argument("--approval-id", required=True)
    template.add_argument("--scope-receipt-id", required=True)
    template.add_argument("--agent", required=True)
    template.add_argument("--ttl-seconds", type=int, default=600)
    sign = commands.add_parser("sign")
    sign.add_argument("template", type=Path)
    sign.add_argument("private_key", type=Path)
    sign.add_argument("output", type=Path)
    check = commands.add_parser("verify")
    check.add_argument("approval", type=Path)
    check.add_argument("public_key", type=Path)
    check.add_argument("plan", type=Path)
    check.add_argument("--schema", required=True, type=Path)
    check.add_argument("--scope-receipt-id", required=True)
    check.add_argument("--agent", required=True)
    args = parser.parse_args()
    try:
        if args.command == "template":
            if not 1 <= args.ttl_seconds <= 3600:
                raise ValueError("approval TTL must be between 1 and 3600 seconds")
            plan = _plan(args.plan)
            now = datetime.now(timezone.utc)
            result = {
                "schema_version": "0.1.0",
                "approval_id": args.approval_id,
                "issued_at": now.isoformat(),
                "expires_at": (now + timedelta(seconds=args.ttl_seconds)).isoformat(),
                "scope_receipt_id": args.scope_receipt_id,
                "agent_name": args.agent,
                "capability": plan.capability,
                "adapter": plan.adapter,
                "action": plan.action,
                "target": plan.target,
                "side_effect": plan.side_effect,
                "plan_digest": plan.digest,
            }
            if args.output.exists():
                raise FileExistsError(f"refusing to overwrite: {args.output}")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        elif args.command == "sign":
            if args.output.exists():
                raise FileExistsError(f"refusing to overwrite: {args.output}")
            document = json.loads(args.template.read_text(encoding="utf-8"))
            result = sign_approval(document, load_private_key(args.private_key))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        else:
            document = json.loads(args.approval.read_text(encoding="utf-8"))
            result = {
                "valid": verify_approval(
                    document,
                    schema=json.loads(args.schema.read_text(encoding="utf-8")),
                    trusted_keys=[load_public_key(args.public_key)],
                    plan=_plan(args.plan),
                    scope_receipt_id=args.scope_receipt_id,
                    agent_name=args.agent,
                )
            }
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
