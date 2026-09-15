#!/usr/bin/env python3
"""GET/HEAD-only HTTP observation adapter with pinned DNS and no redirects."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit

from capabilities import CapabilityBroker
from dns_guard import DNSGuard, DNSPin
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict, untrusted_json


class HTTPObserveAdapter:
    name = "http-observe"

    def __init__(self, curl: Path, dns_guard: DNSGuard):
        self.curl = curl.resolve()
        self.dns_guard = dns_guard

    def plan(
        self,
        url: str,
        pin: DNSPin,
        *,
        method: str = "GET",
        required_headers: dict[str, str] | None = None,
    ) -> ExecutionPlan:
        parsed = urlsplit(url)
        method = method.upper()
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("HTTP adapter requires an http(s) URL")
        if method not in {"GET", "HEAD"}:
            raise PermissionError("HTTP observation adapter supports only GET and HEAD")
        if parsed.username or parsed.password:
            raise ValueError("credentials in URLs are forbidden")
        resolve = f"{pin.hostname}:{pin.port}:{pin.addresses[0]}"
        argv = [
            str(self.curl), "--disable", "--silent", "--show-error", "--include",
            "--max-time", "30", "--connect-timeout", "10", "--max-filesize", "2097152",
            "--max-redirs", "0", "--proto", "=http,https", "--noproxy", "*",
            "--resolve", resolve, "--request", method, "--url", url,
        ]
        for name, value in sorted((required_headers or {}).items(), key=lambda item: item[0].lower()):
            if "\r" in name or "\n" in name or ":" in name:
                raise ValueError("invalid required header name")
            if "\r" in value or "\n" in value:
                raise ValueError("invalid required header value")
            argv.extend(("--header", f"{name}: {value}"))
        if method == "HEAD":
            argv.append("--head")
        return ExecutionPlan(
            adapter=self.name,
            capability="surface.http.observe",
            action="http.observe",
            target=url,
            side_effect="network_read",
            argv=tuple(argv),
            cwd="/tmp",
            timeout_seconds=40,
            max_output_bytes=3_000_000,
            network=True,
        )

    def run(
        self,
        *,
        agent_name: str,
        url: str,
        scope_guard,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
        method: str = "GET",
    ) -> AdapterOutcome:
        initial_pin = self.dns_guard.pin(url, "http.observe", scope_guard)
        plan = self.plan(
            url,
            initial_pin,
            method=method,
            required_headers=scope_guard.required_headers,
        )
        self.dns_guard.revalidate(initial_pin, scope_guard, "http.observe")
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=artifacts,
            normalized={"response": untrusted_json(result.stdout), "stderr": untrusted_json(result.stderr)},
        )
