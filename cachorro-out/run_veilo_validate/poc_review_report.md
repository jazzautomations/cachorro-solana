# Veilo `transaction` circuit — ZK soundness PoC results

**Date:** 2026-07-28
**Scope:** local Groth16 proof-gen + local verify against the real on-chain VK. NO mainnet interaction.
**Target VK:** `artifacts/transaction_verification_key.json` (groth16 / bn128 / nPublic=8) == on-chain `TRANSACTION_VK`.
**On-chain sink:** Anchor instruction `transact` (IDL `privacy_pool.json`) — args: `root, input_tree_id, output_tree_id, public_amount(i64), ext_data_hash, mint_address(pubkey), input_nullifier_0/1, output_commitment_0/1, deadline, ext_data, proof`. These are exactly the 8 public signals + proof.

## Harness (recovered scheme — verified, not trusted)
Recovered from the public npm `veilo-sdk-core@0.3.2` (`dist/cjs/{poseidon,utxo,merkle,proof}.js`) and confirmed by producing a proof that verifies against the real VK. All Poseidon uses circomlibjs `buildPoseidonReference` over BN254 Fr.

- `pubkey       = Poseidon(privKey)`
- `commitment   = Poseidon(amount, pubkey, blinding, mint)`  ← 4-arity, mint bound INTO commitment
- `signature    = Poseidon(privKey, commitment, pathIndex)`
- `nullifier    = Poseidon(commitment, pathIndex, signature)`
- value conservation: `sum(inAmount) + publicAmount === sum(outAmount)` (mod p)
- per-input `enabled = 1 - IsZero(inAmount)` gates Merkle membership (`MerkleProofIfEnabled` / `ForceEqualIfEnabled`)
- **single public `mintAddress`** is used for ALL input- and output-commitment reconstruction (no per-UTXO mint signal). Merkle depth = **22**.
- exact snarkjs input signal names (from `formatInputsForSnarkjs`): `root, publicAmount, extDataHash, mintAddress, inputNullifier[2], outputCommitment[2]` (public) + `inAmount[2], inPubkey[2], inBlinding[2], inPathIndex[2], inPathElements[2][22], inPrivateKey[2], outAmount[2], outPubkey[2], outBlinding[2]` (private).

### BASELINE (harness soundness proof) — PASS
Honest 2-in/2-out withdrawal: 1 real input (amount 1000, inserted in tree) + 1 zero input; `publicAmount = -400`; outputs `[600, 0]`.
- `node poc/baseline.js` → **VERIFY: true**
- Evidence: `poc/baseline_proof_EVIDENCE.json`, `poc/baseline_public_EVIDENCE.json` (publicSignals[1] = p−400, confirming signed publicAmount).
- Reproduce: `cd poc && node baseline.js`

---

## ATTACK A — VALUE INFLATION (field overflow on output amount) → **SAFE**
Zero inputs, `publicAmount=0`, outputs `[X, p−X]` so `sumOuts ≡ 0 (mod p)` but the integer sum = p. Tried `X ∈ {2^60, 2^100, 2^200}`.
- Result: **witness generation THROWS** every time — `Assert Failed: Num2Bits_292 (line 38) ← ProcessOutput_293 (line 179) ← Transaction_295 (line 253)`.
- **Constraint that stops it:** output amounts are range-checked with `Num2Bits(248)`. Probed exact width (`poc/probe_width.js`): `2^247` passes, `2^248` fails ⇒ **248-bit** range check on each output amount.
- Why this is sound: with 2 outputs each `< 2^248`, `sumOuts < 2^249 ≪ p (~2^254)`. Real inputs are ≤2 notes also `< 2^249` and `publicAmount` is i64 (`< 2^63`), so `sumIns + publicAmount` can never reach `p`. Field wrap-around is impossible ⇒ value conservation holds in true integers.
- Reproduce: `cd poc && node attack_A.js` ; `node probe_width.js`

## ATTACK B — FAKE MEMBERSHIP (nonzero input not in tree) → **SAFE**
Nonzero input (amount 500) with a bogus Merkle path, `root` = a real tree root that does NOT contain the note.
- Result: **witness THROWS** — `Assert Failed: ForceEqualIfEnabled_218 (line 56) ← MerkleProofIfEnabled_219 (line 95) ← ProcessInput_291 (line 145)`.
- **Constraint that stops it:** for a nonzero input `enabled = 1`, so `ForceEqualIfEnabled(enabled, computedRoot, root)` forces the Poseidon-reconstructed root to equal the public `root`. The only way to skip membership is `enabled=0`, which requires `inAmount=0` (contributes zero value). No bypass.
- Reproduce: `cd poc && node attack_BC.js` (section "ATTACK B")

## ATTACK C2 — MINT UNBINDING (cross-asset) → **SAFE**
Spend a note built with mint A while setting the public `mintAddress = B` and building outputs with mint B.
- Result: **witness THROWS** — same `ForceEqualIfEnabled_218 / MerkleProofIfEnabled_219 / ProcessInput_291`.
- **Constraint that stops it:** the input commitment is reconstructed inside the circuit as `Poseidon(inAmount, inPubkey, inBlinding, mintAddress_public)`. Using mint B yields a commitment ≠ the real leaf (built with mint A), so the computed root ≠ public root and membership fails. Mint is cryptographically bound into every commitment and re-checked via membership; a single public mint governs the whole tx ⇒ no cross-asset value creation.
- Reproduce: `cd poc && node attack_BC.js` (section "ATTACK C2")

## ATTACK C1 — DUPLICATE INPUT / double-spend one UTXO in one tx → **SAFE**
Both inputs = the same note at the same leaf index (identical nullifiers), withdraw `2×amount`.
- Result: **witness THROWS** — `Assert Failed: Transaction_295 (line 270)`.
- **Constraint that stops it:** the circuit contains an explicit input-nullifier-distinctness check (Transaction line 270) that rejects `inputNullifier[0] == inputNullifier[1]`. (Confirmed by contrast: two DISTINCT nullifiers pass — see C1b.)
- Reproduce: `cd poc && node attack_BC.js` (section "ATTACK C1")

---

## Secondary observations (verifying proofs that are NOT circuit-level breaks — for the on-chain reviewers)

### OBS-1 — C1b: same commitment at two DISTINCT leaves → proof VERIFIES (not a circuit break)
Inserting the identical commitment at two leaf positions of one tree yields two DISTINCT nullifiers (nullifier includes `pathIndex`), so the C1 distinctness guard passes and the proof **verifies** (`poc/attackC1b_proof.json`, `poc/attackC1b_public.json`; re-verified true; publicSignals[1] = p−1000, double-counting the 500 note).
- **Why it is NOT a fund-loss on its own:** it requires the real on-chain Merkle tree to actually contain the SAME commitment at two leaves. Each on-chain deposit/output inserts one leaf; obtaining two identical leaves requires two funded insertions (paying twice) — no value is created. The circuit correctly delegates leaf-uniqueness/root-freshness to the on-chain program.
- **On-chain action item:** confirm the deposit/insert path either rejects duplicate commitments or that duplicate leaves cannot be produced for a single payment. If duplicates can be inserted for free, this becomes exploitable.

### OBS-2 — INPUT amounts are NOT range-checked (only outputs are)
`poc/probe_input_range.js`: an input note with `inAmount = 2^250` generates a valid witness (no `Num2Bits` on input amounts; range check exists only on outputs).
- **Why it is NOT a circuit break:** an input must satisfy Merkle membership against the public `root`. Every legitimately-inserted leaf is a range-checked OUTPUT (or deposit) with amount `< 2^248`, so no real tree contains a `2^250` note. Inputs inherit the bound transitively — this is the standard tornado-cash-nova design.
- **Residual risk / on-chain action item (defense-in-depth):** circuit soundness here fully depends on (a) the on-chain `transact` validating `root` against the real tree's known historical roots, and (b) EVERY leaf-producing path (esp. deposits/`fund_native_source`) enforcing a ≤248-bit amount. If either is weak, an attacker could commit an unbounded-amount note and drain the vault (`vault_token_account → recipient_token_account`) via `publicAmount` withdrawals. This is an on-chain check, outside pure-circuit scope, but flagged because the circuit provides no input-side backstop.

---

## Reproduction summary
```
cd /root/veilo-audit/privacy-program/cachorro-out/run_manual/poc
npm install               # snarkjs@0.7.6, circomlibjs, ffjavascript, veilo-sdk-core (already installed)
node baseline.js          # honest proof -> VERIFY: true   (evidence the harness matches the real VK)
node attack_A.js          # value inflation -> all THROW (Num2Bits(248) on outputs)
node probe_width.js       # confirms 248-bit output range check
node attack_BC.js         # B, C2, C1 THROW ; C1b verifies (see OBS-1)
node probe_input_range.js # shows inputs are NOT range-checked (see OBS-2)
```

## VERDICT
The `transaction` circuit is **SOUND** against the tested value-integrity attacks. No verifying-but-invalid proof was produced for value inflation, fake membership, mint unbinding, or single-tx duplicate-input double-spend. The circuit enforces: 248-bit output range checks (blocks field-overflow inflation), enabled-gated Merkle membership (blocks fake membership and binds the single public mint into every commitment), and explicit input-nullifier distinctness (blocks duplicate-input double-spend). Two verifying proofs exist that are NOT circuit breaks (C1b duplicate-leaf; unbounded input amounts) — both are safe only because the on-chain program is trusted to validate the `root` and to bound leaf amounts at deposit; these are flagged for on-chain review, not confirmed as circuit vulnerabilities.
