#!/usr/bin/env python3
"""Capability broker binding scope and agent policy to one immutable plan."""

from __future__ import annotations

import hashlib
import ipaddress
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit

import yaml

from dns_guard import DNSGuard, DNSPin
from execution import ExecutionPlan
from scope import ScopeDecision, ScopeGuard


ApprovalVerifier = Callable[[str, str, ExecutionPlan], bool]


@dataclass(frozen=True)
class CapabilityReceipt:
    receipt_id: str
    issued_at: str
    agent_name: str
    agent_package_hash: str
    scope_receipt_id: str
    capability: str
    adapter: str
    action: str
    target: str
    side_effect: str
    plan_digest: str
    matched_asset: str
    dns_pin: dict[str, object] | None
    control_plane: str | None

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


class CapabilityBroker:
    def __init__(
        self,
        bundle_root: Path,
        scope_guard: ScopeGuard,
        agent_hasher: Callable[[str], str],
        *,
        dns_guard: DNSGuard | None = None,
        approval_verifier: ApprovalVerifier | None = None,
    ):
        self.bundle_root = bundle_root.resolve()
        self.scope_guard = scope_guard
        self.agent_hasher = agent_hasher
        self.dns_guard = dns_guard or DNSGuard()
        self.approval_verifier = approval_verifier or (lambda _approval, _agent, _plan: False)
        self.policy = yaml.safe_load((self.bundle_root / "policies/default.yaml").read_text())

    def _manifest(self, agent_name: str) -> dict[str, object]:
        path = self.bundle_root / "agents" / agent_name / "manifest.yaml"
        if not path.is_file():
            raise KeyError(f"unknown agent package: {agent_name}")
        return yaml.safe_load(path.read_text(encoding="utf-8"))

    def authorize(
        self,
        agent_name: str,
        plan: ExecutionPlan,
        *,
        approval_id: str | None = None,
    ) -> CapabilityReceipt:
        manifest = self._manifest(agent_name)
        if plan.capability not in manifest["capabilities"]:
            raise PermissionError(f"agent lacks capability {plan.capability!r}")
        declared_tools = {item["name"]: item for item in manifest["tools"]}
        if plan.adapter not in declared_tools:
            raise PermissionError(f"agent has not declared adapter {plan.adapter!r}")
        tool = declared_tools[plan.adapter]
        declared_effects = set(manifest["side_effects"])
        if plan.side_effect != "none" and plan.side_effect not in declared_effects:
            raise PermissionError(f"agent has not declared side effect {plan.side_effect!r}")
        if plan.network and plan.side_effect != "network_read":
            raise PermissionError("network plans must declare network_read")
        if plan.control_plane and not plan.network:
            raise PermissionError("control-plane plans must declare network access")
        if plan.control_plane:
            allowed_control_adapters = set(self.policy.get("local_control_plane_adapters", []))
            if plan.adapter not in allowed_control_adapters:
                raise PermissionError("adapter is not approved for a local control plane")
            parsed_control = urlsplit(plan.control_plane)
            try:
                control_address = ipaddress.ip_address(parsed_control.hostname or "")
                control_port = parsed_control.port
            except ValueError as exc:
                raise PermissionError("control plane must use a literal loopback IP") from exc
            if (
                parsed_control.scheme != "http"
                or parsed_control.username
                or parsed_control.password
                or parsed_control.path not in {"", "/"}
                or parsed_control.query
                or parsed_control.fragment
                or not control_address.is_loopback
                or control_port is None
            ):
                raise PermissionError("control plane must be a bounded loopback HTTP endpoint")
        if tool["mutates_target"] and plan.side_effect != "target_state_change":
            raise PermissionError("mutating adapters must declare target_state_change")
        approval_effects = set(self.policy["side_effects"]["require_explicit_approval"])
        if plan.side_effect in approval_effects:
            if not approval_id or not self.approval_verifier(approval_id, agent_name, plan):
                raise PermissionError(f"side effect {plan.side_effect!r} requires external approval")

        decision: ScopeDecision = self.scope_guard.authorize(
            plan.action,
            plan.target,
            side_effect=plan.side_effect,
        )
        pin: DNSPin | None = None
        if plan.network and not plan.control_plane:
            pin = self.dns_guard.pin(plan.target, plan.action, self.scope_guard)

        unsigned = {
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "agent_name": agent_name,
            "agent_package_hash": self.agent_hasher(agent_name),
            "scope_receipt_id": decision.receipt_id,
            "capability": plan.capability,
            "adapter": plan.adapter,
            "action": plan.action,
            "target": plan.target,
            "side_effect": plan.side_effect,
            "plan_digest": plan.digest,
            "matched_asset": decision.matched_asset,
            "dns_pin": pin.as_dict() if pin else None,
            "control_plane": plan.control_plane,
        }
        receipt_id = "sha256:" + hashlib.sha256(
            json.dumps(unsigned, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return CapabilityReceipt(receipt_id=receipt_id, **unsigned)
