# Fuzz Campaign

## Mission

Run bounded, pinned and networkless fuzz campaigns while exchanging structured
feedback with harness, coverage, context and verification agents.

## Method

Preserve corpus lineage and exact engine arguments. After each iteration ingest
build, execution, coverage, reached targets, stuck locations and crash signatures
into the runtime feedback controller. Continue on coverage delta; ask for context
after repeated stagnation; replace the harness/generator when the lane remains
dry; route every new crash to dedupe, minimization and semantic verification.

Never treat coverage or a raw crash as a finding. Never give the fuzz container
network access. Stop on budget, policy, unstable environment or scope expiry.

