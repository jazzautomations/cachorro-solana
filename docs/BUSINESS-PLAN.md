# CACHORRO — Business Plan (service pivot, 2026-09-28)

> Builds on `BUSINESS-CASE.md` + `research/05-market-business.md`. What changed since:
> mentor feedback at Solana House — **sell the audit, not the tool**. Anchor on audit
> invoices, charge for verified outcomes, use the bounty board as the demand map.
> Fresh figures re-sourced 2026-09-28; vendor numbers still marketing until proven.

---

## 0. The story in one breath

**Audit firms sell opinions by the page. The pack sells proof by the byte.**

A Solana audit today is a $50k–$150k invoice that lands in 8–16 weeks, ships a PDF where
most "findings" are informational noise the team has to triage itself, and silently expires
the day the program upgrades. Immunefi's own data says a critical bug costs **$6,548 to catch
in an audit competition, ~$66k in a tier-1 private audit, and $24.5M when an attacker finds
it first** (Immunefi ecosystem update, Jul 2026).

Cachorro turns that invoice into an engagement measured in hours: every finding arrives with
an executable PoC proven treatment-vs-control on a local validator, refuted candidates marked
VERMELHO instead of shipped as noise, a dup-check against every public audit, and a receipt
anchored on-chain that knows when it went stale.

We are not selling a scanner. **We are selling the artifact a $150k audit should have shipped.**

---

## 1. Why now (the market moved under the audit industry)

- **H1 2026: $972M lost to exploits** across a record 207 incidents; April alone saw Drift
  −$285M and KelpDAO −$290M (TRM Labs / Immunefi, Jun 2026). August 2026 was the most-hacked
  month in crypto history by incident count, with confirmed criticals on Immunefi up **9× YoY**
  (14 → 126 in one month).
- **Continuous coverage is beating one-shot audits** — Immunefi explicitly: "continuous
  coverage beats one-shot audits" (Apr 2026 update). Audit competitions find **6.2 serious
  bugs per engagement vs 1.5 for tier-1 audits** — 4× the yield at ~10% of the cost per critical.
- **The market is big and accelerating**: smart-contract audit spend ~**$1.0B in 2026 → $5.5B
  by 2034** (23% CAGR); automated-tool subscriptions already 38% of revenue; annual
  subscription audit models growing 22% → 34% adoption YoY — i.e., buyers are *already
  migrating* to exactly the recurring-verification model our receipts enable.
- **Solana scarcity premium is real**: Rust auditors charge $5k–$20k/week; Solana carries a
  20–40% markup over Solidity; the Solana-native bench is ~4 firms deep (OtterSec, Zellic,
  Neodyme, Sec3). Every Solana program paying the premium is our ICP.
- **AI auditors exist — but all EVM**: CritikalAI, Azimuth (TestMachine), AuditSentry,
  Guardix, sc-auditor. Every one ships Foundry PoCs for Solidity. None speak Anchor, none run
  litesvm, none attest on-chain. **Solana is whitespace.**

---

## 2. Product (what the buyer actually gets)

The deliverable is the `/report/[id]` **audit certificate**:

| Artifact | What it is |
|---|---|
| Findings | VERDE = reproduced on local validator (treatment drains, control blocks); VERMELHO = refuted, shown anyway; dup-flagged = known publicly, no bounty value |
| Evidence | the PoC that ran, the lamports moved, the control rejection code — replayable by the buyer |
| Receipt | SHA-256 of report bytes + audited commit + hash-chained events journal, anchored as a devnet/mainnet memo `cachorro:v1:<digest>` — verify at `/verify` without trusting us |
| Stale-detection | program upgrades → digest stops matching → receipt expires itself; the watchlist re-hunts |

**Proof it works:** hunt `run_1789568330_9453f2` (onre-sol, FULL) — 9 candidates → devil
killed 2 → 7 PoC'd → 6 VERDE reproduced, 1 VERMELHO refuted, 2 flagged dup vs
Quantstamp×3/Ackee/OtterSec. **Four findings were new.** Six professional audits walked that
code; the pack found what they missed and proved every one.

---

## 3. Business model — sell outcomes, price against the anchor

| Tier | Price | What | Anchor |
|---|---|---|---|
| **SNIFF** | free | QUICK recon hunts, live feed, board+labs | the "discovery call" firms charge for |
| **THE HUNT** | **20 SOL / engagement** (~$4k) | FULL hunt, all survivors PoC'd, human-reviewed certificate, on-chain receipt, dup-check, dispute re-runs | audit quote starts at $50k + months of queue |
| **CONTINUOUS** | **6 SOL / mo** (~$1.2k) | unlimited hunts, stale-receipt watchlist → auto re-hunt on upgrade, CI API key, priority queue | traditional audits expire silently on ship day |
| **PAY-PER-PROOF** (pilot) | retainer + bounty per VERDE | crit/high/med/low priced like Immunefi tiers | "a firm invoices for pages; we invoice for reproductions" |

**Unit economics** (directional, devnet demo): a FULL hunt's COGS is fetch+static (free) +
one engine session (~2.5h cap) + validator compute — low hundreds of dollars in inference.
At 20 SOL the engagement margin is >90%; the binding constraint is reviewer-hours for the
human pass, which is also what keeps quality honest. CONTINUOUS is pure recurring revenue
against a feature we already built (watch-targets stale detection).

**Why this beats the old "0.5 SOL/mo SaaS"**: we were pricing ourselves as a tool for
bounty hunters. The buyer with the pain and the wallet is the *protocol* holding TVL — for
them $4k vs $50k isn't a discount, it's a different product category (proof vs prose).

---

## 4. GTM — the board is the go-to-market

1. **Bounty board = demand-side lead gen.** 174 indexed programs with $6.3M in live bounties
   are, definitionally, programs paying for verified bugs. Every public hunt certificate is
   a sales artifact linking back to /verify.
2. **Hunters are the wedge, protocols are the wallet.** Free SNIFF hunts pull whitehats in;
   a VERDE finding on someone's program is a warm outbound email: "your program has a
   verified bug; the PoC runs; the receipt is here."
3. **Audit shops as channel, not enemy.** Firms drown in false-positive triage — sell them
   the pack as the *verification layer* under their prose. They keep the relationship and the
   $50k invoice; we take the engine fee. (Azimuth/CritikalAI sell EVM-only — Solana firms
   have no equivalent.)
4. **Superteam/LATAM + Colosseum funnel**: every cohort team is a pre-mainnet program that
   can't afford a $50k audit — SNIFF→THE HUNT is their on-ramp. Darwin track: receipts as
   compliance artifacts for tokenized money.
5. **CI as the lock-in**: `ALPHA` keys block deploys without a live receipt — security as a
   build gate. Once receipts are in the README badge + the CI pipeline, churn approaches zero.

---

## 5. Competition map (Sep 2026)

| Player | Chain | PoC proof | On-chain receipt | Continuous | Notes |
|---|---|---|---|---|---|
| OtterSec / Zellic / Neodyme / Sec3 | Solana | human-written | ✗ | retainer only | the anchor; $15k–45k/week |
| Certora | multi | formal verification | ✗ | ✗ | premium FV niche |
| Cantina / Code4rena / Sherlock / Immunefi ACs | multi | contest PoCs | ✗ | contests | 4× bug yield vs audits — validates the model, they're a channel not a blocker |
| **CritikalAI** | EVM | forge-verified | ✗ | ✗ | multi-agent + jury — closest analog, private beta |
| **Azimuth / TestMachine** | EVM | RL fork exploits | ✗ | CI | "zero FP" claim — same thesis, wrong chain |
| AuditSentry / sc-auditor / Guardix | EVM | plugin PoCs | cert NFTs | ✗ | Claude plugins, ~$200 commodity tier |
| **CACHORRO** | **Solana** | **local-validator PoC + control** | **✓ SPL-memo, stale-aware, revocable** | **✓ watch→re-hunt** | only trustless receipt in the category |

**Moat**: not the harness (commodity). It's (a) the *enforced gate* — reputation for zero
false positives compounds; (b) the *receipt* — a public, verifiable artifact that becomes a
standard only if we're first; (c) the *evidence corpus* — every hunt trains the atlas on
Solana-specific classes nobody else has PoCs for.

---

## 6. Risks & honest limits

- **We're the pre-audit, not the audit.** Deep economic/game-theoretic bugs still need human
  reasoning. Say it on the site (already do — "attested ≠ safe").
- **Zero-FP reputation is fragile**: one fake VERDE kills the brand. The gate is mechanical —
  keep it that way; never let marketing override a VERMELHO.
- **Safety rail is the moat too**: mainnet-never + clone-don't-build + human submits = we can
  operate where exploit-gen tools can't.
- **Devnet receipts are demo-grade**: production receipts anchor on mainnet (costs real SOL,
  trivial) or a memo program with revocation. Pre-launch decision.
- **Solana dev inflow cooled −51% YoY** — bet on value-at-risk concentration, not headcount.

---

## 7. Storytelling — the 3-minute arc for judges

1. *"$285M drained in 128 seconds — after the audit."* (Drift, Apr 2026 — the wound.)
2. *"An audit is an opinion you pay $150k for and wait 4 months. Immunefi won't pay a bounty
   without a working exploit — but your audit firm will invoice you without one."* (the absurdity)
3. *"We built a pack that hunts like an attacker and proves like a court."* — show the live
   PACK MIND feed, 10 seconds of real reasoning streaming.
4. *"Six audits walked this code. The pack found four new bugs and proved each one on a local
   validator."* — open the onre-sol certificate; click a VERDE.
5. *"And this"* — open /verify — *"is the receipt. Anyone can recompute it. It expires itself
   when the program upgrades. Audits never did that."*
6. Close: *"Proof, not opinion. The audit you can verify on-chain."*

---

## 8. Next 14 days (to submission 12/10)

- [ ] **Anchor real receipts** — devnet keypair needs ~0.2 SOL (faucet 429):
      send to `97JjCwCNed53KNXxrokiWBWXoYbeHhDXZuUTN2tgEnd7`, then `attest-run.sh` per run.
      Non-negotiable for "verify yourself" on stage.
- [ ] One fresh FULL hunt on a board target → certificate + anchored receipt + badge.
- [ ] Outreach list: 10 Solana bounty programs + 3 audit shops (pitch the verification layer).
- [ ] Pitch video (3min, English) + demo video (3min) per PITCH.md — two separate videos.
- [ ] Public URL decision (tailnet → public deploy) — needs the runsc sandbox first
      (build.rs = RCE) or restrict targets to allowlist.
- [ ] Pricing page is live-repositioned ✓ (engagement + continuous + pay-per-proof).
