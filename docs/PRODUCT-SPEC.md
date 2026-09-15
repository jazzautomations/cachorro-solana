# PRODUCT-SPEC — cachorro-solana

> Product & technical roadmap to the Colosseum "Crypto World's Fair" submission (12 Oct 2026).
> Author: product spine · 2026-09-15. Builds directly on the research briefs
> `docs/research/{01-vuln-taxonomy,03-poc-tech,04-attestation-prior-art,08-v3-leverage}.md`
> and the current state in `AGENTS.md` / `STATUS.md`. Nothing here re-litigates those; it
> turns them into a product surface, a build order, and a realistic milestone plan.

## 0. The one-sentence product

**cachorro is the proof-and-provenance layer for Solana program security: it turns a suspected
bug into an exploit that runs on a *local* validator against a negative control, then anchors the
verdict on-chain so anyone can verify the finding without trusting us.** We are not "the best
detector" — the harness/fuzzer layer is a commodity (Trident, Sec3, Trident Arena). Our moat is
*what the on-chain hash commits to*: a hash-chained evidence journal + a clean-room reproduced PoC
+ a negative control, bound to the exact deployed bytes. (`04-attestation-prior-art.md` §6;
`08-v3-leverage.md` §7.)

Positioning line for the pitch: **"proof, not opinion — every finding ships an exploit you can
re-run, and an on-chain receipt you can verify."**

---

## 1. Product surface — three tiers

One engine, three depths of the same pipeline. A tier is just *how far down the promotion ladder*
(`observation → signal → hypothesis → candidate → verified → reportable`, `08-v3-leverage.md`) we
run, and whether we anchor.

### Tier 1 — **Scan** (free, deterministic, no LLM, no sandbox)
- **What it is:** the `fetch-target.sh` + `static-scan.sh` engine that already ships (STATUS.md
  M0). `cargo-audit` (dep CVEs) + clippy + the grep-based Anchor/Solana lint heuristics (the "8
  sections / 55 entries" smoke) + on-chain account/IDL dump for a program-id.
- **Output:** the static report the web casca already renders — summary tiles + collapsible lint
  sections + on-chain account. Framed honestly as **observations, not findings** — grep is blind
  to the classes in `01-vuln-taxonomy.md` that need dataflow (owner-check reachability, CPI id
  provenance, math invariants). We say so in the UI.
- **Why free:** it is a lead magnet and a credibility demo. It is also the input layer for Tier 2
  (these become `observation` nodes in the research graph, `08-v3-leverage.md` §4.1). Costs us
  nothing per run beyond CPU; no untrusted code executes (we never build the target here).
- **Status:** ✅ shipped. This is what the casca serves today.

### Tier 2 — **Hunt** (paid / gated, LLM + executable PoC, the core product)
- **What it is:** the full agentic campaign on the v3 spine. Static observations → context model
  of the Anchor accounts → hypotheses with falsifiers → treatment/control experiment → **litesvm
  PoC inside runsc** → promotion gate (`add_evidence` requires ≥1 reproduction; `verify_primitive`
  requires oracle `supports` + negative control) → skeptic counter-review → clean-room re-run →
  report of *only verified findings*.
- **The deliverable per finding:** (a) a human-readable writeup mapped to a `01-vuln-taxonomy.md`
  class; (b) a **runnable litesvm Rust test** that a human re-runs (`treatment passes, control
  fails`); (c) the raw evidence (tx logs, before/after state) in the content-addressed vault; (d)
  a `report.json` with `report_sha256` + `journal_head`.
- **The guardrail (non-negotiable, AGENTS.md rules 1/2/4/5):** PoCs run **only** on local
  validator / fork / snarkjs. We **never** submit — the human submits, only what they reproduced,
  through the official bounty channel. Building a third party's target (which runs `build.rs`)
  happens in an isolated build stage and requires an Ed25519 approval (`approvals.py`).
- **Business shape:** the natural buyer is a whitehat / audit shop / protocol team running a
  bounty program. Priced per-hunt or per-seat; the honest unit is "a reproduced finding with a
  PoC," not "a scan." (Business detail lives in `docs/research/05-market-business.md`, not
  restated here.)
- **Status:** ⚠️ **blocked on the runsc gate** (§4). The full pipeline is designed
  (`08-v3-leverage.md`); the executable-PoC step cannot run until `runsc` is installed. This is
  the M1 target and the single biggest risk. Be honest about this in the pitch: today we can prove
  *one* finding end-to-end on a teaching corpus; a general "point it at any bounty" product is
  post-hackathon.

### Tier 3 — **Watch** (continuous, on-upgrade re-attestation, roadmap / demo-only for now)
- **What it is:** upgradeable Solana programs can change after audit. Watch subscribes to a
  program-id, and **on every upgrade** (the executable hash changes) it (1) invalidates the prior
  attestation and (2) re-runs Hunt against the new bytes, re-anchoring a fresh verdict.
- **Why it is defensible, not just a cron:** the attestation binds to `verified_build_digest`
  (`04-attestation-prior-art.md` §5.2). A verifier's cross-check `solana-verify get-program-hash
  <live>` vs our anchored digest **fails the instant the program upgrades** — that expiry-on-upgrade
  is a *feature*. Watch turns that failure into an automatic re-audit. This matches Trident Arena's
  "scan every upgrade" but ships an on-chain, *reproduced* result instead of a report.
- **Status:** roadmap. For the hackathon, ship the *mechanism* (detect an upgrade → digest mismatch
  → mark attestation stale) as a demo, not a running fleet. The honest framing: "the receipt knows
  when it's out of date." Full continuous fleet is post-accelerator.

---

## 2. Verticalization onto pentest-agent v3 (the technical core)

The thesis of `08-v3-leverage.md`, made into a build contract: **0 runtime rewrites.** The v3
spine (journal, evidence vault, research graph, scheduler, capability broker, `execution.py`
sandbox, `oracles.py`, reporting, scope-signing, approvals, dossier) is chain-agnostic and
transfers AS-IS. Cachorro **swaps the body (toolpacks) and wires the moat (on-chain attestation)
into a journal hook.** What we actually build:

| Layer | Work | Effort |
|---|---|---|
| Runtime (all of it) | none — reuse | 0 |
| Scope matcher | Solana variant: `solana:program:<base58>@<cluster>` + `solana:repo:<url>@<commit>`; **hard, non-removable deny of `target_state_change` on any cluster ≠ localnet** (encodes AGENTS.md rule 1 in policy, not prompt) | 0.5 day |
| Reasoning agents (director, hypothesis, experiment, skeptic, chain, coverage) | 0 code — new dossier/skill text only (the vuln "lenses" from `01-vuln-taxonomy.md` become skill content) | text |
| Variant agents (context-modeler → anchor account model, cartographer → on-chain surface, patch-archaeologist → sealevel-variants, harness/fuzz → Trident, clean-room → litesvm image) | skill + declared tools in manifest, runtime AS-IS | text |
| `web-experiment-runner` | replaced by `solana-experiment-runner` (copy the mold of `sqli_differential.py` almost line-for-line) | included below |
| **New adapters** (`solana-core`, `solana-dynamic` toolpacks) | `anchor-static-scan` (wraps existing script), `solana-program-dump`, **`litesvm-poc` — the jewel**, `snarkjs` | see §4 order |
| Attestation | `attestation_anchor.py` (~80 lines) wiring the real `journal_head` into the existing `attest/` | 0.5 day |
| Infra | **install runsc** (blocking) | §4 |

**The bidirectional attestation hook (the moat²), `08-v3-leverage.md` §5:**
1. **journal → memo:** at campaign end, `reporting.render_json` materializes only `verified`
   findings → `report_sha256`; `journal.verify()` returns the `head_hash` = `journal_head`;
   `verified_build_digest` comes from the vault (`program.so` the PoC ran). Build the canonical
   payload, anchor the digest on devnet via the existing `attest/bin/attest.js`.
2. **memo → journal:** after the tx confirms, append an `attestation.anchored` event to the
   hash-chained journal. Now the local chain points at the on-chain record and the on-chain record
   points back — tamper either and the digests diverge. This is the non-repudiation neither Trident
   Arena nor Sec3 X-Ray has.

The promotion gate is what makes "proof, not opinion" *enforced in code, not prompted*: v3 already
refuses to promote `candidate→verified` without an oracle `supports` verdict + a successful
reproduction. Cachorro inherits it free. We must not weaken it to hit the deadline.

---

## 3. What the web casca must show

The casca (`web/`, Next 15 + vaporwave, systemd `cachorro-web` :8790, tailnet-only today) is the
demo surface and the verifier's home. Priorities, in order of judge impact:

1. **Scan → Hunt continuity (exists, extend).** The current single screen (input → `/api/scan` →
   AgentFlow polling → static report) stays as Tier 1. Add the AI stages
   (RESEARCH/ANALYZE/DEVIL/POC/REVIEW) that today render `pending-ai` — light them up as the
   campaign runs so a judge *watches* the pipeline climb the promotion ladder.
2. **The proven finding, front and center.** For M1 this is one card: the taxonomy class, the
   diff'd treatment/control, and — the money shot — the **PoC transcript** (`treatment passed,
   control rejected`) pulled from the evidence vault. This is the "proof, not opinion" moment; it
   must be visible without scrolling.
3. **The on-chain receipt + a copy-paste verifier.** Show the attestation digest, the devnet
   explorer link (once the faucet unblocks — see §4), and a **~30-line verifier snippet** a
   launchpad can copy (`04-attestation-prior-art.md` §7.5). The strategy is: trivial for *them* to
   verify, hard for *us* to fake.
4. **The honest-limits box** (`04-attestation-prior-art.md` §7.6). Footer of the report:
   "cachorro-attested = this exact deployed program was adversarially tested and here is the
   reproducible evidence, on-chain and revocable — **not** a proof it is safe." Leading with the
   limitation is more convincing to Solana security people than an "AI audited ✅" badge, and it is
   true.
5. **Public visibility for the demo.** Casca is tailnet-only now; the submission needs a public
   URL (or a login-protected preview flagged as such, CLAUDE.md §5). Decide before the last week.

Do **not** invent DB/auth/payment surfaces for the hackathon — filesystem jobs are fine (STATUS.md).
Tier gating can be a flag, not a billing system.

---

## 4. The blocking gate — runsc/gVisor (be honest about this)

Everything dynamic (litesvm-poc, snarkjs, clean-room, harness/fuzz) is **hard-blocked** until
`runsc` is installed on the Hermes VPS. `ContainerSandbox.command()` hardcodes `--runtime runsc`
and refuses an image without `@sha256:`; the v3 design **refuses to silently fall back to `runc`**
(`gap-matrix-v3.md`; `08-v3-leverage.md` §8). This is not a nice-to-have — it is the load-bearing
claim of the whole pitch.

- **Install:** `runsc` as an OCI runtime → register in `/etc/docker/daemon.json` (`"runtimes":
  {"runsc": {"path": "/usr/local/bin/runsc"}}`) → `systemctl restart docker` → validate
  `docker run --runtime=runsc --rm hello-world`.
- **Topology (`03-poc-tech.md` sandbox section):** (1) fetch/build stage — network allowed,
  trusted, builds `.so` once (build.rs isolation, AGENTS.md #4), outputs immutable artifacts to the
  vault; (2) PoC stage — `runsc --network=none`, litesvm against the `.so`, deterministic oracle,
  **nothing outbound**; (3) attest stage — separate, explicit devnet anchor. litesvm/program-test
  are networkless and run clean under `--network=none`; only `solana-test-validator --clone` needs
  loopback, so keep the fork path inside the sandbox.
- **Conscious fallback if runsc won't install in time:** run the dynamic step on the Zo/VPS
  (CLAUDE.md §2 — heavy work off my context) — but **never** drop to `runc`, which v3 refuses by
  design. If neither works by the deadline, we ship M1 honestly scoped to what ran and say so.

**A second known blocker:** the devnet faucet is 429-rate-limited per IP on this VPS (STATUS.md
M2), so live anchoring is stalled. The digest/verify logic is proven (5/5 unit tests;
`fetchMemoTx` validated against a real devnet memo). Live anchor runs the moment the faucet
unblocks *or* we fund the keypair manually. Do not block M1's PoC on the faucet — they are
independent.

---

## 5. Milestone plan to 12 Oct

Realism first. Done already: M0 (Scan casca, tailnet, smoke-tested) and M2 (attestation
digest/verify, devnet memo, unit-proven). The gap is M1 = the vertical slice that pushes **one**
finding through the whole spine with a real executable PoC.

### M1 — one proven finding + on-chain attestation (the whole pitch, one vertical cut)
**Target corpus:** `coral-xyz/sealevel-attacks` (already smoke-tested). It is the perfect M1 target
because every lesson ships an `insecure/` + `secure/` pair of the *same* program — **the negative
control comes for free in the repo**, satisfying the promotion gate without synthesizing a patch.
Pick **one** lesson (`0-signer-authorization` or `2-owner-checks` — most didactic, deterministic).

Build order (smallest path, from `08-v3-leverage.md` §6):
1. **Install runsc** (blocking — do first; without it, steps 5–7 cannot run). — *infra*
2. **`anchor-static-scan` adapter** — wraps the existing `static-scan.sh`; observations become
   typed graph nodes. Low risk. — *~1 day*
3. **`litesvm-poc` adapter** — clone the `sqli_differential.py` mold (repetitions, treatment/control,
   dedupe, stopping rule); run litesvm inside runsc; `binary_differential_oracle`. **This is the
   risk item.** — *2–3 days*
4. **Solana scope variant** — program-id/cluster matcher + non-removable mainnet deny. — *0.5 day*
5. **`attestation_anchor.py`** — wire real `journal_head` into `attest/`; append `attestation.anchored`.
   — *0.5 day*
6. **Skill text** for the variant agents (dossier, not code): the vuln lenses, sealevel variants,
   Anchor account model. — *text, parallelizable*

**M1 deliverable = 1 finding with:** a verifiable local hash-chain, a differential PoC that runs
in runsc (treatment passes / control fails), a devnet receipt, and a verifier that recomputes
everything. Runs in minutes because litesvm is in-process. **This is the entire Colosseum pitch in
one vertical cut.**

### M1.5 — breadth on the corpus (if M1 lands with time)
2–3 more sealevel lessons proven the same way (owner-check, arbitrary-CPI, init_if_needed reinit).
Each is mostly new hypothesis skill text against the same machinery — cheap once M1 works. Gives
the demo a "here are N reproduced classes" slide instead of one.

### M2-live — real on-chain anchor
Unblock the faucet (or fund manually) → run `attest anchor` for real → real signature + explorer
URL in the pitch. Independent of M1; do whenever the faucet frees.

### M3 — one real bounty target, honestly scoped
Point Hunt at **one** in-scope Superteam/Immunefi Solana program with a datable commit in the
window (AGENTS.md rule 1: authorized only). Even a *clean* result ("adversarially tested, no
critical reproduced, here's the attested evidence") is a legitimate, honest deliverable and proves
the product on non-teaching code. Do **not** promise "any bounty" coverage — the honest claim is
"proven on a teaching corpus + tested on one live in-scope target."

### Final week — narrative
Public casca URL decision; 3-min video + 3-min live demo (litesvm PoC running in runsc + on-chain
verify), submission in English; Brazil side-track via Superteam Brasil; Darwin capital-markets
angle (tokenization/stablecoin/receivables programs are exactly the high-value, upgradeable targets
Watch is built for). GTM detail in `docs/research/05-market-business.md` and `07-judging-pattern.md`.

### What is NOT realistic by 12 Oct (say so)
- A general "audit any program" product — Hunt is proven on one corpus + one live target, not
  battle-tested at breadth.
- A running Watch fleet — ship the upgrade-detection *mechanism* as a demo, not a service.
- SAS flagship track — Memo is the shipped MVP; SAS schema (`cachorro-audit/v1`) is the highest-value
  *post*-hackathon upgrade (`04-attestation-prior-art.md` §7.3). Adding `verified_build_digest` to
  the payload *now* is the cheap, high-leverage win to do before the deadline.

---

## 6. Honest competitive stance (for the pitch, not to oversell)

- **Sec3 X-Ray** — open-source static. Cachorro ships an *executable differential PoC*, not a
  pattern alert. Different category.
- **Trident / Trident Arena (Ackee, Solana Foundation-backed)** — the serious competitor. Arena
  reports ~70% crit/high detection vs 37% for a raw LLM, ~26% FP. **We do not out-detect it — we
  consume it** (Trident as a sensor under the broker) and add what it lacks: a reproduced PoC on
  *your* validator + an on-chain, revocable, verifiable receipt. Position cachorro as the **proof
  and provenance layer**, not "the best detector." (`08-v3-leverage.md` §7.)
- **CertiK AI Auditor / Solanaizer / HexStrike-AI / T3MP3ST** — harness/detector commodities. The
  moat is the oracle-driven spine + attestation, exactly what v3 lets us claim publicly.
- **The honest limit, stated up front:** an attestation proves *a claim about an artifact*, not
  that the artifact is safe. Verified builds were hacked twice. We reduce the gap (reproduced PoCs,
  negative control, bind to deployed bytes) but never sell "cachorro-attested = safe." Leading with
  this is more credible to Solana security people than a badge.

---

## 7. Immediate next actions (this week)

1. **Install runsc on Hermes** and validate `docker run --runtime=runsc hello-world`. Unblocks
   everything dynamic. If it won't install, decide the Zo/VPS fallback now.
2. **Add `verified_build_digest` to the attest payload** (`solana-verify get-executable-hash` /
   `get-program-hash`) — cheapest upgrade from "audited a repo" to "audited the deployed bytes."
3. **Build `anchor-static-scan` + `litesvm-poc` adapters** against sealevel-attacks
   `0-signer-authorization`. This is M1's critical path.
4. **Wire `attestation_anchor.py`** so `journal_head` is the real journal head, not a placeholder.
5. **Unblock the devnet faucet** (or fund the throwaway keypair) to get a real explorer URL.
