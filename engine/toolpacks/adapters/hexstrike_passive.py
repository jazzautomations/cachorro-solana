#!/usr/bin/env python3
"""Closed-profile bridge to a loopback HexStrike service.

HexStrike's public server builds shell command strings from request parameters.
This adapter therefore exposes only passive discovery profiles with payloads
constructed entirely by the adapter. Free-form arguments are never accepted.
"""

from __future__ import annotations

import http.client
import ipaddress
import json
import re
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlsplit

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, ExecutionResult

from .common import AdapterOutcome, execute_and_capture, execution_dict, untrusted_json


_DOMAIN_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
Transport = Callable[[str, int, str, bytes, int, int], tuple[int, bytes]]


@dataclass(frozen=True)
class PassiveProfile:
    endpoint: str
    target_field: str
    fixed_parameters: dict[str, object]
    source_kind: str


PROFILES: dict[str, PassiveProfile] = {
    "subfinder-passive": PassiveProfile(
        endpoint="/api/tools/subfinder",
        target_field="domain",
        fixed_parameters={"silent": True, "all_sources": False, "additional_args": ""},
        source_kind="passive-subdomain-enumeration",
    ),
    "gau-archive": PassiveProfile(
        endpoint="/api/tools/gau",
        target_field="domain",
        fixed_parameters={
            "providers": "wayback,commoncrawl,otx,urlscan",
            "include_subs": True,
            "blacklist": "png,jpg,gif,jpeg,swf,woff,svg,pdf,css,ico",
            "additional_args": "",
        },
        source_kind="public-archive-url-enumeration",
    ),
    "waybackurls-archive": PassiveProfile(
        endpoint="/api/tools/waybackurls",
        target_field="domain",
        fixed_parameters={"get_versions": False, "no_subs": False, "additional_args": ""},
        source_kind="public-archive-url-enumeration",
    ),
}


def normalize_domain(value: str) -> str:
    """Return a shell-metacharacter-free ASCII DNS name."""
    if not isinstance(value, str) or not value or len(value) > 253:
        raise ValueError("HexStrike passive profiles require a bounded domain name")
    forbidden = "/*?&;|`$()[]{}\\'\""
    if value != value.strip() or "://" in value or any(character in value for character in forbidden):
        raise ValueError("HexStrike passive target must be a plain domain name")
    try:
        domain = value.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise ValueError("HexStrike passive target is not a valid IDNA domain") from exc
    labels = domain.split(".")
    if len(labels) < 2 or any(not _DOMAIN_LABEL.fullmatch(label) for label in labels):
        raise ValueError("HexStrike passive target is not a valid domain name")
    return domain


def loopback_service(value: str) -> tuple[str, int, str]:
    parsed = urlsplit(value)
    if parsed.scheme != "http" or parsed.username or parsed.password:
        raise ValueError("HexStrike service must use unauthenticated HTTP on a loopback IP")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment or not parsed.hostname:
        raise ValueError("HexStrike service URL may contain only a loopback host and port")
    try:
        address = ipaddress.ip_address(parsed.hostname)
    except ValueError as exc:
        raise ValueError("HexStrike service host must be a literal loopback IP") from exc
    if not address.is_loopback:
        raise ValueError("remote HexStrike services are forbidden")
    try:
        parsed_port = parsed.port
    except ValueError as exc:
        raise ValueError("invalid HexStrike service port") from exc
    port = 8888 if parsed_port is None else parsed_port
    if not 1 <= port <= 65535:
        raise ValueError("invalid HexStrike service port")
    canonical_host = address.compressed
    canonical_url = f"http://[{canonical_host}]:{port}" if address.version == 6 else f"http://{canonical_host}:{port}"
    return canonical_host, port, canonical_url


def _canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


class HexStrikeLoopbackExecutor:
    """POST a broker-bound passive profile to a loopback HexStrike API."""

    def __init__(self, transport: Transport | None = None):
        self.transport = transport or self._http_post

    @staticmethod
    def _http_post(host: str, port: int, endpoint: str, body: bytes, timeout: int, limit: int) -> tuple[int, bytes]:
        connection = http.client.HTTPConnection(host, port, timeout=timeout)
        try:
            connection.request(
                "POST",
                endpoint,
                body=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            response = connection.getresponse()
            return response.status, response.read(limit + 1)
        finally:
            connection.close()

    @staticmethod
    def _invocation(plan: ExecutionPlan) -> tuple[str, int, str, bytes]:
        if plan.adapter != "hexstrike-passive" or len(plan.argv) != 4 or plan.argv[0] != "hexstrike-loopback":
            raise PermissionError("invalid HexStrike execution plan")
        host, port, _ = loopback_service(plan.argv[1])
        endpoint = plan.argv[2]
        try:
            payload = json.loads(plan.argv[3])
        except json.JSONDecodeError as exc:
            raise PermissionError("invalid HexStrike plan payload") from exc
        profile = next((item for item in PROFILES.values() if item.endpoint == endpoint), None)
        if profile is None:
            raise PermissionError("HexStrike endpoint is not in the passive allowlist")
        expected = {profile.target_field: normalize_domain(plan.target), **profile.fixed_parameters}
        if payload != expected:
            raise PermissionError("HexStrike payload differs from its closed profile")
        return host, port, endpoint, _canonical(payload).encode("ascii")

    def run(self, plan: ExecutionPlan, authorized_plan_digest: str) -> ExecutionResult:
        if plan.digest != authorized_plan_digest:
            raise PermissionError("execution plan changed after capability authorization")
        host, port, endpoint, body = self._invocation(plan)
        try:
            status, response = self.transport(host, port, endpoint, body, plan.timeout_seconds, plan.max_output_bytes)
            truncated = len(response) > plan.max_output_bytes
            response = response[: plan.max_output_bytes]
            return ExecutionResult(
                plan_digest=plan.digest,
                returncode=0 if 200 <= status < 300 else 1,
                stdout=response,
                stderr=b"" if 200 <= status < 300 else f"HexStrike HTTP status {status}".encode(),
                timed_out=False,
                truncated=truncated,
            )
        except (OSError, http.client.HTTPException) as exc:
            return ExecutionResult(
                plan_digest=plan.digest,
                returncode=1,
                stdout=b"",
                stderr=f"HexStrike loopback request failed: {exc}".encode("utf-8", errors="replace"),
                timed_out=isinstance(exc, TimeoutError),
                truncated=False,
            )


class HexStrikePassiveAdapter:
    name = "hexstrike-passive"

    def __init__(self, server_url: str = "http://127.0.0.1:8888", *, transport: Transport | None = None):
        _, _, self.server_url = loopback_service(server_url)
        self.executor = HexStrikeLoopbackExecutor(transport)

    def plan(self, profile_name: str, target: str) -> ExecutionPlan:
        try:
            profile = PROFILES[profile_name]
        except KeyError as exc:
            raise ValueError(f"unknown HexStrike passive profile: {profile_name}") from exc
        domain = normalize_domain(target)
        payload = {profile.target_field: domain, **profile.fixed_parameters}
        return ExecutionPlan(
            adapter=self.name,
            capability="surface.hexstrike.passive",
            action="http.observe",
            target=domain,
            side_effect="network_read",
            argv=("hexstrike-loopback", self.server_url, profile.endpoint, _canonical(payload)),
            cwd="/tmp",
            timeout_seconds=300,
            max_output_bytes=2_000_000,
            network=True,
            control_plane=self.server_url,
        )

    @staticmethod
    def _candidates(profile_name: str, target: str, raw: bytes) -> list[str]:
        try:
            document = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return []
        stdout = document.get("stdout", "") if isinstance(document, dict) else ""
        if not isinstance(stdout, str):
            return []
        candidates: set[str] = set()
        for line in stdout.splitlines():
            value = line.strip()
            if profile_name == "subfinder-passive":
                try:
                    domain = normalize_domain(value)
                except ValueError:
                    continue
                if domain == target or domain.endswith(f".{target}"):
                    candidates.add(domain)
            else:
                try:
                    parsed = urlsplit(value)
                    hostname = normalize_domain(parsed.hostname or "")
                except (ValueError, UnicodeError):
                    continue
                if parsed.scheme in {"http", "https"} and (hostname == target or hostname.endswith(f".{target}")):
                    candidates.add(value)
        return sorted(candidates)[:10_000]

    def run(
        self,
        *,
        agent_name: str,
        profile_name: str,
        target: str,
        scope_guard,
        broker: CapabilityBroker,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
    ) -> AdapterOutcome:
        domain = normalize_domain(target)
        plan = self.plan(profile_name, domain)
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=self.executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        profile = PROFILES[profile_name]
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=artifacts,
            normalized={
                "classification": "observation_only",
                "promotion_eligible": False,
                "profile": profile_name,
                "source_kind": profile.source_kind,
                "target": domain,
                "candidates": self._candidates(profile_name, domain, result.stdout),
                "response": untrusted_json(result.stdout),
                "stderr": untrusted_json(result.stderr),
            },
        )
