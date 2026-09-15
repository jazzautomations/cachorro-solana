# 04 — On-Chain Attestation & Verifiable-Audit Prior Art (the moat)

> Research doc for **cachorro-solana**. Maps the prior art cachorro's on-chain attestation
> layer must stand on: Solana verifiable builds, program-hash verification, SPL Memo vs a
> custom program vs Solana Attestation Service (SAS), EAS-on-Ethereum as analogy, and
> in-toto/SLSA provenance. Then designs what cachorro should anchor and how a third party
> (launchpad, wallet, DEX) verifies a "cachorro-attested" program — and what makes that
> defensible vs. copyable.
> Web-sourced; treat every fetched claim as vendor marketing until independently verified.
> Sources dated inline. Compiled 2026-09-15.

## TL;DR

- **Program-hash verification already exists and is solid, but it is a *build-provenance*
  primitive, not a *security* primitive.** `solana-verify` / otter-verify proves "this repo
  at this commit under this Docker image produced the bytes now running at this program id."
  It says **nothing** about whether the code is safe. That gap is exactly cachorro's product:
  we bind an **executable PoC + audit verdict** to the same commit/hash the verified-build
  world already anchors. (solana.com/docs/programs/verified-builds; Accretion, 2025.)
- **The attestation rail is now native.** The **Solana Attestation Service (SAS)** shipped to
  mainnet in 2025 (program `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`). It gives us a
  credential→schema→attestation hierarchy with issuer authority, expiry and revocation — a
  purpose-built home for a "cachorro audited program X at commit Y" statement, far better than
  a raw SPL Memo. (solana.com/news, 2025; deepwiki, 2025.)
- **cachorro's current attest CLI (SPL Memo on devnet) is the right MVP but the wrong
  long-term rail.** Memo = a timestamped fingerprint anyone can pull, zero deploy cost, good
  for the hackathon demo. SAS = an issuer-scoped, schema-typed, revocable credential a wallet
  or launchpad can query by one SDK call. **Recommend: keep Memo as the fallback anchor, add a
  SAS schema as the flagship.**
- **The moat is not "we put a hash on-chain" (trivially copyable). The moat is *what the hash
  commits to*: a hash-chained journal head + a reproduced-in-clean-room PoC + a negative
  control, i.e. the pentest-agent-v3 promotion gate.** An attestation is only worth its
  weakest input; competitors can copy the memo/SAS write in an afternoon, but not the
  evidence-integrity pipeline behind `journal_head`.
- **Honest limit to state up front:** an on-chain audit attestation inherits every weakness of
  verified builds — it proves *a claim about a specific artifact*, not that the artifact is
  safe, not that the frontend/SDK/deploy is honest, and not that the audited commit is what's
  actually deployed *unless we also bind the verified-build digest*. We must bind it, and we
  must say plainly what the attestation does and does not mean.

---

## 1. Solana verified builds — the existing anchor cachorro plugs into

### 1.1 What it is
`solana-verify` (crate `solana-verify`, CLI) is the deterministic build/verify tool maintained
by **Ellipsis Labs** and **OtterSec**. It builds a program in a **pinned Docker image** so the
build is reproducible, then compares the hash of the locally built `.so` against the hash of the
bytes deployed on-chain. If they match, the deployed program provably came from that source at
that commit. The verification **API is hosted by OtterSec** and consumed by explorers (Solana
Explorer, Solscan). (github.com/Ellipsis-Labs/solana-verifiable-build; solana.com/docs/programs/verified-builds,
fetched 2026-09-15. Also mirrored at github.com/solana-foundation/solana-verifiable-build.)

### 1.2 How the hash works
Two hashes are compared:

```bash
solana-verify get-executable-hash target/deploy/<lib>.so        # local build artifact
solana-verify get-program-hash   -u <rpc> <PROGRAM_ID>          # on-chain program bytes
```

The on-chain program's executable bytes are read from the program (upgradeable loader) account
data and hashed; the tool handles the loader's layout and trailing padding so the two digests
line up. A match = byte-for-byte reproduction. (solana.com/docs/programs/verified-builds, fetched
2026-09-15 — note: the official page gives the CLI commands but does **not** spell out the exact
trailing-zero handling; that lives in the crate source. Flag this as "read the code before
claiming precision.")

### 1.3 The on-chain record (otter-verify PDA)
- **Program id:** `verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC` (otter-verify).
- On submit, a **PDA** is created (derived from the program address + upgrade authority) storing:
  **program address, git URL, commit hash, and the build args** used. This is the immutable
  link from an on-chain program back to its source. (solana.com/docs/programs/verified-builds,
  fetched 2026-09-15.)
- Third-party verification is trustless: `solana-verify list-program-pdas --program-id <id>` to
  read the claim, then `solana-verify verify-from-repo --program-id <id> <git-url> --commit-hash
  <sha>` to independently reproduce — no need to trust the OtterSec API.

### 1.4 Where it breaks (must be honest — this is our differentiator's setup)
Accretion's "How We Hacked Solana Verified Builds" (accretion.xyz/blog/verified-builds, fetched
2026-09-15) documents two real breaks:
- **2023 (Anchor-era):** Rust builds legitimately run code at build time (`build.rs`, proc
  macros). They wrote a `build.rs` that fetched the real on-chain binary and substituted it for
  their own compiled output — so a **fake source repo produced a matching hash**. Root cause
  (build-time code execution) is *fundamentally unfixed*.
- **2024 (Nov 20, 2024, OtterSec-era):** they submitted verification data for a program **without
  authorization checks**, getting Explorer to display an attacker-controlled repo as canonical.
  (Auth was subsequently fixed, but it shows the attestation write is a trust-sensitive surface.)
- **The core, permanent limit:** verification proves only *"repo@commit under build-env → this
  hash."* It does **not** prove the repo is trustworthy, the README/SDK/frontend/npm/Discord
  links are honest, or **that the code is safe.**

> **This is precisely cachorro's wedge.** The verified-build world anchors *provenance*.
> Nobody anchors a *security verdict backed by a reproduced exploit*. cachorro's attestation
> reuses their identifiers (commit + verified-build digest) and adds the missing claim.

---

## 2. Solana Attestation Service (SAS) — the native rail we should adopt

### 2.1 What it is
An open, permissionless on-chain protocol for verifiable credentials, **live on mainnet + devnet
since 2025** (introduced by the Solana Foundation, ~May 2025). Model: **issuers register
Credentials, declare Schemas, and issue Attestations that verifiers fetch and decode.** Sensitive
data stays off-chain; the chain carries signed, typed, reusable statements. Early adopters are
KYC/identity (Civic, Sumsub, Range). (solana.com/news/solana-attestation-service, 2025;
cantina.xyz/blog, 2025; range.org/blog, 2025; biometricupdate.com, 2025-05.)

- **Program id:** `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG` (mainnet + devnet).
- **12 instructions** (discriminators 0–7, 9–11, plus 228 `EmitEvent`; 8 unused).
  (github.com/openbudgetfun/solana_kit PR #251, 2025.)

### 2.2 Account model (from deepwiki.com/solana-foundation/solana-attestation-service, fetched 2026-09-15)
Hierarchical trust: **Credential → Schema → Attestation.**

**Credential** (root of trust)
- `authority` (Pubkey) — primary controller
- `name` (≤32 bytes)
- `authorized_signers` — delegated signing keys
- PDA seeds: `["credential", authority, name]`

**Schema** (structure + validation rules)
- `credential` (Pubkey) — parent issuer
- `name`, `description`, `layout` (binary type layout), `field_names`
- `version` (0–255), `is_paused` (circuit breaker)
- PDA seeds: `["schema", credential, name, version]`

**Attestation** (the signed record)
- `nonce` (Pubkey) — unique/user-scoped id
- `credential` (Pubkey), `schema` (Pubkey)
- `data` — serialized payload conforming to the schema layout
- `signer` (Pubkey) — one of the credential's `authorized_signers`
- `expiry` (unix ts; `0` = never)
- `token_account` (optional) — for tokenized attestations
- PDA seeds: `["attestation", credential, schema, nonce]`

**Verifier flow (one path, deterministic):**
1. Derive/fetch the Attestation PDA.
2. **Verify issuer** — the `credential.authority` (and `signer` ∈ `authorized_signers`) is the
   expected auditor (cachorro).
3. **Validate schema** — data walks the schema `layout` byte-by-byte.
4. **Check expiry** — `expiry` vs. now (`0` = indefinite).
5. **Revocation** — `is_paused` on the parent schema; attestations can also be closed.

**Tokenized attestations:** SAS can mint a **Token-2022** "Group Member" for an attestation using
extensions `GroupMember, NonTransferable, MetadataPointer, PermanentDelegate, MintCloseAuthority,
TokenMetadata` — embedding the attestation in token metadata so token-aware programs (wallets,
launchpads) can read it natively. Non-transferable + closeable = a soulbound, revocable audit badge.

### 2.3 Why SAS beats a raw Memo for cachorro
| | SPL Memo (current MVP) | SAS |
|---|---|---|
| Deploy cost | zero (canonical `MemoSq4…` program) | zero (canonical SAS program) |
| Issuer identity | none — anyone can write any memo | **credential authority** = cachorro, verifiable |
| Typed schema | no (opaque string) | yes (schema layout, versioned) |
| Revocation / expiry | no | yes (`is_paused`, `expiry`, close) |
| Third-party query | must know the tx sig | derive PDA from (credential, schema, nonce) |
| Wallet/launchpad composability | parse a log line | one SDK call / Token-2022 badge |
| Sybil/forgery of "cachorro said X" | trivial (spoof the memo) | must control the credential authority key |

Memo's weakness is decisive: **a memo string `cachorro:v1:<digest>` can be written by anyone**, so
"cachorro attested this" is unforgeable *only* because you'd have to also produce a matching local
receipt — but a third party pulling the chain can't tell our memo from an impostor's. SAS fixes
this: the attestation is bound to **our credential authority key**. Forgery requires our key.

---

## 3. EAS (Ethereum) — the analogy, and what it teaches
Ethereum Attestation Service (EAS): two contracts — a **SchemaRegistry** and an **EAS** attester.
Each schema has a UID; each attestation has a UID = **hash of the attestation itself**. Two modes:
- **On-chain:** attestation stored on-chain, optionally gated by a **resolver contract** (custom
  on-chain validation, payments).
- **Off-chain:** attestation is a **signed object**, not stored on-chain; privacy via encoding the
  data in a URL fragment. You can still put the **UID on-chain to timestamp it** (hash-anchor).
  Verification = check the signature against the raw attestation file.
(docs.attest.org, 2025; quicknode.com guide, 2025; github.com/ethereum-attestation-service/eas-sdk.)

**Lessons for cachorro:**
- The **off-chain-signed + on-chain-UID-timestamp** pattern is *exactly* cachorro's current
  design (full canonical report off-chain, only the digest on-chain). We're already EAS-idiomatic.
- SAS is Solana's answer to EAS but redesigned for a **stateless/PDA model** (no stateful
  resolver contract by default; schema layout + credential authority do the gating). We should
  present cachorro's attestation as "EAS-style provenance, SAS-native."

---

## 4. in-toto / SLSA — the supply-chain grammar to borrow
- **in-toto Attestation Framework:** a signed **Statement** binding a **predicate** (typed
  metadata) to one or more **subjects** (artifacts, by digest). Gives integrity + authenticity to
  arbitrary supply-chain claims. (slsa.dev/blog/2023, in-toto.io.)
- **SLSA Provenance** is *one* in-toto **predicate type** describing *where/when/how* an artifact
  was built (builder id, source repo, commit, build params). SLSA recommends but doesn't mandate
  in-toto. (slsa.dev/spec, legitsecurity.com, 2024.)

**Why cachorro cares:** in-toto/SLSA is the industry-standard way to say "artifact X (by digest)
was produced/checked by process Y." cachorro's audit attestation is *the same shape* — a
**custom predicate type** (`https://cachorro.audit/attestation/v1`) whose subject is the program's
**verified-build digest** and audited **commit**. Aligning the JSON schema to in-toto's
Statement/predicate structure means: (a) our off-chain receipt is a recognizable in-toto
attestation (interoperable with sigstore/cosign tooling), and (b) the on-chain SAS/Memo entry is
just the **digest of that in-toto statement**. This is the credibility bridge to security teams who
already speak SLSA — and it's a differentiator competitors' "AI badge" doesn't have.

---

## 5. Design — what cachorro should anchor, and how a third party verifies

### 5.1 The claim, in one sentence
> *"cachorro (issuer key K) audited the program whose source is `git_url@commit`, which
> deterministically builds to `verified_build_digest`, on `date`; the full evidence chain is
> committed to by `journal_head`; verdict = N findings (C/H/M/L), all reproduced in a clean-room
> local validator; the human-readable report hashes to `report_sha256`."*

### 5.2 Canonical payload (extend the current one; make it in-toto-shaped)
cachorro already anchors:
`{schema, report_sha256, audited_commit, verified_build_digest, journal_head, target, cluster, created_at}`
→ canonicalized (sorted keys, no whitespace) → `sha256` = **attestation digest**. Keep that. Add
the fields that make it *bind to the deployed program*, not just to a repo:

```jsonc
{
  "schema": "cachorro-report/v1",           // predicateType, in-toto sense
  "subject": {
    "program_id": "<base58 or null if repo-only>",
    "git_url": "github.com/org/prog",
    "audited_commit": "<40-hex sha>",
    "verified_build_digest": "<solana-verify get-executable-hash of the audited commit>"
  },
  "verdict": { "findings_total": N, "critical": c, "high": h, "medium": m, "low": l,
               "all_pocs_reproduced": true },
  "evidence": {
    "journal_head": "<hash-chained journal head from pentest-agent-v3>",
    "report_sha256": "<sha256 of the human-readable report.md>",
    "clean_room": true, "negative_control": true      // promotion-gate booleans
  },
  "issuer": "cachorro",
  "created_at": "2026-..-..T..:..:..Z",
  "cluster": "devnet"
}
```

**The single most important addition is `verified_build_digest` = the on-chain program's executable
hash at the audited commit.** Without it, the attestation says "we audited a repo" — copyable and
weak. With it, a verifier can cross-check `solana-verify get-program-hash <live program_id>`
against our `verified_build_digest` and know **the thing we audited is the thing running.** This is
the join between §1 (provenance) and cachorro (verdict).

### 5.3 Two-track anchoring
- **Track A — SAS (flagship).** One-time: cachorro creates a **Credential** (`authority` = our
  cold issuer key) and a **Schema** `cachorro-audit/v1` (layout = the fields above). Per audit:
  issue an **Attestation** with `nonce = program_id` (or a hash of subject), `data` = the payload,
  `expiry` = e.g. re-audit horizon or `0`. Optionally **tokenize** (Token-2022, NonTransferable) so
  it shows up as a soulbound "audited by cachorro" badge in wallets. Verifier derives the PDA from
  `(credential, schema, nonce)` — **no tx sig needed**, and issuer identity is cryptographic.
- **Track B — SPL Memo (fallback / hackathon-proven).** Keep the existing `cachorro:v1:<digest>`
  memo path for zero-setup demos and as a cluster-agnostic timestamp. It's the EAS "on-chain UID"
  pattern. Ship both; lead the pitch with SAS, keep Memo as the "works even without our schema" story.

### 5.4 How a third party (launchpad / wallet / DEX) verifies a "cachorro-attested" program
Given a live `program_id`:
1. **Provenance:** `solana-verify get-program-hash <program_id>` → `H_live`. Read the otter-verify
   PDA (`solana-verify list-program-pdas`) → `git_url@commit`.
2. **Find cachorro's attestation:** derive the SAS Attestation PDA from
   `(cachorro_credential, cachorro_schema, nonce=program_id)` and fetch it (or, Track B, look up
   the memo tx). Confirm `attestation.credential.authority == cachorro_issuer_key` and not expired
   / `is_paused == false`.
3. **Bind:** check `attestation.data.subject.verified_build_digest == H_live` **and**
   `subject.audited_commit == commit from otter-verify PDA`. This proves the deployed bytes are the
   audited bytes.
4. **Verdict:** read `verdict` (e.g. "0 critical, all PoCs reproduced").
5. **(Optional, high-assurance) reproduce:** fetch the off-chain receipt (its `report_sha256` must
   match `attestation.data.evidence.report_sha256`), re-run the published PoCs on a local validator,
   and/or independently `solana-verify verify-from-repo` the commit. Nothing here trusts cachorro's
   servers — every step is chain data + local reproduction.

A launchpad can gate listings on step 3+4 with a single SDK call; a wallet can render a badge from
the tokenized attestation; a DEX router can refuse to route to programs without a fresh (non-expired)
cachorro attestation.

---

## 6. What makes this defensible vs. copyable

**Copyable in an afternoon (do NOT claim these as moat):**
- Writing a memo or a SAS attestation. It's ~50 lines against a canonical program.
- The JSON schema shape. Anyone can define one.
- "We put the audit hash on-chain." Table stakes the moment we ship.

**The actual moat — what the attestation *commits to*:**
1. **`journal_head` = a hash-chained, content-addressed evidence journal** (pentest-agent-v3:
   hash-chained journal + content-addressed evidence vault). Anchoring a *tamper-evident audit
   trail head* — not just a report hash — means the attestation is only issuable at the end of a
   pipeline whose every step is committed. A copycat's "on-chain badge" points at a PDF; ours
   points at a reproducible chain of custody.
2. **The promotion gate (`clean_room` + `negative_control` + `all_pocs_reproduced`).** cachorro
   only anchors findings that **reproduced in an isolated validator with a negative control**
   (runsc/gVisor sandbox, litesvm/solana-test-validator). The attestation encodes *booleans a liar
   can't cheaply fake* because faking them means actually building the reproduction infra. "Proof,
   not opinion" is enforceable *because* the on-chain record refuses to exist without the proof.
3. **The bind to `verified_build_digest`.** Competitors who attest "we reviewed repo X" produce a
   weaker claim than "we reviewed the exact bytes at program id Y." The join to solana-verify is
   cheap for *us* (we're already fetching program bytes) and is what a launchpad actually needs.
4. **Issuer reputation under a single credential key.** SAS makes "cachorro said this" a
   cryptographic fact tied to one authority. Over time the credential's history *is* the brand;
   forking the code doesn't fork the reputation. (Same reason CAs matter more than X.509 the format.)

**Honest limits to state in the pitch (credibility > hype):**
- An attestation proves *a claim about an artifact*, not that the artifact is safe. Verified builds
  were hacked twice (§1.4); our attestation inherits build-time-code-execution risk and the
  "hash ≠ safety" gap. We reduce it (reproduced PoCs, negative control) but must never sell it as
  "cachorro-attested = safe." Correct framing: **"cachorro-attested = this exact deployed program
  was adversarially tested and here's the reproducible evidence, on-chain, revocable."**
- The attestation is only as fresh as its `expiry`; an upgradeable program can change after audit.
  Mitigation: bind to `verified_build_digest` and **expire on upgrade** — a verifier's step 3
  fails the moment `H_live` changes, which is a feature. Continuous re-attestation on upgrade is the
  roadmap (matches Trident Arena's "scan every upgrade" but with an on-chain, reproduced result).
- SAS `authorized_signers` and our issuer cold key are now the crown jewels; key compromise = forged
  audits. Treat like a CA root.

---

## 7. Concrete recommendations for the build

1. **Keep the SPL Memo path** (shipped, devnet-proven per STATUS.md) as Track B / fallback.
2. **Add `verified_build_digest` to the canonical payload now** and wire `solana-verify
   get-executable-hash` (audited commit) + `get-program-hash` (live) into the reporter, even before
   SAS. This is the highest-leverage change: it upgrades the claim from "audited a repo" to "audited
   the deployed bytes."
3. **Ship a SAS Track A** as the flagship: one Credential + one Schema `cachorro-audit/v1`;
   per-audit Attestation keyed by `program_id`; consider a NonTransferable Token-2022 badge. Devnet
   first (SAS is on devnet), mainnet for the finalists' demo. `@solana/web3.js` + the SAS SDK
   (`sas-lib` / gill-based clients exist).
4. **Shape the off-chain receipt as an in-toto Statement** (`predicateType:
   cachorro.audit/attestation/v1`, `subject.digest.sha256 = verified_build_digest`). Interop with
   cosign/sigstore for free credibility; on-chain entry = sha256 of the canonical statement.
5. **Publish a ~30-line verifier snippet** (the §5.4 flow) in the repo and web casca so a launchpad
   can copy-paste it. The verifier being trivial for *them* and the evidence being hard for *us* is
   the whole strategy.
6. **Write the honest-limits box** into the pitch and the web report footer. Verified builds got
   hacked; leading with the limitation and showing the reproduced-PoC mitigation is more convincing
   to Solana security people than an "AI audited ✅" badge.

---

## Sources (all fetched/searched 2026-09-15)
- Ellipsis-Labs / solana-foundation `solana-verifiable-build` — github.com/Ellipsis-Labs/solana-verifiable-build; github.com/solana-foundation/solana-verifiable-build
- Verifying Programs — solana.com/docs/programs/verified-builds (otter-verify id `verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC`; CLI `get-executable-hash`/`get-program-hash`/`list-program-pdas`/`verify-from-repo`)
- `solana-verify` crate — docs.rs/crate/solana-verify/0.3.1; crates.io/crates/solana-verify
- "How We Hacked Solana Verified Builds" — accretion.xyz/blog/verified-builds (2023 build.rs substitution; 2024-11-20 unauthorized verify submission)
- Solana Attestation Service — solana.com/news/solana-attestation-service (2025); attest.solana.com; solana.com/docs/tools/attestations
- SAS deep dive (accounts/PDAs/Token-2022) — deepwiki.com/solana-foundation/solana-attestation-service; program id `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`
- SAS instruction set (12 ix) — github.com/openbudgetfun/solana_kit PR #251
- SAS analysis/adoption — cantina.xyz/blog/solana-new-attestation-layer-changes-on-chain-trust; range.org/blog/introducing-solana-attestation-service; blockworks.com; biometricupdate.com (2025-05, Civic); idtechwire.com (Sumsub)
- EAS — docs.attest.org; quicknode.com EAS guide; github.com/ethereum-attestation-service/eas-sdk
- in-toto / SLSA — slsa.dev/blog/2023/05/in-toto-and-slsa; slsa.dev/spec/draft/build-provenance; legitsecurity.com SLSA provenance series; in-toto.io
