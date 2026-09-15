# 02 — Solana Security Tooling Landscape (as of Sep 2026)

> Research doc for **cachorro-solana**. Honest competitive map. Web-sourced; treat every
> fetched claim as vendor marketing until independently verified. Sources dated inline.
> Compiled 2026-09-15.

## TL;DR

The Solana security stack in 2026 splits into four layers: **static analyzers** (Sec3 X-Ray,
Solanaizer), **fuzzers** (Trident, FuzzDelSol), **AI auditors** (Trident Arena, CertiK AI Auditor),
and **provenance/verified builds** (solana-verify + Solscan). Two general-purpose **offensive
harnesses** (HexStrike-AI, T3MP3ST) can drive exploits but are web2/infra-shaped, not Solana-program
aware. **Nobody in the Solana-native set ships a curated, human-readable executable PoC that runs on
a local validator/fork, and nobody anchors a verifiable attestation of the audit result on-chain.**
That is the whitespace (see §GAPS).

---

## The matrix

| Tool | Vendor | OSS/Paid | Class | Executable PoC? | Continuous / on-upgrade? | Pricing |
|---|---|---|---|---|---|---|
| **Sec3 X-Ray** | sec3.dev | Open source (2024) | Static (LLVM-IR) | No | Via CI/GitHub Action | Free (OSS) |
| **Trident** | Ackee + Solana Fdn | Open source | Fuzz (coverage-guided) | Crash repro, not curated PoC | Local/CI, manual | Free (OSS) |
| **Trident Arena** | Ackee | Paid / closed | Multi-agent AI | **No** | Yes (scan every upgrade) | Undisclosed (request access) |
| **FuzzDelSol** | Academic (RUB/UDE) | Research artifact | Fuzz (binary-only) | Crash/bug oracle, not PoC | No | N/A (paper) |
| **CertiK AI Auditor** | CertiK | Freemium + enterprise | Hybrid static+symbolic+ML | No | Repo/CI scanning | Free tier; audits $5k–$100k+ |
| **Solanaizer** | Solanaizer | GitHub Action (sample OSS) | AI (LLM review) | No | Via GitHub Action | Free/low (Action) |
| **solana-verify / Solscan** | Ellipsis Labs + OtterSec | Open source | Provenance (build ↔ source) | N/A (not vuln detection) | On deploy/upgrade | Free (OSS) |
| **HexStrike-AI** | 0x4m4 | Open source | Offensive harness (MCP) | Yes (web2/infra) | No (mission-based) | Free (OSS) |
| **T3MP3ST** | elder-plinius | Open source | Offensive meta-harness | Yes (web2/CVE) | No (mission-based) | Free (OSS) |

---

## Per-tool detail

### 1. Sec3 X-Ray — open-source static analyzer
- **What:** CLI that parses Rust → AST → LLVM-IR and runs static analysis over the IR to flag
  50+ vulnerability classes (missing account validation, arithmetic overflow, flash-loan exposure,
  signer-check bypass). Prior to open-sourcing it was the engine behind Sec3's SaaS scanner (2+ yrs).
- **OSS/Paid:** Open-sourced at **Breakpoint 2024 (Sep 2024)**; `github.com/sec3-product/x-ray`. Free.
- **Class:** Pure static. **No executable PoC** — reports pattern matches, not proven exploits.
- **Monitoring:** Integrable into CI / GitHub workflow for scan-on-commit.
- **Weakness for us to note:** static pattern matching → false positives; can't prove impact.

### 2. Trident (Ackee) — open-source Anchor fuzzer
- **What:** Rust framework to fuzz-test Solana programs written in Anchor. "First open-source fuzzer
  for Solana." Coverage-guided; up to ~12,000 tx/s in fuzzing mode; supports **manually guided**
  fuzzing (dev writes invariants/flows). Backed by **Solana Foundation**.
- **OSS/Paid:** Open source, free. First announced **May 2024** (Ackee tweet).
- **Class:** Fuzzing. Produces a **crash-reproducing input**, but not a curated, human-readable PoC
  tied to a named finding with an assertion of stolen funds. Needs a dev to write the harness.
- **Monitoring:** Runs locally/CI; no autonomous on-upgrade product.

### 3. Trident Arena (Ackee) — paid multi-agent AI auditor
- **What:** "Solana-native AI security scanning solution." Multiple parallel agents cross-check each
  other's findings to cut false positives; delivers audit reports "in hours" with severity +
  remediation.
- **Benchmarks (vendor, Feb 2026):** 70% of critical/high Solana vulns detected (vs 37% Claude Opus
  4.6, 33% GPT-5.2 w/ reasoning); **26.56% false-positive rate** (vs ~86.67% for plain LLMs).
- **OSS/Paid:** Closed, commercial. **Launched 2026-02-25**, request-access. Pricing undisclosed.
- **Executable PoC:** **No** — the launch material makes no mention of generating a running exploit.
- **Monitoring:** **Yes** — explicitly pitched for "continuous security… scan every deployment,
  upgrade, or major feature." This is the closest competitor to cachorro's monitoring angle, but it
  re-scans (re-opines) rather than re-running a proof.

### 4. FuzzDelSol — academic binary-only fuzzer
- **What:** "Fuzz on the Beach: Fuzzing Solana Smart Contracts," ACM CCS 2023 (arXiv 2309.03006).
  First **binary-only, coverage-guided** fuzzing architecture for Solana — works without source,
  with custom bug oracles for major Solana bug classes. Largest-scale Solana mainnet security study
  at the time: **6,049 contracts** evaluated.
- **OSS/Paid:** Research artifact, not a productized/maintained tool.
- **Executable PoC:** Emits crashing inputs / oracle hits, not curated PoCs.
- **Relevance:** Proof that binary-level, source-free analysis is viable — useful prior art if
  cachorro ever needs to hit closed-source programs.

### 5. CertiK AI Auditor — hybrid AI auditor (multi-chain)
- **What:** AI auditor for Solidity, Move, **and Solana Rust**. Hybrid: static analysis + symbolic
  execution + ML trained on historical audit data. Vendor claims **88.6% cumulative exact-hit rate
  across 35 Web3 incidents in 2026**.
- **OSS/Paid:** Free tier at `aiauditor.certik.com`; full CertiK audits run **$5k–$100k+**.
- **Executable PoC:** **No public claim** of a running PoC. Reports findings + severity.
- **Monitoring:** Repo/CI scanning; CertiK's broader platform (Skynet) does runtime monitoring but
  that's separate from the AI Auditor and not Solana-PoC-specific.
- **Note:** Not Solana-first — Solana is one of several targets; depth on Anchor idioms is shallower.

### 6. Solanaizer — AI GitHub Action
- **What:** AI-driven Solana/Anchor contract auditor delivered as a **GitHub Action**. LLM reviews
  Rust for overflow/underflow, unsafe memory, bad authorization, deep CPI (>4), reentrancy-style and
  logic/arithmetic errors.
- **OSS/Paid:** Sample project on GitHub / GitHub Action Marketplace; low-friction, CI-native.
- **Executable PoC:** No. LLM narrative findings only — classic false-positive risk.
- **Monitoring:** Runs on push via the Action.

### 7. solana-verify + Solscan — verified builds (provenance, NOT vuln detection)
- **What:** `solana-verify` CLI (Ellipsis Labs; hosted verification worker by **OtterSec/osec.io**)
  deterministically rebuilds a program and checks the artifact hash against the on-chain executable,
  then records verification on-chain (PDA w/ upgrade authority). **Solscan** surfaces Verified/False
  status + links to the source repo. `verify.osec.io` is the public dashboard.
- **OSS/Paid:** Open source, free. Legacy `--remote` deprecated → `submit-job` queues OtterSec worker.
- **Class:** **Provenance only** — proves *deployed bytecode == public source*. Says **nothing** about
  whether that source is vulnerable.
- **Why it matters to cachorro:** This is the *analog* of what we want, but for build integrity, not
  security. It's the proof that the ecosystem already trusts an **on-chain attestation** primitive —
  our attestation of an *audit result* is the natural next layer, and can even key off verified-build
  status as ground truth for "what code did I actually audit."

### 8. HexStrike-AI — general offensive MCP harness
- **What:** MCP server exposing **150+ cybersecurity tools** to LLM agents (Claude/GPT/Copilot) for
  autonomous pentest, vuln discovery, bug-bounty automation. v6.0 = multi-agent, autonomous
  decision-making, vuln-intelligence, auto-reporting. Check Point documented it being **weaponized
  to drive real zero-day exploitation** (2025).
- **OSS/Paid:** Open source, free.
- **Executable PoC:** **Yes** — it runs real tools and exploits — but the arsenal is **web2 / network
  / infra** (nmap-class recon, web exploitation). **Not Solana/Anchor/BPF-aware.** No litesvm, no
  validator fork, no account-model reasoning.
- **Relevance:** Commodity harness layer — proves "LLM + tool arsenal + autonomy" is table stakes,
  not a moat. Our moat has to be the Solana-specific bug oracles + local-validator PoC + attestation.

### 9. T3MP3ST — Pliny's offensive meta-harness
- **What:** "Autonomous multi-agent red-teaming platform." Turns your existing coding agent
  (Claude Code, Codex, Hermes) into a zero-day hunter: recon → exploit → report from a War Room UI or
  CLI, with evidence store + mission model, **local, no new API keys/cloud**. Exploit loop benchmarked
  at **90.1% pass@1 on XBEN** (XBOW's 104-challenge suite) and tested on 10 real 2026 CVEs across 7
  languages.
- **OSS/Paid:** Open source, free (`github.com/elder-plinius/T3MP3ST`).
- **Executable PoC:** **Yes**, and it's the strongest PoC-generation prior art here — but again the
  target class is **web apps / CVEs / infra**, not on-chain Solana programs. No Anchor/account-model
  awareness, no on-chain attestation, and it *points at live authorized targets* rather than a
  deterministic local fork.
- **Relevance:** Architecturally the closest to cachorro's "prove it" ethos. The differentiators that
  survive: Solana-native oracles, **local-fork-only** safety posture, and the **on-chain attestation**.

---

## GAPS — the whitespace cachorro can own

1. **Curated executable PoC tied to a finding — nobody Solana-native does it.**
   Static tools (X-Ray, Solanaizer) and AI auditors (Trident Arena, CertiK) emit *opinions*
   (findings + severity), never a running exploit. Fuzzers (Trident, FuzzDelSol) emit *crashing
   inputs*, not a human-readable PoC that asserts "these accounts, this instruction sequence, drains
   X". The general offensive harnesses (HexStrike, T3MP3ST) *do* run exploits but are web2/infra and
   Solana-blind. **Cachorro's proof-not-opinion PoC on litesvm / `solana-test-validator --clone` /
   BanksClient is genuinely unoccupied.**

2. **On-chain attestation of the *audit result* — unoccupied.**
   `solana-verify`/Solscan anchor **build provenance** on-chain (bytecode == source), but no one
   anchors a verifiable attestation that "program P at slot S was audited, here is the report hash,
   here are the reproduced findings." This composes cleanly with verified builds (use their hash as
   the audited-artifact ground truth) and is a defensible, demoable primitive for the hackathon.

3. **On-upgrade *re-execution of the proof*, not re-opining.**
   Trident Arena monitors on upgrade but **re-scans** (produces a fresh opinion each time). Nobody
   keeps the saved PoC and **re-runs it against the upgraded program** to prove a regression returned
   or a fix held. "Your fix is verified because the old exploit no longer runs on a fork of the new
   code" is a stronger, cheaper signal than another AI pass.

4. **False-positive elimination by construction.**
   Even the best AI auditor (Trident Arena) ships ~26.56% FP; plain LLMs ~86%; Solanaizer/CertiK
   narrative findings inherit LLM FP risk. Cachorro's promotion gate (oracle + negative control +
   clean-room reproduction on a fork) means **a finding only ships if its exploit actually executes**
   — FP rate trends toward zero by definition, not by cross-checking agents.

5. **Capital-markets vertical oracles (Darwin angle).**
   No tool verticalizes bug oracles for **tokenization / stablecoin / receivables** program patterns
   (mint/burn authority, freeze, transfer hooks, oracle-priced collateral, RWA redemption). This is
   the Darwin Startups partnership focus and a clean specialization no competitor targets.

6. **Safety posture as a feature.**
   Offensive harnesses point at live authorized targets; that's a liability for on-chain programs
   holding real funds. Cachorro's **local-fork-only, never-mainnet** guarantee (already codified in
   AGENTS.md) is both an ethical stance and a marketable trust signal for capital-markets clients.

**Honest caveats:** (a) The *harness layer is a commodity* — HexStrike/T3MP3ST prove LLM+tools+autonomy
is table stakes; our moat is Solana-native oracles + local-validator PoC + attestation, not "an AI
that runs tools." (b) Trident Arena is the most direct competitor on the monitoring/AI-audit axis and
is Solana-Foundation-adjacent (Ackee) — we must win on *proof and attestation*, not on out-scanning
them. (c) Auto-generating a *working* Solana exploit is hard; fuzzers get crashes cheaply but curated,
fund-draining PoCs on the account model are the actual technical risk we're taking on.

---

## Sources (accessed 2026-09-15)

- Sec3 X-Ray — [github.com/sec3-product/x-ray](https://github.com/sec3-product/x-ray) · [Breakpoint 2024 talk, Solana Compass](https://solanacompass.com/learn/breakpoint-24/bp-2024-technical-talk-open-source-x-ray-solana-smart-contract-static-analysis)
- Trident — [Ackee: Introducing Trident](https://ackee.xyz/blog/introducing-trident-the-first-open-source-fuzzer-for-solana-programs/) · [usetrident.xyz](https://usetrident.xyz/) · [QuickNode guide](https://www.quicknode.com/guides/solana-development/tooling/trident-fuzzing) · [Ackee announcement tweet, May 2024](https://x.com/AckeeBlockchain/status/1792631392402018788)
- Trident Arena — [Ackee: Trident Arena (2026-02-25)](https://ackee.xyz/blog/trident-arena-multi-agent-ai-security-for-solana-programs/)
- FuzzDelSol / "Fuzz on the Beach" — [arXiv 2309.03006](https://arxiv.org/abs/2309.03006) · [ACM CCS 2023](https://dlnext.acm.org/doi/10.1145/3576915.3623178)
- CertiK AI Auditor — [aiauditor.certik.com](https://aiauditor.certik.com/) · [certik.com/ecosystems/solana](https://www.certik.com/ecosystems/solana)
- Solanaizer — [github.com/solanaizer/solanaizer-sample-project](https://github.com/solanaizer/solanaizer-sample-project)
- Verified builds — [solana-foundation/solana-verifiable-build](https://github.com/solana-foundation/solana-verifiable-build) · [verify.osec.io](https://verify.osec.io/) · [solana.com/docs/programs/verified-builds](https://solana.com/docs/programs/verified-builds) · [Solscan program verification](https://info.solscan.io/program-verification-and-security-txt-on-solscan/)
- HexStrike-AI — [github.com/0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai) · [Check Point: HexStrike-AI & zero-day exploitation](https://blog.checkpoint.com/executive-insights/hexstrike-ai-when-llms-meet-zero-day-exploitation/)
- T3MP3ST — [github.com/elder-plinius/T3MP3ST](https://github.com/elder-plinius/T3MP3ST) · [The Weather Report: under the hood of T3MP3ST](https://theweatherreport.ai/posts/t3mp3st-pliny-bug-hunting-harness/)
- Landscape overview — [DEV: The Solana Security Toolbox in 2026](https://dev.to/ohmygod/the-solana-security-toolbox-in-2026-a-practitioners-guide-to-fuzzing-static-analysis-and-5h7f) *(404 on refetch 2026-09-15; title/context only)*
