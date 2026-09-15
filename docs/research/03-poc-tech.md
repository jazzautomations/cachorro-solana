# 03 — Local Executable PoC Tech for Solana Exploits

> Research doc for **cachorro-solana**. This feeds **M1** (the AI ANALYZE/DEVIL/POC stages) and the
> **runsc/PoC gate** in STATUS.md. Goal: turn a static finding into a **runnable exploit** that
> proves impact (e.g. attacker drains a PDA's lamports) on a **local, networkless** VM — never
> mainnet. Web-sourced; treat every fetched claim as untrusted until reproduced. Compiled 2026-09-15.

## TL;DR

Four ways to run a Solana exploit locally, ranked by fit for our sandboxed "proof, not opinion" engine:

1. **litesvm** — in-process Rust VM. **Networkless, no ports, no child process.** Millisecond startup.
   Load a compiled `.so`, craft the attacker instruction, assert on lamports/data. **This is our
   default PoC harness.** Runs cleanly under `runsc --network=none`.
2. **solana-program-test / BanksClient (ProgramTest)** — the older in-process harness (BanksServer +
   BanksClient over an in-memory channel). Also networkless, but heavier (async, Tokio) and slower.
   Use when a finding needs features litesvm lacks, or to port an existing Anchor test.
3. **solana-test-validator --clone** — a **real, separate validator process that BINDS PORTS**
   (8899 RPC, 8900 WS, 9900 faucet, 8000-8020 gossip). This is the **fork-style** path: clone real
   mainnet program + account state and replay the exploit against it. Does **not** fit `--network=none`
   as-is (needs loopback at minimum; the process wants to bind). Sandbox with loopback-only.
4. **Trident (Ackee)** — coverage-guided fuzzer, not a PoC author. Great as a **bug *finder*** that
   emits a crash-reproducing input; that input still has to be hand-lifted into a curated litesvm PoC
   for our deliverable. In-process (built on solana-program-test internals), networkless.

**Decision for cachorro:** author every PoC as a **litesvm Rust test** (networkless, `runsc`-friendly,
fast, deterministic oracle). Escalate to **`--clone` fork** only when the bug depends on real mainnet
state (an existing PDA balance, a live config account, a specific program version). Use **Trident**
optionally in ANALYZE as a discovery aid, never as the shipped artifact.

---

## The comparison matrix

| Dimension | litesvm | solana-program-test / BanksClient | solana-test-validator --clone | Trident |
|---|---|---|---|---|
| Model | In-process VM (Rust lib) | In-process BanksServer+Client (async) | Real validator, separate process | Fuzz harness over program-test |
| Language | Rust (+ TS/Py bindings) | Rust | Any (RPC client) | Rust |
| Startup | ~ms | ~tens of ms | seconds (ledger init) | ms (per-iteration) |
| Loads target how | `add_program(id, bytes)` / `add_program_from_file` | `ProgramTest::add_program(name,id,None)` | `--bpf-program` / `--clone-upgradeable-program` | via program-test loader |
| Real mainnet state | manual `set_account` | manual `set_account` | **native `--clone` / `--account`** | manual |
| Pass/fail oracle | `Result` from `send_transaction` + assert on `get_account`/`get_balance` | `Result` from `process_transaction` + `get_account` | RPC read-back + assert | invariant fn + crash file |
| **Networkless?** | **Yes — no sockets** | **Yes — in-memory channel** | **No — binds 8899/8900/9900/gossip** | **Yes** |
| `runsc --network=none` | ✅ clean | ✅ clean | ⚠️ needs loopback (netstack) | ✅ clean |
| Best for | our default PoC | porting Anchor tests | fork-from-mainnet PoC | finding the bug |

---

## 1. litesvm — the default harness

**What it is.** A library that runs the full Solana runtime **inside your Rust test process**. No
validator, no RPC, no child process, no sockets. Marketed as much faster to run/compile than
`solana-program-test` and `solana-test-validator`
([QuickNode LiteSVM guide](https://www.quicknode.com/guides/solana-development/tooling/litesvm),
retrieved 2026-09-15; [docs.rs/litesvm](https://docs.rs/litesvm/latest/litesvm/), retrieved 2026-09-15).

**How it loads a target.** For a program you have the compiled BPF for:

```rust
let mut svm = LiteSVM::new();
svm.add_program_from_file(program_id, "target/deploy/victim.so").unwrap();
// or from bytes you already hold:
svm.add_program(program_id, &program_bytes);
```

`add_program` is the fastest path and **does not run `build.rs`** — it consumes an already-compiled
`.so`. This matters for AGENTS.md rule #4 (third-party `build.rs` is arbitrary code). The clean flow
is: build the target **once** in an isolated container (or use a `.so` the target already ships), then
run *N* PoCs against the bytes with **no further compilation of untrusted code**.

**How it runs an attacker instruction.** Build a normal `Transaction`/`Instruction` with the attacker
keypair as signer and send it:

```rust
let meta = svm.send_transaction(tx);   // Result<TransactionMetadata, FailedTransactionMetadata>
```

**The pass/fail oracle.** `send_transaction` returns a `Result`: `Ok(meta)` (logs, CU consumed) on
success, `Err(..)` on a failed/reverted tx. You then read state directly:

```rust
let before = svm.get_balance(&victim_pda).unwrap();
svm.send_transaction(attack_tx).unwrap();          // must NOT error for a real drain
let after  = svm.get_balance(&victim_pda).unwrap();
assert_eq!(after, 0, "PoC failed: PDA not drained");
assert!(svm.get_balance(&attacker).unwrap() > before, "attacker did not receive funds");
```

Two oracle styles, both deterministic:
- **Positive-impact oracle:** attack tx succeeds AND a value invariant is broken (victim lamports → 0,
  attacker balance ↑, mint supply inflated, nullifier reused). This is what a *critical* PoC asserts.
- **Negative control:** the same tx signed/owned correctly **must** `Err`, proving the vuln is the
  missing check and not a setup artifact. (Maps to the promotion gate's "negative-control" requirement
  in the pentest-agent spine.)

**Seeding arbitrary state.** `svm.set_account(pubkey, Account{ lamports, data, owner, executable,
rent_epoch })` writes raw account bytes, so you can materialize a funded victim PDA owned by the target
program without going through its init path. `svm.airdrop(&payer, n)` funds signers.

**Networkless proof.** litesvm opens **no sockets** — the runtime is a struct in your process. It runs
unchanged under `runsc --network=none`. This is the single biggest reason it is our default.

---

## 2. solana-program-test / BanksClient (ProgramTest)

**What it is.** The original in-process harness. `ProgramTest::new(name, program_id, processor)` builds
an environment; `.start()` (or `.start_with_context()`) returns `(BanksClient, payer_keypair,
recent_blockhash)` ([docs.rs/solana-program-test](https://docs.rs/solana-program-test/latest/solana_program_test/struct.BanksClient.html),
retrieved 2026-09-15; [Helius testing guide](https://www.helius.dev/blog/a-guide-to-testing-solana-programs),
retrieved 2026-09-15).

**Load target:** `program_test.add_program("victim", program_id, None)` locates `victim.so` in
`tests/fixtures` / `BPF_OUT_DIR`, or pass a builtin `processor!` entry for native programs.

**Attacker ix + oracle:**
```rust
let (mut banks, payer, blockhash) = program_test.start().await;
let r = banks.process_transaction(attack_tx).await;   // Result<(), BanksClientError>
let acct = banks.get_account(victim_pda).await.unwrap().unwrap();
assert_eq!(acct.lamports, 0);
```
`process_transaction` (and `process_transaction_with_metadata`) is the oracle; `get_account` reads
state back.

**Networkless?** Yes — BanksClient talks to an in-memory BanksServer over a channel, no TCP. Also fits
`--network=none`. **Downside vs litesvm:** async/Tokio boilerplate, slower, more ceremony. Use it to
**port an existing Anchor/`ProgramTest` test** a target already ships, or when a needed API is missing
from litesvm.

---

## 3. solana-test-validator --clone — the fork-style PoC

**What it is.** A **real single-node validator as a separate OS process**. Use it when the exploit
depends on **actual mainnet state** — a live PDA with a real balance, a specific config/authority
account, or the exact deployed program version (not the repo HEAD).

**It binds ports** (this is the key sandboxing fact): 8899 RPC, 8900 WebSocket, 9900 faucet, and a
gossip/TPU range around 8000-8020
([Agave validator docs](https://docs.solana.com/running-validator/validator-start), retrieved
2026-09-15; [DEV localnet ports](https://dev.to/originalb/troubleshooting-solana-localnet-slaying-zombie-ports-and-validator-errors-438k),
retrieved 2026-09-15). So it is **not** networkless — under gVisor it needs at least loopback
(netstack provides one even with `--network=none`), and the RPC client must reach 127.0.0.1:8899.

**Cloning real state (two ways):**

Inline clone at boot (needs an upstream RPC reachable **at fork time only** — do this in a trusted
setup step, then the *replay* runs offline):
```bash
solana-test-validator --reset \
  --url mainnet-beta \
  --clone-upgradeable-program <PROGRAM_ID> \
  --clone <ACCOUNT_PUBKEY> \
  --clone <ANOTHER_ACCOUNT>
# --clone            : snapshot a data account
# --clone-upgradeable-program : snapshot program + its programdata (correct for BPFUpgradeable)
```
([QuickNode fork-to-localnet guide](https://www.quicknode.com/guides/solana-development/accounts-and-data/fork-programs-to-localnet),
retrieved 2026-09-15.)

Offline/air-gapped clone (fetch once, replay with **no network**): dump accounts to files, then boot
from files.
```bash
# fetch step (trusted, has network):
solana account <ACCOUNT_PUBKEY> --output-file acct.json --output json --url mainnet-beta
solana program dump <PROGRAM_ID> victim.so --url mainnet-beta
# replay step (sandbox, network off except loopback):
solana-test-validator --reset \
  --bpf-program <PROGRAM_ID> victim.so \
  --account <ACCOUNT_PUBKEY> acct.json
```
This split is important for us: the **network-touching fetch** is a separate, auditable step; the
**exploit replay** runs against local files. `mucho`/Anchor's `[test.validator.clone]` toml wrap the
same flags ([solana-foundation/mucho](https://github.com/solana-foundation/mucho), retrieved
2026-09-15).

**Oracle:** ordinary RPC — read the account before/after via `getAccountInfo`/`getBalance` and assert.
Slower and port-bound, but the only path that proves an exploit against *the state that is actually on
mainnet today*.

**litesvm fork alternative:** you can reproduce most fork PoCs **networklessly** by fetching the
account(s) once with an RPC client and replaying them into litesvm via `set_account` — keeping the
whole replay in-process. Prefer this unless a bug genuinely needs full validator semantics
(sysvars/slots/rent edge behavior, CPI to many cloned programs).

---

## 4. Trident (Ackee) — finder, not PoC author

Coverage-guided fuzzer for Anchor programs, Solana-Foundation-backed
([Ackee: Introducing Trident](https://ackee.xyz/blog/introducing-trident-the-first-open-source-fuzzer-for-solana-programs/),
retrieved 2026-09-15; [QuickNode Trident guide](https://www.quicknode.com/guides/solana-development/tooling/trident-fuzzing),
retrieved 2026-09-15).

- **Loads target** through the program-test loader (in-process, networkless).
- **Attacker ixs** come from a generated template you fill in:
  `trident-tests/fuzz_tests/fuzz_0/fuzz_instructions.rs` defines account storages and per-ix flows;
  the fuzzer supplies random `AccountId`s and instruction data.
- **Oracle** = **invariant checks** (custom `check`/`invariant` fns) + tx hooks; on violation or panic
  it writes a **crash file** with the exact input for replay/debug.
- **Fit for us:** run it in ANALYZE as an optional discovery aid on Anchor targets. Its output is a
  crash input, **not** a curated, human-readable "attacker drains PDA" PoC — a human/agent still lifts
  it into a litesvm test with a named finding and a value-invariant assertion. Never our shipped
  artifact; it complements the static engine.

---

## Minimal litesvm PoC — missing owner check (the canonical shape)

Scenario: `withdraw` reads a "vault authority" account, transfers the vault PDA's lamports to a
`recipient`, but **never checks the authority account's `owner` == the program** (nor a `has_one` /
signer). Attacker passes a look-alike account they control → drains the vault.

```rust
// Cargo.toml (dev-deps): litesvm = "*", solana-sdk = "*"
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account, instruction::{AccountMeta, Instruction},
    pubkey::Pubkey, signature::{Keypair, Signer}, transaction::Transaction,
};

#[test]
fn poc_missing_owner_check_drains_vault() {
    let mut svm = LiteSVM::new();

    // 1. Load the ALREADY-COMPILED target (no build.rs runs here).
    let program_id = Pubkey::new_unique();
    svm.add_program_from_file(program_id, "fixtures/victim.so").unwrap();

    // 2. Attacker keypair, funded for fees.
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    // 3. Seed a funded vault PDA owned by the program (raw bytes, skip init path).
    let (vault, _bump) = Pubkey::find_program_address(&[b"vault"], &program_id);
    svm.set_account(vault, Account {
        lamports: 5_000_000_000,           // 5 SOL to steal
        data: vec![0u8; 8],
        owner: program_id,
        executable: false,
        rent_epoch: 0,
    }).unwrap();

    // 4. FORGED authority account the attacker controls (owner is NOT the program).
    let fake_auth = Keypair::new();

    let before = svm.get_balance(&vault).unwrap();

    // 5. Craft the attacker instruction (discriminator + accounts per the target's IDL).
    let ix = Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(fake_auth.pubkey(), true), // signs, wrong owner
            AccountMeta::new(attacker.pubkey(), false),          // recipient = attacker
        ],
        data: vec![/* withdraw discriminator + amount */],
    };
    let tx = Transaction::new_signed_with_payer(
        &[ix], Some(&attacker.pubkey()),
        &[&attacker, &fake_auth], svm.latest_blockhash(),
    );

    // 6. ORACLE: attack must succeed, and the value invariant must be broken.
    svm.send_transaction(tx).expect("exploit tx reverted — no bug");
    let vault_after = svm.get_balance(&vault).unwrap();
    let atk_after   = svm.get_balance(&attacker.pubkey()).unwrap();

    assert_eq!(vault_after, 0, "PoC FAILED: vault not drained");
    assert!(atk_after > before - 100_000, "PoC FAILED: attacker did not receive vault funds");
    // Positive-impact oracle satisfied => CONFIRMED critical.
}
```

**Companion negative control** (same file, proves the *check* is the cause): sign with an authority
account whose `owner == program_id` set correctly / that fails `has_one`, and assert
`send_transaction(...).is_err()`. Both together = promotion-gate-worthy proof.

Adapt the discriminator/account order to the target IDL (Anchor: 8-byte sighash of `global:<ix_name>`).
For Anchor targets you can build the ix with the generated client instead of hand-rolling `data`.

---

## Sandboxing (gVisor / runsc) — what our PoC gate needs

Per STATUS.md the PoC gate must run exploits in an **isolated sandbox**. gVisor (`runsc`) is a
user-space kernel that intercepts every syscall and forwards a filtered subset to the host
([gVisor intro](https://gvisor.dev/docs/architecture_guide/intro/), retrieved 2026-09-15).

- **litesvm / program-test / Trident:** run under `runsc --network=none` with **no changes** — they
  open no sockets. `--network=none` still leaves a netstack loopback, which they don't even need.
  ([gVisor networking](https://gvisor.dev/docs/user_guide/networking/), retrieved 2026-09-15.)
- **solana-test-validator:** binds 8899/8900/9900/gossip, so it needs at least **loopback**. Two safe
  configs: (a) run the validator + RPC client **inside the same sandbox** and keep `--network=none`
  (loopback stays inside gVisor's netstack — the exploit client reaches 127.0.0.1:8899, nothing
  reaches the host or internet); (b) do the **`--clone`/fetch step in a separate, network-enabled,
  trusted stage**, snapshot to files, then replay the validator from files inside the sandbox with
  loopback only. Never give the exploit-replay stage outbound network — that is the AGENTS.md rule #1
  guardrail (no attack tx ever leaves for mainnet).
- **Build isolation:** compile the target `.so` in a **separate** container/stage (build.rs = arbitrary
  code, AGENTS.md #4). The PoC stage consumes only bytes. Rootless `runsc --rootless --network=none do`
  works for one-shot binary runs.

**Recommended cachorro topology:**
1. **fetch/build stage** (network allowed, trusted): clone repo, build `.so` once, or `solana account`
   dump for a fork. Outputs immutable artifacts (`.so`, `acct.json`) into the evidence vault.
2. **PoC stage** (`runsc --network=none`): litesvm test against the `.so` (+ optional replayed
   accounts). Deterministic oracle → CONFIRMED/REFUTED. Nothing outbound.
3. **attest stage:** hash the report + journal head, anchor digest on devnet (separate, explicit).

This keeps the only network-touching steps in an auditable trusted stage and the actual exploit fully
air-gapped — which is exactly the "proof, not opinion, never mainnet" story the pitch sells.

---

## Sources (retrieved 2026-09-15)

- LiteSVM API — https://docs.rs/litesvm/latest/litesvm/
- QuickNode, "How to Test Solana Programs with LiteSVM" — https://www.quicknode.com/guides/solana-development/tooling/litesvm
- Anchor docs, litesvm testing — https://github.com/solana-foundation/anchor/blob/master/docs/content/docs/testing/litesvm.mdx
- solana-program-test / BanksClient — https://docs.rs/solana-program-test/latest/solana_program_test/struct.BanksClient.html
- Helius, "A Guide to Testing Solana Programs" — https://www.helius.dev/blog/a-guide-to-testing-solana-programs
- QuickNode, "Fork Programs & Accounts from Mainnet to Localhost" — https://www.quicknode.com/guides/solana-development/accounts-and-data/fork-programs-to-localnet
- solana-foundation/mucho — https://github.com/solana-foundation/mucho
- Agave validator docs (ports) — https://docs.solana.com/running-validator/validator-start
- DEV, "Troubleshooting Solana Localnet: Zombie Ports" — https://dev.to/originalb/troubleshooting-solana-localnet-slaying-zombie-ports-and-validator-errors-438k
- Ackee, "Introducing Trident" — https://ackee.xyz/blog/introducing-trident-the-first-open-source-fuzzer-for-solana-programs/
- QuickNode, "How to Fuzz Test Programs with Trident" — https://www.quicknode.com/guides/solana-development/tooling/trident-fuzzing
- gVisor architecture / networking — https://gvisor.dev/docs/architecture_guide/intro/ , https://gvisor.dev/docs/user_guide/networking/
