# cachorro attest — on-chain audit receipt (Solana devnet)

**The moat.** Every cachorro-solana audit report gets a verifiable receipt anchored
on Solana. Not a badge you have to trust us on — a transaction anyone can pull from
the chain and re-check against the report bytes.

**Proof, not opinion — and the receipt is on-chain.**

## How it works

An attestation is a small canonical JSON payload:

```
{ schema, report_sha256, audited_commit, verified_build_digest,
  journal_head, target, cluster, created_at }
```

We canonicalize it (sorted keys, no whitespace) and take `sha256` of those exact
bytes → the **attestation digest**. Only that digest goes on-chain, inside an
**SPL Memo** instruction (program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`)
as the compact string `cachorro:v1:<digest>`. The full canonical payload lives in
the local receipt; the chain carries just the fingerprint, so the transaction stays
tiny and cheap. No custom on-chain program to deploy — we ride the canonical memo
program.

Verification recomputes the digest from the receipt's fields (it does **not** trust
the stored digest), fetches the transaction from devnet, and checks the on-chain
`cachorro:v1:<digest>` matches. If a single audited field is altered, the memo no
longer matches and verify fails.

## Commands

```bash
npm install                 # in attest/  (pins @solana/web3.js 1.99.0)

# anchor a report -> devnet tx + local receipt
node bin/attest.js anchor fixtures/sample-report.json
#   [--commit <sha>]  [--target <name>]
#   commit/target are read from the report JSON if not passed

# verify by signature OR attestation digest
node bin/attest.js verify <signature|attestation_sha256>
```

`anchor` prints the transaction signature and
`https://explorer.solana.com/tx/<sig>?cluster=devnet`, and writes
`receipts/<attestation_sha256>.json`. `verify` prints PASS/FAIL with the matched
report hash, commit, memo hash, slot and block time.

## Safety

- **Devnet only.** The cluster is hardcoded; passing `--cluster mainnet` is refused.
  This is a test-network receipt, not a real financial transaction.
- A throwaway payer keypair is created at `.devnet-keypair.json` (gitignored) and
  funded from the devnet faucet. If the faucet is rate-limited, `anchor` fails with a
  clear message and the exact manual airdrop command — it never hangs.

## Layout

```
lib/canonical.js     deterministic canonical JSON + sha256
lib/attestation.js   payload shape, digest, memo string, memo parse
lib/solana.js        devnet connection, keypair, airdrop, send/fetch memo
bin/attest.js        CLI: anchor / verify
fixtures/            sample cachorro report
test/                unit tests (canonicalization + verify logic vs mocked tx)
receipts/            anchored receipts (gitignored)
```
