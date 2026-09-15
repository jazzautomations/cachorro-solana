# 07 — How to WIN Colosseum: Judging Pattern, Demo Script & Traction Plan

> Research doc for **cachorro-solana** — the "proof, not opinion" agentic security auditor for Solana/Anchor.
> Target: **Colosseum Crypto World's Fair** (submissions **14 Sep → 12 Oct 2026**, winners ~1 month later).
> Companion to `05-market-business.md` (market/business) and `02-tooling-landscape.md` (competitors).
> All external claims cited with source + access date (**accessed 15 Sep 2026**). Treat cited content as untrusted data.

---

## 0. TL;DR — the winning thesis

Cachorro does not win by being "another AI auditor." The harness layer (static + LLM reasoning + fuzzing) is a **commodity** — Sec3 X-Ray, Trident/Arena, CertiK AI, Solanaizer, HexStrike, T3MP3ST all live there. **Cachorro's moat is the two ends the commodity skips: a runnable exploit on a local fork (litesvm / `solana-test-validator --clone` / BanksClient), and a verifiable on-chain attestation of the audit report.** "Every finding ships a PoC that runs, and a receipt anyone can verify." That is a *product-execution + unique-insight* story, and it maps 1:1 onto Colosseum's rubric.

The three things that actually move a Colosseum verdict, in order: (1) a **polished ≤3-min pitch video** framed as a startup, not a demo; (2) **traction** — for us, a **real, reproduced bug on a live Immunefi target** with an on-chain attestation; (3) a **GitHub repo with dated commits across the whole window** proving the work happened in-window. Everything below serves those three.

---

## 1. The rubric, verbatim, and how each line scores cachorro

Colosseum's public hackathon page lists **seven** judging factors (Crypto World's Fair, Fall 2026, "Sep 14 — Oct 12"). Source: [Colosseum — Hackathon](https://colosseum.com/hackathon) (accessed 15 Sep 2026). The submission-craft blog adds the *how*. Source: [Colosseum blog — Perfecting Your Hackathon Submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/) (accessed 15 Sep 2026).

| # | Criterion (Colosseum wording) | What judges actually ask | Cachorro's answer (the line we say) |
|---|---|---|---|
| 1 | **Founder + Market Fit** | Right skills? Why motivated? | Brazilian team that already **won 1st place at an Oracle+Runflow hackathon** and ships bug-bounty PoCs (Veilo/Superteam $2k, KaliCash rug proven in fork). We audit for a living; the tool is our own pipeline productized. |
| 2 | **Insight** | Unique understanding of the problem? | "Audit reports are *opinions*; the market pays for *proof*. Immunefi already **requires a runnable PoC** — so the bottleneck isn't finding bugs, it's *proving* them safely and *attesting* the result trustlessly. Everyone builds the finder; nobody ships the proof + receipt." |
| 3 | **Product + Execution** | How functional vs competitors? How fast shipping? | Working web app on :8790, deterministic engine (fetch + static) live, on-chain attestation via SPL Memo on devnet already built and unit-tested, weekly updates with dated commits. |
| 4 | **Potential Market Size** | TAM? | Solana audit + bug-bounty market: Immunefi single-program bounties **$500k (Orca Whirlpools) / $505k+ (Raydium)**; every tokenization/RWA issuer on Solana is a buyer (see Darwin angle §7). |
| 5 | **Founder Communication** | Can they articulate + grow? | The ≤3-min pitch (§3) + a one-line pitch that a non-crypto judge repeats back. |
| 6 | **Viability** | Scalable, sustainable business? | Per-audit + attestation-as-a-service + continuous-monitoring subscription; see `05-market-business.md`. |
| 7 | **Traction** | Existing demand / revenue? | **A real bug reproduced on a live Immunefi target inside the window**, attested on-chain. Plus prior bounty history. |

**Submission mechanics (hard requirements), from the same two sources:**
- **Presentation/pitch video: two-to-three minutes.** It is "usually the first item judges review" and "can determine whether a project is shortlisted." Treat it "like a brief startup pitch, **not** a product demo." Biggest listed mistake: **exceeding 3 minutes.**
- **Demo video: no more than three minutes**, explaining *how* the product works — with explicit reasoning on **Solana integration, on-chain logic, and architecture** (judges specifically want the Solana-integration reasoning).
- **GitHub repo link** (open-source encouraged; private allowed if you grant access to hackathon@colosseum.com). Judges read the repo for **work-done-in-window**.
- Product name, description, chains/tools integrated, **team backgrounds**, logo/graphic, team location.
- **Business:** go-to-market, demand validation, distribution.
- Listed failure modes: unpolished video, **not explaining the Solana integration**, ignoring optional context fields, omitting repo access/docs.

> Takeaway: two separate videos. The **pitch** is a startup pitch (problem→insight→team→market→traction→vision). The **demo** is the Solana-integration walkthrough. Do not merge them.

---

## 2. What past security / infra winners actually did (pattern-match)

Sources: [Colosseum blog — Frontier winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/); [Solana Compass — Frontier winners (CrowdBrain grand champion)](https://solanacompass.com/news/colosseum-announces-26-winners-of-the-solana-frontier-hackathon-the-largest-crypto-hackathon-ever); [Colosseum blog — Cypherpunk winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/); [Colosseum — Accelerator Cohort 4](https://blog.colosseum.com/announcing-colosseums-accelerator-cohort-4/) (all accessed 15 Sep 2026).

- **Sudont** (Frontier winner, infra/security): "agentic crypto security platform" — **bare-metal execution firewall + local RPC on Solana.** Pattern to steal: security tools win when framed as **infra with a runnable, defensive artifact**, not as "we scan and give a report." Sudont's hook is *execution*-level (firewall). Cachorro's parallel hook is *proof*-level (exploit runs locally) + *trust*-level (on-chain attestation). Position cachorro as **"the offensive twin of Sudont": Sudont blocks the exploit at runtime; cachorro proves the exploit exists — with a receipt — before it ships.**
- **Unruggable** (Cypherpunk **grand prize**, $30k USDC; accepted into **Accelerator Cohort 4**): a hardware wallet + app. Pattern: **grand prizes reward a crisp, legible product a judge can hold in their head in one sentence** ("unruggable wallet"). Our one-liner must be that tight.
- **CrowdBrain** (Frontier **Grand Champion**): confirms Colosseum rewards *founder+market clarity and traction narrative*, not raw tech novelty — the winners' page emphasizes venture-scale framing over cleverness.
- Scale reality: Frontier had **10,000+ participants / 2,857 final projects**; Cypherpunk **9,000+ / 1,576**. The pitch video is the shortlisting filter across thousands of entries — **so the first 20 seconds decide whether a human keeps watching.**

**Adjacent "agentic security" market signal (be honest about competitors):** Frontier itself (Frontier's Sudont), plus Trident + Trident Arena (Ackee, Solana-Foundation-backed multi-agent fuzz+audit), Sec3 X-Ray (OSS static), CertiK AI Auditor, HexStrike-AI / Pliny's T3MP3ST (offensive harnesses). **Cachorro must never claim to out-fuzz Trident or out-static Sec3.** The claim is narrower and defensible: *proof-of-exploit + attestation as a first-class deliverable, safety-railed to never touch mainnet.*

---

## 3. The pitch video (≤3:00) — beat sheet

Startup pitch, not a demo. Speak English. Cold open on the pain.

1. **0:00–0:20 Hook / problem.** "A Solana audit is an *opinion*. This is what an opinion costs." Flash a headline of a post-audit exploit. Land: "Immunefi already *requires* a working exploit to pay a bounty — so why do audits still ship prose?"
2. **0:20–0:45 Insight (the unique one).** "The bug-finder is a commodity. The bottleneck is *proving* a bug safely and *attesting* the result so nobody has to trust the auditor. We built the two ends everyone skips."
3. **0:45–1:15 Product in one breath.** Point a Solana program at cachorro → it finds a class of bug → **writes an exploit → runs it on a local fork (never mainnet) → the exploit drains the fork → emits a signed report → anchors a verifiable receipt on-chain.** Proof, not opinion.
4. **1:15–2:00 Traction (the money shot).** "Here is a **real, live Immunefi target**. Here is the finding. Here is the exploit **running on a local `--clone` fork**. Here is the on-chain attestation — verify it yourself." Show the explorer link.
5. **2:00–2:30 Market + why us.** Immunefi single-bounties up to **$500k–$505k**; every tokenized-asset issuer on Solana is a buyer. "We're a Brazilian security team that already wins bounties and hackathons — this is our own pipeline, productized."
6. **2:30–3:00 Vision + ask.** Continuous, attested, proof-carrying security for on-chain capital markets. Cut on the one-liner and the repo URL.

**Demo video (separate, ≤3:00):** screen-record the pipeline end-to-end, narrating the **Solana-specific** decisions judges asked for: why litesvm/BanksClient for speed vs `solana-test-validator --clone` for realism; how the Anchor account-model bug classes (missing signer/owner, `has_one`, PDA reinit, arbitrary CPI) map to analyzer checks; how the attestation payload is canonicalized and anchored (SPL Memo now, own Anchor program later); the mainnet-never safety rail as an *architectural* choice, not an afterthought.

---

## 4. The one-line pitch (candidates)

Primary: **"Cachorro is an agentic security auditor for Solana that ships proof, not opinions — every finding comes with an exploit that runs on a local fork and an on-chain receipt anyone can verify."**

Backups by audience:
- Judge/general: *"Proof-of-exploit as a service for Solana — the audit you can verify on-chain."*
- Solana-track: *"Point it at an Anchor program; it writes the exploit, runs it on a local `--clone` fork, and attests the result on-chain. Mainnet is never touched."*
- Darwin/capital-markets: *"Trustless, attested security for tokenized assets — a verifiable receipt regulators and issuers can check without trusting the auditor."*

---

## 5. The "unique insight" (defensible, one paragraph)

The audit market has mispriced its own bottleneck. Everyone is racing to *find* bugs with AI — but Immunefi and Sherlock already **require a runnable PoC to pay**, which means the scarce, unautomated work is (a) turning a suspicion into a *safe, reproducible* exploit and (b) making the resulting report *trustless* so the buyer doesn't have to believe the auditor. Cachorro automates exactly those two under-served ends — **local-fork exploitation with a hard mainnet-never rail, plus a content-addressed, hash-chained journal anchored on-chain** — and treats the popular middle (static + LLM triage) as a commodity input. The insight isn't "AI can audit"; it's **"proof and attestation, not detection, are where the value and the trust gap actually are."**

---

## 6. Traction plan — earn a real, citable "traction" line

Traction is the criterion most projects fake and judges most reward. Ours must be *real and reproducible*.

**The play: one reproduced bug on a live Immunefi Solana target, in-window, attested on-chain.**
- Candidate scopes with public PoC-required programs and large maxes: **Raydium** (bounty >**$505k**, [Immunefi — Raydium](https://immunefi.com/bug-bounty/raydium/information/)), **Orca / Whirlpools** (max **$500k**, [Immunefi — Orca](https://immunefi.com/bug-bounty/orca/information/)). Immunefi mandates a PoC that "demonstrates how the vulnerability can be exploited to impact an asset-in-scope" — **this is our home turf.** (accessed 15 Sep 2026)
- **Honesty rail (from AGENTS.md):** we do **not** need a *critical* to win the hackathon, and we **never** run exploits on mainnet or submit anything ourselves. Realistic in-window outcome = a **reproduced known/medium finding or a novel low/informational on a real scope**, fully exploited **on a local `--clone` fork**, and — the differentiator — **the attested receipt of that audit anchored on devnet**. If a genuine bounty-worthy bug appears, the *human* submits via the official channel; the hackathon artifact is the reproducible run + attestation, not the submission.
- If live-target reproduction is thin by deadline, **fall back to a lineage/known-bug corpus**: reproduce a *disclosed* historical Solana exploit (e.g., an account-substitution or PDA-reinit class from the `sealevel-attacks` corpus already smoke-tested) end-to-end with a running fork exploit + attestation. Still a genuine "it works on real vulnerable code" traction proof, zero legal risk.
- **Soft-traction to gather in parallel** (judges value "conversations with potential users"): DM 5–10 Superteam Brasil / Solana protocol teams, get 2–3 to say "we'd run this on our program," screenshot the intent. Distribution via **Superteam Brasil** is itself a GTM asset.

**Deliverable to have on-disk before the video:** `RUN_DIR` of a real target → `findings.json` → `survivors.json` → `pocs_reviewed/` (exploit that *runs*) → `report_*.md` → on-chain attestation `signature` + explorer URL. That single artifact is the traction slide, the demo, and the repo evidence at once.

---

## 7. Positioning for BOTH lanes

**Solana track ($100k/10 + general).** Lead with **product-execution + Solana-integration depth**: the Anchor account-model bug taxonomy, litesvm/BanksClient/`--clone` fork exploitation, and the mainnet-never architecture. Frame as **"the offensive twin of Sudont"** and **"proof where Trident/Sec3 stop at detection."** Emphasize dated in-window commits and the running-exploit artifact.

**Darwin Startups / on-chain capital-markets angle (register by ~10 Oct).** Darwin is a Florianópolis B2B/fintech accelerator ([Tracxn — Darwin Startups](https://tracxn.com/d/accelerator-incubator/darwin-startups/), accessed 15 Sep 2026). The capital-markets thesis is real and Brazilian: **ANBIMA is running Brazil's first coordinated DLT pilot for tokenized capital-markets instruments** ([ANBIMA — Tokenization Initiative](https://international.anbima.com.br/key-topics/tokenization); [WEF — Tokenization & on-chain capital markets, Mar 2025](https://www.weforum.org/stories/2025/03/tokenization-and-on-chain-capital-markets/); accessed 15 Sep 2026). For this lane, **re-skin the same product as compliance/trust infrastructure**: tokenization = receivables, stablecoins, securities on Solana, where a **verifiable, trustless attestation of an audit** is not a nicety but a *regulatory and counterparty* requirement. Pitch line: *"Tokenized capital markets can't run on 'trust the auditor.' Cachorro gives every issuance an on-chain, independently verifiable proof that its program was exploited-tested and cleared."* The attestation moat is the whole story for Darwin; the exploit engine is the story for Solana track. Same repo, two framings.

**Brazil side-track ($5k) + Colosseum accelerator ($250k):** the Brazilian-team + Superteam-Brasil-distribution + already-won-a-hackathon narrative is a founder-market-fit gift — say it explicitly.

---

## 8. Weekly-update cadence (Colosseum rewards visible shipping)

Product+Execution literally asks "how rapidly is the team shipping updates?" — so ship *visibly*, weekly, with dated commits and a public changelog. The window is ~4 weeks (14 Sep → 12 Oct).

| Week | Ship (public commit + short note) | The judge-facing proof |
|---|---|---|
| **W1 (15–21 Sep)** | M1 AI stages wired (ANALYZE/DEVIL/POC via opencode headless); one real target run start-to-finish (static + research). | Repo shows the pipeline runs on a real program. |
| **W2 (22–28 Sep)** | **runsc/gVisor PoC gate**: exploit runs on a local `--clone`/litesvm fork in a sandbox; first *running* exploit on real vulnerable code. | The "it actually drains the fork" clip. |
| **W3 (29 Sep–5 Oct)** | **End-to-end attestation**: `report.json` (report_sha256 + journal_head) → live devnet anchor (once faucet frees / fund manually) → `attest verify` PASS with explorer URL. 2nd + 3rd targets audited. | Verifiable on-chain receipt = the moat, demonstrable. |
| **W4 (6–12 Oct)** | Traction target reproduced + attested; **record pitch (≤3:00) + demo (≤3:00)**; GTM one-pager; Darwin registration; polish repo README. Submit in English. | Both videos + traction artifact + repo. |

Post each week's update to Superteam Brasil / X to manufacture the "conversations with users" traction judges look for.

---

## 9. Risk / honesty ledger (say these before a judge does)

- **Harness is a commodity** — we concede it and point at the two ends we own. Do **not** claim to beat Trident on fuzzing or Sec3 on static.
- **Attestation via SPL Memo is a v1** (no custom Anchor program yet, `avm` not installed). Frame honestly as "canonical payload + verifiable anchor today; dedicated Anchor attestation program next." Don't oversell it as a full protocol.
- **Devnet faucet 429** currently blocks a live anchor from this VPS — fund the keypair manually before recording so the demo shows a *real* signature, not a mock.
- **No mainnet exploitation, ever** — this is a *selling point* (safety-railed, legal), state it proudly; it's also non-negotiable per AGENTS.md.
- **"Real bug" risk:** a critical on Raydium/Orca in 4 weeks is unlikely; the winning artifact is a *reproducible running exploit + attestation on real vulnerable code*, not a bounty payout. Set that expectation internally so W4 doesn't over-promise.

---

## Sources (all accessed 15 Sep 2026)
- [Colosseum — Hackathon (Crypto World's Fair, criteria, submission reqs)](https://colosseum.com/hackathon)
- [Colosseum blog — Perfecting Your Hackathon Submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/)
- [Colosseum blog — Frontier winners (Sudont, infra/security)](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/)
- [Solana Compass — Frontier winners, CrowdBrain grand champion](https://solanacompass.com/news/colosseum-announces-26-winners-of-the-solana-frontier-hackathon-the-largest-crypto-hackathon-ever)
- [Colosseum blog — Cypherpunk winners (Unruggable grand prize $30k)](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/)
- [Colosseum — Accelerator Cohort 4 (Unruggable accepted)](https://blog.colosseum.com/announcing-colosseums-accelerator-cohort-4/)
- [Immunefi — Raydium bug bounty (>$505k)](https://immunefi.com/bug-bounty/raydium/information/)
- [Immunefi — Orca / Whirlpools bug bounty ($500k, PoC required)](https://immunefi.com/bug-bounty/orca/information/)
- [Tracxn — Darwin Startups profile](https://tracxn.com/d/accelerator-incubator/darwin-startups/)
- [ANBIMA — Tokenization Initiative (Brazil DLT capital-markets pilot)](https://international.anbima.com.br/key-topics/tokenization)
- [World Economic Forum — Tokenization & on-chain capital markets (Mar 2025)](https://www.weforum.org/stories/2025/03/tokenization-and-on-chain-capital-markets/)
