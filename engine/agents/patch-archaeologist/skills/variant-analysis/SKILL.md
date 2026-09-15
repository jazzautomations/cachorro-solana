---
name: variant-analysis
description: Reconstruct the invariant behind a fix and search semantic siblings, alternate paths, copied implementations and incomplete backports without treating text similarity as proof.
---

# Variant analysis

Read the fix as a hypothesis about an invariant. Compare behavior before and
after, then express the change as control/data/state conditions independent of
identifier names. Search for those conditions across callers, siblings, forks,
backports and error paths.

For every candidate, record both similarity and divergence. A strong seed says
why the old failure mechanism may still exist and what minimal observation would
falsify it. Preserve classified negatives with exact locations.

