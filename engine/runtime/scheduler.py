#!/usr/bin/env python3
"""Deterministic portfolio scheduler for candidate research rounds."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import jsonschema


@dataclass(frozen=True)
class RankedProposal:
    proposal: dict[str, Any]
    score: float


def proposal_score(proposal: dict[str, Any]) -> float:
    numerator = (
        proposal["information_gain"]
        * proposal["impact_potential"]
        * proposal["reachability"]
        * proposal["novelty"]
        * proposal["exploration_bonus"]
    )
    denominator = proposal["cost"] * proposal["operational_risk"] * proposal["difficulty"]
    repetition_penalty = (1 + proposal["repetition_count"]) ** 2
    return numerator / denominator / repetition_penalty


def validate_proposals(proposals: Iterable[dict[str, Any]], schema: dict[str, Any]) -> list[dict[str, Any]]:
    validator = jsonschema.Draft202012Validator(schema)
    validated: list[dict[str, Any]] = []
    seen: set[str] = set()
    for proposal in proposals:
        validator.validate(proposal)
        proposal_id = proposal["proposal_id"]
        if proposal_id in seen:
            raise ValueError(f"duplicate proposal_id: {proposal_id}")
        seen.add(proposal_id)
        validated.append(proposal)
    return validated


def rank_proposals(proposals: Iterable[dict[str, Any]]) -> list[RankedProposal]:
    ranked = [RankedProposal(proposal=item, score=proposal_score(item)) for item in proposals]
    return sorted(ranked, key=lambda item: (-item.score, item.proposal["proposal_id"]))


def select_portfolio(
    proposals: Iterable[dict[str, Any]],
    slots: int,
    *,
    orthogonal_slots: int = 1,
) -> list[RankedProposal]:
    if slots < 1:
        raise ValueError("slots must be positive")
    if orthogonal_slots < 0 or orthogonal_slots >= slots:
        if slots == 1 and orthogonal_slots == 0:
            pass
        else:
            raise ValueError("orthogonal_slots must be non-negative and smaller than slots")

    ranked = [item for item in rank_proposals(proposals) if item.score > 0]
    if slots == 1:
        return ranked[:1]

    primary_count = max(1, slots - orthogonal_slots)
    selected = ranked[:primary_count]
    selected_ids = {item.proposal["proposal_id"] for item in selected}
    selected_lanes = {item.proposal["lane"] for item in selected}

    diverse = [
        item
        for item in ranked
        if item.proposal["proposal_id"] not in selected_ids
        and item.proposal["lane"] not in selected_lanes
    ]
    for item in diverse[:orthogonal_slots]:
        selected.append(item)
        selected_ids.add(item.proposal["proposal_id"])
        selected_lanes.add(item.proposal["lane"])

    if len(selected) < slots:
        for item in ranked:
            if item.proposal["proposal_id"] not in selected_ids:
                selected.append(item)
                selected_ids.add(item.proposal["proposal_id"])
                if len(selected) == slots:
                    break
    return selected


def load_and_select(proposals_path: Path, schema_path: Path, slots: int) -> list[RankedProposal]:
    proposals = json.loads(proposals_path.read_text(encoding="utf-8"))
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    if not isinstance(proposals, list):
        raise ValueError("proposal file must contain a JSON array")
    return select_portfolio(validate_proposals(proposals, schema), slots)
