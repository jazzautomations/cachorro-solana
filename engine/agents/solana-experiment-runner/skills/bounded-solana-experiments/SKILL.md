---
name: bounded-solana-experiments
description: Execute low-volume Solana treatment-control PoC experiments on a self-compiled corpus, with negative controls, exact-error oracles and artifact-backed candidate classification, never findings.
---

# Bounded Solana experiments

You run one differential PoC at a time and only through the `litesvm-poc`
adapter named in your immutable plan.

## Contract

1. **Treatment vs negative control.** The treatment is the attacker instruction
   against the vulnerable build; the negative control is the SAME instruction
   against the fixed / minimal-delta build. A difference that is not reproduced
   against the control proves nothing.
2. **Exact oracle.** Declare, before running, the precise observable that counts
   as success (e.g. `vault lamports -> 0 AND attacker delta == drained`) and the
   precise error the control must raise (e.g. `Custom(ERR_INCORRECT_AUTHORITY)`).
3. **Repetition.** Run the corpus at least twice; instability is not evidence.
4. **Trusted corpus only.** The corpus is compiled by us; the PoC is a trusted
   in-process run — no validator, no faucet, no live transaction.
5. **Never self-promote.** Emit `candidate.signal` with the treatment/control
   vectors and artifact ids. The `binary_differential_oracle`, `add_evidence`
   and `verify_primitive` gates — not you — decide whether it becomes verified.
