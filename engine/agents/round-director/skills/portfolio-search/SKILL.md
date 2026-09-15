---
name: portfolio-search
description: Rank independent research trajectories by expected information gain, impact, novelty, cost, operational risk and reachability.
---

# Portfolio search

Use when several valid next rounds compete for limited budget.

1. Reject candidates lacking a bounded objective, scope match or stopping rule.
2. Normalize each factor to `[0, 1]`; record both the raw assessment and rationale.
3. Rank with the framework formula, then reserve at least one slot for an
   orthogonal trajectory when budget permits.
4. Penalize repeated equivalent attempts with unchanged context or coverage.
5. Re-score after every graph delta; never carry a score forward blindly.

The score prioritizes experiments. It does not measure exploitability or truth.

