#!/usr/bin/env python3
"""Generate Ed25519 scope-authority keys and sign or verify receipts."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey


def canonical_receipt(receipt: dict[str, Any]) -> bytes:
    unsigned = {key: value for key, value in receipt.items() if key != "signature"}
    return json.dumps(unsigned, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def public_key_id(public_key: Ed25519PublicKey) -> str:
    raw = public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return f"sha256:{hashlib.sha256(raw).hexdigest()}"


def generate_keypair(private_path: Path, public_path: Path) -> str:
    if private_path.exists() or public_path.exists():
        raise FileExistsError("refusing to overwrite an existing scope-authority key")
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    private_bytes = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    public_bytes = public_key.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    private_path.parent.mkdir(parents=True, exist_ok=True)
    public_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(private_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(private_bytes)
    descriptor = os.open(public_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(public_bytes)
    return public_key_id(public_key)


def load_private_key(path: Path) -> Ed25519PrivateKey:
    key = serialization.load_pem_private_key(path.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise TypeError("scope authority private key must be Ed25519")
    return key


def load_public_key(path: Path) -> Ed25519PublicKey:
    key = serialization.load_pem_public_key(path.read_bytes())
    if not isinstance(key, Ed25519PublicKey):
        raise TypeError("scope authority public key must be Ed25519")
    return key


def sign_receipt(receipt: dict[str, Any], private_key: Ed25519PrivateKey) -> dict[str, Any]:
    signed = {key: value for key, value in receipt.items() if key != "signature"}
    signature = private_key.sign(canonical_receipt(signed))
    signed["signature"] = {
        "algorithm": "Ed25519",
        "key_id": public_key_id(private_key.public_key()),
        "value": base64.b64encode(signature).decode("ascii"),
    }
    return signed


def verify_receipt(receipt: dict[str, Any], public_keys: Iterable[Ed25519PublicKey]) -> str:
    signature = receipt.get("signature")
    if not isinstance(signature, dict) or signature.get("algorithm") != "Ed25519":
        raise InvalidSignature("scope receipt has no supported signature")
    try:
        encoded = base64.b64decode(signature["value"], validate=True)
    except Exception as exc:
        raise InvalidSignature("scope receipt signature is not valid base64") from exc
    trusted = {public_key_id(key): key for key in public_keys}
    key_id = signature.get("key_id")
    if key_id not in trusted:
        raise InvalidSignature(f"scope receipt key is not trusted: {key_id}")
    trusted[key_id].verify(encoded, canonical_receipt(receipt))
    return str(key_id)


def _write_json_once(path: Path, value: dict[str, Any]) -> None:
    if path.exists():
        raise FileExistsError(f"refusing to overwrite: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    keygen = commands.add_parser("keygen")
    keygen.add_argument("private_key", type=Path)
    keygen.add_argument("public_key", type=Path)
    sign = commands.add_parser("sign")
    sign.add_argument("receipt", type=Path)
    sign.add_argument("private_key", type=Path)
    sign.add_argument("output", type=Path)
    verify = commands.add_parser("verify")
    verify.add_argument("receipt", type=Path)
    verify.add_argument("public_key", nargs="+", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "keygen":
            result = {"key_id": generate_keypair(args.private_key, args.public_key)}
        elif args.command == "sign":
            receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
            signed = sign_receipt(receipt, load_private_key(args.private_key))
            _write_json_once(args.output, signed)
            result = {"receipt": str(args.output), "key_id": signed["signature"]["key_id"]}
        else:
            receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
            result = {"key_id": verify_receipt(receipt, [load_public_key(path) for path in args.public_key])}
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

