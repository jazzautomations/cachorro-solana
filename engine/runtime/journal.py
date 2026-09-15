#!/usr/bin/env python3
"""Append-only, hash-chained campaign journal."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


GENESIS_HASH = "0" * 64


def _canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _hash_record(record: dict[str, Any]) -> str:
    unsigned = {key: value for key, value in record.items() if key != "record_hash"}
    return hashlib.sha256(_canonical(unsigned)).hexdigest()


class JournalCorruption(RuntimeError):
    pass


class RoundJournal:
    def __init__(self, path: Path):
        self.path = path.resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def records(self) -> Iterator[dict[str, Any]]:
        if not self.path.exists():
            return
        with self.path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    raise JournalCorruption(f"blank record at line {line_number}")
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise JournalCorruption(f"invalid JSON at line {line_number}: {exc}") from exc
                yield record

    def verify(self) -> tuple[int, str]:
        previous = GENESIS_HASH
        count = 0
        for count, record in enumerate(self.records(), start=1):
            if record.get("sequence") != count:
                raise JournalCorruption(f"sequence mismatch at record {count}")
            if record.get("previous_hash") != previous:
                raise JournalCorruption(f"previous hash mismatch at record {count}")
            expected = _hash_record(record)
            if record.get("record_hash") != expected:
                raise JournalCorruption(f"record hash mismatch at record {count}")
            previous = expected
        return count, previous

    def append(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not event_type or not isinstance(payload, dict):
            raise ValueError("event_type and object payload are required")
        with self.path.open("a+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            handle.flush()
            handle.seek(0)
            previous = GENESIS_HASH
            count = 0
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    raise JournalCorruption(f"blank record at line {line_number}")
                record = json.loads(line)
                count += 1
                if record.get("sequence") != count or record.get("previous_hash") != previous:
                    raise JournalCorruption(f"journal chain invalid at record {count}")
                if record.get("record_hash") != _hash_record(record):
                    raise JournalCorruption(f"journal hash invalid at record {count}")
                previous = record["record_hash"]

            new_record: dict[str, Any] = {
                "sequence": count + 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_type": event_type,
                "previous_hash": previous,
                "payload": payload,
            }
            new_record["record_hash"] = _hash_record(new_record)
            handle.seek(0, os.SEEK_END)
            handle.write(json.dumps(new_record, ensure_ascii=False, sort_keys=True) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            return new_record

