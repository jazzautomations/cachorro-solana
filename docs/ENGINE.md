# ENGINE.md — the cachorro-solana vertical on the v3 spine

Cachorro-solana is **not** an ad-hoc opencode workflow anymore. It is the
pentest-agent **v3 research spine** (journal, evidence vault, typed research
graph, capability broker, deterministic oracle, promotion gates, reporting)
with a **Solana body** (a toolpack of Solana adapters) and a **Solana moat**
(on-chain attestation anchored to the journal head). This is what turns cachorro
from a script into a product: *proof, not prose*, enforced in code.

The framework is Felipe's own (`/root/pentest-agent/pentest-agent-v3`); it is
**vendored** into this repo under `engine/`.

## What is reused from v3 (AS-IS, zero rewrite)

Everything chain-agnostic transfers unchanged. Vendored copy validates and the
v3 test suite passes inside `engine/`:

```
python3 engine/runtime/validate_bundle.py engine     # VALID, 14 agents
cd engine && python3 -m unittest discover -s tests    # 39 tests OK
```

Reused runtime: `journal.py` (append-only hash chain), `evidence_vault.py`
(content-addressed SHA-256, write-once), `research_graph.py` (typed nodes +
`TYPE_TRANSITIONS` + the `add_evidence` / `verify_primitive` / `add_finding`
gates), `capabilities.py` (broker), `execution.py` (`TrustedProcessExecutor`,
`ContainerSandbox`), `oracles.py` (`binary_differential_oracle`), `scope.py` /
`scope_signing.py` (Ed25519 signed scope), `campaign.py`, `reporting.py`. None
of these were touched — a Solana bug maps onto the exact same node types (an
account is an `asset`, an instruction a `function`, a missing-authority bug a
`hypothesis → primitive → finding`).

Reasoning agents are reused as folders. `solana-experiment-runner` is a new
agent cloned from `web-experiment-runner` (the `sqli-differential` template);
`context-modeler` and `cartographer` gained one Solana capability + tool each.

### Relocation edits (vendoring only)

Two v3 **test fixtures** hardcoded the old bundle path `/root/pentest-agent`;
they now point at `/root/cachorro-solana` so the suite passes from the new
location. One test's expected agent list gained `solana-experiment-runner`.
No runtime behaviour changed.

## The Solana toolpack (`engine/toolpacks/adapters/`)

Each adapter follows the SAME bounded-capability contract as `common.py` /
`git_history.py`: `plan() → ExecutionPlan → broker.authorize → executor →
evidence vault → journal`. Registered in `toolpacks/registry.yaml` (packs
`solana-core`, `solana-dynamic`) and dispatched by `runtime/run_adapter.py`.

| Adapter | Capability | Execution | Side-effect |
|---|---|---|---|
| `anchor-static-scan` | `static.anchor.scan` | wraps `scripts/static-scan.sh` (grep/cargo-audit, **no target build**) via `TrustedProcessExecutor` | `workspace_write` |
| `solana-program-dump` | `surface.solana.dump` | wraps `scripts/fetch-target.sh --program-id` (solana CLI + RPC), DNS-pinned RPC target, never signs a tx | `network_read` |
| `litesvm-poc` | `experiment.solana.poc` | runs a differential Rust PoC **as a trusted process** on a corpus **we** compiled | `workspace_write` |

`litesvm-poc` is the M1 escape hatch: because the corpus is self-compiled and
trusted, the PoC runs in-process and needs **neither runsc, nor a validator, nor
the devnet faucet**. It only *measures* — per repetition it parses the PoC's
treatment/control outcome into booleans; the causal verdict is decided by the
real `binary_differential_oracle`, not by the adapter or the Rust `assert!`.

## How a finding flows through the gate

Driver: `engine/runtime/solana_round.py` (corpus: `spike/vault/`, a
self-authored vulnerable/fixed pair — a **teaching corpus**, not disclosed-
vulnerable third-party code). Every record below is produced by real v3 code;
only the reasoning-agent *prose* (hypothesis/experiment/skeptic/finding text) is
scripted — a live model `CommandProvider` is the next step, not M1.

```
signed scope receipt ──▶ Campaign.initialize (journal + graph + vault + scope)
anchor-static-scan  ──▶ observation node            [vault artifact + journal]
scripted hypothesis + experiment nodes
litesvm-poc ×2      ──▶ treatment=[T,T] control=[F,F] [vault artifacts + journal]
binary_differential_oracle(minimum_successes=2) ──▶ verdict = "supports"
add_evidence         (gate: supports ⇒ ≥1 reproduction) ──▶ evidence node
verify_primitive     (gate: evidence.verdict == supports) ──▶ candidate→verified
clean-room reproduction (fresh litesvm-poc run) ──▶ repro artifact
add_finding          (gate: verified primitive + supporting evidence) ──▶ finding
reporting.render_json ──▶ report.json (verified findings only) + report_sha256
```

Proven M1 numbers: treatment drained **5,000,000,000 lamports** (vault → 0),
negative control blocked with **`Custom(1)` = `ERR_INCORRECT_AUTHORITY`** (vault
unchanged), oracle `treatment=2/2 control=0/2 → supports`. The gate is not
advisory: `verify_primitive` refuses non-`supports` evidence and `add_finding`
refuses an unverified primitive (covered by the v3 unit tests). An LLM cannot
promote an opinion to a finding.

Run it:

```
python3 engine/runtime/solana_round.py
```

Outputs land in `cachorro-out/engine-runs/<ts>/` (gitignored): `report.json`,
`round-summary.json`, and the campaign `journal/`, `graph/`, `evidence/`.

## How the attestation anchors the journal head (the moat²)

After the report, `RoundJournal.verify()` returns `(count, head_hash)`; that
`head_hash` **is** the `journal_head`. The driver builds the cachorro
attestation payload (`attest/`, canonical
`{schema, report_sha256, audited_commit, verified_build_digest, journal_head,
target, cluster, created_at}`) and computes the digest with the real journal
head via `node attest/bin/attest.js digest …`. A local receipt is written
(`attest/receipts/<digest>.json`, memo `cachorro:v1:<digest>`).

Then the digest is chained **back** into the journal as an `attestation.anchored`
event — so provenance is bidirectional: the local hash chain points at the
digest, and (once anchored) the on-chain memo points at the chain. Altering the
report breaks `report_sha256`; altering the journal breaks the hash chain;
altering either diverges from the memo.

**Live devnet send is faucet-blocked** on this VPS (airdrop 429), so the receipt
is `status: pending_anchor_faucet_blocked` — the digest is fully derived from the
real journal head and is anchor-ready. To anchor for real (once funded):
`solana airdrop 1 $(solana address -k attest/.devnet-keypair.json) --url devnet`
then `node attest/bin/attest.js anchor <report.json> --journal-head <head>
--commit <sha> --target <name>`.

## TODO — M2 (out of M1 scope, deliberately)

- **Live model `CommandProvider`** driving the reasoning agents through
  `agent_runner.py` (replaces the scripted hypothesis/experiment/finding prose).
- **Untrusted third-party targets**: `litesvm-poc` on a target we did *not*
  compile must run under `ContainerSandbox` (runsc, `--network none`) with the
  `code_execution` side-effect + Ed25519 `approvals.py` (because `build.rs` runs
  arbitrary code). M1 stays on the trusted self-compiled corpus.
- **`snarkjs` adapter** for zk-circuit soundness (fourth adapter, deferred).
- **Point it at a real bounty target** (Superteam/Immunefi scope) through the
  same spine, with the scope receipt encoding the program's rules.
