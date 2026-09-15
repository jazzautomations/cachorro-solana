#!/usr/bin/env python3
"""Normalize sanitizer traces into stable candidate signatures for deduplication."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass


ADDRESS = re.compile(r"0x[0-9a-fA-F]+")
PID = re.compile(r"==\d+==")
FRAME = re.compile(r"^\s*#\d+\s+(?:0x[0-9a-fA-F]+\s+in\s+)?(.+)$")
SANITIZERS = {
    "AddressSanitizer": re.compile(r"AddressSanitizer:\s*([^\n]+)"),
    "UndefinedBehaviorSanitizer": re.compile(r"(?:UndefinedBehaviorSanitizer|runtime error):\s*([^\n]+)"),
    "MemorySanitizer": re.compile(r"MemorySanitizer:\s*([^\n]+)"),
    "ThreadSanitizer": re.compile(r"ThreadSanitizer:\s*([^\n]+)"),
}


@dataclass(frozen=True)
class CrashSignature:
    signature: str
    sanitizer: str
    category: str
    frames: tuple[str, ...]
    status: str = "untriaged"

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def normalize_trace(trace: bytes, *, frame_limit: int = 8) -> CrashSignature:
    text = trace.decode("utf-8", errors="replace")
    sanitizer = "unknown"
    category = "unknown-crash"
    for name, pattern in SANITIZERS.items():
        match = pattern.search(text)
        if match:
            sanitizer = name
            category = ADDRESS.sub("0xADDR", match.group(1).strip())[:300]
            break
    frames: list[str] = []
    for line in text.splitlines():
        match = FRAME.match(line)
        if not match:
            continue
        normalized = ADDRESS.sub("0xADDR", PID.sub("==PID==", match.group(1)))
        normalized = re.sub(r"\s+", " ", normalized).strip()
        if normalized and normalized not in frames:
            frames.append(normalized[:500])
        if len(frames) == frame_limit:
            break
    material = "\n".join([sanitizer, category, *frames]).encode()
    signature = "crash:" + hashlib.sha256(material).hexdigest()
    return CrashSignature(signature, sanitizer, category, tuple(frames))

