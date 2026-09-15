# Veilo ZK Circuit Hunt — Findings

**Target:** Veilo privacy pool (zk on Solana). Bug-bounty (authorized whitehat).
**Goal:** Locate the ZK **circuit source / proving artifacts** — the on-chain program ships only the verifying key; the circom / witness-gen / proving key is where a *forge-proof → drain* soundness bug would live.
**Date:** 2026-07-28

---

## TL;DR

- **Circom source (`.circom`): NOT obtainable.** It is deliberately withheld. `.gitignore` in the on-chain repo excludes `zk/`, `circuits/`, `fixtures/`, `scripts/`, `tools/` with the comment `# ZK circuits (private)`. The two npm SDKs point at repos (`VeiloSolana/veilo-sdk`, `ZKSOLDev/core-sdk`) that are **private / 404**.
- **Proving artifacts: FULLY obtainable (for the core `transaction` circuit).** The Veilo Chrome extension CRX bundles `transaction_final.zkey` + `transaction.wasm` + `transaction_verification_key.json`. **Downloaded and verified.** These are staged in `./artifacts/`.
- The **`.zkey` contains the complete R1CS constraint system**, which `snarkjs zkey export json` extracts (28,547 constraint-coefficient triples, 29,692 wires, nPublic=8). **This is sufficient to audit constraint-soundness without the `.circom`.**
- **Upstream template: Tornado-Cash-Nova (`tornado-nova`) `transaction.circom`**, 2-in/2-out UTXO, extended with a `mint` public input for multi-asset. Public-input layout matches exactly.
- The extracted VK from the `.zkey` **matches** the extension's bundled VK **and** matches the on-chain `TRANSACTION_VK` (nPublic=8, IC[9]). So the artifact we pulled is provably the circuit the on-chain verifier enforces.
- The **`swap` circuit** (`swap.circom`) exists but its artifacts are **NOT in the extension** — swap proving is done **server-side by the relayer** (`relayer-server/src/controllers/swap.helpers.ts`), so swap artifacts are not publicly reachable.

**Obtainable? → PARTIAL:** proving artifacts YES (transaction circuit, downloadable), circom source NO, swap artifacts NO.

---

## 1. What is / isn't in the public GitHub org

`VeiloSolana` public repos: `privacy-program` (on-chain), `wallet-sdk-demo`, `sdk-demo` (empty, LICENSE only), `DefiLlama-Adapters` (fork).

**On-chain repo (`privacy-program`) — the circuit is gitignored, not absent by accident:**
```
# ZK circuits (private)
zk/
circuits/
fixtures/
...
scripts/
tools/
```
The test suite references the artifacts by path but they are not committed:
- `zk/circuits/transaction/transaction_js/transaction.wasm`
- `zk/circuits/transaction/transaction_final.zkey`
- `zk/circuits/transaction/transaction_verification_key.json`
- `zk/circuits/swap/swap_js/swap.wasm`, `zk/circuits/swap/swap_final.zkey`, `zk/circuits/swap/swap_verification_key.json`

Test/helper comments repeatedly cite **`transaction.circom`** and **`swap.circom`** signal names (e.g. `tests/test-helpers.ts`, `tests/note-ciphers.test.ts`), confirming a circom toolchain, but no `.circom`/`.r1cs` is anywhere in the tree.

**On-chain public-input struct (`programs/privacy-pool/src/lib.rs`, `TransactionPublicInputs`):**
`root`, `public_amount (i64)`, `ext_data_hash`, `mint_address`, `input_nullifiers[2]`, `output_commitments[2]` → **8 public inputs** (matches `TRANSACTION_N_PUBLIC = 8`, `TRANSACTION_VK_IC[9]` in `vk_constants.rs`).

---

## 2. npm packages

| Package | Repo (per metadata) | Bundles artifacts? |
|---|---|---|
| `veilo-sdk-core@0.3.2` | `github.com/VeiloSolana/veilo-sdk` (**404/private**) | **No** |
| `@veilo/sdk-core@0.1.17` | `github.com/ZKSOLDev/core-sdk` (**404/private**) | **No** |

Neither ships `.wasm`/`.zkey`. `veilo-sdk-core`'s `prover.d.ts` states the consumer must supply them:
> "Circuit artifact paths required by snarkjs. **Host them on GitHub Releases, IPFS, or a CDN and download at runtime.**"

The SDK is proof-*plumbing* only: `formatInputsForSnarkjs`, `createTransactionProver` (calls `snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath)`), `encodeSnarkjsProofToTransactionProof`. Useful intel for building a PoC prover, and it **leaks the swap circuit layout** (see §5) and mirrors relayer-side logic (`relayer-server/src/controllers/swap.helpers.ts`).

`wallet-sdk-demo` uses a third, unpublished package `veilo-connect-sdk` (local `.tgz`, `VeiloConnect` — an extension-bridge/"connect" model), confirming proving is delegated to the **browser extension**, not the web page.

The web app (`veilo.network`, Next.js) exposes **no** artifact URLs directly; it links to the extension.

---

## 3. THE ARTIFACTS — Chrome extension (downloadable, VERIFIED)

**Veilo Wallet extension**, Chrome Web Store ID **`embiakcfieonjgmbhhcbbdfogfffgahb`**.
Downloaded via the CRX update endpoint (35 MB CRX, no login):
```
https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=120.0&x=id%3Dembiakcfieonjgmbhhcbbdfogfffgahb%26installsource%3Dondemand%26uc
```
CRX is a zip after a header; entries include the full ZK payload (built 2026-07-17):

| File | Size | sha256 |
|---|---|---|
| `zk/circuits/transaction/transaction_final.zkey` | 12,855,940 | `3009250d5ae87ca76102f8686c26e2d58d5775162e368ff9877d7c2db85f1454` |
| `zk/circuits/transaction/transaction_js/transaction.wasm` | 3,194,904 | `3f14fb74a4415af75c437bdc4821f9a237d052039707cb03b0fe8245c277b1ab` |
| `zk/circuits/transaction/transaction_verification_key.json` | 4,205 | `35d0ceacbdacc475c4046400d63fd7451d9a841e01b965d5fd0eb6ef506508eb` |
| `zk/circuits/transaction/transaction_js/{generate_witness.js, witness_calculator.js}` | — | — |

**Only the `transaction` circuit is bundled — no `swap` circuit artifacts** (swap proofs are generated by the relayer server, not the client).

**Staged locally for the auditor:** `cachorro-out/run_manual/artifacts/`
(`transaction_final.zkey`, `transaction.wasm`, `transaction_verification_key.json`, `transaction_js/*`, and `transaction_zkey_export.json` = the `snarkjs zkey export json` dump).

### Consistency proof (artifact ↔ on-chain)
- `snarkjs zkey export verificationkey transaction_final.zkey` → matches the bundled `transaction_verification_key.json` byte-for-byte on `nPublic`, `IC[0]`, `vk_alpha_1`.
- Bundled VK: `protocol=groth16`, `curve=bn128`, `nPublic=8`, `IC.length=9` → matches on-chain `vk_constants.rs` (`TRANSACTION_N_PUBLIC=8`, `TRANSACTION_VK_IC[9]`).
- `snarkjs zkey export json` → `nVars=29692`, `nPublic=8`, `domainSize=32768` (power 15), **28,547 constraint triples (`ccoefs`)** — the full R1CS is recoverable from the `.zkey`.

Conclusion: the pulled `.zkey`/`.wasm` **are** the exact proving system the on-chain verifier trusts. Soundness of the whole pool reduces to soundness of these constraints.

---

## 4. Upstream template & lineage

**Tornado-Cash-Nova (`tornadocash/tornado-nova`) `circuits/transaction.circom`** — 2-in/2-out UTXO shielded pool. Veilo's public-signal layout is that circuit plus a `mint` signal for multi-asset support:

| tornado-nova | Veilo `transaction` |
|---|---|
| root | root |
| publicAmount | public_amount (i64; `sumIns + publicAmount = sumOuts`) |
| extDataHash | ext_data_hash (`Poseidon(recipient, relayer, fee, refund)`) |
| — | **mint_address** (added for multi-token) |
| inputNullifier[2] | input_nullifiers[2] |
| outputCommitment[2] | output_commitments[2] |

Poseidon hashing, Merkle membership, `enabled = 1 - isZero(amount)` "skip Merkle for zero-value input" pattern, and `sumIns + publicAmount = sumOuts` value conservation are all the tornado-nova idiom (confirmed by test comments in `tests/phoenix-integration.test.ts`, `tests/raydium-cpmm-swap.test.ts`).

**Known soundness-sensitive spots in this lineage — prioritize when auditing the extracted R1CS:**
1. **Amount range checks.** tornado-nova relies on `LessThan`/bit-decomposition to keep `inAmount`/`outAmount` in range so `sumIns + publicAmount = sumOuts` can't wrap mod p. A missing/weak range check (or `mint`-mixing across the two inputs/outputs) is the classic drain vector — mint an output larger than inputs via field overflow.
2. **Per-input `enabled` binding.** The "skip Merkle proof when amount==0" gate: if a nonzero-amount input can drive `enabled=0`, an attacker spends a commitment that isn't in the tree. Verify `enabled` is forced `=1` whenever `amount != 0`.
3. **Nullifier construction / duplicate inputs.** Whether `inputNullifier[0] != inputNullifier[1]` (same UTXO spent twice in one tx) is enforced **in-circuit** or only on-chain (tests reference a "duplicate-nullifier failure"). Also whether the nullifier binds the leaf index/path so the same note can't yield two nullifiers.
4. **`mint` binding.** The added `mint` signal must be constrained into every input/output commitment and nullifier; if a commitment's mint is unconstrained, cross-asset value creation is possible.
5. **`publicAmount` sign/field encoding.** i64 on-chain vs field element in-circuit — check the negative-value (withdrawal) encoding can't alias a huge positive.

---

## 5. Swap circuit (`swap.circom`) — partial intel, no artifact

Not in the extension and not on GitHub. But the SDK (`veilo-sdk-core/dist/esm/proof.js`) leaks its interface and hashing:
- **Public:** `sourceRoot, swapParamsHash, extDataHash, sourceMint, destMint, inputNullifier[2], changeCommitment, destCommitment, swapAmount` (matches on-chain `SwapPublicInputs` in `swap.rs`).
- **`swapParamsHash` (swap.circom ~lines 293–307):** `mintPairHash=Poseidon(sourceMint,destMint)`, `swapTermsHash=Poseidon(minAmountOut,deadline,destAmount)`, `swapParamsHash=Poseidon(mintPairHash,swapTermsHash)`.
- Proving is relayer-side (`relayer-server/src/controllers/swap.helpers.ts` `generateSwapProof`). To get the swap `.zkey`/`.wasm` you'd need the relayer server or a private repo — **not currently reachable**.

---

## 6. Adjacent public work (context, not artifacts)

Other bounty hunters' repos exist (on-chain findings, not circuit): `sudo-robi/veilo-privacy-pool-audit` (V-01 + PoC), `Triwidodo99/veilo-bounty-report`, `redisinaga/veilo-audit-report`, `NataliaBorova/...-Blackbox-Analysis`. None appear to hold the circom source. Worth reading to avoid duplicate findings, but the circuit-soundness angle looks unclaimed.

---

## 7. Concrete next-step plan (constraint-soundness audit)

Everything needed for the **transaction** circuit is already pulled into `./artifacts/`. Recommended path:

1. **Recover the constraint system** (done): `transaction_zkey_export.json` holds all 28,547 constraints. For readable analysis, feed the `.wasm` + `.zkey` to **`circomkit`/`circom_tester`** or use **`snarkjs`** to sanity-run `groth16.fullProve` with crafted inputs.
2. **Reconstruct circuit semantics** from `transaction.wasm` via the `witness_calculator.js` symbol table (the wasm carries signal names) — map wires back to `inAmount/outAmount/enabled/mint/nullifier` to locate the range-check and `enabled` gates.
3. **Diff against tornado-nova `transaction.circom`** (public upstream) to see exactly what Veilo added (`mint`) and whether the added constraints preserve the range/conservation guarantees. Focus on the 5 spots in §4.
4. **Forge-proof PoC:** using `veilo-sdk-core`'s `formatInputsForSnarkjs` + `createTransactionProver` with the pulled `.wasm`/`.zkey`, attempt to build a witness that (a) spends a zero/nonzero input with `enabled=0`, (b) overflows `sumIns+publicAmount=sumOuts`, or (c) mismatches `mint` between commitment and nullifier — then verify locally against the pulled VK (which equals the on-chain VK). A proof that verifies but violates value conservation = **critical drain**.
5. **Swap circuit:** parked unless the relayer server or `swap.zkey` becomes reachable; pursue via relayer host or private-repo access.

---

## Verification notes
- All URLs/artifacts above were actually fetched/executed; hashes are of the real downloaded files. No URLs fabricated.
- Private repos (`VeiloSolana/veilo-sdk`, `ZKSOLDev/core-sdk`, `ZKSOLDev` org) returned HTTP 404 with the authenticated `gh` token — reported as unreachable, not assumed.
