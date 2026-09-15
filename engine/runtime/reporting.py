#!/usr/bin/env python3
"""Materialize reports only from gated finding nodes in the research graph."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from research_graph import ResearchGraph


REPORTABLE = {"verified", "reported", "accepted"}


def findings(graph: ResearchGraph) -> list[dict[str, Any]]:
    return [
        node
        for node in graph.nodes()
        if node["node_type"] == "finding" and node["status"] in REPORTABLE
    ]


def render_json(graph: ResearchGraph) -> str:
    document = {
        "schema_version": "0.1.0",
        "graph_revision": graph.revision(),
        "findings": [node["data"] for node in findings(graph)],
    }
    return json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def render_markdown(graph: ResearchGraph) -> str:
    selected = findings(graph)
    lines = [
        "# Verified vulnerability research report",
        "",
        f"Graph revision: `{graph.revision()}`",
        f"Reportable findings: `{len(selected)}`",
        "",
    ]
    for index, node in enumerate(selected, start=1):
        finding = node["data"]
        lines.extend(
            [
                f"## {index}. {finding['title']}",
                "",
                f"Finding ID: `{finding['finding_id']}`",
                "",
                "### Mechanism",
                "",
                finding["mechanism"],
                "",
                "### Impact",
                "",
                finding["impact"],
                "",
                "### Preconditions",
                "",
                *[f"- {item}" for item in finding["preconditions"]],
                "",
                "### Evidence",
                "",
                *[f"- `{item}`" for item in finding["evidence_ids"]],
                "",
                "### Counterreview",
                "",
                finding["skeptic_review"],
                "",
                "### Clean-room reproduction",
                "",
                f"Artifact: `{finding['clean_room_reproduction']['artifact_id']}`",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def write_once(path: Path, content: str) -> None:
    if path.exists():
        raise FileExistsError(f"refusing to overwrite report: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

