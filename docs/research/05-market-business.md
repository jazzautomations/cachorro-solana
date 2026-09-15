# 05 — Market & Business Case (as of Sep 2026)

> Research doc for **cachorro-solana**: the "proof, not opinion" agentic auditor for Solana/Anchor
> programs (every finding ships a PoC that runs on a *local* validator/fork + an on-chain
> attestation of the report). This file sizes the market, defines the ICP, proposes pricing and
> unit economics, and maps the LATAM/Superteam/Darwin distribution wedge.
> Web-sourced; treat every fetched figure as vendor/marketing until independently verified. Sources
> dated inline. Compiled 2026-09-15. Numbers rounded; ranges kept honest.

---

## TL;DR (read this, skip the rest if you're pitching)

- **The pain is real and expensive.** A Solana/Anchor audit runs **$7k–$150k+** and **1–12 weeks**
  of calendar time, gated by a *tiny* pool of Rust-literate auditors who charge **$5k–$20k/week**
  ([Accretion Labs, 2026](https://accretion.xyz/blog/solana-audit-cost); [Zealynx, 2025](https://www.zealynx.io/blogs/Smart_Contract_Audit_Cost_in_2025-What_You_Need_to_Know)).
  Rust carries a **25–40% premium** over Solidity because of that scarcity.
- **The bounty layer is a liquid, KYC-optional market.** Immunefi alone has paid **$140M+** across
  **650+ protocols**, **77.5%** of it for smart-contract bugs and **87.8%** for *critical* severity
  ([Immunefi](https://immunefi.com/bug-bounty-program/); [SQ Magazine, Mar 2026](https://sqmagazine.co.uk/smart-contract-bug-bounties-statistics/)).
  Contest platforms (Cantina/Code4rena/Sherlock) run **$100k–$2M+** prize pools; top researchers
  clear **$200k–$500k+/yr** ([SmartContractsHacking, 2026](https://smartcontractshacking.com/tools/auditor-salary-calculator); [web3.career, 2026](https://web3.career/learn-web3/smart-contract-security-auditor-2026)).
- **The buyer funnel exists and is dated.** Colosseum's accelerator takes **up to 15 startups**
  each hackathon at **$250k** pre-seed; every one of those teams is a pre-mainnet program that will
  need a cheap security pass *before* it can afford a $50k audit
  ([Colosseum, 2025](https://blog.colosseum.com/announcing-colosseum-eternal-and-solanas-2025-hackathon-schedule/)).
- **The moat is not the harness.** Harnesses (Trident, HexStrike, T3MP3ST) are commodity (see
  `02-tooling-landscape.md`). Our defensible wedge is **curated executable PoC + verifiable on-chain
  attestation**, sold into the **LATAM/Superteam** distribution channel, with a vertical into
  **Darwin's on-chain capital-markets thesis** (tokenization / stablecoins / receivables) where a
  bug is a *regulated-money* bug and an attestation is a compliance artifact.
- **Honest caveat:** Solana developer inflow is *cooling* — new devs/month fell from a **May 2025
  peak of 550 to 270 by May 2026 (−51%)** and monthly active repos nearly halved
  ([Syndica, May 2026](https://blog.syndica.io/deep-dive-solana-developers-may-2026/)). We are not
  betting on hypergrowth of *headcount*; we're betting on rising *value-at-risk per program* as
  capital-markets money moves on-chain.

---

## 1. Market sizing

### 1.1 Traditional audit spend (the incumbent budget we undercut)

| Program type | Typical cost | Calendar time | Source |
|---|---|---|---|
| Simple SPL token / small program | $7k–$20k | 1–2 weeks | [Accretion, 2026](https://accretion.xyz/blog/solana-audit-cost); [Procur3, 2026](https://procur3.io/blog/smart-contract-audit-cost-2026) |
| Standard DeFi protocol (Anchor) | $20k–$100k | 3–4 weeks | Accretion, 2026; Zealynx, 2025 |
| Bridge / large multi-program system | $100k–$500k+ | 6–12 weeks + remediation | Accretion, 2026 |
| Senior freelance auditor (rate) | $5k–$20k / week | — | [Zealynx, 2025](https://www.zealynx.io/blogs/Smart_Contract_Audit_Cost_in_2025-What_You_Need_to_Know) |

Two structural facts drive the whole business:

1. **Cost = auditor-hours.** "The price is driven almost entirely by how long your code takes to
   review… because auditor time is the single biggest cost in this industry" (Zealynx, 2025). Any
   tool that removes *deterministic* review hours (find the missing `signer` check, prove it) attacks
   the cost base directly.
2. **Rust scarcity premium of 25–40%** over Solidity (Accretion, 2026). The pool of people who can
   read Anchor *and* write a litesvm PoC is small — which is exactly the labor our agent substitutes
   for on the mechanical 60–70% of findings, leaving humans the judgment calls.

**Bottom-up TAM sketch (audit spend only, deliberately conservative):**
- Active Solana repos ~**780/month** as of May 2026, down from a ~1,400 peak (Syndica, 2026). Assume
  ~**1,500–3,000 programs/yr** reach a state where an audit is even considered.
- If **20–30%** pay for *some* paid review at an average of **$30k**, that's a
  **~$13M–$27M/yr Solana-specific audit TAM** — small, but it's the *premium slice*. The larger
  reachable market is the **long tail that never audits at all** because $30k is prohibitive: that's
  the segment our **free scan + $-hundreds "hunt"** converts from $0 to paying.
- The broader smart-contract audit market (all chains) is estimated in the **hundreds of millions to
  low billions/yr** depending on methodology ([DevTechnosys, 2025](https://devtechnosys.com/insights/smart-contract-audit-cost/);
  [BlockchainAppFactory, 2025](https://www.blockchainappfactory.com/blog/smart-contract-audit-cost-guide/)).
  We only need a sliver of the Solana wedge to be a viable hackathon-to-seed company.

### 1.2 Bug-bounty economics (the "researcher tool" market + our own upside)

Who pays, how much, and how KYC works — because cachorro can be sold *as a tool to whitehats* **and**
run *as a whitehat itself* (human-in-the-loop, per AGENTS.md rules).

**Immunefi (the anchor tenant of the market):**
- **$140M+ paid**, **650+ protocols**, "more than the rest of the market combined"
  ([Immunefi](https://immunefi.com/bug-bounty-program/)).
- Of a **$134M** cumulative-spend baseline analyzed in Mar 2026: **smart-contract bugs = 77.5%
  ($77.97M)**, blockchain/consensus = 18.6% ($18.76M), web/app = 3.8% ($3.85M)
  ([SQ Magazine, Mar 2026](https://sqmagazine.co.uk/smart-contract-bug-bounties-statistics/)).
- **Severity skew is extreme: critical = 87.8% ($88.34M)**, high 7.4%, medium 3.2%. **The money is
  in criticals** — which is precisely what an *executable* PoC de-risks (a critical without repro
  gets downgraded or disputed).
- Immunefi cites processing **93% of all critical crypto vuln disclosures** and **$25B+ in hacks
  prevented** — i.e., it's the default clearing house our findings would flow through.

**KYC / payout mechanics (matters for a LATAM team getting paid):**
- KYC is **per-program, not universal**: "you can make a career as a whitehat without KYC-ing by
  participating in programs that don't have KYC requirements"
  ([Immunefi support](https://immunefisupport.zendesk.com/hc/en-us/articles/18327648101649-KYC-requirements)).
- When required, KYC is triggered **only after a report is confirmed valid**, done via a third party
  (zkPassport for onboarding; gov-ID for critical payouts), and **rewards pay in USDC**. Practical
  read: a Brazilian team can operate and get paid; plan for gov-ID KYC on any *critical* payout.

**Contest platforms (Cantina / Code4rena / Sherlock) — the tool-buyer's daily arena:**
- Prize pools: Code4rena & Sherlock typically **$100k–$500k**; Cantina runs the largest at **$2M+**
  (EigenLayer, Uniswap v4). A single critical finding can pay **$10k–$50k+**
  ([SmartContractsHacking, 2026](https://smartcontractshacking.com/tools/web3-auditing-competitions-and-bug-bounties)).
- Researcher income bands: top-10 **$200k–$500k+/yr**, top-50 **$80k–$200k**, top-100 **$30k–$80k**,
  active participants **$5k–$30k** ([web3.career, 2026](https://web3.career/learn-web3/smart-contract-security-auditor-2026)).
- **Implication for pricing a tool:** a researcher earning $30k–$500k/yr will happily pay a
  **$X00/month** tool or a **rev-share on a landed PoC** if it raises hit rate. Our per-hunt LLM cost
  (below) is single-digit dollars — the margin is enormous *if* the PoC quality is real.

### 1.3 Value-at-risk on Solana (why the buyer's ROI is obvious)

- Cumulative Solana incident losses **~$600M gross (2020–2025)**, ~$469M mitigated → **~$131M net**;
  38 verified incidents, peak 15 in 2022 ([Helius](https://www.helius.dev/blog/solana-hacks);
  [Razored, 2025](https://medium.com/@razoredmanchi/from-bugs-to-bugproof-solanas-security-journey-2020-2025-5c838caa1ec3)).
- The trend *improved* into 2024–early 2025 (~$28M in 2024, <$1M early 2025) — **but 2026 broke the
  streak hard**: **Drift −$285M in 128 seconds (Apr 1, 2026)** and **KelpDAO −$290M via a LayerZero
  bridge (Apr 18, 2026)** ([crypto.news, 2026](https://crypto.news/defi-hacks-2026-billion-lost-same-attack-keeps-working/);
  ChainSec). DeFi-wide **$1.3B lost in 2026** to repeat attack classes.
- **Sales narrative:** the losses are lumpy and catastrophic; "the same attack keeps working." A
  $50k audit every 6 months does not catch the *upgrade you shipped Tuesday*. Continuous, PoC-backed
  monitoring on a program ID is the honest answer — and it's the "Watch" SKU.

### 1.4 Deal flow / how many buyers appear per month

- **New programs:** ~**780 active Solana repos/month** (May 2026), down from ~1,400 (Syndica, 2026);
  **11,534 new devs in 9 months of 2025**, 17,708 active. Inflow *cooling* (new devs/mo 550→270).
  Honest framing: **fewer net-new teams, higher stakes per team.**
- **Hackathon cohorts (concentrated, time-boxed demand):** Colosseum runs multiple Solana hackathons
  a year (Breakout, Cypherpunk, Radar…) feeding an accelerator that takes **up to 15 startups at
  $250k each** per cycle ([Colosseum, 2025](https://blog.colosseum.com/announcing-colosseum-eternal-and-solanas-2025-hackathon-schedule/)).
  Historically these draw **thousands of submissions** per event. That is a recurring, addressable
  *pre-mainnet* funnel — the exact moment a team has code, no audit budget, and a deadline.

---

## 2. ICP — Ideal Customer Profile (tiered)

| Tier | Who | Pain | What they buy | Willingness to pay | How we reach them |
|---|---|---|---|---|---|
| **T1 — Pre-mainnet / Garage** | Hackathon + accelerator teams (Colosseum, Superteam), solo builders, indie Anchor devs | No audit budget, deadline, "is my program obviously broken?" | **Free static scan** → paid **per-program Hunt** with a real PoC before they go live | Free → **$99–$499 / hunt** | Superteam Brasil events, hackathon Discords, Colosseum directory |
| **T2 — Funded protocols** | Seed/Series-A Solana DeFi, launched programs shipping upgrades | Continuous risk on every `upgrade`; full audits are slow + stale | **Watch** (continuous monitoring per program ID) + on-demand hunts | **$299–$1,500 / mo per program** | Inbound from T1 graduates, ecosystem intros, direct |
| **T3 — Launchpads / infra** | Token launchpads, RPC/infra providers, chains wanting a "security gate" | Reputational risk of listing/hosting a rugged program; want a cheap pre-screen at scale | **B2B API / white-label**: auto-scan every program launched on their platform + attestation badge | **$2k–$10k+ / mo** platform fee + per-scan | BD partnerships; the attestation badge is the wedge |
| **T4 — Auditors (tool, not competitor)** | Freelance auditors, small audit shops, contest hunters | Mechanical triage eats billable hours; need reproducible PoCs fast | **Pro seat**: agent as a first-pass + PoC scaffolder they refine and sign | **$99–$499 / mo / seat** or rev-share on landed findings | Cantina/Code4rena/Sherlock communities, Superteam auditors |

**Sharpest entry point:** **T1 via Superteam Brasil + Colosseum.** They have code, a deadline, no
money, and they're *in a room we can stand in.* Free scan lands the logo; the paid hunt lands before
mainnet; T2/T4 are the expansion.

---

## 3. Pricing

Design principle: **free where it's deterministic and cheap to run; paid where the PoC creates
provable value; subscription where risk is continuous.**

| SKU | What it does | Price | Rationale |
|---|---|---|---|
| **Scan (free)** | Deterministic static pass (`static-scan.sh`: clippy + cargo-audit + Anchor-pattern lint) + on-chain account read. No AI, no PoC. | **$0** | Zero marginal cost besides compute; it's the top-of-funnel and the demo. Mirrors Sec3 X-Ray being free OSS — we don't lose money matching it. |
| **Hunt (per program)** | Full agentic pipeline (RESEARCH→ANALYZE→DEVIL→POC→REVIEW), curated human-readable findings, **each critical ships an executable PoC on a local validator/fork**, + on-chain attestation of the report. | **$99–$499** flat, tiered by program size/complexity | Single-digit-dollar LLM cost (see §4) vs. $20k–$100k human audit. Even $499 is a **40×–200× discount** on the incumbent for the mechanical layer. |
| **Watch (subscription, per program ID)** | Re-runs the hunt on every program upgrade / on a cadence; alerts on new findings; keeps a hash-chained journal + fresh attestation. | **$299–$1,500 / mo per program ID** | Directly answers "the same attack keeps working after the upgrade you shipped." Recurring, sticky, and the highest-LTV SKU. |
| **B2B / Launchpad** | API + white-label + attestation badge; auto-scan every program on the platform. | **$2k–$10k+ / mo** + per-scan overage | Distribution leverage: one deal = hundreds of programs scanned. The badge becomes a listing requirement. |
| **Pro seat (auditors)** | Agent as a first-pass + PoC scaffolder inside the auditor's workflow. | **$99–$499 / mo / seat** or rev-share on landed findings | Sell to the people who'd otherwise be competitors; they 10× throughput, we take a cut. |

**Attestation as pricing lever, not a feature line-item:** the on-chain attestation (report hash +
audited commit + verified-build digest + journal head, anchored on Solana) is what lets a launchpad
show a *badge* and a protocol show *proof it was checked at commit X*. That's the thing nobody else in
the Solana-native set ships (`02-tooling-landscape.md`), so it anchors the premium in Watch and B2B.

---

## 4. Unit economics (incl. LLM cost per hunt)

The engine's deterministic stages (FETCH, STATIC, POC-RUN, ATTEST) cost only compute; the money
question is the **LLM cost of the reasoning stages** (RESEARCH, ANALYZE, DEVIL, POC-smith, REVIEW).
Per CLAUDE.md "os Opus trampam, o Fable coordena," we model the reasoning agents on **Claude Opus 4.8
($5 / 1M input, $25 / 1M output)** with a **Sonnet 5 ($2 / $10)** variant for the mechanical fan-out.
*(Pricing per the bundled `claude-api` skill model table, cached 2026-06-24; the pipeline itself is
provider-agnostic via opencode — swap in whatever the operator connects.)*

**Per-hunt token model (a mid-size Anchor program, ~3–6k LOC):**

| Stage | Model | Est. input tok | Est. output tok | Notes |
|---|---|---|---|---|
| RESEARCH | Opus 4.8 | 40k | 8k | protocol context, similar-exploit lineage |
| ANALYZE (fan-out ×3 clusters) | Sonnet 5 | 3 × 80k = 240k | 3 × 15k = 45k | reads code with prompt caching on the repo prefix |
| DEVIL (false-positive killer) | Opus 4.8 | 120k | 20k | re-reads survivors, adversarial |
| POC-smith | Opus 4.8 | 90k | 25k | writes litesvm/test-validator PoCs |
| REVIEW | Opus 4.8 | 60k | 12k | validates PoC output, gates report |
| **Totals** | mixed | **~550k in** | **~110k out** | before caching |

**Cost math (list price, no caching):**
- Opus 4.8 portion ≈ 310k in × $5/1M + 65k out × $25/1M = **$1.55 + $1.63 = ~$3.18**
- Sonnet 5 portion ≈ 240k in × $2/1M + 45k out × $10/1M = **$0.48 + $0.45 = ~$0.93**
- **Raw LLM ≈ $4.11 / hunt.** With **prompt caching** on the repo prefix (the code is re-read across
  stages; cache reads ~0.1× input) realistic input is **30–50% cheaper** → **~$2.50–$3.50 / hunt.**
- Add compute (fetch/build-in-sandbox/validator/attestation devnet tx ≈ free on devnet): **<$1**.
- **Fully-loaded COGS ≈ $3–$6 / hunt.**

**Margins:**
- **Hunt @ $99–$499** vs. ~$5 COGS → **~95–99% gross margin.** Even a heavy program (2–3× tokens,
  ~$12–$18 COGS) stays **>95%**.
- **Watch @ $299–$1,500/mo:** cost = (hunts triggered per month × ~$5) + monitoring poll compute.
  A program upgrading weekly = ~4 hunts = **~$20/mo COGS** → **>98% margin.** This is a software
  business, not a services business — the whole point of automating the mechanical audit layer.
- **CAC is the real cost, not COGS.** Because distribution is community/event-led (Superteam,
  hackathons), CAC for T1 is near-zero (booth + Discord). The financial risk is **quality**, not
  compute: a false-positive-heavy report burns trust and kills the channel. Hence the DEVIL stage and
  the human-in-the-loop rule (AGENTS.md) are *economic* safeguards, not just technical ones.

**Sensitivity / honesty check:** if we had to run every reasoning stage on the frontier tier
(Fable 5 @ $10/$50), per-hunt LLM cost roughly triples to **~$12/hunt** — still **96%+ margin at
$299**. The unit economics are not fragile to model choice; they're fragile to *how many retries a
bad target forces* and *how much human review each report needs.*

---

## 5. Distribution wedge — LATAM / Superteam / Darwin

### 5.1 Why LATAM/Superteam is the beachhead

- **Superteam Brasil** is the official Solana community hub in Brazil — mentorship, grants, events,
  bounties, hackathons — and the global Superteam network has distributed **$1.7M+ in community GDP**
  and runs the **Superteam Earn** bounty board ([Superteam Brasil](https://www.superteam.com.br/en);
  [Solana Compass](https://solanacompass.com/projects/superteam)). LATAM has a real, funded Solana
  builder base ([MercoPress, Mar 2025](https://en.mercopress.com/2025/03/06/the-solana-ecosystem-in-latin-america-meet-the-top-projects-and-developers)).
- **The team is Brazilian and native to this channel.** That is a genuine, defensible distribution
  advantage over US/EU audit shops: we can stand in the room at Superteam Brasil events, run "bring
  your program, get a free scan" workshops, and convert the exact T1 cohort at ~zero CAC.
- **Superteam Earn as a landing mechanic:** post a bounty ("audit your hackathon program with
  cachorro, best PoC wins") to seed usage and case studies before mainnet.

### 5.2 The Darwin vertical — security+attestation into on-chain capital markets

Darwin Startups' incubation thesis for this cycle is **on-chain capital markets: tokenization,
stablecoins, receivables.** That is the highest-stakes possible home for a "proof + attestation"
product, for three reasons:

1. **The value-at-risk is regulated money.** RWA tokenization crossed **>$30–36B on-chain in 2025**
   (ex-stablecoins) and is forecast to **$2T–$30T by 2030** depending on methodology (McKinsey base
   $2–4T; BCG/Ripple ~$9.4T by 2030, $18.9T by 2033; bull cases $16–30T)
   ([a16z crypto, 2025](https://a16zcrypto.com/posts/article/tokenized-asset-rwa-market-data-charts/);
   [CoinDesk, Feb 2025](https://www.coindesk.com/opinion/2025/02/07/rwa-tokenization-is-going-to-trillions-much-faster-than-you-think)).
   **Stablecoins** sit at **~$220B** today, projected **$3–5T by 2030**
   (a16z; [Mintlayer, 2025](https://www.mintlayer.org/blogs/16-30-trillion-by-2030-unlocking-the-rwa-opportunity)).
   A bug in a receivables or stablecoin program isn't a $28M DeFi loss — it's a *compliance and
   solvency* event.
2. **Attestation = compliance artifact.** In capital markets, "we audited it" is not enough; you need
   *proof of what was checked, at which commit, on which verified build*. Our canonical on-chain
   attestation (`report_sha256`, `audited_commit`, `verified_build_digest`, `journal_head`, anchored
   on Solana — see `attest/` and STATUS.md) is exactly the immutable evidence a tokenization issuer,
   auditor, or regulator wants. **This is the single most differentiated thing we ship**, and it maps
   1:1 onto Darwin's thesis.
3. **Continuous monitoring fits the product lifecycle.** Tokenization/stablecoin/receivables programs
   are *upgraded and re-parameterized constantly* (rates, oracles, whitelists). The **Watch** SKU —
   re-audit + fresh attestation on every upgrade — is the natural sale into a Darwin-incubated issuer,
   not a one-shot pre-launch scan.

**How it plugs in concretely:**
- **Darwin portfolio companies** (tokenization/stablecoin/receivables issuers) become **T2/T3 design
  partners** for Watch + attestation, giving us regulated-money case studies no competitor has.
- **The attestation badge** becomes a trust signal an issuer shows counterparties/auditors — turning
  a security tool into a *market-access* tool.
- **Superteam Brasil (distribution) + Darwin (vertical + incubation) + Colosseum (funnel + $250k
  accelerator)** are three non-overlapping channels that all point at the same Brazilian team. That
  three-way alignment is the actual business thesis, not the harness.

---

## 6. Go-to-market sequencing (hackathon → company)

1. **Now → submission (12 Oct 2026):** land 3 real audited targets with dated commits + **1 real
   reproduced bug** + 1 live on-chain attestation (devnet). Free scan live on Superteam Discord.
2. **Post-hackathon (if accelerated):** convert hackathon cohort to paid Hunts; sign 2–3 Watch
   design partners from T2; one launchpad B2B LOI.
3. **Darwin track:** 1–2 tokenization/receivables issuers as regulated-money Watch design partners;
   attestation-as-compliance case study.
4. **Auditor channel (T4):** Pro seats into Superteam auditors + Cantina/Code4rena hunters as a
   throughput multiplier and a source of PoC-quality feedback.

**The one number to defend in the pitch:** we turn a **$20k–$100k, 3–4-week** mechanical audit pass
into a **$99–$499, minutes-to-hours** PoC-backed one at **>95% gross margin**, and we're the only
Solana-native tool that **proves each finding on a local fork and attests the result on-chain** —
sold through the **Brazilian Superteam/Darwin channel** the incumbents can't stand in.

---

## Sources (with dates)

- Accretion Labs — "How Much Does a Solana Audit Cost in 2026?" — https://accretion.xyz/blog/solana-audit-cost (2026)
- Zealynx Security — "Smart Contract Audit Cost in 2025" — https://www.zealynx.io/blogs/Smart_Contract_Audit_Cost_in_2025-What_You_Need_to_Know (2025)
- Procur3 — "Smart Contract Audit Cost 2026" — https://procur3.io/blog/smart-contract-audit-cost-2026 (2026)
- DevTechnosys — "Smart Contract Audit Cost 2025" — https://devtechnosys.com/insights/smart-contract-audit-cost/ (2025)
- BlockchainAppFactory — "Smart Contract Audit Cost Guide 2025" — https://www.blockchainappfactory.com/blog/smart-contract-audit-cost-guide/ (2025)
- Immunefi — Bug Bounty Platform — https://immunefi.com/bug-bounty-program/ (accessed 2026-09-15)
- SQ Magazine — "Smart Contract Bug Bounties Statistics" — https://sqmagazine.co.uk/smart-contract-bug-bounties-statistics/ (Mar 2026)
- Immunefi Support — "KYC requirements" — https://immunefisupport.zendesk.com/hc/en-us/articles/18327648101649-KYC-requirements (accessed 2026-09-15)
- SmartContractsHacking — Auditor Salary Calculator / Competitions — https://smartcontractshacking.com/tools/auditor-salary-calculator ; https://smartcontractshacking.com/tools/web3-auditing-competitions-and-bug-bounties (2026)
- web3.career — "Smart Contract Security Auditor 2026" — https://web3.career/learn-web3/smart-contract-security-auditor-2026 (2026)
- Syndica — "Deep Dive: Solana Developers — May 2026" — https://blog.syndica.io/deep-dive-solana-developers-may-2026/ (May 2026)
- Colosseum — "Announcing Colosseum Eternal and Solana's 2025 Hackathon Schedule" — https://blog.colosseum.com/announcing-colosseum-eternal-and-solanas-2025-hackathon-schedule/ (2025); accelerator terms via https://x.com/colosseum/status/1919396222571315694 (2025)
- Helius — "Solana Hacks, Bugs, and Exploits: A Complete History" — https://www.helius.dev/blog/solana-hacks (accessed 2026-09-15)
- Razored — "From Bugs to Bugproof? Solana's Security Journey (2020–2025)" — https://medium.com/@razoredmanchi/from-bugs-to-bugproof-solanas-security-journey-2020-2025-5c838caa1ec3 (2025)
- crypto.news — "DeFi has lost $1.3 billion to hacks in 2026" — https://crypto.news/defi-hacks-2026-billion-lost-same-attack-keeps-working/ (2026)
- a16z crypto — "7 Charts: Tokenized assets" — https://a16zcrypto.com/posts/article/tokenized-asset-rwa-market-data-charts/ (2025)
- CoinDesk — "RWA Tokenization Is Going to Trillions" — https://www.coindesk.com/opinion/2025/02/07/rwa-tokenization-is-going-to-trillions-much-faster-than-you-think (Feb 2025)
- Mintlayer — "$16–30 Trillion by 2030" — https://www.mintlayer.org/blogs/16-30-trillion-by-2030-unlocking-the-rwa-opportunity (2025)
- Superteam Brasil — https://www.superteam.com.br/en ; Solana Compass — https://solanacompass.com/projects/superteam (accessed 2026-09-15)
- MercoPress — "The Solana Ecosystem in Latin America" — https://en.mercopress.com/2025/03/06/the-solana-ecosystem-in-latin-america-meet-the-top-projects-and-developers (Mar 2025)
- LLM pricing: bundled `claude-api` skill model table (Anthropic first-party rates, cached 2026-06-24) — Opus 4.8 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5, Fable 5 $10/$50 per 1M tokens
