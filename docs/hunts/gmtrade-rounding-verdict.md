# GMTrade (gmsol-labs/gmx-solana) — Rounding / Dust Value-Leak Verdict

**Target:** GMTrade / gmx-solana — Immunefi bug bounty. In-scope: `store`, `treasury`, `liquidity-provider`.
**Lead under test:** favorable-rounding / dust value-leak in the store program's deposit/withdraw/order math, and the pool-backing invariant (the one residual "needs a human look" item from `docs/hunts/gmtrade.md`).
**Date:** 2026-09-15 · Repo run: `gmtrade_1789497977`
**Discipline:** audit + local numeric repro only. No mainnet, no fund movement (per `AGENTS.md`).

## Verdict: NOT A BUG.

The deposit → withdraw rounding is **pool-favorable / conservative within rounding tolerance**. Across every scenario, size, and price tested, an attacker looping min-size deposit→withdraw cycles **never** ended with more value than they started (best single-iteration net = **0**, never positive; cumulative net = **0** in the zero-fee case, strongly **negative** once real fees apply). No value is extractable from nothing; the pool-backing invariant holds exactly.

## How it was proven (numeric harness, not a source read)

The on-chain `store` deposit/withdraw amount math is a thin wrapper over the pure-Rust `gmsol-model` crate (`crates/model`): `Deposit::execute` / `Withdrawal::execute`, backed by `utils::usd_to_market_token_amount` and `utils::market_token_amount_to_usd`. The harness drives that **exact production code** with deterministic oracle prices (the same deterministic-price role `mock-chainlink-verifier` plays on a validator), so the numbers are identical to what the program computes on-chain — without the entangled devnet-clone validator harness.

- Harness crate: `harness/gmtrade/` (depends on `gmsol-model` by path, `features = ["test","u128"]`).
- Run: `cd harness/gmtrade && cargo run --release`. Full output: `harness/gmtrade/harness_output.txt`.

**Oracle (the assertion that decides bug vs no-bug):** attacker end USD value (at the operating oracle price) **>** start value ⇒ value extracted ⇒ BUG. Otherwise ⇒ pool-favorable ⇒ NOT a bug.

### Scenarios
- **A — u64/9 market, ZERO fees + ZERO price-impact (isolates PURE ROUNDING, strongest attacker case):** 4 price pairs × 14 deposit sizes (1…12345) × 100,000 iterations each. Result: `cum_net_usd = 0`, `per_iter = +0.000000`, `best_single = 0` for **every** cell. Deposit-then-withdraw of the freshly-minted GT is exactly break-even; the attacker cannot even shave a single lamport in their favor.
- **A' — u128/20 market (production decimals), ZERO fees + ZERO impact:** sizes 1…1,000,000 × 100,000 iters. Same result: `cum_net_usd = 0`, `best_single = 0`.
- **B — u64/9 market, DEFAULT (realistic) fees + impact:** the attacker **loses** on every iteration — `per_iter` from `-120` USD (dust) up to `-168,120` USD (size 1e6) — confirming fees only make round-tripping strictly worse for the attacker.
- **Invariant cross-check:** victim LP deposits 1e9; attacker hammers 200,000 dust round-trips; victim then redeems their full GT position. `victim_out = 1,000,000,000` (delta **+0**), `attacker_cum_usd_over_200k = +0`. The pool retained 100% of its backing; nothing leaked to the attacker.

## Why it holds (the mechanism)

Both conversions round **down (floor)** toward the pool:
- **Mint on deposit:** `usd_to_market_token_amount` = `floor(supply · usd / pool_value)` (`crates/model/src/utils.rs`), i.e. fewer GT minted.
- **Payout on withdraw:** `market_token_amount_to_usd` = `floor(pool_value · amount / supply)`, then `checked_mul_div` (floor) for the token split, then `checked_div` by price (floor) — every step floors.

Two floors in and two floors out means the round-trip can only ever return **≤** what went in; any lost sub-unit is retained by the pool, never credited to the user. `checked_*` arithmetic (u128 intermediates) rules out the overflow/wrap path that could otherwise flip the direction. This is the classic "rounding must favor the vault" property, and the code satisfies it.

## Independent corroboration

The repo's **own** model unit tests pass, including its dust-attack regression test:
`cargo test -p gmsol-model --features test,u128 --lib` → **12 passed, 0 failed**, incl. `action::deposit::tests::round_attack_deposit` (10,000,000 single-unit deposits) and `action::withdraw::tests::{basic, small_amount_withdrawal}` whose assertions enforce exact supply/long/short conservation across a deposit→withdraw cycle. The maintainers clearly anticipated this attack class and the invariants hold.

## Scope / honesty notes

- This closes item **1** ("`ops/` rounding direction") of the three residual "needs a human look" items in `gmtrade.md`. Items **2** (treasury `swap.rs` cross-program GT-bank consistency) and **3** (oracle staleness thresholds vs. real feed cadence) are **not** addressed here and remain open.
- The `order.rs` open/close path was not exercised as a full round-trip harness; the deposit/withdraw liquidity path (the specific lead) was, and its fee/impact math shares the same floor-toward-pool `checked_mul_div` primitives.
- A documented clean null result is the deliverable: the rounding lead is refuted with measured numbers. **Nothing to submit to Immunefi** for this class.

*Prepared via the cachorro-solana numeric harness. Verdict: pool-favorable rounding, not exploitable.*
