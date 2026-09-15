#!/usr/bin/env python3
"""Pure scope checks used before a capability can reach an adapter."""

from __future__ import annotations

import ipaddress
import json
from fnmatch import fnmatchcase
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import jsonschema

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from scope_signing import verify_receipt


class ScopeDenied(PermissionError):
    pass


def _utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("scope timestamps must include a timezone")
    return parsed.astimezone(timezone.utc)


def _hostname(target: str) -> str:
    parsed = urlsplit(target if "://" in target else f"//{target}")
    host = parsed.hostname
    if not host:
        raise ValueError(f"target has no hostname: {target}")
    return host.rstrip(".").encode("idna").decode("ascii").lower()


def _host_matches(pattern: str, target: str) -> bool:
    host = _hostname(target)
    normalized = pattern.rstrip(".").encode("idna").decode("ascii").lower()
    if normalized.startswith("*."):
        suffix = normalized[2:]
        return host.endswith(f".{suffix}") and host != suffix
    return host == normalized


def _host_glob_matches(pattern: str, target: str) -> bool:
    """Match an entire hostname against a signed, narrowly validated glob."""
    host = _hostname(target)
    normalized = pattern.rstrip(".").encode("idna").decode("ascii").lower()
    if not normalized or any(character in normalized for character in "/:@[]\\"):
        raise ValueError("host glob contains a forbidden character")
    if normalized.count(".") < 2 or not set(normalized) <= set(
        "abcdefghijklmnopqrstuvwxyz0123456789-.*?"
    ):
        raise ValueError("host glob is not a bounded DNS pattern")
    return fnmatchcase(host, normalized)


def _url_prefix_matches(pattern: str, target: str) -> bool:
    allowed = urlsplit(pattern)
    candidate = urlsplit(target)
    if allowed.scheme.lower() != candidate.scheme.lower():
        return False
    if allowed.hostname is None or candidate.hostname is None:
        return False
    if not _host_matches(allowed.hostname, candidate.hostname):
        return False
    allowed_port = allowed.port or (443 if allowed.scheme.lower() == "https" else 80)
    candidate_port = candidate.port or (443 if candidate.scheme.lower() == "https" else 80)
    if allowed_port != candidate_port:
        return False
    base = allowed.path.rstrip("/") or "/"
    path = candidate.path or "/"
    return path == base or path.startswith(f"{base.rstrip('/')}/")


def _cidr_matches(pattern: str, target: str) -> bool:
    try:
        host = _hostname(target)
        address = ipaddress.ip_address(host)
        network = ipaddress.ip_network(pattern, strict=True)
    except ValueError:
        return False
    return address in network


def _filesystem_matches(pattern: str, target: str) -> bool:
    base = Path(pattern).resolve()
    candidate = Path(target).resolve()
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def _asset_matches(asset: dict[str, Any], target: str) -> bool:
    kind = asset["kind"]
    try:
        if kind == "host":
            return _host_matches(asset["value"], target)
        if kind == "host-glob":
            return _host_glob_matches(asset["value"], target)
        if kind == "url-prefix":
            return _url_prefix_matches(asset["value"], target)
        if kind == "cidr":
            return _cidr_matches(asset["value"], target)
        if kind == "filesystem":
            return _filesystem_matches(asset["value"], target)
    except (OSError, ValueError):
        return False
    return False


@dataclass(frozen=True)
class ScopeDecision:
    receipt_id: str
    action: str
    target: str
    side_effect: str
    matched_asset: str


class ScopeGuard:
    def __init__(
        self,
        receipt: dict[str, Any],
        schema: dict[str, Any],
        *,
        trusted_keys: list[Ed25519PublicKey] | None = None,
        require_signature: bool = False,
    ):
        jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(receipt)
        issued = _utc(receipt["issued_at"])
        expires = _utc(receipt["expires_at"])
        if expires <= issued:
            raise ValueError("scope receipt expires_at must be after issued_at")
        if require_signature:
            if not trusted_keys:
                raise InvalidSignature("no trusted scope-authority keys configured")
            verify_receipt(receipt, trusted_keys)
        self.receipt = receipt
        self.issued = issued
        self.expires = expires

    @property
    def required_headers(self) -> dict[str, str]:
        """Return headers fixed by the signed authorization receipt."""
        return dict(self.receipt["required_headers"])

    @classmethod
    def from_files(
        cls,
        receipt_path: Path,
        schema_path: Path,
        *,
        trusted_keys: list[Ed25519PublicKey] | None = None,
        require_signature: bool = False,
    ) -> "ScopeGuard":
        return cls(
            json.loads(receipt_path.read_text(encoding="utf-8")),
            json.loads(schema_path.read_text(encoding="utf-8")),
            trusted_keys=trusted_keys,
            require_signature=require_signature,
        )

    def authorize(
        self,
        action: str,
        target: str,
        *,
        side_effect: str = "none",
        at: datetime | None = None,
    ) -> ScopeDecision:
        moment = (at or datetime.now(timezone.utc)).astimezone(timezone.utc)
        if moment < self.issued:
            raise ScopeDenied("scope receipt is not active yet")
        if moment >= self.expires:
            raise ScopeDenied("scope receipt has expired")
        if side_effect not in self.receipt["allowed_side_effects"]:
            raise ScopeDenied(f"side effect is not authorized: {side_effect}")
        for denied in self.receipt["denied_assets"]:
            if _asset_matches(denied, target):
                raise ScopeDenied(f"target matches an explicit deny rule: {denied['value']}")
        for asset in self.receipt["assets"]:
            if _asset_matches(asset, target) and action in asset["actions"]:
                return ScopeDecision(
                    receipt_id=self.receipt["receipt_id"],
                    action=action,
                    target=target,
                    side_effect=side_effect,
                    matched_asset=asset["value"],
                )
        raise ScopeDenied(f"action {action!r} is outside scope for target {target!r}")
