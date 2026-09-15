#!/usr/bin/env python3
"""Bound and label untrusted tool output before model-facing serialization."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass


INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"ignore\s+(all|any|the)?\s*(previous|prior|system)\s+instructions?",
        r"system\s*prompt",
        r"developer\s+message",
        r"do\s+not\s+tell\s+the\s+user",
        r"exfiltrat(e|ion)",
        r"tool\s+call",
    )
]


@dataclass(frozen=True)
class UntrustedText:
    trust: str
    sha256: str
    original_bytes: int
    truncated: bool
    injection_indicators: tuple[str, ...]
    text: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def envelope(data: bytes, *, limit: int = 200_000) -> UntrustedText:
    digest = hashlib.sha256(data).hexdigest()
    decoded = data[:limit].decode("utf-8", errors="replace")
    cleaned = "".join(
        character
        for character in decoded
        if character in "\n\r\t" or ord(character) >= 32
    )
    indicators = tuple(
        pattern.pattern
        for pattern in INJECTION_PATTERNS
        if pattern.search(cleaned)
    )
    return UntrustedText(
        trust="untrusted-tool-output",
        sha256=digest,
        original_bytes=len(data),
        truncated=len(data) > limit,
        injection_indicators=indicators,
        text=cleaned,
    )

