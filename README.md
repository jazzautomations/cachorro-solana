# CACHORRO — proof, not opinion.

**The audit your users can verify.** Point the pack at an Anchor program or a deployed program ID: it fans out like a bug bounty, attacks the surface, writes an executable PoC for every survivor, then anchors the verdict as a receipt on-chain.

Six human audits (Quantstamp ×3, Ackee, OtterSec) passed over `onre-finance/onre-sol` — the pack found 4 novel bugs and proved each on a local validator. See `docs/` for the business plan and pitch.

## The proof stack

Probabilistic models hallucinate bugs (false positives). Statistical scanners sleep through them (false negatives). The pack couples both:

- **PROPOSE** — the model hunts for recall. Semgrep (`corpus/semgrep-anchor.yml`) sets the coverage floor; LLM analysis fans out over clusters for everything patterns miss.
- **WEIGH** — a System One judge (TypeSafe `jev-1.13.0`) scores every promoted claim for exploit-plausibility — a probability, not prose. Dissent lands on the certificate.
- **PROVE** — the deterministic gate: nothing ships without an oracle verdict plus reproduction on a local validator / mainnet fork ([surfpool](https://github.com/solana-foundation/surfpool)). Treatment drains, control blocks.
- **SELF-AUDIT** — `scripts/tripwires-hunt.py` (port of pentest-agent v0.4.0 tripwires) checks the pack's own trail for promotion-without-proof, too-easy verification, confirmation collapse, rubber-stamp devil, suspicious-clean. Flags emit into the hunt feed and become part of the receipt's journal.

## The receipt lives on-chain

Every finished hunt anchors `sha256(report || audited commit || verified-build digest || journal head)` as a devnet memo: `cachorro:v1:<digest>`. The receipt expires itself — when the program upgrades, the digest diverges and the attestation goes stale.

```bash
attest digest report.md --commit <sha> --journal-head <h> --target <repo>
attest anchor report.md --commit <sha> --target <repo>   # devnet memo
attest verify <digest>                                   # trustless check
```

## Web

Next.js 15 app (`web/`): landing, bounty board (174 programs / $6.3M indexed), labs (learn-by-hunting), live PACK MIND feed, audit certificates at `/report/[id]`, `/verify`, `/claim` (program ownership via upgrade-authority signature), and a SOL-native billing rail (invoice → on-chain memo payment → key issuance).

```bash
cd web && npm install && npx next dev  # :3000 (prod: next build && cachorro-web.service)
```

Hunt via API:

```bash
curl -X POST $HOST/api/scan -H 'content-type: application/json' \
  -d '{"target":"https://github.com/orca-so/whirlpools","kind":"repo","mode":"deep"}'
```

## Pipeline

`scripts/run-job-devin.sh` → fetch → static (cargo-audit, clippy, grep lints, semgrep) → research → analyze (cluster fan-out) → devil (adversarial adjudication) → poc (surfpool/litesvm/test-validator) → review → report → **jev judge → self-audit → anchor**. Every stage streams to `cachorro-out/runs/<id>/events.jsonl`; `status.json` carries the machine-readable truth.

## Honesty contract

- No proof, no finding — the gate is enforced by machine, not by prompt
- A stale receipt says so out loud; it doesn't die quietly
- Failed and refuted hypotheses are first-class data (`rejected_findings.md` ships in every report)
- QUICK-mode reports are labeled RECON — no PoC gate, no certificate cosplay

Built in the open during **Colosseum — Crypto World's Fair '26**.
