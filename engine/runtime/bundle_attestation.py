#!/usr/bin/env python3
"""Create and verify a detached Ed25519 provenance attestation for a bundle."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature

from scope_signing import load_private_key, load_public_key, public_key_id


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def attest(bundle: Path, private_key_path: Path, output: Path, *, builder_id: str) -> dict[str, Any]:
    if output.exists():
        raise FileExistsError(f"refusing to overwrite attestation: {output}")
    private_key = load_private_key(private_key_path)
    digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
    statement = {
        "_type": "https://in-toto.io/Statement/v1",
        "subject": [{"name": bundle.name, "digest": {"sha256": digest}}],
        "predicateType": "https://pentest-agent.local/BundleProvenance/v0.1",
        "predicate": {
            "builder": {"id": builder_id},
            "buildType": "https://pentest-agent.local/DeterministicZip/v0.1",
            "buildStartedOn": datetime.now(timezone.utc).isoformat(),
        },
    }
    signature = private_key.sign(_canonical(statement))
    document = {
        "statement": statement,
        "signature": {
            "algorithm": "Ed25519",
            "key_id": public_key_id(private_key.public_key()),
            "value": base64.b64encode(signature).decode("ascii"),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return document


def verify(bundle: Path, attestation: Path, public_key_path: Path) -> dict[str, Any]:
    document = json.loads(attestation.read_text(encoding="utf-8"))
    public_key = load_public_key(public_key_path)
    signature = document["signature"]
    if signature["key_id"] != public_key_id(public_key):
        raise InvalidSignature("attestation key is not trusted")
    public_key.verify(base64.b64decode(signature["value"], validate=True), _canonical(document["statement"]))
    expected = document["statement"]["subject"][0]["digest"]["sha256"]
    actual = hashlib.sha256(bundle.read_bytes()).hexdigest()
    if actual != expected:
        raise InvalidSignature("bundle digest does not match signed subject")
    return document["statement"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("bundle", type=Path)
    create.add_argument("private_key", type=Path)
    create.add_argument("output", type=Path)
    create.add_argument("--builder-id", required=True)
    check = commands.add_parser("verify")
    check.add_argument("bundle", type=Path)
    check.add_argument("attestation", type=Path)
    check.add_argument("public_key", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "create":
            result = attest(args.bundle, args.private_key, args.output, builder_id=args.builder_id)
        else:
            result = verify(args.bundle, args.attestation, args.public_key)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

