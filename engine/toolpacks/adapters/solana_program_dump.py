#!/usr/bin/env python3
"""On-chain read-only Solana program/account dump adapter.

Wraps cachorro's ``scripts/fetch-target.sh --program-id`` (which uses the
``solana`` CLI + RPC ``getAccountInfo``) as a bounded ``network_read``
capability. The plan target is the RPC endpoint URL so the broker DNS-pins it
before the read; the program-id and cluster are arguments. It never signs or
sends a transaction (no keypair is in the plan), so it can never mutate the
target. Output (program bytes, account listing) is captured to the evidence
vault and treated as untrusted data.
"""

from __future__ import annotations

import re
from pathlib import Path

from capabilities import CapabilityBroker
from evidence_vault import EvidenceVault
from execution import ExecutionPlan, TrustedProcessExecutor

from .common import AdapterOutcome, execute_and_capture, execution_dict, untrusted_json


_BASE58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_CLUSTER_RPC = {
    "devnet": "https://api.devnet.solana.com",
    "testnet": "https://api.testnet.solana.com",
    "mainnet": "https://api.mainnet-beta.solana.com",
    "mainnet-beta": "https://api.mainnet-beta.solana.com",
}


class SolanaProgramDumpAdapter:
    name = "solana-program-dump"
    capability = "surface.solana.dump"
    action = "surface.solana.dump"

    def __init__(self, bash: Path, script: Path):
        self.bash = bash.resolve()
        self.script = script.resolve()

    def rpc_url(self, cluster: str) -> str:
        if cluster in _CLUSTER_RPC:
            return _CLUSTER_RPC[cluster]
        if cluster.startswith("https://"):
            return cluster
        raise ValueError(f"unknown cluster / non-https RPC: {cluster}")

    def plan(self, program_id: str, cluster: str, dest: Path) -> ExecutionPlan:
        if not _BASE58.fullmatch(program_id):
            raise ValueError(f"program id is not base58: {program_id}")
        url = self.rpc_url(cluster)
        dest = dest.resolve()
        dest.mkdir(parents=True, exist_ok=True)
        return ExecutionPlan(
            adapter=self.name,
            capability=self.capability,
            action=self.action,
            target=url,
            side_effect="network_read",
            argv=(str(self.bash), str(self.script), "--program-id", program_id, url, str(dest)),
            cwd=str(dest),
            timeout_seconds=120,
            max_output_bytes=4_000_000,
            network=True,
            environment={"HOME": "/root"},
        )

    def run(
        self,
        *,
        agent_name: str,
        program_id: str,
        cluster: str,
        dest: Path,
        broker: CapabilityBroker,
        executor: TrustedProcessExecutor,
        vault: EvidenceVault,
        agent_package_hash: str,
        scope_receipt_id: str,
    ) -> AdapterOutcome:
        plan = self.plan(program_id, cluster, dest)
        capability, result, artifacts = execute_and_capture(
            agent_name=agent_name,
            plan=plan,
            broker=broker,
            executor=executor,
            vault=vault,
            agent_package_hash=agent_package_hash,
            scope_receipt_id=scope_receipt_id,
        )
        normalized = {
            "classification": "onchain_surface" if result.returncode == 0 else "dump_failed",
            "candidate_only": True,
            "program_id": program_id,
            "cluster": cluster,
            "rpc": plan.target,
            "returncode": result.returncode,
            # solana CLI / RPC output is third-party data: wrap, never trust.
            "output": untrusted_json(result.stdout),
        }
        return AdapterOutcome(
            adapter=self.name,
            capability_receipt=capability.as_dict(),
            execution=execution_dict(result),
            artifacts=artifacts,
            normalized=normalized,
        )
