# MASTER-PLAN — cachorro-solana

> The single source of truth that folds PRODUCT-SPEC, BUSINESS-CASE, PITCH and COMPLIANCE into one
> plan, **after** reconciling four rounds of adversarial critique. Written to win the Colosseum
> "Crypto World's Fair" (deadline 12 Oct 2026) *and* stand up as a real company. Concrete and honest:
> where a claim died under scrutiny, it is buried here, not repeated. Compiled 2026-09-15.
> Rule of the doc: **we lead with the hardest-to-copy asset and say out loud what is roadmap.**

---

## 0. What changed after the critiques (read this first)

Four skeptics converged on the same verdict: the previous package **oversold the moat** and the
**submission-day inventory**. The honest corrections we adopt everywhere below:

1. **The on-chain "ledger network effect" is dead.** The Solana Attestation Service (SAS) is **live
   and permissionless on mainnet** — any issuer defines a schema, anyone verifies
   ([solana.com/news/solana-attestation-service](https://solana.com/news/solana-attestation-service);
   [range.org](https://range.org/blog/introducing-solana-attestation-service), 2025). A hash-anchor is
   table-stakes plumbing Ackee or CertiK clone in a weekend. **We stop selling "our ledger becomes a
   network asset / switching cost."**
2. **The real, harder-to-copy asset is not the anchor — it is *what the receipt commits to*: a
   portable, *re-runnable* differential PoC bound to the exact deployed bytes, behind a hard
   mainnet-never rail.** A memo is a hash; our artifact is a test a verifier can *re-execute*. That is
   the moat sentence now.
3. **We are behind Ackee on corpus and Foundation proximity — admit it.** Trident Arena is
   Solana-Foundation-backed, multi-agent, built on 200+ real audits. We do **not** claim corpus depth
   as an edge. Our corpus today is honestly **n≈2, and neither is Solana-Anchor** (Veilo was a Solana
   *zk* bounty ~$2k; KaliCash was EVM/Polygon). We compete on **artifact type + safety rail + speed**,
   not detection stats.
4. **"FP → 0 by construction" is really "a smaller set of verified findings."** Only the
   auto-exploitable subset ships proven; the rest still ships as reviewed opinion. We quantify that
   subset instead of implying superior recall.
5. **Margin is not "95%, software not services" once human review is in.** Scan is zero-touch; Hunt
   carries auditor-minutes at the margin. We model both.
6. **Drift/KelpDAO are OUT of our detection surface** — Drift was admin-key compromise + oracle
   manipulation + governance social-engineering
   ([Chainalysis](https://www.chainalysis.com/blog/lessons-from-the-drift-hack/);
   [TRM Labs](https://www.trmlabs.com/resources/blog/north-korean-hackers-attack-drift-protocol-in-285-million-heist),
   Apr 2026), KelpDAO was a LayerZero bridge exploit. We stop leading with hacks our tool would not
   have stopped, and we state scope plainly.
7. **runsc is NOT load-bearing for the M1 demo.** litesvm runs in-process against a `.so` we compiled
   from *trusted* source (the teaching corpus); the `build.rs`-RCE threat only applies to *untrusted*
   third-party targets (M3). We decouple: M1 ships without waiting on gVisor. (§4.)

---

## 1. The pitch + the unique insight

**One-liner (primary, survives a non-crypto judge):**
> **cachorro is proof-of-exploit as a service for Solana: point it at an Anchor program, it writes an
> exploit, runs it on a *local* fork against a negative control — never mainnet — and hands you a
> receipt anyone can re-run to verify the finding. Proof, not opinion.**

**The unique insight (criterion #2):** the audit market has **mispriced its own bottleneck.** Everyone
races to *find* bugs with AI, but Immunefi and Sherlock already **require a runnable PoC to pay**
([Immunefi — Orca](https://immunefi.com/bug-bounty/orca/information/), accessed 15 Sep 2026). The scarce,
unautomated work is not detection — it is (a) turning a suspicion into a **safe, reproducible exploit**
and (b) making the report **trustless** so the buyer needn't believe the auditor. We automate exactly
those two ends and treat detection (static + LLM triage) as a commodity input.

**The sharpened version that answers the skeptics:** a hash on-chain proves only "we produced this
document." **Trustless requires the verifier to *re-run the proof*, not re-hash JSON.** So the artifact
we ship is not a memo — it is a **content-addressed, re-executable litesvm PoC + negative control bound
to `verified_build_digest`**, and the receipt points at it. *That* is the thing Ackee/CertiK don't ship
and can't clone in a weekend, because the hard part is the safety-railed reproduction, not the anchor.

---

## 2. Product — three tiers (one engine, three depths)

### Tier 1 — Scan (free, deterministic, no LLM, no sandbox) ✅ shipped
`fetch-target.sh` + `static-scan.sh`: clippy + cargo-audit + grep-based Anchor lint + on-chain
account/IDL dump. Framed honestly in the UI as **observations, not findings** (grep is blind to the
dataflow classes). It is the lead magnet, the credibility demo, and the input layer to Tier 2. Zero
marginal cost; no untrusted code executes. This is what the casca serves today.

### Tier 2 — Hunt (paid, LLM + *re-runnable* executable PoC) — the core product, **M1 target**
Full agentic campaign on the pentest-agent-v3 spine: observations → Anchor account context model →
hypotheses with falsifiers → treatment/control experiment → **litesvm differential PoC** → promotion
gate (`add_evidence` needs ≥1 reproduction; `verify_primitive` needs oracle `supports` + negative
control) → skeptic counter-review → clean-room re-run → report of **only verified findings**.

**Deliverable per finding:** (a) a writeup mapped to a `01-vuln-taxonomy` class; (b) a **runnable
litesvm Rust test** a human re-runs (`treatment passes, control fails`); (c) raw evidence (tx logs,
before/after state) in the content-addressed vault; (d) a `report.json` with `report_sha256` +
`journal_head` + `verified_build_digest`.

**Honest scope of the "proof" wedge (the denominator the critics asked for):** a cheap deterministic
litesvm oracle exists for the **account-model / access-control half** of the Solana taxonomy — missing
signer/owner, `has_one`/type-confusion, PDA seed/bump reinit, arbitrary CPI, close/rent theft,
duplicate-mutable, basic lamport/cast math. It **does not** cleanly exist for economic, oracle-manipulation,
cross-program-logic, or governance bugs. So Hunt ships **proven** on roughly the access-control subset
(much of `sealevel-attacks`) and **reviewed opinion** on the rest. We say so. That subset is the true
size of the differentiator — not "all findings, FP zero."

### Tier 3 — Watch (continuous, on-upgrade re-proof) — roadmap / mechanism-only for the hackathon
Subscribe to a program-id; on every upgrade the executable hash changes, so `solana-verify
get-program-hash <live>` **diverges from the anchored `verified_build_digest`** and the receipt is
**marked stale** (note: SPL-Memo v1 is immutable/append-only — we mark stale off-chain and anchor a
fresh memo; true on-chain **revocation** needs the dedicated Anchor program, which is roadmap). Watch's
*defensible* value is the **cheap case**: when the upgrade did **not** touch the vulnerable path, the
**saved PoC re-runs green as regression proof** — cheaper and stronger than re-opining. When the upgrade
*does* touch the path, we concede we must re-hunt (no cheaper than Arena re-scanning). Ship the
**mechanism** (detect upgrade → digest mismatch → stale + optional PoC re-run) as a demo, not a fleet.

---

## 3. The moat thesis (what survives the skeptics)

We drop "the system is the moat / they'd need all four loops." Three of those loops favored Ackee. We
name the **one loop we can plausibly lead and defend**, and we are honest that it is a *wedge widening
into* a moat, not a moat we hold on 12 Oct.

**The one loop: the safety-railed, re-runnable local-fork proof artifact — and the speed to seed it in
a channel incumbents under-serve.**

- **Why it is harder to copy than a memo:** the copyable part (SAS anchor, digest cross-check) we
  concede is a weekend of work for anyone. The **non-copyable part** is a pipeline that reliably makes
  an LLM author a *compiling, IDL-correct, minimally-scoped* differential exploit that a promotion gate
  will only pass on a real reproduction against a real negative control — behind a **hard, policy-level
  mainnet-never rail** (encoded in the scope matcher, not a prompt). That is engineering depth + a
  safety posture a regulated/careful buyer actually wants, and it is exactly what the offensive
  harnesses (HexStrike/T3MP3ST) and the multi-chain auditors (CertiK) skip.
- **Competitive wargame (the critics' missing analysis) — "what stops Ackee shipping an SAS attestation
  + a litesvm PoC next quarter?"** Honest answer: *nothing stops the anchor* (weekend) and *little stops
  a fuzzer crash-input* (they have Trident). What is slower for them: (1) a **curated, minimal-delta
  differential PoC with a named negative control** rather than a crash input — a different artifact with
  its own review loop; (2) a **hard mainnet-never architectural rail** as a selling point, not a footnote;
  (3) **being the Brazilian team in the Superteam/Darwin room first.** We do not claim they *can't* — we
  claim we can be **entrenched in one vertical + one channel before they decide it is worth entering**,
  and we bank the head start into design-partner contracts (§5), not into an un-ownable ledger.
- **What we explicitly DO NOT claim as moat anymore:** attestation-ledger network effect (SAS kills it);
  corpus depth vs Ackee (we're behind, n≈2); "incumbents can't stand in the LATAM room" (Ackee is
  Foundation-adjacent — closer to the orbit than we are; Superteam sponsorship is buyable). Distribution
  is a **wedge/speed advantage**, not a wall.
- **Prior-art / FTO honesty:** on-chain audit certificates are **not novel** — CertiK issues them,
  Chainlink markets "compliance attestation," and there is USPTO art on on-chain certificate verification
  for smart contracts. Our differentiation is the *re-runnable PoC payload + safety rail*, not "nobody
  anchors an audit result." (Do a proper FTO check before any patent/marketing claim — §7.)

**Moat in one sentence:** *not the on-chain hash (SAS made that a commodity) — the safety-railed,
re-executable local-fork proof the hash commits to, seeded first in the Brazilian Superteam/Darwin
channel.*

---

## 4. Build plan to 12 Oct — with the runsc decision flagged for Felipe

**Done:** M0 (Scan casca, tailnet, smoke-tested) and M2 (attestation digest/verify logic, devnet memo,
5/5 unit tests — but **zero live on-chain anchor has ever run**, blocked by faucet 429).

**The single biggest unproven risk is NOT runsc — it is that the AI stages have never run.** All of
ANALYZE/DEVIL/POC are `pending-ai` stubs. The whole pitch rests on opencode-headless reliably authoring
a compiling, IDL-correct exploit, and that capability is 100% unproven on this box. **W1 must be a
de-risk spike that produces ONE real analyzer→PoC output**, before we commit the timeline.

### ⚠️ runsc DECISION — FLAGGED FOR FELIPE (go/no-go, this week)
- **The finding that de-risks the whole submission:** the **M1 demo does not need gVisor.** litesvm runs
  in-process against a `.so` we compiled ourselves from the *trusted* teaching corpus. The `build.rs`=RCE
  threat that justifies runsc is a property of **untrusted third-party targets (M3)**, not sealevel.
  **So: run the M1 litesvm PoC directly now; scope runsc to the untrusted-target path only.**
- **Still do the smoke test as a separate go/no-go:** `docker run --runtime=runsc --rm hello-world` on
  Hermes *today*. Known hazards: runsc not installed; **no `/dev/kvm`** → ptrace platform (slower,
  unproven for the Solana BPF runtime under gVisor's emulated kernel); Hermes may itself be containerized.
- **The old fallback ("run on Zo") is DEAD** — Zo was discontinued 16/08 (memory). Real fallback for the
  *untrusted-target* sandbox = **Jazz VPS** (`root@100.123.90.115` via tailnet) or a throwaway cloud VM.
  **Never drop to `runc`** — v3 refuses it by design.
- **Decision Felipe owns:** (a) approve running M1 without runsc (recommended — unblocks the money shot),
  and (b) whether to spend a day on runsc + a pinned litesvm image now for M3, or defer to post-hackathon.

### M1 — one proven finding + on-chain attestation (the whole pitch in one vertical cut)
Target: **`coral-xyz/sealevel-attacks`**, one lesson (`0-signer-authorization` or `2-owner-checks`). The
`insecure/`+`secure/` pair gives a negative control — but **verify both actually compile** on the current
toolchain first (old Anchor 0.x corpus vs installed Anchor; **avm/anchor are MISSING** and must be
installed, or switch to a **self-authored minimal victim/secure pair** we control). **Use a minimal-delta
control** (add only the one missing check) so treatment-vs-control isolates a single line, and have the
skeptic assert the control fails with the *specific* expected error — not just "errors."

Build order (smallest path):
1. **W1 de-risk spike:** one analyzer→PoC output on the chosen lesson; **hand-write the litesvm PoC**,
   have the agent only *parameterize* it (discriminator, account order from IDL). Do **not** claim
   autonomous exploit synthesis for the demo; state plainly which parts are agent-authored vs curated. — *agent, M*
2. **Compile the insecure/secure pair end-to-end** (install avm/anchor or pin old version, or swap to a
   self-authored pair). — *agent, M*
3. `anchor-static-scan` adapter (wraps existing script) → typed graph nodes. — *agent, S*
4. `litesvm-poc` adapter — the jewel. **Honest re-scope:** the deterministic plumbing (copy the
   `sqli_differential.py` mold) is 2–3 days; the *exploit-authoring intelligence* is the real deliverable
   and gets its own budget + the hand-written fallback above. Run in-process (no runsc for the trusted
   corpus). — *agent, L*
5. Solana scope variant: matcher + **non-removable mainnet-deny in policy** (encodes AGENTS.md rule 1). — *agent, S*
6. Add **`verified_build_digest`** to the attest payload (`solana-verify get-program-hash`) — cheapest
   upgrade from "audited a repo" to "audited the deployed bytes," and a prerequisite for Watch's
   upgrade-expiry to mean anything. — *agent, S*
7. `attestation_anchor.py` (~80 lines): wire the real `journal_head` into `attest/`; append
   `attestation.anchored`. — *agent, S*

**M1 deliverable = 1 finding with:** a verifiable local hash-chain, a differential PoC (treatment passes /
control fails with the expected error), a **real devnet receipt**, and a verifier that **re-runs the PoC**
and recomputes the digest. Runs in minutes (litesvm is in-process).

### M2-live — the cheapest de-risk in the whole plan (do NOW, independent of M1)
**Fund the throwaway devnet keypair manually** (~0.1 SOL, buy/transfer — do not wait on the 429 faucet),
anchor **one real attestation**, capture the signature + explorer URL, screenshot into the pitch. Removes a
demo-day single point of failure.

### M3 — one live in-scope target, honestly scoped (only if time remains)
One authorized Superteam/Immunefi Solana program, datable in-window. Even a **clean** result
("adversarially tested, no critical reproduced, here's the attested evidence") is a legitimate deliverable.
**This is the path that needs the runsc sandbox** (untrusted third-party build). Do **not** promise "any
bounty" coverage.

### Web casca (owned in W1, not the last week)
Light up the AI stages (RESEARCH/ANALYZE/DEVIL/POC/REVIEW) so a judge *watches* the ladder climb — this
is the primary judge-impact surface and it is **not** in the effort tables; budget it. Put the **proven
finding + PoC transcript** front and center (visible without scrolling; define its content contract:
treatment/control diff, oracle transcript, vault entry). Decide the **public URL** in W1 (public
reverse-proxy vhost on Hermes with the ufw/tailscale posture, or a static export) — Vercel previews can
be login-gated.

### Not realistic by 12 Oct (say so in the pitch)
General "audit any program"; a running Watch fleet (ship mechanism only); the SAS `cachorro-audit/v1`
schema (post-hackathon; Memo is the MVP); autonomous exploit synthesis at breadth; M1.5 breadth and a
second dynamic adapter (snarkjs/zk) unless a zk target is the pick.

### Minimum-viable floor (if runsc AND faucet both fail in the final week)
Ship: the litesvm PoC running **in-process** on the trusted corpus (no runsc needed) + the **manually-funded**
devnet anchor (no faucet needed) + honest notes. Both blockers have independent escape hatches; the floor
is still a real running exploit + a real receipt.

---

## 5. Business model, pricing, and the LATAM/Darwin wedge

**One defensible number (with the load-bearing qualifier restored every time):** we collapse the
**mechanical / deterministic-review layer** of a $20k–$100k, 3–4-week Solana audit into a **$99–$499,
minutes-to-hours PoC-backed pass.** We do **not** claim to replace a full audit (logic/economic/governance/
completeness opinion stays human). Better framing for investors: *"we collapse the first-pass triage +
PoC scaffolding that eats 40–60% of auditor hours."*

**SKUs & pricing (each with one distinct unit and price logic):**

| SKU | Unit | Price | Margin reality |
|---|---|---|---|
| **Scan** | free, per run | $0 | zero-touch, true software margin |
| **Hunt** | per program, one-time | $99–$499 (tiered by size) | see two-line COGS below |
| **Watch — pre-mainnet** | per program / mo, cadence-light | $99–$299/mo | value = "your fix held" regression proof |
| **Watch — funded protocol** | per program / mo, priced on value-at-risk | $499–$1,500/mo | needs 1 T2 design partner to confirm WTP |
| **B2B / Launchpad** | per platform / mo + overage | $2k–$10k+/mo | one deal = hundreds of scans |
| **Pro seat (auditors)** | per seat / mo | $99–$499/mo or rev-share | sell to would-be competitors |

**Two-line COGS (the critics' central fix):**
- **Fully-automated (Scan, and Hunt findings that auto-pass DEVIL/REVIEW):** LLM tokens only. Realistic
  band with **retries** (the agentic loop runs reasoning 3–8×, not one clean pass): **~$10–$30/hunt**;
  best case ~$4. Still >90% margin at $99.
- **Review-gated (any critical before it ships — the channel-protection rule):** + **15–60 min senior
  Rust review** at $5k–$20k/wk rates ≈ **$30–$300/report** at the margin. At a $99 Hunt with mandatory
  human review of a critical, **margin can go negative.** So: **Scan and auto-passed lows are zero-touch
  software; criticals are services at the margin and must be priced/sequenced accordingly.** Headline is
  **"80–95% blended, depending on target difficulty and auto-pass rate,"** not ">95%." The auto-pass rate
  is the key unknown to measure — publish it once we have runs.

**Market sizing honesty:** Solana-specific audit TAM is small (~$13–27M/yr) and dev inflow is **down 51%**
(550→270 new devs/mo, May 25→May 26; Syndica 2026). We are **not** betting on headcount — the venture case
lives in **T2 Watch (recurring) + T3 B2B (one deal = hundreds of scans)**, priced on **value-at-risk per
program** as capital-markets money moves on-chain, **not** in one-time T1 Hunts. A bottom-up SOM
(reachable programs × conversion × blended price incl. Watch/B2B) is **owed and not yet built** (§7).

**Beachhead honesty:** T1 (pre-mainnet garage teams) is the **shrinking** cohort and the **least
proven to pay** — it is a **logo/funnel play**, not the revenue base. Before pitching T1 monetization as
validated, get **3–5 real WTP signals** from Superteam Brasil. The right anchor for T1 is not "40–200× off
a $30k audit" (they never buy it) — it is "the cost of shipping unaudited today = $0, and here is a $199
proof before mainnet."

**LATAM / Superteam / Darwin — a wedge to convert into contracts, not a moat to assert:**
- **Superteam Brasil (distribution):** "bring your program, get a free scan" workshops + a Superteam Earn
  bounty to seed usage/case studies. Near-zero CAC. **Non-exclusive** — treat as speed, and pursue
  preferential terms.
- **Colosseum (funnel + capital):** thousands of pre-mainnet teams; accelerator up to $250k. Winning the
  hackathon *is* the first demand-gen event. **Confirm prize/accelerator eligibility + equity terms for a
  Brazilian team** (open item).
- **Darwin (vertical + incubation):** on-chain capital markets (tokenization/stablecoins/receivables).
  **Reframe the attestation as "independently verifiable, timestamped engineering provenance / trust
  signal," NOT a "compliance artifact."** A self-disclaimed AI-generated hash has **zero regulatory
  standing**; regulated issuers need accredited-auditor liability + named human sign-off. Drop the implied
  ANBIMA association unless a real conversation exists. To make Darwin real: **partner with a
  licensed/accredited auditor to co-sign** (reintroduces a services cost — model it) or position as
  **supplementary evidence + a design-partner/distribution story.** Note the **CNPJ-before-contract**
  dependency (no legal entity yet). Aim for **one Darwin design-partner LOI** as the exclusivity that makes
  the channel compound.

---

## 6. Top 10 next actions (owner + effort)

Ordered by "protects the critical path / removes a single point of failure" first.

| # | Action | Owner | Effort |
|---|---|---|---|
| 1 | **Fund the devnet keypair manually (~0.1 SOL) and anchor ONE real attestation** → capture signature + explorer URL. Kills the faucet-429 demo risk, independent of everything. | **Felipe** (needs value/transfer) | **S** |
| 2 | **W1 de-risk spike:** get ONE analyzer→PoC output on one sealevel lesson; hand-write the litesvm PoC, agent parameterizes. Proves the never-run AI stages before the timeline commits. | Agent | **M** |
| 3 | **runsc go/no-go smoke test** (`docker run --runtime=runsc hello-world`) AND decide to run M1 in-process without it. Flagged decision. | **Felipe** decides / Agent runs | **S** |
| 4 | **Compile the insecure/secure sealevel pair end-to-end** (install avm/anchor or pin old version, or swap to a self-authored minimal pair). Unblocks the negative control. | Agent | **M** |
| 5 | **Build `litesvm-poc` adapter** (differential, minimal-delta control, oracle asserts the *specific* error). The jewel; run in-process. | Agent | **L** |
| 6 | **Add `verified_build_digest` to the attest payload** + wire real `journal_head` via `attestation_anchor.py`. Prereq for the upgrade-expiry / Watch story to be true. | Agent | **S** |
| 7 | **Light up the AI stages in the web casca** + put the PoC transcript front-and-center; **decide the public URL** (Hermes vhost or static export). Primary judge surface. | Agent | **M** |
| 8 | **Fix every doc's framing:** sealevel = "teaching corpus of known vuln classes," not "real disclosed-vulnerable code"; drop "revocable" from Memo v1; drop Drift/KelpDAO as our-scope examples and add an explicit scope statement (in-program logic YES; key-mgmt/governance/oracle-infra/bridges NO). | Agent | **S** |
| 9 | **Get 3–5 WTP signals** from Superteam Brasil + pursue **one Darwin design-partner LOI**; **confirm Colosseum/Darwin eligibility + deadlines** for a Brazilian team. | **Felipe** | **M** |
| 10 | **Build the bottom-up SOM** (reachable programs × conversion × blended Watch/B2B price → 12–24-mo revenue line) and the **two-line COGS with auto-pass rate**. Replaces the ">95% software-not-services" headline. | Agent (draft) → **Felipe** (numbers) | **M** |

---

## 7. Open risks the critics raised — and our answer

| Risk (critic) | Our honest answer |
|---|---|
| **SAS makes the attestation a commodity; the ledger network effect is dead.** | Conceded. We reframe the anchor as table-stakes on SAS and locate defensibility in the **re-runnable PoC payload + safety rail**, not the ledger. Moat sentence rewritten (§3). |
| **We're behind Ackee on corpus, graph-reasoning, Foundation proximity.** | Conceded — three of four old loops favored them. We compete on **artifact type + mainnet-never rail + LATAM speed**, name the one loop we can lead, and bank the lead into contracts. Corpus is honestly n≈2. |
| **The differentiating artifact doesn't run at submission; shippable set is commodity.** | True today. The plan makes **one in-process litesvm reproduction + one real devnet anchor** the non-negotiable M1 floor — both have independent escape hatches (no runsc, no faucet needed). We state submission-day defensibility honestly. |
| **"FP → 0 by construction" oversells; recall is bounded.** | Replaced with "a **smaller set of verified findings**." The proof wedge = the **access-control / account-model subset** with cheap deterministic oracles; economic/oracle/governance ship as reviewed opinion. Quantified in §2. |
| **">95% margin, software not services" ignores human review.** | Replaced with a **two-line COGS**: Scan + auto-passed lows are zero-touch; **criticals carry auditor-minutes and can go negative at $99.** Blended **80–95%**, auto-pass rate to be measured. |
| **Watch is "just a cron"; digest-diff is commodity; a real upgrade forces a re-hunt.** | Conceded the trigger is commodity. Watch's value is the **cheap regression case** (upgrade didn't touch the path → saved PoC re-runs green). We quantify how often that holds vs a forced re-hunt rather than claiming "we re-run, they re-opine." |
| **Distribution isn't a moat; incumbents are closer to the Foundation.** | Downgraded to **wedge/speed**. We pursue **exclusivity** (Darwin LOI, preferential Superteam terms), not an un-enterable room. |
| **"Attestation = compliance artifact" won't survive a Darwin/ANBIMA reviewer.** | Downgraded to **"verifiable, timestamped engineering provenance."** No regulatory standing claimed. Darwin needs an **accredited co-signer** (services cost, modeled) or positions as **supplementary evidence**. CNPJ dependency noted. |
| **Drift/KelpDAO are outside our detection surface — a security judge notices.** | Removed as flagship examples. Replaced with **in-Anchor logic-bug** examples a fork PoC reproduces, plus an explicit **scope statement**. |
| **We dunk on Arena's 26.56% FP while publishing no numbers of our own.** | Stop the dunk. We **credit Arena's published numbers** and either **publish our own recall/FP on the sealevel set** or say we have none yet. |
| **runsc unproven / no `/dev/kvm` / dead "Zo" fallback / no pinned litesvm image.** | **Decoupled from M1** (in-process on trusted corpus). Go/no-go smoke test flagged for Felipe. Real fallback = **Jazz VPS / cloud VM**, never `runc`. Pinned image is M3 work, budgeted a day. |
| **"trustless" collapses to "we timestamped a doc."** | Closed by making the **verifier re-run the PoC** (treatment passes / control fails), not just re-hash JSON. Until that ships, the on-camera claim is downgraded to "a verifiable, tamper-evident, timestamped receipt." |
| **No SOM, no WTP evidence, no eligibility confirmation, no FTO check.** | All four are **open items in §6 (actions 1, 9, 10)** and flagged as owed, not asserted. |

---

*Bottom line: the harness is a commodity and we say so. What is ours to win is the **safety-railed,
re-runnable local-fork proof**, shipped first in a channel the incumbents under-serve, and turned into
design-partner contracts before they enter it. On 12 Oct that is one reproduced finding + one verifiable
receipt — small, honest, and real — not a moat we pretend to already hold.*
