---
name: clean-replay
description: Reproduce a candidate in a fresh pinned environment using the original treatment and control, preserve deviations, minimize without changing the oracle and report variance.
---

# Clean replay

Pin code, build flags, dependencies, corpus/input, configuration, identity and
state. Execute treatment and control from the same clean snapshot. Record each
attempt separately; never collapse failures into a success narrative.

If the original artifact cannot be replayed without modification, record the
deviation and return inconclusive until a new experiment is reviewed. Minimize
only after stable reproduction, and re-run the negative control after every
material minimization.

