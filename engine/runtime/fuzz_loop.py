#!/usr/bin/env python3
"""Persisted coverage-directed agent/fuzzer feedback controller."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import jsonschema

from journal import RoundJournal


@dataclass(frozen=True)
class FuzzDecision:
    action: str
    reason: str
    context_locations: tuple[str, ...] = ()
    crash_signatures: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


class HybridFuzzLoop:
    def __init__(self, workspace: Path, schema_path: Path):
        self.workspace = workspace.resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.schema = json.loads(schema_path.read_text(encoding="utf-8"))
        self.journal = RoundJournal(self.workspace / "feedback.jsonl")

    def history(self) -> list[dict[str, Any]]:
        return [record["payload"]["feedback"] for record in self.journal.records()]

    def ingest(self, feedback: dict[str, Any]) -> FuzzDecision:
        jsonschema.Draft202012Validator(self.schema).validate(feedback)
        history = self.history()
        if history and feedback["iteration"] != history[-1]["iteration"] + 1:
            raise ValueError("fuzz feedback iterations must be contiguous")
        if not history and feedback["iteration"] != 1:
            raise ValueError("first fuzz feedback iteration must be 1")

        decision = self._decide(history + [feedback])
        self.journal.append(
            "fuzz.feedback",
            {"feedback": feedback, "decision": decision.as_dict()},
        )
        return decision

    @staticmethod
    def _decide(history: list[dict[str, Any]]) -> FuzzDecision:
        current = history[-1]
        if not current["build_ok"]:
            return FuzzDecision("repair_harness", "Harness does not build; no coverage conclusion is valid.")
        if not current["execution_ok"]:
            return FuzzDecision("diagnose_harness", "Harness builds but cannot execute stably.")
        untriaged = [item["signature"] for item in current["crashes"] if item["oracle_status"] == "untriaged"]
        if untriaged:
            return FuzzDecision(
                "minimize_and_verify",
                "New crash signatures require deduplication, minimization, semantic oracle and negative control.",
                crash_signatures=tuple(sorted(untriaged)),
            )
        if current["coverage_delta"] > 0:
            return FuzzDecision("continue_campaign", "Coverage increased; preserve the corpus and continue this lane.")

        stagnant = 0
        for item in reversed(history):
            if item["build_ok"] and item["execution_ok"] and item["coverage_delta"] <= 0:
                stagnant += 1
            else:
                break
        if stagnant >= 2 and current["stuck_locations"]:
            return FuzzDecision(
                "expand_context",
                "Coverage stagnated; inspect the first unsatisfied branch or semantic blocker.",
                context_locations=tuple(current["stuck_locations"]),
            )
        if stagnant >= 3:
            return FuzzDecision(
                "replace_harness_or_generator",
                "Repeated zero-delta runs require an orthogonal harness, grammar or generator strategy.",
            )
        if current["reached_targets"]:
            return FuzzDecision(
                "semantic_input_generation",
                "Target code is reached without an oracle event; refine state and structured input constraints.",
            )
        return FuzzDecision("continue_campaign", "One dry iteration is insufficient to abandon the lane.")

