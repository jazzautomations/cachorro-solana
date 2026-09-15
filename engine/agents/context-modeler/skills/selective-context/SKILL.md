---
name: selective-context
description: Expand source and runtime context top-down from a precise question while tracking provenance, ambiguity, trust boundaries and coverage gaps.
---

# Selective context compilation

Prefer a call/data/state slice over a repository dump.

For each expansion, record why the new artifact is needed and which unresolved
edge it closes. Keep code, configuration, tests, history and runtime traces as
separate evidence classes. Stop expanding when another artifact would not change
the next experiment or its oracle.

Never compress away boundary crossings, error paths, ownership/lifetime changes,
normalization steps or authorization decisions.

