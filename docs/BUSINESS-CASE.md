# Cachorro — Startup Business Case

> The "proof, not opinion" agentic security auditor for Solana/Anchor. Every finding ships an
> exploit that runs on a **local** validator/fork (litesvm / `solana-test-validator --clone` /
> BanksClient, **never mainnet**) plus a **verifiable on-chain attestation** of the audit report.
> Synthesized from `docs/research/05-market-business.md`, `02-tooling-landscape.md`,
> `07-judging-pattern.md`. Figures are web-sourced and dated in those briefs; treat vendor numbers
> as marketing until independently verified. Compiled 2026-09-15.

---

## 1. One-line value prop

**Cachorro turns a $20k–$100k, 3–4-week mechanical Solana audit into a $99–$499, minutes-to-hours
pass where every finding ships an exploit that runs on a local fork and an on-chain receipt anyone
can verify — proof, not opinion.**

Backup framings (same product, different room):
- **Solana track:** "Point it at an Anchor program; it writes the exploit, runs it on a local
  `--clone` fork, and attests the result on-chain. Mainnet is never touched."
- **Darwin / capital markets:** "Tokenized capital markets can't run on 'trust the auditor.'
  Cachorro gives every issuance an on-chain, independently verifiable proof that its program was
  exploit-tested and cleared."

---

## 2. The problem (why a buyer pays)

1. **Audits are expensive and slow, gated by Rust scarcity.** A Solana/Anchor audit runs
   **$7k–$150k+** over **1–12 weeks**; senior auditors charge **$5k–$20k/week** and Rust carries a
   **25–40% premium** over Solidity because the pool of people who can read Anchor *and* write a
   litesvm PoC is tiny (Accretion 2026; Zealynx 2025). Cost is almost entirely auditor-hours — so a
   tool that removes the *deterministic* review hours attacks the cost base directly.
2. **Audits are opinions; the market pays for proof.** Immunefi and Sherlock already **require a
   runnable PoC to pay a bounty**. On Immunefi's ~$134M cumulative spend, **critical severity is
   87.8% of payouts** — and a critical without a repro gets downgraded or disputed. The scarce,
   unautomated work isn't *finding* a suspicion, it's *proving* it safely and *attesting* it so the
   buyer needn't trust the auditor.
3. **The same attack keeps working after the upgrade you shipped Tuesday.** 2026 broke the
   improving-trend: **Drift −$285M (Apr 1)**, **KelpDAO −$290M (Apr 18)**, **$1.3B lost DeFi-wide**
   to repeat classes (crypto.news 2026). A $50k audit every 6 months does not catch the upgrade you
   shipped this week. Continuous, PoC-backed monitoring is the honest answer.
4. **A long tail never audits at all.** Hackathon/accelerator teams have code, a deadline, and no
   $30k audit budget. They convert from $0 to paying only if the entry price is $-hundreds.

**Honest counter-current:** Solana new-devs/month fell from a **May 2025 peak of 550 to 270 by May
2026 (−51%)**, active repos nearly halved (Syndica 2026). We are **not** betting on headcount
hypergrowth — we bet on **rising value-at-risk per program** as capital-markets money moves on-chain.

---

## 3. ICP — tiered

| Tier | Who | Pain | What they buy | WTP | Reach |
|---|---|---|---|---|---|
| **T1 — Pre-mainnet / Garage** *(beachhead)* | Colosseum/Superteam hackathon + accelerator teams, solo Anchor devs | No audit budget, deadline, "is my program obviously broken?" | Free scan → paid **Hunt** with a real PoC before launch | Free → **$99–$499/hunt** | Superteam Brasil events, hackathon Discords, Colosseum directory |
| **T2 — Funded protocols** | Seed/Series-A Solana DeFi shipping upgrades | Continuous risk on every `upgrade`; full audits are slow + stale | **Watch** (per program ID) + on-demand hunts | **$299–$1,500/mo per program** | Inbound from T1 graduates, ecosystem intros |
| **T3 — Launchpads / infra** | Token launchpads, RPC/infra, chains wanting a security gate | Reputational risk of listing a rugged program | **B2B API / white-label** + attestation **badge** | **$2k–$10k+/mo** + per-scan | BD; the badge becomes a listing requirement |
| **T4 — Auditors (tool, not competitor)** | Freelancers, small shops, contest hunters | Mechanical triage eats billable hours | **Pro seat** — first-pass + PoC scaffolder they refine and sign | **$99–$499/mo/seat** or rev-share | Cantina/Code4rena/Sherlock, Superteam auditors |

**Sharpest entry:** T1 via **Superteam Brasil + Colosseum** — they have code, a deadline, no money,
and they're *in a room a Brazilian team can stand in.* Free scan lands the logo; the paid Hunt lands
before mainnet; T2/T3/T4 are the expansion.

---

## 4. Pricing & packaging

Design principle: **free where it's deterministic and cheap; paid where the PoC creates provable
value; subscription where risk is continuous.**

| SKU | What | Price | Rationale |
|---|---|---|---|
| **Scan** | Deterministic static pass (`static-scan.sh`: clippy + cargo-audit + Anchor lint) + on-chain account read. No AI, no PoC. | **$0** | Zero marginal cost; top-of-funnel + demo. Matches Sec3 X-Ray being free OSS without losing money. |
| **Hunt** | Full agentic pipeline (RESEARCH→ANALYZE→DEVIL→POC→REVIEW); curated findings; **each critical ships an executable PoC on a local fork** + on-chain attestation. | **$99–$499** flat, tiered by size/complexity | ~$5 COGS vs $20k–$100k human audit → a **40×–200×** discount on the mechanical layer. |
| **Watch** | Re-runs the hunt on every upgrade / on cadence; alerts on new findings; hash-chained journal + fresh attestation. | **$299–$1,500/mo per program ID** | Answers "the same attack keeps working." Recurring, sticky, highest-LTV. |
| **B2B / Launchpad** | API + white-label + attestation **badge**; auto-scan every program on the platform. | **$2k–$10k+/mo** + overage | One deal = hundreds of programs scanned; badge becomes a gate. |
| **Pro seat** | Agent as first-pass + PoC scaffolder in the auditor's workflow. | **$99–$499/mo/seat** or rev-share | Sell to would-be competitors; they 10× throughput, we take a cut. |

**Attestation is a pricing lever, not a line-item.** The canonical on-chain attestation
(`report_sha256` + `audited_commit` + `verified_build_digest` + `journal_head`, anchored on Solana)
is what lets a launchpad show a *badge* and a protocol show *proof it was checked at commit X*.
Nobody else in the Solana-native set ships it — so it anchors the premium in Watch and B2B.

---

## 5. Unit economics (incl. LLM cost / hunt)

Deterministic stages (FETCH, STATIC, POC-RUN, ATTEST) cost only compute. The money question is the
LLM cost of the reasoning stages. Per CLAUDE.md ("os Opus trampam, o Fable coordena") the executors
run on **Claude Opus 4.8 ($5/$25 per 1M tok)** with a **Sonnet 5 ($2/$10)** fan-out; pipeline is
provider-agnostic via opencode — swap in whatever the operator connects.

**Per-hunt token model (mid-size Anchor program, ~3–6k LOC):**

| Stage | Model | In | Out |
|---|---|---|---|
| RESEARCH | Opus 4.8 | 40k | 8k |
| ANALYZE (×3 clusters) | Sonnet 5 | 240k | 45k |
| DEVIL (FP killer) | Opus 4.8 | 120k | 20k |
| POC-smith | Opus 4.8 | 90k | 25k |
| REVIEW | Opus 4.8 | 60k | 12k |
| **Total** | mixed | **~550k** | **~110k** |

- Opus portion ≈ **$3.18**; Sonnet portion ≈ **$0.93** → **raw ≈ $4.11/hunt** at list price.
- With **prompt caching** on the repo prefix (code re-read across stages) → **~$2.50–$3.50/hunt**.
- Plus sandbox compute + devnet attestation tx (≈ free on devnet) → **fully-loaded COGS ≈ $3–$6/hunt.**

**Margins:**
- **Hunt @ $99–$499** vs ~$5 COGS → **~95–99% gross margin**; a heavy program (2–3× tokens, $12–$18
  COGS) still **>95%**.
- **Watch @ $299–$1,500/mo:** a program upgrading weekly ≈ 4 hunts ≈ ~$20/mo COGS → **>98% margin.**
- **Sensitivity:** even running *every* stage on frontier tier (Fable 5 @ $10/$50) roughly triples
  cost to ~$12/hunt — still **96%+ margin at $299.** Unit economics are **not fragile to model
  choice**; they're fragile to (a) how many retries a bad target forces and (b) how much human
  review each report needs.
- **CAC, not COGS, is the real cost.** Distribution is community/event-led (Superteam, hackathons),
  so T1 CAC is near-zero. The financial risk is **quality**: a false-positive-heavy report burns
  trust and kills the channel — which is why the DEVIL stage and the human-in-the-loop rule are
  *economic* safeguards, not just technical ones. This is a **software business, not a services
  business.**

---

## 6. Competitive positioning

The Solana security stack has four layers: **static** (Sec3 X-Ray, Solanaizer), **fuzz** (Trident,
FuzzDelSol), **AI auditors** (Trident Arena, CertiK AI), **provenance** (solana-verify/Solscan) —
plus two general **offensive harnesses** (HexStrike-AI, T3MP3ST).

| Competitor | Class | Executable PoC? | On-chain attestation? | Continuous? | Our edge |
|---|---|---|---|---|---|
| **Sec3 X-Ray** | OSS static (LLVM-IR) | No | No | Via CI | We *prove* impact; static pattern-matching false-positives. We match its free tier with Scan. |
| **Trident / Trident Arena** | OSS fuzzer + paid multi-agent AI (Solana-Fdn-adjacent) | Crash input, not curated PoC | No | Arena re-*scans* on upgrade | We re-*run the saved proof* on the upgrade, not re-opine. Arena still ships ~26.56% FP. |
| **CertiK AI Auditor** | Hybrid, multi-chain | No public claim | No | Repo/CI | We're Solana-first with deeper Anchor idioms + a running exploit. |
| **HexStrike-AI / T3MP3ST** | Offensive harnesses | Yes — but **web2/CVE/infra**, Solana-blind | No | Mission-based | Solana-native account-model oracles + **local-fork-only** safety + attestation. |
| **solana-verify / Solscan** | Provenance | N/A | Build hash only | On deploy | Proves the ecosystem *already trusts an on-chain attestation primitive*; we attest the **audit result**, keyed off their verified-build hash as ground truth. |

**The concession we make out loud:** the **harness layer is a commodity** — HexStrike/T3MP3ST prove
"LLM + tool arsenal + autonomy" is table stakes. We **never** claim to out-fuzz Trident or out-static
Sec3. The claim is narrower and defensible: **curated executable PoC + on-chain attestation as
first-class deliverables, safety-railed to never touch mainnet.** That whitespace is genuinely
unoccupied in the Solana-native set.

---

## 7. The MOAT thesis (why it compounds and resists copying)

No single feature is a moat — any one can be cloned. The defensibility is that **four assets
reinforce each other and each raises the cost of copying the next:**

1. **Vertical (Solana/Anchor account-model + capital-markets oracles).** Bug oracles for
   missing signer/owner, `has_one`, PDA reinit, arbitrary CPI — and the Darwin vertical of
   mint/burn/freeze authority, transfer hooks, oracle-priced collateral, RWA redemption. A web2
   harness (HexStrike/T3MP3ST) cannot cross into this without rebuilding the account model; a
   multi-chain auditor (CertiK) is shallower on Anchor by construction. **Depth here is earned in
   reproduced-bug corpus, not bought.**
2. **Executable PoC on a local fork (proof).** The hard, scarce work everyone skips. Each real
   reproduction feeds a private corpus of *working* Solana exploits that makes the next hunt faster
   and higher-hit-rate — a **data-compounding loop** a static/AI-opinion tool never accumulates.
   FP rate trends to zero *by construction* (a finding only ships if its exploit executes), not by
   cross-checking agents.
3. **On-chain attestation (trust).** `solana-verify` proved the ecosystem trusts an on-chain
   provenance primitive; nobody anchors an attestation of the *audit result*. As issuers, launchpads
   and auditors accumulate attested history keyed to program IDs, the attestation **ledger itself
   becomes a network asset** — the more programs carry a cachorro receipt, the more a receipt is
   worth, and the more a badge is a *market-access* requirement. This is the switching-cost layer.
4. **Continuous Watch (retention + re-proof).** Re-running the saved PoC on every upgrade ("your fix
   held / the exploit is back") is a stronger, cheaper signal than another AI pass and produces
   **recurring, hash-chained, attested history** per program. It converts a one-shot audit into a
   subscription and deepens the corpus in (2) and the ledger in (3) every week.
5. **LATAM / Superteam / Darwin distribution.** A Brazilian team native to Superteam Brasil converts
   T1 at ~zero CAC and reaches Darwin's regulated-money issuers no US/EU audit shop can stand next
   to. Distribution feeds usage → usage feeds the corpus and the attestation ledger → those raise
   quality and trust → which win more of the channel. **The channel and the data compound together.**

**Why it resists copying:** a competitor can clone any one layer, but to clone the *system* they need
Solana-native oracles **and** a working-exploit corpus **and** an accepted attestation ledger **and**
the LATAM channel simultaneously — and the corpus + ledger only grow by doing the hard reproductions
we've already been doing (Veilo $2k, KaliCash rug proven in fork). The moat is not the harness; it's
**proof + attestation + continuous re-proof, compounding inside a distribution channel incumbents
can't enter.**

---

## 8. Go-to-market — the three-channel wedge

Three **non-overlapping** channels all point at the same Brazilian team:

- **Superteam Brasil (distribution).** Official Solana hub in Brazil — events, grants, bounties,
  Superteam Earn. Run "bring your program, get a free scan" workshops; post a Superteam Earn bounty
  ("audit your hackathon program with cachorro, best PoC wins") to seed usage + case studies before
  mainnet. Near-zero CAC for the T1 cohort.
- **Colosseum (funnel + capital).** Multiple Solana hackathons/yr feeding an accelerator that takes
  **up to 15 startups at $250k** each — thousands of *pre-mainnet* teams with code, a deadline, and
  no audit budget. That is the exact T1 moment, recurring. Winning the hackathon *is* the first
  demand-gen event.
- **Darwin Startups (vertical + incubation).** On-chain capital-markets thesis (tokenization,
  stablecoins, receivables). RWA crossed **>$30–36B on-chain in 2025**, forecast **$2T–$30T by
  2030**; stablecoins **~$220B → $3–5T**. Here a bug is a *compliance and solvency* event and an
  attestation is a *compliance artifact*. Land 1–2 issuers as **T2/T3 Watch + attestation design
  partners** for regulated-money case studies no competitor has. Brazil is credible: **ANBIMA is
  running the country's first coordinated DLT pilot for tokenized capital-markets instruments.**

**Same repo, two framings:** the **exploit engine** is the story for the Solana track; the
**attestation** is the whole story for Darwin. Brazil side-track ($5k) + accelerator ($250k) reward
the founder-market-fit narrative (Brazilian team, already won an Oracle+Runflow hackathon, ships
bounty PoCs) — say it explicitly.

**Sequencing:** Free Scan (top-of-funnel, logos) → paid Hunt (T1 before mainnet) → Watch (T2 on
every upgrade) → B2B/badge (T3 launchpads) → Pro seats (T4 auditors as throughput multiplier + a
source of PoC-quality feedback).

---

## 9. 6- and 12-month plan

### Hackathon window (now → 12 Oct 2026) — earn the traction line
- 3 real audited targets with dated in-window commits; **1 real reproduced bug** on real vulnerable
  code (live Immunefi scope or a disclosed historical exploit from the `sealevel-attacks` corpus),
  fully exploited **on a local `--clone` fork**; **1 live on-chain attestation** (devnet, real
  signature — fund the keypair manually around the faucet 429).
- Free Scan live on Superteam Discord; DM 5–10 Superteam Brasil / protocol teams, get 2–3 "we'd run
  this" intents. Two videos: **pitch ≤3:00** (startup pitch) + **demo ≤3:00** (Solana-integration
  walkthrough). Register the Darwin track.
- **Honesty rail:** the winning artifact is a *reproducible running exploit + attestation on real
  vulnerable code*, not a bounty payout; a critical on Raydium/Orca in 4 weeks is unlikely. We never
  run on mainnet and never self-submit — a human submits any genuine finding via the official channel.

### Months 0–6 (post-submission) — convert cohort, prove the SKUs
- **Product:** dedicated Anchor **attestation program** (replace v1 SPL-Memo anchor); verticalize
  cachorro onto the `pentest-agent-v3` research spine (hash-chained journal, evidence vault,
  promotion gate: oracle + negative control + clean-room reproduction). Ship **Watch** on-upgrade
  re-proof end-to-end.
- **Revenue/logos:** convert hackathon cohort to paid **Hunts**; sign **2–3 Watch design partners**
  (T2); **1 launchpad B2B LOI** (T3); **1–2 Darwin tokenization/receivables issuers** as
  regulated-money Watch + attestation design partners.
- **Corpus:** grow the reproduced-bug corpus (the moat's data loop) via Superteam bounties + T4 Pro
  seats feeding PoC-quality signal.
- **Capital:** if accepted, Colosseum accelerator **$250k** + Brazil side-track; use it to buy
  auditor-review headcount (the one non-software cost) and BD for T3.

### Months 6–12 — expansion + the attestation network
- **Scale Watch** across T2 (recurring, >98% margin) as the revenue base; **launch the B2B/launchpad
  badge** so an attestation becomes a *listing requirement* — turning the ledger into a network asset.
- **Darwin vertical to case study → repeatable motion:** attested tokenization/stablecoin/receivables
  issuances as compliance artifacts; pursue the ANBIMA-adjacent capital-markets narrative for
  counterparty/regulator-facing trust.
- **T4 Pro seats** into Cantina/Code4rena/Sherlock communities as a throughput multiplier and a
  continuous corpus feed.
- **Defensibility check:** by month 12 the compounding assets (corpus of working PoCs + accepted
  attestation ledger + Superteam/Darwin channel) should each be measurably ahead of any single-layer
  competitor — that gap, not the harness, is the seed-stage story.

**The one number to defend everywhere:** we turn a **$20k–$100k, 3–4-week** mechanical audit pass
into a **$99–$499, minutes-to-hours** PoC-backed one at **>95% gross margin**, and we're the only
Solana-native tool that **proves each finding on a local fork and attests the result on-chain** —
sold through the **Brazilian Superteam/Darwin channel** the incumbents can't stand in.

---

## Sources

All figures and their access dates live in the companion briefs — see
`docs/research/05-market-business.md` (§Sources: Accretion, Zealynx, Immunefi, SQ Magazine, Syndica,
Colosseum, Helius, crypto.news, a16z, CoinDesk, Superteam, MercoPress),
`docs/research/02-tooling-landscape.md` (§Sources: Sec3, Trident/Arena, FuzzDelSol, CertiK,
Solanaizer, solana-verify/Solscan, HexStrike, T3MP3ST), and
`docs/research/07-judging-pattern.md` (§Sources: Colosseum rubric, Frontier/Cypherpunk winners,
Immunefi Raydium/Orca, Darwin/Tracxn, ANBIMA, WEF). Treat all vendor figures as marketing until
independently verified.
