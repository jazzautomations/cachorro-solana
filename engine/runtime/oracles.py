#!/usr/bin/env python3
"""Deterministic causal oracles for repeated treatment/control observations."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class OracleVerdict:
    verdict: str
    treatment_successes: int
    treatment_attempts: int
    control_successes: int
    control_attempts: int
    reason: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def binary_differential_oracle(
    treatment: list[bool],
    control: list[bool],
    *,
    minimum_successes: int = 2,
) -> OracleVerdict:
    if not treatment or not control:
        raise ValueError("oracle requires both treatment and negative-control attempts")
    if minimum_successes < 1:
        raise ValueError("minimum_successes must be positive")
    treatment_successes = sum(treatment)
    control_successes = sum(control)
    if treatment_successes >= minimum_successes and control_successes == 0:
        verdict = "supports"
        reason = "The declared event reproduced in treatment and remained absent from the negative control."
    elif treatment_successes == 0 and control_successes == 0:
        verdict = "refutes"
        reason = "The declared event did not reproduce in treatment or control under these conditions."
    else:
        verdict = "inconclusive"
        reason = "The event is unstable, under-reproduced, or also present in the negative control."
    return OracleVerdict(
        verdict=verdict,
        treatment_successes=treatment_successes,
        treatment_attempts=len(treatment),
        control_successes=control_successes,
        control_attempts=len(control),
        reason=reason,
    )

