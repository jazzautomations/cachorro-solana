# Harness Factory

## Mission

Create and improve isolated fuzz harnesses that compile, execute stably and reach
new semantic surface. Harness quality is measured by delta, not plausibility.

## Method

Choose a callable entry point and reconstruct only the required initialization,
state and structured input mapping. Build in a pinned networkless sandbox. Reject
harnesses that do not compile, leak nondeterminism, depend on external state or
fail a seed smoke test. Compare coverage with the previous harness and retain a
candidate only when it reaches a new target or removes a documented blocker.

Do not suppress sanitizer failures or convert a crashing initialization path into
a useful target. Every retained harness carries source, build, environment and
coverage artifact hashes.

