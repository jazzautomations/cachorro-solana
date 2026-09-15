#!/usr/bin/env python3
"""Fail-closed DNS pinning and rebinding checks for network adapters."""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Callable, Iterable
from urllib.parse import urlsplit

from scope import ScopeGuard, _asset_matches


class DNSDenied(PermissionError):
    pass


Resolver = Callable[[str, int], Iterable[str]]


def system_resolver(hostname: str, port: int) -> Iterable[str]:
    return {
        item[4][0]
        for item in socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    }


@dataclass(frozen=True)
class DNSPin:
    hostname: str
    port: int
    addresses: tuple[str, ...]
    resolved_at: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


class DNSGuard:
    def __init__(self, resolver: Resolver = system_resolver):
        self.resolver = resolver

    @staticmethod
    def _target(target: str) -> tuple[str, int]:
        parsed = urlsplit(target if "://" in target or target.startswith("//") else f"//{target}")
        if not parsed.hostname:
            raise DNSDenied(f"network target has no hostname: {target}")
        scheme = parsed.scheme.lower()
        default_port = 443 if scheme == "https" else 80
        return parsed.hostname.rstrip(".").lower(), parsed.port or default_port

    @staticmethod
    def _explicit_cidr_allows(guard: ScopeGuard, address: ipaddress._BaseAddress, action: str) -> bool:
        for asset in guard.receipt["assets"]:
            if asset["kind"] != "cidr" or action not in asset["actions"]:
                continue
            if address in ipaddress.ip_network(asset["value"], strict=True):
                return True
        return False

    @staticmethod
    def _explicitly_denied(guard: ScopeGuard, address: str) -> bool:
        return any(
            asset["kind"] == "cidr" and _asset_matches(asset, address)
            for asset in guard.receipt["denied_assets"]
        )

    def pin(self, target: str, action: str, guard: ScopeGuard) -> DNSPin:
        hostname, port = self._target(target)
        try:
            addresses = sorted({str(ipaddress.ip_address(item)) for item in self.resolver(hostname, port)})
        except (OSError, ValueError) as exc:
            raise DNSDenied(f"DNS resolution failed for {hostname}: {exc}") from exc
        if not addresses:
            raise DNSDenied(f"DNS resolution returned no addresses for {hostname}")
        for text in addresses:
            address = ipaddress.ip_address(text)
            if self._explicitly_denied(guard, text):
                raise DNSDenied(f"resolved address matches explicit deny CIDR: {text}")
            if not address.is_global and not self._explicit_cidr_allows(guard, address, action):
                raise DNSDenied(
                    f"non-public resolved address requires an explicit scoped CIDR: {text}"
                )
        return DNSPin(
            hostname=hostname,
            port=port,
            addresses=tuple(addresses),
            resolved_at=datetime.now(timezone.utc).isoformat(),
        )

    def revalidate(self, pin: DNSPin, guard: ScopeGuard, action: str) -> DNSPin:
        current = self.pin(f"//{pin.hostname}:{pin.port}", action, guard)
        if current.addresses != pin.addresses:
            raise DNSDenied(
                f"DNS answer changed after authorization: {pin.addresses!r} -> {current.addresses!r}"
            )
        return current
