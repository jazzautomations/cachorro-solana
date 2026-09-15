# Veilo `privacy_pool` — Cachorro Audit Report

- **Target program (mainnet):** `GYy4kM6GHhpgLCUscuABbzkD2ZbJ2fneYryaZ6Ch7fFU`
- **Source:** github.com/VeiloSolana/privacy-program (`declare_id!` matches mainnet program id — confirmed)
- **Scope:** deployed on-chain Solana/Anchor program only (per Superteam/Veilo bounty)
- **Method:** Cachorro pipeline adapted EVM→Solana — 6 parallel per-cluster analyzers (opus) + Devil's-advocate verification + targeted atomicity/introspection hunt + manual review of ZK core, transact, positions cosigner path, and merkle tree.
- **LOC reviewed:** ~14.5k across lib.rs, groth16.rs, zk.rs, vk_constants.rs, merkle_tree.rs, swap.rs, perps.rs, positions.rs, phoenix.rs, predictions.rs

## Verdict

**No critical/high vulnerability leading to loss, theft, or unauthorized withdrawal of user funds was found in the on-chain program.** The contract is well-engineered and shows evidence of a prior audit (code cites `AUDIT-005`). The canonical privacy-pool fund-loss classes are all correctly mitigated, and the DeFi CPI surface (swap/perps/positions/phoenix) binds token flow to proof-committed amounts.

This bounty pays **1st place only, strictly for critical fund-loss with a realistic path**. Based on the on-chain program alone, that finding does not currently exist in scope. The three items below are real but sub-critical (hardening / self-inflicted), and the bounty explicitly excludes "theoretical issues without proof" and "DoS without fund loss".

## Verified secure (with citations)

| Area | Result | Key evidence |
|---|---|---|
| Root validation | ✅ | `transact` binds `root` into proof (lib.rs:3644) then `is_known_root` requires known historical root (lib.rs:3656; merkle_tree.rs:116-148, rejects zero root, exact ring-buffer match). Attacker-chosen root impossible. |
| Nullifier double-spend | ✅ | Per-nullifier PDA markers via `init` seeds `[nullifier_v3, mint, nullifier]` + `is_spent` + equal/zero/canonical checks (lib.rs:3492-3496, 3666-3685). |
| ExtData / recipient / relayer binding | ✅ | `ext_data.hash()` recomputed == proof input (lib.rs:3514-3515); recipient/relayer/token-account owners bound to ext_data (lib.rs:3533-3638). No fee redirect / front-run. |
| Accounting / publicAmount | ✅ | Single i64 drives proof input and transfer; disjoint sign ranges (zk.rs:126-155); checked arithmetic; vault balance checked before payout. |
| Token/SOL & vault authority | ✅ | Config-bound mint; canonical vault-ATA derivation + mint/owner checks; withdrawals CPI-signed by vault PDA. |
| Groth16 verifier soundness | ✅ | Correct pairing eqn + proof_a negation (groth16.rs:174-204, zk.rs:209-220); canonical (<Fr) checks on raw-compared inputs; VK shapes 8/10 consistent; on-curve/subgroup via arkworks `Validate::Yes` + precompile. |
| Access control / admin | ✅ | All admin ix gated by `has_one=admin`/global-config authority + Signer; config updates can't change admin/mint/authority; no privileged unproven fund movement. |
| Swap output routing | ✅ | Output measured from program-controlled executor ATA; `min_amount_out` & `dest_amount` (swap_params.hash, proof-bound) + `fee` (ext_data.hash) enforced (swap.rs:849/868; positions.rs:843-850 via `validate_fee_to_vault`). Malicious route can only revert, never redirect/skim. |
| Multi-instruction atomicity | ✅ | `fund_native_*`→paired-ix guards: program-id pin + discriminator + positional executor binding (idx 14/15/10) + amount binding at Borsh offsets + ZK amount reconciliation; `init`-only executors, no reclaim path. |
| Merkle tree | ✅ | Standard incremental tree; zero root rejected; correct ring-buffer history. Layout `EXPECTED_SIZE` drift is admin-only migration doc, not exploitable. |

## Findings (all sub-critical)

### F1 — `swap_data_hash` is not bound into the ZK proof — **MEDIUM (contained; no theft path)**
`SwapParams::hash()` (swap.rs:102-127) omits `self.swap_data_hash`, and `swap_params_hash` is the only swap-param committed in the Groth16 proof. The Jupiter-branch check `sha256(swap_data) == swap_params.swap_data_hash` (swap.rs:827-828) is therefore self-referential — both sides are relayer-controlled, so the documented "relayer cannot substitute swap instructions" guarantee does not hold. **Impact is capped** because output is measured from the executor's own ATA post-swap and gated by proof-bound `min_amount_out`/`dest_amount`; worst case is a bad-but-≥min swap on the user's *own* notes. No theft of other users' pool funds. Devil-verified as non-critical. **Fix:** include `swap_data_hash` in `SwapParams::hash()` so the executed route is committed by the user's proof.

### F2 — Residual collateral locked on partial position close — **LOW / informational (self-inflicted, out of scope)**
On a partial `close_position` / `close_position_to_sol`, the change note (`output_commitment_0`) is inserted into the PDA-gated `position_tree_v1`, but no `PositionPDA` is created for it and the old PDA is closed (positions.rs:1071-1210; lib.rs:1420-1426, 1576-1580). Spending a position note structurally requires a pre-existing `PositionPDA` (created only by open/merge), so the residual becomes permanently unspendable. **Real fund-lock, but 100% self-inflicted** — no attacker/relayer can force a victim into a partial close (claimant must sign; amounts from the user's own proof), no attacker profit. Fails the bounty's critical/attacker-driven bar. **Fix:** create a `PositionPDA` for the change note in the close paths, or block partial closes at the constraint level.

### F3 — Missing EMBER/PhUSD account pinning in `phoenix_ember_wrap`/`ember_unwrap` — **LOW (conditional, unconfirmed)**
These relayer-only ix pass EMBER reserve/mint/authority accounts into the CPI without the canonical-account pinning the deposit path enforces (phoenix.rs:1350, 1473-1474 vs 376-378). Exploitability is conditional on EMBER skipping internal reserve validation + a malicious relayer — unconfirmed. Reported as a hardening gap. **Fix:** pin EMBER accounts to expected canonical addresses as the deposit path does.

## What this audit could NOT cover (realistic remaining critical surface)

1. **The ZK circuits themselves.** ~~unauditable from the program alone~~ — **UPDATE: the `transaction` circuit WAS obtained and audited.** The circom source is private, but the proving artifacts (`transaction_final.zkey`, `transaction.wasm`, VK) were pulled from the Veilo Chrome extension and proven to match the on-chain `TRANSACTION_VK`. A forge-proof PoC harness (snarkjs, baseline valid proof verifies=true) tested the classic tornado-nova soundness gaps against the real VK — **all SAFE** (see below). The **`swap` circuit remains a blind spot**: its artifacts are generated relayer-side and are not publicly downloadable, so `swap.circom` constraint-soundness is the one reachable-in-scope surface left unaudited (the on-chain swap *verifier* and handler were audited and are clean; the swap *circuit constraints* were not).
2. **Mainnet-vs-source divergence.** We confirmed the `declare_id` matches, but did not byte-compare the deployed program/VK against a reproducible build. A live upgrade authority could ship on-chain code that differs from this repo.
3. **Trusted-setup integrity** (toxic waste) — off-chain, explicitly out of scope.

## Transaction-circuit soundness (forge-proof PoC)

Pulled artifacts (verified == on-chain `TRANSACTION_VK`), built a snarkjs harness whose honest 2-in/2-out proof verifies=true, then attacked:

| Attack | Result | Stopping constraint |
|---|---|---|
| A — value inflation via field overflow (outputs > inputs + publicAmount) | ✅ SAFE | `Num2Bits(248)` range-checks each output; 2 outputs < 2^249 ≪ p, no wrap |
| B — fake Merkle membership (spend a note never in the tree) | ✅ SAFE | `ForceEqualIfEnabled`/`MerkleProofIfEnabled`, membership enforced when `enabled=1` |
| C2 — mint unbinding / cross-asset value creation | ✅ SAFE | mint bound into commitment `Poseidon(amount,pubkey,blinding,mint)` + membership |
| C1 — duplicate input (double-spend one UTXO in a tx) | ✅ SAFE | explicit in-circuit `inputNullifier[0] != inputNullifier[1]` check |

**Verdict: the `transaction` circuit is SOUND.** No proof verifies against the real VK while encoding an invalid transaction. Two verifying-but-benign observations (duplicate-leaf distinct-nullifiers; input amounts not range-checked but bounded by Merkle membership + range-checked deposits) are standard tornado-nova trust-boundary delegations, not breaks. PoC scripts + baseline evidence under `poc/`.

## Mainnet verification (on-chain vs source)

Fetched the deployed program via RPC (`getAccountInfo`) and compared against the repo:

- **Program:** owner `BPFLoaderUpgradeable`, executable, **upgradeable**. ProgramData `T1arFasFzpCgUxCkzWquUwGKwDwrMgygTW8x6PF2bo3` (1,808,509 bytes), last deploy slot 432860998.
- **Upgrade authority (live):** `cu82g8m9evMKYFyedsrfr789bz5kgKpqyssNwKfjayR`. The program can be upgraded by this single key — a centralization risk, but publicly visible and standard-design (not a contract-logic vulnerability; out of scope for this bounty).
- **VK match:** all five sampled verifying-key byte sequences from `vk_constants.rs` (TX alpha_g1 / delta_g2 / IC[0], SWAP delta_g2 / IC[10]) are present verbatim in the on-chain binary. **The deployed verifying keys equal the audited source's VKs.** Combined with the matching `declare_id`, this is strong evidence the repo reflects the mainnet deployment. (A full byte-for-byte logic comparison would require a reproducible Anchor verified build; not performed.)
