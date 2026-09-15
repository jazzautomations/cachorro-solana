#!/usr/bin/env python3
"""Encrypted secret handles that are resolved only for named adapters."""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class SecretVault:
    def __init__(self, root: Path, master_key: bytes):
        if len(master_key) != 32:
            raise ValueError("secret vault master key must be exactly 32 bytes")
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.cipher = AESGCM(master_key)

    @staticmethod
    def generate_key() -> bytes:
        return AESGCM.generate_key(bit_length=256)

    def put(self, value: bytes, *, allowed_adapters: list[str], expires_at: str) -> str:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
            raise ValueError("secret expiry must be timezone-aware and in the future")
        if not allowed_adapters:
            raise ValueError("secret must be restricted to at least one adapter")
        token = os.urandom(24).hex()
        handle = f"secret:{token}"
        nonce = os.urandom(12)
        payload = json.dumps(
            {
                "value": base64.b64encode(value).decode("ascii"),
                "allowed_adapters": sorted(set(allowed_adapters)),
                "expires_at": expiry.astimezone(timezone.utc).isoformat(),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        ciphertext = self.cipher.encrypt(nonce, payload, handle.encode())
        document = {
            "nonce": base64.b64encode(nonce).decode("ascii"),
            "ciphertext": base64.b64encode(ciphertext).decode("ascii"),
        }
        path = self.root / f"{token}.json"
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(document, file, sort_keys=True)
        return handle

    def resolve(self, handle: str, *, adapter: str) -> bytes:
        if not handle.startswith("secret:"):
            raise ValueError("invalid secret handle")
        token = handle.split(":", 1)[1]
        if len(token) != 48 or any(character not in "0123456789abcdef" for character in token):
            raise ValueError("invalid secret handle")
        document = json.loads((self.root / f"{token}.json").read_text(encoding="utf-8"))
        payload = self.cipher.decrypt(
            base64.b64decode(document["nonce"]),
            base64.b64decode(document["ciphertext"]),
            handle.encode(),
        )
        secret = json.loads(payload)
        if adapter not in secret["allowed_adapters"]:
            raise PermissionError(f"secret is not available to adapter {adapter!r}")
        expiry = datetime.fromisoformat(secret["expires_at"])
        if datetime.now(timezone.utc) >= expiry:
            raise PermissionError("secret has expired")
        return base64.b64decode(secret["value"])


def redact(data: bytes, secrets: list[bytes]) -> bytes:
    redacted = data
    variants: list[bytes] = []
    for secret in secrets:
        if secret:
            variants.extend([secret, base64.b64encode(secret), secret.hex().encode()])
    for value in sorted(set(variants), key=len, reverse=True):
        redacted = redacted.replace(value, b"[REDACTED]")
    return redacted

