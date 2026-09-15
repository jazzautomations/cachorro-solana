# Devil's Advocate Verdict — Veilo zk Privacy Pool

Target: `programs/privacy-pool/src/{positions.rs,lib.rs}`
Program: GYy4kM6GHhpgLCUscuABbzkD2ZbJ2fneYryaZ6Ch7fFU (mainnet, authorized whitehat bounty)

---

## FINDING 1 — "Locked/lost collateral on partial position close"

### VERDICT: DOWNGRADED — from MEDIUM to LOW / Informational (OUT OF SCOPE for payout)

The mechanism is **technically real** (the change note IS permanently orphaned), so this is
NOT a false report. But it is a **self-inflicted, non-attacker-exploitable footgun**, which
fails this bounty's payout bar ("critical vulnerabilities that directly lead to USER FUND LOSS";
explicitly out of scope: "theoretical issues without proof"). Not payable as-is.

### Q1 — REACHABILITY: is a partial close constructable? → YES (at protocol level)

- `close_position` verifies the swap with the **same circuit** as `open_position`
  (`verify_swap_transaction_groth16` over `SwapPublicInputs`, positions.rs:1118-1129 vs
  502-513). In `open_position`, `output_commitment_0` is a genuine, routinely-nonzero USDC
  **change note** (positions.rs:429, 672-679). In `close_position`, `output_commitment_0` is
  explicitly the **position-token change note** (positions.rs:1042, appended at 1265-1274).
- Nothing on-chain forces `swap_amount` to equal the full position value. `close_position`
  never checks `pos_pda.balance` against `swap_amount` — it only checks `is_active`, `mint`,
  `tree_id`, `claimant` (positions.rs:1071-1075). The lone quantity gate,
  `vault_balance >= swap_amount` (positions.rs:1207-1210), is against the **global pooled**
  mint vault, not this position.
- Therefore a user can submit `close_position` with `swap_amount < note_value`, producing a
  nonzero-value residual position note re-inserted into `position_tree_v1`.
- Caveat: I could not read the circom source; this rests on the circuit being the identical
  swap circuit that supports nonzero change on the open side. That is overwhelmingly the case,
  but it is the one assumption a full kill/confirm would need to nail in the circuit itself.

### Q2 — is the change note really unspendable? → YES, genuinely permanent

A note living in `position_tree_v1` can ONLY be consumed by three instructions, and **all three
structurally require a pre-existing `PositionPDA`**:
- `close_position` (lib.rs:1420-1426: `seeds=[b"position_pda_v1", key]`, `mut`, `close=relayer`,
  NOT `init`)
- `close_position_to_sol` (lib.rs:1576-1580, same)
- `merge_positions` (lib.rs:1711-1731 require `position_pda_0`/`position_pda_1`, and
  positions.rs:2198-2199 require both `is_active`)

A `PositionPDA` is created ONLY by:
- `open_position` (lib.rs:1329-1336 `init`) — consumes **USDC source notes**, not a position note
- `merge_positions` (lib.rs:1733 `new_position_pda` `init`) — consumes **two existing** PDAs

Neither can be pointed at an already-existing orphan position note. There is **no "register /
reissue PDA for an existing position note" instruction** (full instruction list checked; the
`phoenix_reissue_notes` / `jperp_reissue_notes` paths mint into `privacy_note_tree_v3`, not the
position tree). The general `transact` / `transact_swap` operate exclusively on
`privacy_note_tree_v3` (mint-keyed pools; lib.rs:744/752, 883/949) and cannot touch
`position_tree_v1`. → The orphan change note is genuinely, permanently unspendable. Claim TRUE.

### Q3 — is a PositionPDA created for the change note anywhere in the close paths? → NO

`ClosePosition` and `ClosePositionToSol` account contexts only reference the **input** PDA and
close it (`close = relayer`); no `init` of any new PDA (lib.rs:1407-1552, 1568+). Confirmed by
handler comments positions.rs:1368 and 1796 ("PositionPDA is auto-closed"). Claim TRUE.

### Q4 — severity & in-scope for a "critical user-fund-loss only" bounty? → NO (downgrade)

- Real fund loss (not DoS)? **Yes** — residual collateral is permanently unrecoverable.
- Attacker-exploitable? **NO.** Purely self-inflicted. No attacker (or relayer) can force a
  victim into a partial close — the `claimant` must sign (positions.rs:1075) and the amounts
  come from the user's own proof. No attacker profit, no theft, no victim but self.
- Reproducible with proof? Constructable at protocol level, but requires the user/SDK to
  **deliberately** generate a partial-close proof; a correct client always fully closes
  (`swap_amount = note_value`, change = dummy). Absent a client that offers partial close, no
  user hits it → "theoretical issue without proof."

Net: a genuine latent correctness/footgun bug worth reporting to the team as hardening (either
forbid a nonzero close-change on-chain, or `init` a `PositionPDA` for `output_commitment_0` in
the close paths), but it does NOT meet the bounty's critical / attacker-driven fund-loss bar.
**LOW / Informational, out of scope for payout.**

---

## SANITY-CHECK 2 — relayer swap-output redirect / skim (open_position staged legs)

### RESULT: NO redirect / skim / over-withdraw path. Not a vulnerability.

Confirmed `swap_data_hash` is NOT bound into `swap_params.hash()` (swap.rs:102-123 hashes only
`min_amount_out`, `deadline`, `dest_amount`), so a whitelisted relayer fully controls the route.
It still cannot skim, because every value that matters is proof-bound and the output is measured
from a program-controlled account:

- Output is read from the **executor's own dest ATA** (`executor_dest_token`, positions.rs:836-840;
  close: 1308-1309). If the relayer's route deposited elsewhere, that balance stays low and the
  swap fails the checks below. The relayer cannot redirect funds out.
- `validate_fee_to_vault` (positions.rs:348-367, called 843 / 1312 / 1733) enforces
  `received >= min_amount_out` and `vault_amount = received - relayer_fee >= dest_amount`. Both
  `min_amount_out` and `dest_amount` are inside `swap_params.hash()` → Groth16 public input
  (positions.rs:499, 1115). The relayer cannot lower what the vault/user receives.
- `relayer_fee = ext_data.fee` (positions.rs:842, 1311) is bound by `ext_data.hash()`, which
  includes `fee` (lib.rs:530-531) and is a public input (positions.rs:500, 1121). The relayer
  cannot inflate its own fee beyond what the user's proof authorized.
- Post-swap the vault credit is re-measured from actual balance and must still cover
  `dest_amount` (positions.rs:905-913). User always receives their committed note value.

Worst case for a malicious route: a bad/degenerate swap → `received < min_amount_out` → revert.
Positive slippage above `dest_amount` accrues to the pooled vault (not to the relayer) and the
fee is fixed by the user's proof — no user fund loss, no relayer over-withdraw. CLEAN. Not
critical.
