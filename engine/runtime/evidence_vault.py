#!/usr/bin/env python3
"""Content-addressed immutable storage for raw research artifacts."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _write_once(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        if path.read_bytes() != data:
            raise RuntimeError(f"immutable vault collision at {path}")
        return
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


class EvidenceVault:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.objects = self.root / "objects/sha256"
        self.receipts = self.root / "receipts"
        self.objects.mkdir(parents=True, exist_ok=True)
        self.receipts.mkdir(parents=True, exist_ok=True)

    def put(
        self,
        data: bytes,
        *,
        media_type: str,
        source: str,
        tool: str,
        tool_version: str,
        agent_package_hash: str,
        scope_receipt_id: str,
        captured_at: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(data, bytes):
            raise TypeError("evidence data must be bytes")
        if not agent_package_hash.startswith("sha256:"):
            raise ValueError("agent_package_hash must be a sha256 identifier")
        digest = hashlib.sha256(data).hexdigest()
        artifact_id = f"sha256:{digest}"
        object_path = self.objects / digest[:2] / digest
        _write_once(object_path, data)

        receipt: dict[str, Any] = {
            "artifact_id": artifact_id,
            "size": len(data),
            "media_type": media_type,
            "source": source,
            "tool": tool,
            "tool_version": tool_version,
            "agent_package_hash": agent_package_hash,
            "scope_receipt_id": scope_receipt_id,
            "captured_at": captured_at or datetime.now(timezone.utc).isoformat(),
        }
        receipt_bytes = _canonical(receipt)
        receipt_hash = hashlib.sha256(receipt_bytes).hexdigest()
        receipt["evidence_receipt_id"] = f"sha256:{receipt_hash}"
        _write_once(self.receipts / f"{receipt_hash}.json", _canonical(receipt) + b"\n")
        return receipt

    def read(self, artifact_id: str) -> bytes:
        prefix = "sha256:"
        if not artifact_id.startswith(prefix):
            raise ValueError("unsupported artifact identifier")
        digest = artifact_id[len(prefix) :]
        if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
            raise ValueError("invalid sha256 artifact identifier")
        data = (self.objects / digest[:2] / digest).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError(f"evidence object failed integrity check: {artifact_id}")
        return data

