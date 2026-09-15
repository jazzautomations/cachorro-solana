#!/usr/bin/env python3
"""Low-volume, non-destructive boolean SQLi differential adapter."""

from __future__ import annotations

import hashlib
import re
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from capabilities import CapabilityBroker
from dns_guard import DNSGuard, DNSPin
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, untrusted_json


_NUMERIC = re.compile(r"^-?[0-9]+(?:\.[0-9]+)?$")
_STATUS = re.compile(br"^HTTP/[^ ]+ ([0-9]{3})(?: |$)", re.MULTILINE)


def _identified(headers: dict[str, str]) -> bool:
    return any(name.lower() == "x-hackerone" and value.strip() for name, value in headers.items())


def _mutated_urls(url: str, parameter: str) -> dict[str, str]:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("SQLi differential requires an http(s) URL")
    if parsed.username or parsed.password or parsed.fragment:
        raise ValueError("credentials and fragments are forbidden")
    pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=False)
    positions = [index for index, (name, _value) in enumerate(pairs) if name == parameter]
    if len(positions) != 1:
        raise ValueError("the selected parameter must occur exactly once")
    index = positions[0]
    original = pairs[index][1]
    if not original or len(original) > 128:
        raise ValueError("the selected parameter needs a non-empty value of at most 128 characters")
    if _NUMERIC.fullmatch(original):
        variants = {
            "baseline": original,
            "predicate_true": f"{original} AND 1=1",
            "predicate_false": f"{original} AND 1=2",
        }
    else:
        variants = {
            "baseline": original,
            "predicate_true": f"{original}' AND '1'='1",
            "predicate_false": f"{original}' AND '1'='2",
        }
    result: dict[str, str] = {}
    for label, value in variants.items():
        changed = list(pairs)
        changed[index] = (parameter, value)
        query = urlencode(changed, doseq=True)
        result[label] = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))
    return result


def _response_metrics(raw: bytes, duration_seconds: float) -> dict[str, object]:
    statuses = _STATUS.findall(raw)
    status = int(statuses[-1]) if statuses else 0
    separator = b"\r\n\r\n"
    if separator in raw:
        body = raw.split(separator, 1)[1]
    elif b"\n\n" in raw:
        body = raw.split(b"\n\n", 1)[1]
    else:
        body = raw
    return {
        "status": status,
        "body_bytes": len(body),
        "body_sha256": hashlib.sha256(body).hexdigest(),
        "duration_seconds": round(duration_seconds, 3),
    }


class SQLiDifferentialAdapter:
    name = "sqli-differential"
    action = "http.sqli.differential"

    def __init__(self, curl: Path, dns_guard: DNSGuard, *, sleeper=time.sleep):
        self.curl = curl.resolve()
        self.dns_guard = dns_guard
        self.sleeper = sleeper

    def plan(self, url: str, pin: DNSPin, required_headers: dict[str, str]) -> ExecutionPlan:
        if not _identified(required_headers):
            raise PermissionError("SQLi differential requires a signed X-Hackerone header")
        resolve = f"{pin.hostname}:{pin.port}:{pin.addresses[0]}"
        argv = [
            str(self.curl),
            "--disable",
            "--silent",
            "--show-error",
            "--include",
            "--max-time",
            "20",
            "--connect-timeout",
            "8",
            "--max-filesize",
            "2097152",
            "--max-redirs",
            "0",
            "--proto",
            "=http,https",
            "--noproxy",
            "*",
            "--resolve",
            resolve,
            "--request",
            "GET",
            "--url",
            url,
        ]
        for name, value in sorted(required_headers.items(), key=lambda item: item[0].lower()):
            if "\r" in name or "\n" in name or ":" in name:
                raise ValueError("invalid required header name")
            if "\r" in value or "\n" in value:
                raise ValueError("invalid required header value")
            argv.extend(("--header", f"{name}: {value}"))
        return ExecutionPlan(
            adapter=self.name,
            capability="experiment.web.differential",
            action=self.action,
            target=url,
            side_effect="network_read",
            argv=tuple(argv),
            cwd="/tmp",
            timeout_seconds=25,
            max_output_bytes=3_000_000,
            network=True,
        )

    def run(
        self,
        *,
        agent_name: str,
        url: str,
        parameter: str,
        scope_guard,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
        repetitions: int = 2,
        delay_seconds: float = 12.0,
    ) -> AdapterOutcome:
        if repetitions < 1 or repetitions > 3:
            raise ValueError("repetitions must be between 1 and 3")
        if delay_seconds < 12 or delay_seconds > 60:
            raise ValueError("delay must be between 12 and 60 seconds")
        urls = _mutated_urls(url, parameter)
        pin = self.dns_guard.pin(url, self.action, scope_guard)
        headers = scope_guard.required_headers
        observations: list[dict[str, object]] = []
        artifacts: list[dict[str, object]] = []
        capability_receipts: list[dict[str, object]] = []
        consecutive_5xx = 0
        baseline_duration: float | None = None
        stop_reason: str | None = None

        request_number = 0
        for repetition in range(1, repetitions + 1):
            for variant in ("baseline", "predicate_true", "predicate_false"):
                if request_number:
                    self.sleeper(delay_seconds)
                self.dns_guard.revalidate(pin, scope_guard, self.action)
                plan = self.plan(urls[variant], pin, headers)
                started = time.monotonic()
                capability, result, captured = execute_and_capture(
                    agent_name=agent_name,
                    plan=plan,
                    broker=broker,
                    executor=executor,
                    vault=vault,
                    agent_package_hash=agent_package_hash,
                    scope_receipt_id=scope_receipt_id,
                )
                duration = time.monotonic() - started
                request_number += 1
                metrics = _response_metrics(result.stdout, duration)
                if variant == "baseline" and baseline_duration is None:
                    baseline_duration = max(duration, 0.001)
                status = int(metrics["status"])
                consecutive_5xx = consecutive_5xx + 1 if 500 <= status <= 599 else 0
                observations.append(
                    {
                        "request_number": request_number,
                        "repetition": repetition,
                        "variant": variant,
                        "metrics": metrics,
                        "response": untrusted_json(result.stdout),
                        "artifact_ids": [item["artifact_id"] for item in captured],
                    }
                )
                artifacts.extend(captured)
                capability_receipts.append(capability.as_dict())
                if consecutive_5xx >= 2:
                    stop_reason = "two consecutive 5xx responses"
                    break
                if baseline_duration and duration > baseline_duration * 4 and duration > 4:
                    stop_reason = "response latency exceeded the safety multiplier"
                    break
            if stop_reason:
                break

        signatures: dict[str, set[tuple[object, object, object]]] = {
            name: set() for name in urls
        }
        for observation in observations:
            metrics = observation["metrics"]
            signatures[str(observation["variant"])].add(
                (metrics["status"], metrics["body_bytes"], metrics["body_sha256"])
            )
        stable = all(len(signatures[name]) == 1 for name in signatures)
        baseline = next(iter(signatures["baseline"]), None)
        predicate_true = next(iter(signatures["predicate_true"]), None)
        predicate_false = next(iter(signatures["predicate_false"]), None)
        candidate = bool(
            not stop_reason
            and stable
            and baseline is not None
            and baseline == predicate_true
            and predicate_false is not None
            and predicate_false != baseline
        )
        selected_value = next(
            value for name, value in parse_qsl(urlsplit(url).query, keep_blank_values=True)
            if name == parameter
        )
        normalized = {
            "classification": "candidate_boolean_differential" if candidate else "no_deterministic_signal",
            "candidate_only": True,
            "parameter": parameter,
            "mode": "numeric" if _NUMERIC.fullmatch(selected_value) else "string",
            "requests_sent": request_number,
            "repetitions_requested": repetitions,
            "delay_seconds": delay_seconds,
            "stopped_early": bool(stop_reason),
            "stop_reason": stop_reason,
            "observations": observations,
        }
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt={"requests": capability_receipts},
            execution={
                "requests_sent": request_number,
                "completed": not bool(stop_reason),
                "stopped_early": bool(stop_reason),
            },
            artifacts=tuple(artifacts),
            normalized=normalized,
        )
