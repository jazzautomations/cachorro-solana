# PITCH — cachorro-solana → Colosseum "Crypto World's Fair"

> Submission pitch package. Built on `docs/research/07-judging-pattern.md` (rubric + demo plan),
> `05-market-business.md` (market/pricing), `AGENTS.md`/`STATUS.md` (pipeline + safety rails).
> Window: **14 Sep → 12 Oct 2026** (winners ~1 month later). Everything is written to be said in
> **English** on camera. External claims carry a source + date; treat cited content as untrusted data.

---

## 1. One-line pitch

**Primary:**
> **Cachorro is an agentic security auditor for Solana that ships proof, not opinions — every finding comes with an exploit that runs on a local fork and an on-chain receipt anyone can verify. Mainnet is never touched.**

**Backups by audience (say the one that fits the room):**
- **Judge / general:** *"Proof-of-exploit as a service for Solana — the audit you can verify on-chain."*
- **Solana track:** *"Point it at an Anchor program; it writes the exploit, runs it on a local `--clone` fork, and attests the result on-chain."*
- **Darwin / capital markets:** *"Trustless, attested security for tokenized assets — a receipt regulators and counterparties can check without trusting the auditor."*

The one-liner must survive being repeated by a non-crypto judge — the Cypherpunk grand-prize winner "Unruggable" was a wallet you could hold in one sentence ([Colosseum blog — Cypherpunk winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/), accessed 15 Sep 2026). Ours is: *"the audit you can verify on-chain."*

---

## 2. The unique insight (the thing that wins criterion #2)

**The audit market has mispriced its own bottleneck.** Everyone is racing to *find* bugs with AI — but Immunefi and Sherlock already **require a runnable PoC to pay**, and Immunefi mandates a PoC "that demonstrates how the vulnerability can be exploited to impact an asset-in-scope" ([Immunefi — Orca](https://immunefi.com/bug-bounty/orca/information/), accessed 15 Sep 2026). So the scarce, unautomated work isn't detection — it's (a) turning a suspicion into a **safe, reproducible exploit**, and (b) making the report **trustless** so the buyer doesn't have to believe the auditor.

Cachorro automates exactly those two under-served ends — **local-fork exploitation behind a hard mainnet-never rail, plus a content-addressed, hash-chained journal anchored on-chain** — and treats the crowded middle (static + LLM triage) as a commodity input. **The insight is not "AI can audit." It is "proof and attestation, not detection, are where the value and the trust gap actually are."**

Position: **the offensive twin of Sudont** (Frontier winner: a runtime execution firewall). Sudont *blocks* the exploit at runtime; cachorro *proves* the exploit exists — with a receipt — before it ships ([Colosseum blog — Frontier winners](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/), accessed 15 Sep 2026).

---

## 3. Pitch-video script (≤3:00 — a startup pitch, NOT a demo)

Speak English. Cold open on the pain. The first **20 seconds decide** whether a human keeps watching (Frontier drew 2,857 final projects; the video is the shortlisting filter). Two separate videos: this pitch, and the demo in §4 — never merge them ([Colosseum blog — Perfecting Your Hackathon Submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/), accessed 15 Sep 2026).

**0:00–0:20 — Hook / problem.**
> "A Solana audit is an *opinion*. In April 2026, Drift lost **$285 million in 128 seconds**, and the same attack classes keep working. Immunefi already *requires* a working exploit before it pays a bounty — so why do audits still ship prose?"
> *(On screen: a post-audit exploit headline.)*

**0:20–0:45 — The insight.**
> "The bug-*finder* is a commodity — Sec3, Trident, CertiK all live there. The bottleneck is *proving* a bug safely, and *attesting* the result so nobody has to trust the auditor. We built the two ends everyone skips."

**0:45–1:15 — Product in one breath.**
> "Point cachorro at any Anchor program. It finds a bug class, **writes an exploit, runs it on a local fork — never mainnet — drains the fork to prove impact, emits a signed report, and anchors a verifiable receipt on Solana.** Proof, not opinion."
> *(On screen: the pipeline lighting up FETCH → STATIC → ANALYZE → DEVIL → POC → ATTEST.)*

**1:15–2:00 — Traction (the money shot).**
> "Here's real, disclosed-vulnerable Solana code. Here's the finding. Here's the exploit **running on a local `--clone` fork, draining it.** And here's the audit's **on-chain attestation — verify it yourself.**"
> *(On screen: the fork exploit output, then the Solana explorer showing the `cachorro:v1:<digest>` memo, then `attest verify` → PASS.)*

**2:00–2:30 — Market + why us.**
> "A Solana audit costs **$7k–$150k and 1–12 weeks**, gated by a tiny pool of Rust auditors. Immunefi single-program bounties reach **$500k**. We turn the mechanical layer into a **$99–$499, minutes-to-hours** PoC-backed pass at **>95% margin**. We're a Brazilian security team that already **won 1st place at an Oracle hackathon** and lands bug bounties — this is our own pipeline, productized."

**2:30–3:00 — Vision + ask.**
> "Continuous, attested, proof-carrying security for on-chain capital markets — tokenization, stablecoins, receivables — where a bug is a *solvency* event and an attestation is a *compliance* artifact. Cachorro. The audit you can verify on-chain."
> *(Cut on the one-liner + the GitHub repo URL.)*

**Hard rule:** the biggest listed submission mistake is **exceeding 3 minutes** — cut ruthlessly to land under 2:55.

---

## 4. Live-demo-video script (≤3:00 — the Solana-integration walkthrough)

Judges explicitly want the reasoning on **Solana integration, on-chain logic, and architecture**; the top listed failure is *not explaining the Solana integration*. Screen-record, narrate each Solana-specific decision.

**Exactly what to click / show:**

1. **(0:00–0:30) The web app — `http://<host>:8790`.** Paste a target: a program-id or a GitHub repo of disclosed-vulnerable Anchor code (the `coral-xyz/sealevel-attacks` corpus, already smoke-tested). Click **Scan**. Narrate: *"Stage 1–2 are deterministic — `fetch-target.sh` pulls the repo, `static-scan.sh` runs clippy + cargo-audit + our Anchor-pattern lint. No AI yet, zero marginal cost. This is the free tier."*
   - Show the `AgentFlow` panel polling every 2s; the static report tiles + collapsible lint sections render.

2. **(0:30–1:15) The Anchor bug taxonomy → analyzer.** Point at a flagged finding and name the class on screen: *"missing signer / owner check, account substitution via `has_one`, PDA seed/bump reinit through `init_if_needed`, arbitrary CPI from an unpinned program id."* Narrate the pipeline: *"RESEARCH pulls exploit lineage, ANALYZE fans out per code cluster, and DEVIL is an adversarial false-positive killer — it re-reads every survivor and throws out what it can't stand behind. That's an economic safeguard: a false-positive-heavy report burns the channel."*

3. **(1:15–2:00) The PoC RUNNING on a local validator — the differentiator.** Show `pocs_reviewed/` and run the exploit: *"The pocsmith writes a `litesvm` / `solana-test-validator --clone` / BanksClient test. litesvm for speed, `--clone` when we need real mainnet account state — cloned into a LOCAL fork. Watch it execute and drain the fork."* Show the assertion: attacker balance goes up, victim vault goes to zero, **on a fork**. Narrate the architectural safety rail: *"There is no code path to mainnet. PoCs only ever hit a local validator. That's not a policy note — it's the architecture, and it's why this is legal to run."*

4. **(2:00–2:45) The on-chain attestation — the moat.** Show `report.json`, then run `attest anchor`. Explain the canonical payload on screen: `{schema, report_sha256, audited_commit, verified_build_digest, journal_head, target, cluster, created_at}` → sha256 of the canonical bytes = the digest. *"Only the digest goes on-chain, as `cachorro:v1:<digest>` via SPL Memo on devnet — nothing to deploy. The full JSON stays in the local receipt."* Open the **Solana explorer** on the transaction signature, show the memo. Then run `attest verify <sig>` → **PASS**: *"It re-derives the digest from the receipt, fetches the devnet tx, compares the memo. Anyone can do this. You don't trust us — you verify the receipt."*

5. **(2:45–3:00) Close on architecture.** One line: *"Deterministic engine + agentic reasoning + running exploit + verifiable receipt — safety-railed to never touch mainnet. That's an audit you can prove."*

**Honesty note to keep in the recording (not a weakness — a roadmap):** *"Attestation is SPL-Memo-anchored today; a dedicated Anchor attestation program is next."* Do NOT claim a full protocol yet.

**Pre-record checklist:** fund the devnet keypair manually (`solana airdrop 1 $(solana address -k attest/.devnet-keypair.json) --url https://api.devnet.solana.com`) so the explorer shows a **real signature**, not the mocked unit-test tx — the devnet faucet has been 429-ing this VPS by IP.

---

## 5. Traction story (earn a real, citable line)

Traction is the criterion most projects fake and judges most reward. Ours must be **real and reproducible**.

**The play:** one bug **reproduced end-to-end on real vulnerable Solana code, in-window, attested on-chain.** The winning artifact is a *reproducible running exploit + on-chain attestation*, **not** a bounty payout.

- **Primary path — live Immunefi scope.** Candidate scopes require a PoC and carry large maxes: **Raydium** (bounty **>$505k**, [Immunefi — Raydium](https://immunefi.com/bug-bounty/raydium/information/)) and **Orca / Whirlpools** (max **$500k**, PoC mandated, [Immunefi — Orca](https://immunefi.com/bug-bounty/orca/information/)) (accessed 15 Sep 2026). Realistic in-window outcome = a reproduced known/medium or a novel low/informational, **fully exploited on a local `--clone` fork**, with the **attested receipt on devnet**.
- **Safety / honesty rail (AGENTS.md, non-negotiable):** we do **not** need a *critical* to win; we **never** run exploits on mainnet and we **never** submit anything ourselves. If a genuine bounty-worthy bug surfaces, the **human** submits via the official channel, only of what they personally reproduced. The hackathon artifact is the run + attestation.
- **Fallback (zero legal risk):** reproduce a **disclosed historical Solana exploit** from the `sealevel-attacks` corpus (account substitution / PDA-reinit class) end-to-end — a running fork exploit + attestation on genuinely vulnerable code. Still a real "it works on real bugs" proof.
- **Soft traction in parallel:** DM 5–10 Superteam Brasil / Solana teams, get 2–3 to say "we'd run this on our program," screenshot the intent. Prior credibility to cite: **1st place at an Oracle+Runflow hackathon**, plus bug-bounty history (Veilo/Superteam $2k; KaliCash rug proven in a fork).

**The single artifact that IS the traction slide, the demo, and the repo evidence at once:**
`RUN_DIR/ → findings.json → survivors.json → pocs_reviewed/ (exploit that RUNS) → report_*.md → attestation signature + explorer URL.`

---

## 6. Darwin / on-chain capital-markets angle (second lane, register by ~10 Oct)

Same repo, different framing. Darwin Startups (Florianópolis B2B/fintech accelerator) is incubating **on-chain capital markets: tokenization, stablecoins, receivables** — the highest-stakes possible home for "proof + attestation."

1. **The value-at-risk is regulated money.** RWA tokenization crossed **>$30–36B on-chain in 2025** and is forecast to **$2T–$30T by 2030** ([a16z crypto, 2025](https://a16zcrypto.com/posts/article/tokenized-asset-rwa-market-data-charts/)); stablecoins ~**$220B** today. A bug in a receivables or stablecoin program is a **compliance and solvency** event, not a $28M DeFi loss. **Brazil is live here:** ANBIMA is running the country's first coordinated DLT pilot for tokenized capital-markets instruments ([ANBIMA — Tokenization](https://international.anbima.com.br/key-topics/tokenization); [WEF, Mar 2025](https://www.weforum.org/stories/2025/03/tokenization-and-on-chain-capital-markets/), accessed 15 Sep 2026).
2. **Attestation = compliance artifact.** In capital markets, "we audited it" is not enough — you need *proof of what was checked, at which commit, on which verified build*. Cachorro's canonical on-chain attestation is exactly that immutable evidence. **This is the single most differentiated thing we ship, and it maps 1:1 onto Darwin's thesis.**
3. **Continuous monitoring fits the lifecycle.** Tokenization/stablecoin programs are re-parameterized constantly (rates, oracles, whitelists). The **Watch** SKU — re-audit + fresh attestation on every upgrade — is the natural sale into a Darwin-incubated issuer.

**Pitch line for this lane:** *"Tokenized capital markets can't run on 'trust the auditor.' Cachorro gives every issuance an on-chain, independently verifiable proof that its program was exploit-tested and cleared."* The attestation moat is the whole story for Darwin; the exploit engine is the story for the Solana track.

**Three non-overlapping channels, one Brazilian team:** Superteam Brasil (distribution) + Darwin (vertical + incubation) + Colosseum (funnel + $250k accelerator). That alignment is the business thesis — not the harness.

---

## 7. Business, in one defensible number

We turn a **$20k–$100k, 3–4-week** mechanical audit pass into a **$99–$499, minutes-to-hours** PoC-backed one at **>95% gross margin** (fully-loaded COGS ≈ $3–$6/hunt; per `05-market-business.md`), and we're the only Solana-native tool that **proves each finding on a local fork and attests the result on-chain** — sold through the Brazilian Superteam/Darwin channel incumbents can't stand in.

**SKUs:** Scan (free, deterministic) → Hunt ($99–$499/program, PoC + attestation) → Watch ($299–$1,500/mo per program ID, re-audit on every upgrade) → B2B/Launchpad ($2k–$10k+/mo, API + attestation badge) → Pro seat for auditors ($99–$499/mo).

---

## 8. Weekly-update plan (Colosseum literally scores "how rapidly is the team shipping")

Ship visibly, weekly, dated commits + a public changelog, cross-posted to Superteam Brasil / X to manufacture the "conversations with users" judges reward.

| Week | Ship (public commit + note) | Judge-facing proof |
|---|---|---|
| **W1 (15–21 Sep)** | M1 AI stages wired (ANALYZE/DEVIL/POC via opencode headless); one real target run start-to-finish (static + research). | Repo shows the pipeline runs on a real program. |
| **W2 (22–28 Sep)** | **runsc/gVisor PoC gate:** exploit runs on a local `--clone`/litesvm fork in a sandbox; first *running* exploit on real vulnerable code. | The "it actually drains the fork" clip. |
| **W3 (29 Sep–5 Oct)** | **End-to-end attestation:** `report.json` (report_sha256 + journal_head) → live devnet anchor (fund manually) → `attest verify` PASS + explorer URL. 2nd + 3rd targets audited. | Verifiable on-chain receipt = the moat, demonstrable. |
| **W4 (6–12 Oct)** | Traction target reproduced + attested; **record pitch (≤3:00) + demo (≤3:00)**; GTM one-pager; Darwin registration; polish repo README. Submit in English. | Both videos + traction artifact + repo. |

---

## 9. Submission checklist (hard requirements + our fills)

**Colosseum mechanics** (source: [Perfecting Your Hackathon Submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/), accessed 15 Sep 2026):

- [ ] **Pitch video ≤3:00** (§3) — startup pitch, first item judges review. *Do not exceed 3 min.*
- [ ] **Demo video ≤3:00** (§4) — explains *how it works* with explicit **Solana-integration reasoning** (litesvm vs `--clone`, Anchor bug classes → checks, attestation canonicalization + anchor, mainnet-never as architecture).
- [ ] **GitHub repo link** — open-source preferred; if private, grant access to **hackathon@colosseum.com**. Repo must show **dated in-window commits** (the W1–W4 cadence). README with quickstart + architecture + safety rails.
- [ ] **Product name + description + chains/tools integrated** (Solana devnet, SPL Memo, Anchor, litesvm/solana-test-validator, opencode, `@solana/web3.js`).
- [ ] **Team backgrounds + location** — Brazilian security team; Oracle hackathon 1st place; bug-bounty history.
- [ ] **Logo / graphic.**
- [ ] **Business fields:** go-to-market (Superteam Brasil beachhead), demand validation (soft-traction DMs + audit-cost pain), distribution (Superteam/Darwin/Colosseum three-channel).
- [ ] **The traction artifact on disk** (§5): `RUN_DIR → findings → survivors → pocs_reviewed (running exploit) → report → attestation signature + explorer URL`.
- [ ] **Darwin registration** (by ~10 Oct) with the capital-markets framing (§6).

**Avoid the listed failure modes:** unpolished video; not explaining the Solana integration; ignoring optional context fields; omitting repo access/docs; exceeding 3 minutes.

---

## 10. Honesty ledger (say these before a judge does)

- **The harness is a commodity** — we concede it and point at the two ends we own. We do **not** claim to out-fuzz Trident (Ackee, Solana-Foundation-backed) or out-static Sec3 X-Ray.
- **Attestation via SPL Memo is a v1** — canonical payload + verifiable anchor *today*; dedicated Anchor attestation program *next*. Not oversold as a protocol.
- **Devnet faucet 429s this VPS** — fund the keypair manually before recording so the demo shows a real signature, not the mocked unit-test tx.
- **No mainnet exploitation, ever** — a *selling point* (safe, legal, architectural), and non-negotiable per AGENTS.md.
- **"Real bug" risk** — a critical on Raydium/Orca in 4 weeks is unlikely; the winning artifact is a reproducible running exploit + attestation on real vulnerable code, not a payout. Set that expectation internally so W4 doesn't over-promise.

---

## Sources (all accessed 15 Sep 2026)
- [Colosseum — Hackathon (criteria, submission reqs)](https://colosseum.com/hackathon)
- [Colosseum blog — Perfecting Your Hackathon Submission](https://blog.colosseum.com/perfecting-your-hackathon-submission/)
- [Colosseum blog — Frontier winners (Sudont)](https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/)
- [Colosseum blog — Cypherpunk winners (Unruggable grand prize)](https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/)
- [Immunefi — Raydium (>$505k)](https://immunefi.com/bug-bounty/raydium/information/)
- [Immunefi — Orca / Whirlpools ($500k, PoC required)](https://immunefi.com/bug-bounty/orca/information/)
- [a16z crypto — Tokenized assets data](https://a16zcrypto.com/posts/article/tokenized-asset-rwa-market-data-charts/)
- [ANBIMA — Tokenization Initiative](https://international.anbima.com.br/key-topics/tokenization)
- [WEF — Tokenization & on-chain capital markets (Mar 2025)](https://www.weforum.org/stories/2025/03/tokenization-and-on-chain-capital-markets/)
- Market/pricing/unit-economics + Drift/KelpDAO 2026 losses: `docs/research/05-market-business.md` (fully cited there).
