#!/usr/bin/env python3
"""Analyze model- and budget-matched ablation results with paired deltas."""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any

import jsonschema


METRICS = (
    "reported_findings", "false_positives", "clean_reproductions", "coverage",
    "cost_usd", "elapsed_seconds", "policy_violations",
)


class AblationAnalyzer:
    def __init__(self, schema_path: Path):
        self.schema = json.loads(schema_path.read_text(encoding="utf-8"))

    def analyze(self, results: list[dict[str, Any]], *, baseline: str, candidate: str) -> dict[str, Any]:
        validator = jsonschema.Draft202012Validator(self.schema)
        for result in results:
            validator.validate(result)
        selected = [item for item in results if item["condition"] in {baseline, candidate}]
        if not selected:
            raise ValueError("no results for requested conditions")
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for result in selected:
            groups[result["condition"]].append(result)
        if baseline not in groups or candidate not in groups:
            raise ValueError("both baseline and candidate conditions are required")
        indexed = {
            condition: {(row["target_id"], row["trial_id"]): row for row in rows}
            for condition, rows in groups.items()
        }
        if set(indexed[baseline]) != set(indexed[candidate]):
            raise ValueError("ablation conditions must contain identical target/trial pairs")
        for key in indexed[baseline]:
            base_row = indexed[baseline][key]
            candidate_row = indexed[candidate][key]
            comparable = ("model", "model_version", "target_snapshot", "budget_id")
            if any(base_row[field] != candidate_row[field] for field in comparable):
                raise ValueError(f"ablation pair {key!r} differs in model, snapshot or budget")

        summary: dict[str, Any] = {}
        for condition, rows in groups.items():
            unique_bugs = sorted({bug for row in rows for bug in row["verified_bug_ids"]})
            summary[condition] = {
                "trials": len(rows),
                "unique_verified_bugs": unique_bugs,
                "means": {metric: statistics.fmean(row[metric] for row in rows) for metric in METRICS},
            }
        base = summary[baseline]
        cand = summary[candidate]
        warnings = []
        if min(base["trials"], cand["trials"]) < 5:
            warnings.append("fewer than five trials per condition; do not promote from this result")
        promoted = (
            not warnings
            and len(cand["unique_verified_bugs"]) > len(base["unique_verified_bugs"])
            and cand["means"]["false_positives"] <= base["means"]["false_positives"]
            and cand["means"]["policy_violations"] == 0
        )
        return {
            "baseline": baseline,
            "candidate": candidate,
            "summary": summary,
            "deltas": {
                "unique_verified_bugs": len(cand["unique_verified_bugs"]) - len(base["unique_verified_bugs"]),
                **{metric: cand["means"][metric] - base["means"][metric] for metric in METRICS},
            },
            "warnings": warnings,
            "promotion_eligible": promoted,
        }
