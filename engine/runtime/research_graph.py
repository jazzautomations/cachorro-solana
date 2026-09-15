#!/usr/bin/env python3
"""Typed SQLite research graph with an append-only audit log."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import jsonschema


NODE_TYPES = {
    "asset", "component", "version", "identity", "endpoint", "function",
    "trust_boundary", "state", "transition", "invariant", "claim",
    "observation", "hypothesis", "experiment", "evidence", "primitive",
    "chain", "mitigation", "contradiction", "finding",
}
STATUSES = {"observed", "inferred", "proposed", "testing", "supported", "candidate", "verified", "refuted", "stale", "reported", "accepted", "duplicate"}
INITIAL_STATUSES = {
    "observation": {"observed", "inferred"},
    "hypothesis": {"proposed"},
    "experiment": {"proposed"},
    "primitive": {"candidate"},
    "chain": {"candidate"},
    "contradiction": {"observed"},
}
DEFAULT_INITIAL_STATUSES = {"observed", "inferred"}
TYPE_TRANSITIONS = {
    "observation": {
        "observed": {"refuted", "stale"},
        "inferred": {"observed", "refuted", "stale"},
        "stale": {"observed", "refuted"},
    },
    "hypothesis": {
        "proposed": {"testing", "refuted", "stale"},
        "testing": {"supported", "refuted", "stale"},
        "supported": {"testing", "refuted", "stale"},
        "stale": {"testing", "refuted"},
    },
    "experiment": {
        "proposed": {"testing", "refuted", "stale"},
        "testing": {"supported", "refuted", "stale"},
        "stale": {"testing", "refuted"},
    },
    "primitive": {
        "candidate": {"refuted", "stale"},
        "verified": {"refuted", "stale"},
        "stale": {"candidate", "refuted"},
    },
    "chain": {
        "candidate": {"refuted", "stale"},
        "verified": {"refuted", "stale"},
        "stale": {"candidate", "refuted"},
    },
    "finding": {
        "verified": {"reported", "refuted", "stale"},
        "reported": {"accepted", "duplicate", "refuted"},
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class ResearchGraph:
    def __init__(self, path: Path, schema_root: Path | None = None):
        self.path = path.resolve()
        self.schema_root = (schema_root or Path(__file__).resolve().parents[1] / "schemas").resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS revisions (
                    revision INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    object_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS nodes (
                    node_id TEXT PRIMARY KEY,
                    node_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    artifact_ids_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    revision INTEGER NOT NULL REFERENCES revisions(revision)
                );
                CREATE TABLE IF NOT EXISTS edges (
                    edge_id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL REFERENCES nodes(node_id),
                    target_id TEXT NOT NULL REFERENCES nodes(node_id),
                    edge_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    artifact_ids_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    revision INTEGER NOT NULL REFERENCES revisions(revision)
                );
                """
            )

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _revision(connection: sqlite3.Connection, event_type: str, object_id: str, payload: dict[str, Any]) -> int:
        cursor = connection.execute(
            "INSERT INTO revisions(timestamp, event_type, object_id, payload_json) VALUES (?, ?, ?, ?)",
            (_now(), event_type, object_id, _json(payload)),
        )
        return int(cursor.lastrowid)

    def _add_node(
        self,
        node_id: str,
        node_type: str,
        status: str,
        *,
        data: dict[str, Any] | None = None,
        artifact_ids: list[str] | None = None,
    ) -> int:
        if node_type not in NODE_TYPES:
            raise ValueError(f"unknown node type: {node_type}")
        if status not in STATUSES:
            raise ValueError(f"unknown node status: {status}")
        if node_type in {"observation", "evidence"} and not artifact_ids:
            raise ValueError(f"{node_type} nodes require artifact_ids")
        payload = {"node_type": node_type, "status": status, "data": data or {}, "artifact_ids": artifact_ids or []}
        with self._transaction() as connection:
            revision = self._revision(connection, "node.added", node_id, payload)
            timestamp = _now()
            connection.execute(
                "INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (node_id, node_type, status, _json(data or {}), _json(artifact_ids or []), timestamp, timestamp, revision),
            )
            return revision

    def add_node(
        self,
        node_id: str,
        node_type: str,
        status: str,
        *,
        data: dict[str, Any] | None = None,
        artifact_ids: list[str] | None = None,
    ) -> int:
        if node_type in {"evidence", "finding"}:
            raise ValueError(f"{node_type} requires its gated add method")
        allowed = INITIAL_STATUSES.get(node_type, DEFAULT_INITIAL_STATUSES)
        if status not in allowed:
            raise ValueError(f"invalid initial status for {node_type}: {status}")
        return self._add_node(
            node_id,
            node_type,
            status,
            data=data,
            artifact_ids=artifact_ids,
        )

    def _load_schema(self, name: str) -> dict[str, Any]:
        return json.loads((self.schema_root / name).read_text(encoding="utf-8"))

    def add_evidence(self, document: dict[str, Any]) -> int:
        schema = self._load_schema("evidence.schema.json")
        jsonschema.Draft202012Validator(schema).validate(document)
        if document["verdict"] == "supports" and document["reproduction"]["successes"] < 1:
            raise ValueError("supporting evidence requires at least one successful reproduction")
        if document["reproduction"]["successes"] > document["reproduction"]["attempts"]:
            raise ValueError("evidence successes cannot exceed attempts")
        hypothesis = self.node(document["hypothesis_id"])
        if hypothesis["node_type"] != "hypothesis":
            raise ValueError("evidence hypothesis_id must reference a hypothesis node")
        revision = self._add_node(
            document["evidence_id"],
            "evidence",
            "observed",
            data=document,
            artifact_ids=document["artifact_ids"],
        )
        self.add_edge(
            f"edge:{document['evidence_id']}:{document['hypothesis_id']}",
            document["evidence_id"],
            document["hypothesis_id"],
            document["verdict"],
            status="observed",
            artifact_ids=document["artifact_ids"],
        )
        return revision

    def transition_node(self, node_id: str, new_status: str, *, reason: str, artifact_ids: list[str] | None = None) -> int:
        if len(reason.strip()) < 10:
            raise ValueError("status transition requires a meaningful reason")
        with self._transaction() as connection:
            current = connection.execute("SELECT node_type, status FROM nodes WHERE node_id = ?", (node_id,)).fetchone()
            if current is None:
                raise KeyError(node_id)
            allowed = TYPE_TRANSITIONS.get(current["node_type"], {}).get(current["status"], set())
            if new_status not in allowed:
                raise ValueError(
                    f"invalid status transition for {current['node_type']}: {current['status']} -> {new_status}"
                )
            payload = {"from": current["status"], "to": new_status, "reason": reason, "artifact_ids": artifact_ids or []}
            revision = self._revision(connection, "node.transitioned", node_id, payload)
            connection.execute(
                "UPDATE nodes SET status = ?, updated_at = ?, revision = ? WHERE node_id = ?",
                (new_status, _now(), revision, node_id),
            )
            return revision

    def verify_primitive(self, node_id: str, evidence_ids: list[str], *, reason: str) -> int:
        if not evidence_ids:
            raise ValueError("primitive verification requires evidence")
        primitive = self.node(node_id)
        if primitive["node_type"] not in {"primitive", "chain"} or primitive["status"] != "candidate":
            raise ValueError("only candidate primitives or chains can be verified")
        for evidence_id in evidence_ids:
            evidence = self.node(evidence_id)
            if evidence["node_type"] != "evidence" or evidence["data"].get("verdict") != "supports":
                raise ValueError(f"non-supporting evidence cannot verify a primitive: {evidence_id}")
        with self._transaction() as connection:
            payload = {"from": "candidate", "to": "verified", "reason": reason, "evidence_ids": evidence_ids}
            revision = self._revision(connection, "primitive.verified", node_id, payload)
            connection.execute(
                "UPDATE nodes SET status = 'verified', updated_at = ?, revision = ? WHERE node_id = ?",
                (_now(), revision, node_id),
            )
        for evidence_id in evidence_ids:
            edge_id = f"edge:{evidence_id}:{node_id}"
            self.add_edge(edge_id, evidence_id, node_id, "verifies", status="verified")
        return revision

    def add_finding(self, document: dict[str, Any]) -> int:
        schema = self._load_schema("finding.schema.json")
        jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(document)
        for primitive_id in document["primitive_ids"]:
            primitive = self.node(primitive_id)
            if primitive["node_type"] not in {"primitive", "chain"} or primitive["status"] != "verified":
                raise ValueError(f"finding references an unverified primitive: {primitive_id}")
        for evidence_id in document["evidence_ids"]:
            evidence = self.node(evidence_id)
            if evidence["node_type"] != "evidence" or evidence["data"].get("verdict") != "supports":
                raise ValueError(f"finding references non-supporting evidence: {evidence_id}")
        revision = self._add_node(
            document["finding_id"],
            "finding",
            "verified",
            data=document,
            artifact_ids=document["evidence_ids"] + [document["clean_room_reproduction"]["artifact_id"]],
        )
        for primitive_id in document["primitive_ids"]:
            self.add_edge(
                f"edge:{primitive_id}:{document['finding_id']}",
                primitive_id,
                document["finding_id"],
                "materializes",
                status="verified",
            )
        return revision

    def add_edge(
        self,
        edge_id: str,
        source_id: str,
        target_id: str,
        edge_type: str,
        *,
        status: str = "inferred",
        data: dict[str, Any] | None = None,
        artifact_ids: list[str] | None = None,
    ) -> int:
        if status not in STATUSES:
            raise ValueError(f"unknown edge status: {status}")
        payload = {"source_id": source_id, "target_id": target_id, "edge_type": edge_type, "status": status, "data": data or {}, "artifact_ids": artifact_ids or []}
        with self._transaction() as connection:
            revision = self._revision(connection, "edge.added", edge_id, payload)
            connection.execute(
                "INSERT INTO edges VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (edge_id, source_id, target_id, edge_type, status, _json(data or {}), _json(artifact_ids or []), _now(), revision),
            )
            return revision

    def node(self, node_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM nodes WHERE node_id = ?", (node_id,)).fetchone()
        if row is None:
            raise KeyError(node_id)
        result = dict(row)
        result["data"] = json.loads(result.pop("data_json"))
        result["artifact_ids"] = json.loads(result.pop("artifact_ids_json"))
        return result

    def revision(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COALESCE(MAX(revision), 0) AS revision FROM revisions").fetchone()
        return int(row["revision"])

    def nodes(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM nodes ORDER BY node_id").fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["data"] = json.loads(item.pop("data_json"))
            item["artifact_ids"] = json.loads(item.pop("artifact_ids_json"))
            results.append(item)
        return results

    def edges(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM edges ORDER BY edge_id").fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["data"] = json.loads(item.pop("data_json"))
            item["artifact_ids"] = json.loads(item.pop("artifact_ids_json"))
            results.append(item)
        return results
