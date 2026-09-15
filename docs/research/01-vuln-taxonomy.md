# Solana / Anchor Vulnerability Taxonomy

> The definitive class list an auditor (and cachorro's agentic engine) must catch.
> Author: cachorro-solana research spine · compiled 2026-09-15.
> Scope: Anchor + native Rust Solana programs. Each class ships: **what it is**,
> a **real example** (dated + sourced), **static detection** (mapped to the exact
> heuristics in `scripts/static-scan.sh`), and **how to PROVE it** with a local PoC
> (litesvm / BanksClient / `solana-test-validator --clone`). **Never mainnet.**

## How to read this doc

- **PoC harness options** (in order of speed): `litesvm` (in-process SVM, ms-fast, best for unit exploits) → `solana-program-test` / `BanksClient` (Anchor-native, good for CPI + sysvars) → `solana-test-validator --clone <program_id> --url mainnet` (fork a live program + its accounts, run the exploit against the *actual deployed bytecode*, mainnet stays untouched). cachorro's rule: a finding is only "proven" when the exploit transaction **succeeds against a local validator/fork and a negative control (the patched/secure variant) rejects it**.
- The canonical teaching corpus is **coral-xyz/sealevel-attacks** (a.k.a. `sealevel-attacks`, Anchor's `programs/*/{insecure,secure,recommended}` triads). We have it cloned locally at `cachorro-out/runs/run_1789493459_1f4834/repo/programs/` — 11 attack families (0–10). Line refs below are to that clone.
- Static heuristics we already grep for live in `scripts/static-scan.sh` (§UncheckedAccount, §init_if_needed, §CPI, §introspection, §casts, §unwrap, §close/lamports, §Signer/has_one census, §zk surface). Each class notes which grep bucket flags it and, importantly, **where grep is blind** (the AI/dynamic layer must cover the gap).

---

## Cross-cutting note: the two root causes

Almost every Solana bug reduces to one of two failures of the program's duty to **validate every account it is handed**, because Solana passes *arbitrary attacker-chosen accounts* into every instruction:

1. **Missing/weak validation of an account** — is this the account I think it is? (owner, signer, address, type, PDA derivation, discriminator).
2. **Incorrect trust in data derived from that account** — arithmetic, price, lamports, proof, field elements.

Anchor's `#[derive(Accounts)]` constraints automate (1) *only when used*; `UncheckedAccount`/`AccountInfo` opt out and shift the burden to hand-written checks that are routinely forgotten. That is why the `UncheckedAccount|AccountInfo<` census is cachorro's single highest-signal static bucket.

---

## 1. Missing signer check (signer authorization)

**What it is.** An instruction acts on behalf of an "authority" but never checks that authority actually **signed** the transaction. Anyone can pass someone else's pubkey as the authority and impersonate them.

**Real example.** sealevel-attacks #0 (`0-signer-authorization/insecure/src/lib.rs`): the authority is typed `authority: AccountInfo<'info>` and `log_message` just reads `authority.key()` — no signature required. The `secure` variant types it `Signer<'info>` or checks `authority.is_signer`. Real-world class: countless "change admin / withdraw" handlers that gate on a stored pubkey but never verify the caller signed as it.

**Static detection.** `scripts/static-scan.sh` §"Signer / has_one / constraint (presence census)" counts `Signer<` per file; §UncheckedAccount flags `AccountInfo` authorities. Red flag = an account named `authority`/`admin`/`owner`/`payer` that is `AccountInfo`/`UncheckedAccount` and is compared to stored state but is **not** a `Signer` and has no `is_signer` guard. grep is blind to native programs that manually iterate accounts — the AI layer must trace whether `is_signer` is asserted before privileged writes.

**How to PROVE it.** litesvm/BanksClient: build the privileged instruction (e.g. update authority / withdraw) with the *victim's* pubkey in the authority slot but signed only by the *attacker*'s keypair. Exploit succeeds → attacker mutated victim-owned state without the victim's signature. Negative control: same tx against `secure` variant → `MissingRequiredSignature`.

---

## 2. Missing owner check

**What it is.** The program deserializes an account's data (e.g. an SPL token account) but never checks the account's **owner program**. An attacker crafts a fake account, owned by a program they control, whose bytes deserialize into the expected layout with attacker-chosen values.

**Real example.** sealevel-attacks #2 (`2-owner-checks/insecure`): `SplTokenAccount::unpack(&ctx.accounts.token.data.borrow())` then compares `authority.key == token.owner` — but never asserts `token.owner_program == spl_token::ID`, so a counterfeit token account with any `amount`/`owner` fields passes. Marquee real-world case: **Cashio** ($52.8M, 22–23 Mar 2022) — "fake accounts all the way down"; a missing *trusted root* meant the `mint` field on a collateral account was never validated back to a real Saber Arrow token, letting the attacker mint ~2B CASH against worthless collateral (Halborn / Ackee writeups, Mar 2022).

**Static detection.** §UncheckedAccount/AccountInfo (raw `unpack`/`try_from_slice` on `AccountInfo` data is the tell). In Anchor, typed `Account<'info, T>` enforces owner == declaring program automatically; `Account<'info, TokenAccount>` (anchor-spl) enforces owner == SPL Token — so the class concentrates wherever devs drop to `AccountInfo` + manual `unpack`. grep flags the deserialize; it cannot confirm an owner assertion is *absent* — AI must verify no `account.owner == expected` check gates the read.

**How to PROVE it.** Create an account owned by a scratch program (or the system program) whose data is the attacker's forged layout; pass it in the `token`/collateral slot. On a `--clone` fork of the real protocol, feed the forged collateral and show the mint/withdraw succeeds. Negative control: real SPL-owned account → same forged values impossible.

---

## 3. Account-data matching / missing `has_one` / relationship checks

**What it is.** Two accounts must be *related* (config.admin == signer; vault.owner == user) but the link is never enforced, so an attacker supplies a config/vault they don't control alongside their own signer.

**Real example.** sealevel-attacks #1 (`1-account-data-matching`): reads `admin_config` and a claimed `admin` but doesn't require `admin_config.admin == admin.key()`. Anchor's fix is the `has_one = admin` constraint (or `constraint = config.admin == signer.key()`).

**Static detection.** §"Signer / has_one / constraint (presence census)" — a low `has_one`/`constraint` count relative to the number of `#[derive(Accounts)]` structs and stored-authority fields is the smell. grep counts presence, not *correctness of the relation* — AI must map each stored pubkey field to the constraint that should bind it.

**How to PROVE it.** Instantiate the protocol's admin/config PDA legitimately; from a second attacker keypair, call the privileged ix passing the real config but the attacker as `admin`/authority. Success = broken relationship. Negative control: `has_one` variant → `ConstraintHasOne`.

---

## 4. Type cosplay / account confusion (missing discriminator)

**What it is.** Two account types share a byte layout (or a prefix). Without a **discriminator**, the program deserializes account type A's bytes as type B and is fooled. Anchor's `#[account]` prepends an 8-byte discriminator and `Account<'info,T>` checks it; native/hand-rolled Borsh structs and raw `try_from_slice` do not.

**Real example.** sealevel-attacks #3 (`3-type-cosplay/insecure`): `User` and `Metadata` are both `{ Pubkey }`; `User::try_from_slice(user.data)` will happily parse a `Metadata` account, so a `Metadata` masquerades as a `User`. This is the *mechanism* underneath Cashio-style fake-account chains (a fake account deserializes into the expected shape).

**Static detection.** §UncheckedAccount + a heuristic on `try_from_slice`/`BorshDeserialize` structs without a leading type tag. grep can find raw `try_from_slice`; it cannot see whether a discriminator/enum tag exists — AI must check each hand-rolled account struct for a unique first field / tag and confirm it's asserted.

**How to PROVE it.** Initialize a `Metadata` (or sibling) account under the program, then invoke the `User` handler pointing at it; show the privileged action fires on the wrong type. Negative control: Anchor `#[account]` discriminator → `AccountDiscriminatorMismatch`.

---

## 5. Arbitrary CPI (unpinned invoked program id)

**What it is.** The program does a cross-program invocation but takes the *target program's account as input* without checking its address, so an attacker substitutes a malicious program that has the same instruction interface (e.g. a fake "token program" whose `transfer` does nothing / re-routes).

**Real example.** sealevel-attacks #5 (`5-arbitrary-cpi/insecure`): `invoke(&spl_token::instruction::transfer(ctx.accounts.token_program.key, ...), ...)` where `token_program: AccountInfo` is never asserted `== spl_token::ID`. Attacker passes their own program in that slot; the "transfer" is a no-op but the calling program proceeds as if funds moved.

**Static detection.** §"CPI invoke/invoke_signed (check program id pinned)" — every `invoke`/`invoke_signed`/`CpiContext::new` is listed; the audit is to confirm the program account is either a hard `Program<'info, Token>` type (Anchor pins it) or an explicit `require_keys_eq!(prog.key(), EXPECTED)`. grep surfaces the CPI; AI must trace the program-id operand back to a pin.

**How to PROVE it.** Deploy a rogue program exporting a matching instruction that logs/steals; call the vulnerable ix with the rogue program in the `token_program` slot on litesvm. Exploit = state advances without the real transfer. Negative control: `Program<'info, Token>` → `InvalidProgramId`.

---

## 6. Duplicate mutable accounts

**What it is.** An instruction takes two mutable accounts expected to be *distinct* (e.g. `from` and `to`, or two user vaults) but never checks `a.key() != b.key()`. Passing the same account twice makes writes alias — e.g. a "transfer" that credits and debits the same account nets a free mint, or the second write clobbers the first.

**Real example.** sealevel-attacks #6 (`6-duplicate-mutable-accounts`): two `user` accounts updated in one ix; passing the same account for both yields inconsistent/abusable state. Fix: `constraint = user_a.key() != user_b.key()`.

**Static detection.** No dedicated grep bucket today (candidate to add). Heuristic: `#[derive(Accounts)]` with ≥2 `mut` accounts of the same type and no `constraint = x.key() != y.key()`. This is a **grep-blind class** — flagged as an AI-layer responsibility (pairwise-distinctness reasoning over each Accounts struct).

**How to PROVE it.** Call the ix with the same pubkey in both mutable slots; assert the invariant break (balance grew, or one side's update silently lost). Negative control: distinctness constraint → `Constraint` error.

---

## 7. Reinitialization via `init_if_needed`

**What it is.** `init_if_needed` runs the init path when the account looks uninitialized (owner = system program *or* zero lamports) — so if state can be reset to that condition, or the guard logic is loose, an attacker re-runs init to **overwrite existing state** (reset an admin, zero a counter, reseed a vault).

**Real example.** Anchor's own docs warn on the macro; the classic pattern (sealevel-attacks #4 `4-initialization`, and Solana "Reinitialization Attacks" course, RareSkills "Day 27", ImmuneBytes advisory 2025) is an `init_if_needed` account with no `is_initialized` flag — a second call reinitializes it. Fix: gate with an explicit `require!(!account.is_initialized)` / one-time flag, or use plain `init`.

**Static detection.** §"init_if_needed (reinit risk)" — every occurrence is listed and treated as *audit-required by default*. grep flags presence; AI must verify a downstream `is_initialized`/state guard exists and that no path drives lamports→0 / owner→system to re-arm the init.

**How to PROVE it.** Init the account normally with admin=alice; from attacker, call the same ix again → show admin becomes attacker (or counter resets). Negative control: guarded variant → custom `AlreadyInitialized` error.

---

## 8. PDA bump-seed canonicalization

**What it is.** `create_program_address` accepts **any** valid bump, but only `find_program_address` returns the *canonical* (highest) bump. If the program lets the caller pass a `bump` and validates with `create_program_address`, an attacker can derive **multiple valid PDAs for the same logical seeds** (one per non-canonical bump), creating shadow accounts / bypassing "one PDA per user" invariants.

**Real example.** sealevel-attacks #7 (`7-bump-seed-canonicalization/insecure`): `Pubkey::create_program_address(&[key.to_le_bytes(), &[bump]], program_id)` with an attacker-supplied `bump`, checked only for equality against the passed account. Fix: derive canonically with `find_program_address` (or Anchor `seeds = [...], bump` which stores/enforces the canonical bump).

**Static detection.** Heuristic on `create_program_address` + a `bump: u8` instruction arg (vs `find_program_address` / Anchor `bump` constraint). Not yet a dedicated bucket — candidate to add alongside the CPI/introspection greps. AI must confirm canonicalization.

**How to PROVE it.** Enumerate bumps 255→0 for the same seeds, find ≥2 that yield on-curve-off PDAs the program accepts, initialize a second "account" for a user who should have exactly one, and abuse the duplicate (double claim, etc.). Negative control: Anchor `bump` → only canonical accepted.

---

## 9. PDA sharing / seed authority collision

**What it is.** A PDA used as a signing authority (or ownership marker) is derived from **too-coarse seeds** (e.g. only the mint, not mint+user), so one PDA authorizes actions across accounts that should be isolated — attacker routes another user's funds through the shared authority.

**Real example.** sealevel-attacks #8 (`8-pda-sharing`): a withdraw authority PDA seeded on a pool/mint alone signs for *any* user's vault of that mint. Fix: bind the PDA seeds to the specific owner (`seeds = [pool, user]`) so the signer PDA can't cross accounts.

**Static detection.** grep-blind (semantic). Heuristic: `seeds = [...]` / `invoke_signed` where the signer seeds omit the per-user/per-account discriminant. AI must reason about *seed granularity vs the isolation invariant*.

**How to PROVE it.** Set up two users' vaults sharing a mint; as user A, invoke withdraw signed by the shared PDA but pointing the destination at A while draining B's vault. Negative control: user-bound seeds → PDA signature invalid for B.

---

## 10. Closing accounts: revival, incomplete close, lamport tricks

**What it is.** "Closing" an account by only zeroing lamports (or only zeroing data) leaves it re-usable within the same transaction or refundable, enabling **account revival** / double-spend of a one-shot account. Correct close must: transfer lamports out **and** overwrite the discriminator with `CLOSED_ACCOUNT_DISCRIMINATOR` (or reassign to system program) so it can't be re-hydrated in the same tx.

**Real example.** sealevel-attacks #9 has a full ladder: `insecure` (only moves lamports), `insecure-still` (zeros data but revivable), `insecure-still-still`, then `secure`/`recommended`. The insecure `close` just does `**dest.lamports += account.lamports; **account.lamports = 0` — the account still exists mid-tx and a follow-up ix in the same tx re-funds/reuses it. Anchor's `close = dest` constraint does the safe sequence.

**Static detection.** §"close = / lamport moves" — flags `close =`, `try_borrow_mut_lamports`, `**...lamports`, `system_program::transfer`. The audit: manual lamport-zeroing **without** discriminator overwrite = finding. grep finds the lamport moves; AI must confirm the discriminator/close-flag write and reassignment.

**How to PROVE it.** In one transaction: call `close`, then in a second instruction of the same tx re-use the "closed" account (e.g. claim rewards again). litesvm/BanksClient can pack both ix in one tx. Success = revival. Negative control: `close = dest` → account gone, second ix fails `AccountNotInitialized`.

---

## 11. Sysvar address & instruction introspection (atomicity/forgery)

**What it is.** Programs that read the **instructions sysvar** (to check "is there a sibling ix?", enforce atomic bundles, or verify an ed25519/secp256k1 precompile ran) must (a) assert the sysvar account is the *real* `Sysvar1nstructions1111...` address, and (b) validate the *contents* (which program, which data). Skipping either lets an attacker pass a fake sysvar or a decoy sibling instruction.

**Real example.** **Wormhole** ($326–338M, 2–3 Feb 2022) — the single most expensive instance: `load_instruction_at` (older API) did **not** verify the instructions-sysvar account was genuine, so the attacker supplied a counterfeit sysvar with forged `secp256k1` verification data and minted 120k wETH on Solana without a lock on Ethereum (Kudelski / Ackee / Merkle Science, Feb 2022). sealevel-attacks #10 (`10-sysvar-address-checking`) is the miniature: read a sysvar without checking its address. Fix: `load_instruction_at_checked` + assert `sysvar::instructions::ID`.

**Static detection.** §"instruction introspection / sysvar instructions (atomicity)" — flags `load_instruction_at_checked`, `get_instruction_relative`, `load_current_index`, `sysvar::instructions`, `instructions_sysvar`. The audit: every such read must be gated by an address check and content validation. AI must confirm the *checked* API is used and the sibling-ix program/data are validated (not just presence).

**How to PROVE it.** Craft a tx where the instructions-sysvar slot is a look-alike account with attacker-authored bytes, or where the "expected" precompile sibling is replaced by a no-op; show the guarded action fires. On `--clone`, replay the Wormhole-shape forgery against a lab program. Negative control: `*_checked` + address assert → rejects the fake sysvar / missing precompile.

---

## 12. Integer overflow / unchecked casts / sign confusion

**What it is.** Rust in `--release` (all deployed Solana programs) **wraps** arithmetic silently unless `overflow-checks = true` is set in `Cargo.toml` or `checked_*`/`saturating_*` are used. A wrapping add on a balance, or a lossy/`as` cast (`u128 as u64`, `i64` sign flip), corrupts accounting → underflow to huge balances, or truncated fees.

**Real example.** Recurring audit finding across Sec3/OtterSec/Neodyme reports (e.g. fee/reward math using `a * b / c` with intermediate `u64` overflow, or `amount as i64` sign flips in lending). Neodyme's fuzzing work ("Fuzz on the Beach", 2023) specifically hunts arithmetic edge cases. The class is why cachorro checks the release profile.

**Static detection.** §"numeric casts (as u64 / as i64 / as u128 — overflow/sign)" lists every `as` cast; a complementary check must read `Cargo.toml` for `overflow-checks = true` (missing = whole program is wrapping). grep finds casts and raw `+`/`*` on money fields; AI must judge which operate on attacker-influenced magnitudes and whether `checked_*` guards them.

**How to PROVE it.** Drive the arithmetic to its boundary (deposit `u64::MAX`-adjacent, or a sequence that wraps a subtraction below zero) and assert the post-state balance is absurd (attacker credited). litesvm makes boundary fuzzing cheap. Negative control: `checked_*`/`overflow-checks` variant → `ArithmeticOverflow`/`require!` failure instead of wrap.

---

## 13. Rounding / precision & share-inflation (AMM/vault math)

**What it is.** Order-of-operations and rounding direction in AMM/lending/vault share math. Rounding **in the user's favor** (e.g. `floor` on what they owe, `ceil` on what they receive), first-depositor **share inflation** (donate to the vault to make 1 share worth a lot, then round subsequent depositors to 0 shares), or `mul` after `div` losing precision — each leaks value per-call and compounds.

**Real example.** Classic ERC-4626-style **first-depositor / share-inflation** attacks ported to Solana vaults; repeatedly flagged in OtterSec/Sec3 AMM audits. Adjacent Solana case: **Loopscale** ($5.8M, 26 Apr 2025) — mispriced RateX PT collateral (internal pricing model, not pure oracle) let undercollateralized loans through (Halborn, Apr 2025). The through-line: a value function that's wrong by rounding/model at the margin is drained by repetition.

**Static detection.** grep-weak. Heuristics: `checked_div`/`/` followed by `*` (div-before-mul), `try_round`/`floor`/`ceil` near share math, first-deposit branches. Fundamentally an **AI + differential-testing** class — static can only nominate the math sites.

**How to PROVE it.** Loop the rounding: deposit/withdraw (or swap) N times and show cumulative attacker gain > fees, or execute the first-depositor inflation (deposit 1 wei-share, donate, victim deposits, victim rounds to 0). Property-test the invariant "protocol never loses value across any op sequence" on litesvm. Negative control: corrected rounding direction → invariant holds.

---

## 14. Oracle / price manipulation & staleness

**What it is.** Pricing collateral/positions from a manipulable source (thin-liquidity spot, a single DEX pool, or an oracle without staleness/confidence checks). Attacker moves the reference price (flash/low-liquidity pump) or feeds a stale/wide-confidence price, then borrows/liquidates against the distorted value.

**Real example.** **Mango Markets** (~$116M, 11–12 Oct 2022) — Eisenberg pumped MANGO-PERP on thin liquidity 5–10x, oracles reported the inflated price, he borrowed $116M against the paper gains and withdrew (Ackee / CoinDesk, Oct 2022). Also **Loopscale** (Apr 2025, above). Static-only tools *cannot* find these — this is cachorro's argument for the dynamic/economic layer.

**Static detection.** grep can flag oracle integration points (`pyth`, `switchboard`, `get_price`, missing `publish_time`/`conf` reads) and single-source pricing, but **cannot** assess manipulability. Flag as: static nominates the price-read sites and checks for staleness/confidence guards; economic reasoning + fork simulation confirms exploitability.

**How to PROVE it.** `solana-test-validator --clone` the protocol **and** its oracle/DEX pool accounts; in the fork, execute the manipulation (move the pool, push the oracle if it's a program you can drive, or set a stale slot) and open the underwater position → withdraw. This is exactly the "prove impact on a fork" mandate. Negative control: TWAP/confidence/staleness guard → borrow reverts.

---

## 15. Unvalidated `remaining_accounts` / arbitrary account substitution

**What it is.** Handlers that iterate `ctx.remaining_accounts` (or take generic `AccountInfo`s for routing/rewards/multi-hop) and act on them without validating owner/type/relationship — a general form of classes 2/3/5 through the back door Anchor constraints don't cover.

**Real example.** Common in reward routers, batch settlers, and AMM multi-hop routers across audit reports (OtterSec/Sec3). Pattern: `for acc in ctx.remaining_accounts { transfer(acc, ...) }` with no per-account check.

**Static detection.** Heuristic on `remaining_accounts` iteration + any lamport/token write inside the loop. grep can flag the iterator; AI must confirm each element is validated before use.

**How to PROVE it.** Pass an attacker-controlled account in a `remaining_accounts` slot the program trusts (e.g. a fake reward vault) and redirect funds. Negative control: per-account owner/type/relationship check → rejected.

---

## 16. Denial-of-service via panic / unwrap / unbounded compute

**What it is.** `unwrap()`/`expect()`/`panic!`/array-index/`unchecked` arithmetic in a handler lets a crafted input abort the ix; if that ix is on a critical path (crank, liquidation, settlement) an attacker can **wedge** the protocol. Also: unbounded loops over attacker-growable vectors exhausting the compute budget.

**Real example.** Standard "informational/medium" in nearly every Sec3/Neodyme report; weaponized when the panicking path is a liquidation or oracle-crank that others depend on (griefing, or blocking liquidations to avoid being liquidated).

**Static detection.** §".unwrap()/.expect()/panic in handlers (DoS)" — lists all such in non-test code. AI must rank by whether the path is attacker-reachable and liveness-critical.

**How to PROVE it.** Supply the input that hits the `unwrap`/index panic; show the critical ix aborts and a dependent action (liquidation) is now impossible. Negative control: graceful `Result` handling → ix returns an error but protocol stays live.

---

## 17. Missing rent-exemption / realloc & residual-data bugs

**What it is.** Accounts not made rent-exempt can be **garbage-collected** (data lost); `realloc` growth that isn't zero-initialized leaks stale bytes into the new region (info disclosure / type confusion); shrinking without care leaves readable residue.

**Real example.** Anchor added `realloc::zero` precisely for this; audit reports flag `realloc` without zeroing and manual account creation without `rent.minimum_balance`. Ties into class 10 (a non-rent-exempt "closed" account behaves unexpectedly).

**Static detection.** Heuristic on `realloc(`/`AccountInfo::realloc` without `zero = true`/explicit zeroing, and manual account creation lacking a rent-exemption check. Not yet a dedicated bucket. AI to verify.

**How to PROVE it.** Grow an account via the vulnerable realloc and read the previously-out-of-bounds region to recover another account's stale bytes, or let a non-exempt account get reaped and observe state loss. Negative control: zeroed realloc / rent-exempt creation.

---

## 18. zk-specific: nullifier, proof-verification, and public-input binding bugs

For privacy pools / shielded transfers / zk-attested state (cachorro's own Veilo/privacy_pool surface). This is the class the `zk_surface.txt` grep exists for.

**18a. Nullifier reuse / double-spend.** The nullifier that marks a note spent is not recorded (or not checked) before payout, so the same note is spent repeatedly. *Correct*: a per-nullifier PDA (`init` on the nullifier hash — creation *is* the double-spend guard, since re-init fails) or an explicit spent-set membership check **before** transferring out. *Detect*: `zk_surface` flags `nullifier`; AI must confirm the record-and-check happens **before** payout and is atomic. *Prove*: submit two valid withdrawals with the same nullifier in one/successive txs on litesvm; second must fail. Negative control: nullifier PDA `init` → second tx `already in use`.

**18b. Missing / mis-ordered proof verification.** The Groth16/`alt_bn128` verify is skipped, its boolean result ignored, or the payout runs before verification. *Detect*: `zk_surface` flags `groth16|alt_bn128|Groth16Verifier`; AI must trace that `verify(...) == true` gates every state change. *Prove*: submit a withdrawal with a random/invalid proof → must reject; and reorder to show payout can't precede a failed verify. Negative control: valid proof only.

**18c. Public-input binding / under-constrained inputs.** The proof is valid but the **public inputs aren't bound to the transaction** (recipient, amount, pool root, chain/domain not in the verified public signals), so an attacker replays a valid proof with a different recipient/amount, or across pools/chains. *Detect*: compare the circuit's public-input vector to what the program binds on-chain (AI + circuit reading; grep can't). *Prove*: take a legitimate proof and change the recipient/amount in the ix; if it still verifies+pays, the input is unbound. Negative control: recipient/amount in public signals → mismatch rejects. (This is the "swap circuit = the only unseen surface" concern from the Veilo audit.)

**18d. Verifying-key / trusted-setup swap & non-canonical field elements.** A mutable or attacker-substitutable verifying key (`vk_ic`/`verification_key` not a pinned constant), or field elements / curve points not range-checked (`>= p`, off-curve, non-canonical) that some verifiers accept. *Detect*: `zk_surface` §"verifying-key constants" flags `vk_ic|VK_IC|verification_key`; AI must confirm the VK is immutable/pinned and inputs are canonicalized (`< field modulus`, on-curve). *Prove*: substitute a VK for which the attacker can forge proofs, or feed a non-canonical field element that the verifier mis-accepts → forged withdrawal succeeds. Negative control: pinned VK + range checks.

**18e. Merkle root / commitment-set freshness.** Withdrawing against a **stale or attacker-chosen historical root**, or a root not verified to belong to the pool's known root history, enabling proofs against a manipulated tree. *Detect*: `zk_surface` flags `merkle`; AI confirms the root is checked against a maintained on-chain root set. *Prove*: submit a proof against a forged root not in the history → must reject.

---

## Coverage map: static-scan.sh buckets → classes

| static-scan.sh bucket | Primary classes it flags | Grep-blind gap (AI/dynamic must cover) |
|---|---|---|
| UncheckedAccount / AccountInfo census | 1, 2, 3, 5, 15 | whether the missing check is actually absent on the exploit path |
| init_if_needed | 7 | presence of an `is_initialized`/state guard |
| CPI invoke/invoke_signed | 5, 9 | whether the program-id operand is pinned |
| instruction introspection / sysvar | 11 | `_checked` API + address + sibling-ix content validation |
| numeric casts / `as` | 12 | + `Cargo.toml` overflow-checks; which magnitudes are attacker-driven |
| unwrap/expect/panic | 16 | reachability + liveness-criticality ranking |
| close = / lamport moves | 10 | discriminator overwrite / reassignment present? |
| Signer / has_one / constraint census | 1, 3, 4 (relations) | correctness of each relation, not just presence |
| zk surface + verifying-key constants | 18a–18e | verify-before-payout ordering, public-input binding, VK immutability, field canonicalization |
| *(none yet — candidates to add)* | 6 (dup-mutable), 8 (bump), 13 (rounding), 14 (oracle), 17 (rent/realloc) | most of the economic/semantic layer |

**Takeaway for cachorro's moat.** The static grep layer is a commodity (Sec3 X-Ray, Trident do it too). The differentiator is the **prove-it layer**: for every nominated site, cachorro must produce a transaction that succeeds on a local validator/fork *and* a negative control on the secure variant that rejects it — the promotion gate (oracle + negative-control + clean-room reproduction) already built into the pentest-agent-v3 spine. Classes 6, 8, 9, 13, 14, 17, 18c are precisely where static tools go silent and executable PoC is the only honest evidence.

---

## Sources (accessed 2026-09-15)

- coral-xyz **sealevel-attacks** (local clone `cachorro-out/runs/run_1789493459_1f4834/repo/programs/0..10`) — canonical Anchor insecure/secure/recommended triads.
- Solana Foundation, *Reinitialization Attacks* course — https://solana.com/developers/courses/program-security/reinitialization-attacks
- RareSkills, *init_if_needed and the Reinitialization Attack* (2024) — https://rareskills.io/post/init-if-needed-anchor
- Sec3, *How to Audit Solana Smart Contracts Part 4: The Anchor Framework* — https://sec3.dev/blog/how-to-audit-solana-smart-contracts-part-4-the-anchor-framework
- Neodyme, *Riverguard: Mutation Rules for Finding Vulnerabilities* — https://neodyme.io/en/blog/riverguard_3_fuzzcases/ ; *Fuzz on the Beach* (arXiv 2309.03006, 2023).
- **Wormhole** (Feb 2022): Kudelski, *Quick Analysis of the Wormhole attack* — https://kudelskisecurity.com/research/quick-analysis-of-the-wormhole-attack ; Ackee, *2022 Solana Hacks Explained: Wormhole* — https://ackee.xyz/blog/2022-solana-hacks-explained-wormhole/ ; Merkle Science, Feb 2022.
- **Cashio** (Mar 2022): Halborn, *Explained: The Cashio Hack* — https://www.halborn.com/blog/post/explained-the-cashio-hack-march-2022 ; Ackee, *2022 Solana Hacks Explained: Cashio* — https://ackee.xyz/blog/2022-solana-hacks-explained-cashio/
- **Mango Markets** (Oct 2022): Ackee, *2022 Solana Hacks Explained: Mango Markets* — https://ackee.xyz/blog/2022-solana-hacks-explained-mango-markets/ ; CoinDesk, Oct 2022.
- **Loopscale** (Apr 2025): Halborn, *Explained: The Loopscale Hack* — https://www.halborn.com/blog/post/explained-the-loopscale-hack-april-2025 ; The Block, 26 Apr 2025.
- zk / nullifier: Helius, *Zero-Knowledge Proofs: Its Applications on Solana* — https://www.helius.dev/blog/zero-knowledge-proofs-its-applications-on-solana ; `groth16-solana` crate; zk-drain-lab (nullifier-reuse PoC pattern) — https://github.com/loxlid/zk-drain-lab ; internal Veilo/privacy_pool audit notes.
- General corpus: sannykim/**solsec** — https://github.com/sannykim/solsec ; Helius, *Solana Hacks, Bugs, and Exploits: A Complete History* — https://www.helius.dev/blog/solana-hacks ; Zealynx, *Solana Security Checklist (45 checks)* — https://www.zealynx.io/research/smart-contracts/solana-security-checklist
