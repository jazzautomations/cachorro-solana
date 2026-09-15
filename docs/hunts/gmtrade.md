# GMTrade (gmsol-labs/gmx-solana) — Hunt Report

**Target:** GMTrade / gmx-solana — Immunefi bug bounty (max $100k, no KYC, Rust/Anchor)
**In-scope programs (ONLY):** `store`, `treasury`, `liquidity-provider`. Everything else (exchange CLI, sdk, other programs) is out of scope and treated as context only.
**Discipline:** Source analysis only. No mainnet execution, no transactions, no fund movement. Any PoC runs on a **local validator/fork** and is Felipe's step, from his own account, before submission.
**Date:** 2026-09-15 · Repo run: `gmtrade_1789497977`

---

## Verdict

**Survivors after adversarial refutation: 0.**

No candidate reached the bar of a confirmed, exploitable bug. Every candidate raised in the audit pass was refuted by the skeptic — the "missing" guard was, in each case, actually enforced in the Anchor `#[derive(Accounts)]` struct (`has_one` / `seeds` / `bump` / `signer` / `constraint=`), in a shared `ops/` validation helper, or by an upstream authority/role check.

**I am not claiming a critical here.** Honestly stated: there is **no clearly critical or high finding that survived**. The strongest *residual* areas that still merit a focused human pass are the pool/fee/precision math in `store/src/ops/` and the treasury swap path — see "Needs a human look" below. These are areas of *uncertainty*, not confirmed bugs, and would need local repro before anyone treats them as real.

---

## Ranked survivors (severity × confidence)

| # | Severity | Confidence | file:line | Vuln class | One-line impact |
|---|----------|-----------|-----------|------------|-----------------|
| — | — | — | — | — | **No findings survived refutation.** |

There is nothing to submit to Immunefi from this pass. A submission now would be a false positive and burn program goodwill / the no-KYC relationship.

---

## Why the candidates fell (pattern of refutation)

Each refuted candidate died to one of these — worth recording so the next pass doesn't re-raise them:

- **"Missing signer/authority check"** → the authority was enforced by `has_one = authority` / a role gate in `store/src/instructions/roles.rs` or the account struct, not the handler body. The handler *looked* naked because the check lives in the constraint.
- **"Missing has_one between related accounts"** → the linkage (store ↔ market ↔ token_config) was pinned by `seeds` + `bump` PDA derivation, so a mismatched account can't be substituted.
- **"Arbitrary CPI / unpinned program id"** → the CPI target was constrained to a known program via `address =` / a pinned constant, or the callback program is itself validated against stored config.
- **"init_if_needed reinit"** → re-init was gated by a discriminator/`bump` check or an explicit `constraint` that the account be freshly zeroed.
- **"Integer overflow in fee/pool math"** → the arithmetic used checked ops / `u128` intermediates in the `ops/` helpers, and the skeptic couldn't produce an input that overflows within realistic bounds.

None of these reached a working exploit path, so none are reported as findings.

---

## What was inspected

- **`store`** (~bulk of the ~45k in-scope LOC): `instructions/` (config, market, gt, oracle, glv, exchange, token_config, roles, user, virtual_inventory, callback, migration) and the `ops/` math layer (deposit, withdrawal, order, shift, market, glv, execution_fee). Focus: authority/role gates, PDA seed derivation, and the fee/precision math in `ops/`.
- **`treasury`**: config, gt_bank, store, swap, treasury instructions + `states/`, `roles.rs`. Focus: the swap path and GT-bank accounting.
- **`liquidity-provider`**: single `lib.rs` (~1500 LOC). Focus: init/authority and any reward/accounting math.

Method per candidate: read the handler body, then the `#[derive(Accounts)]` constraints, then any shared `ops/`/helper it calls — confirm a guard is *genuinely* absent before claiming it. That last step is exactly what killed every candidate.

---

## Coverage gaps (honest)

- **Cross-program invariants** between `store` and `treasury` (e.g. GT accounting consistency across a swap that touches both) were reasoned about statically, not exercised. A mismatch that only shows under a specific instruction ordering would not surface from single-file reads.
- **`ops/` precision & rounding**: the checked-arithmetic argument rules out overflow, but *rounding-direction / dust-accumulation* bugs (value siphoned over many deposits/withdrawals via favorable rounding) are NOT ruled out by reading alone — this class only shows up numerically.
- **Oracle staleness/manipulation** in `store/src/instructions/oracle/`: the freshness/confidence checks were read as present, but the exact staleness thresholds vs. GMX-Solana's price-feed cadence weren't validated against live feed behavior.
- **`liquidity-provider`** got lighter coverage than `store`; it's newer/single-file and deserves its own dedicated pass.

## Needs a human look (uncertain, not findings)

1. **`ops/` rounding direction** (deposit.rs / withdrawal.rs / order.rs) — build a local numeric harness, not a static read, and check whether repeated min-size deposit→withdraw cycles net a gain to the user at the pool's expense.
2. **treasury `swap.rs`** — confirm the swap can't be induced to credit GT-bank inconsistently across the store↔treasury boundary.
3. **oracle freshness thresholds** — confirm staleness window matches the actual Chainlink/price-feed update cadence used in prod.

If any of these is to be pursued, the next step is a **local-fork numeric/behavioral harness** (below), NOT another source read — reading has already been exhausted for the confirmable classes.

## Generic local-fork PoC plan (for whichever uncertain area gets promoted)

There is no confirmed bug to PoC yet. When a human elevates one of the three items, prove it on a **local validator** (`anchor test` / `solana-test-validator`), never mainnet:
- **Accounts:** deploy `store` + `treasury` (+ `liquidity-provider` if relevant) locally; create a store, one market, token configs, and two user wallets (victim LP + attacker).
- **Oracle:** stand up the mock price feed (`mock-chainlink-verifier` is in-tree) and set a controlled price; the *assertion* is on pool value / user token balance before vs. after.
- **Attacker instruction:** drive the suspected path (e.g. repeated min deposit/withdraw, or the treasury swap ordering) in a loop.
- **Assertion that proves impact:** attacker end-balance > start-balance, OR pool/GT-bank invariant (sum of shares · price == backing) violated by more than rounding tolerance. No assertion that fires ⇒ not a bug; drop it.

---

*Prepared by the lead auditor. Zero confirmed findings this pass. Immunefi submission is Felipe's action, only after a local repro that fires the assertion above.*
