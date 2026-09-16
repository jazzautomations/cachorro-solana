#!/usr/bin/env node
// build-labs.mjs — assemble web/data/labs.json from the sealevel-attacks corpus.
// Corpus lives at corpus/sealevel-attacks/<class>/<insecure|secure|recommended>/src/lib.rs
// (vendored from github.com/coral-xyz/sealevel-attacks — Apache-2.0, teaching material).
// Lesson copy is authored below; code is pulled from the corpus so it can't drift.
// Run: node scripts/build-labs.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = join(ROOT, 'corpus', 'sealevel-attacks')
const OUT = join(ROOT, 'web', 'data', 'labs.json')
const REPO_URL = 'https://github.com/coral-xyz/sealevel-attacks'

// tier: 0 = foundations (no bug — the model) · 1 = core model bugs · 2 = CPI/PDA · 3 = lifecycle & DoS
// kind: 'lesson' = conceptual, no corpus code · 'lab' = vulnerable program + hunt
const LABS = [
  {
    id: 'solana-model',
    tier: 0,
    kind: 'lesson',
    title: 'The Account Model',
    vulnClass: 'foundations',
    concept:
      'Ethereum contracts own their storage. Solana programs are stateless — they hold no data. Everything lives in accounts: lamports (balance), data (raw bytes), owner (the program allowed to write it), and flags. A "wallet" is an account owned by the System Program. A "token account" is an account owned by the Token Program whose data encodes mint+owner+amount. Every instruction receives the accounts it may touch as arguments — the runtime enforces nothing about what they mean. That single design choice is why Solana security exists as a discipline.',
    realWorld: 'Almost every Solana exploit is an account-model misunderstanding weaponized: wrong owner, wrong data, wrong signer, wrong program. Learn the model and the bugs read themselves.',
  },
  {
    id: 'signers-and-writers',
    tier: 0,
    kind: 'lesson',
    title: 'Signers & Writable Flags',
    vulnClass: 'foundations',
    concept:
      'The runtime tracks two facts per account in a transaction: is_signer (did its private key sign the tx) and is_writable (may the program mutate it). A program that reads authority.key() without checking authority.is_signer has only learned who the caller CLAIMS is authority. Signatures are how Solana says "this human agreed" — everything else is just bytes anyone can pass.',
    realWorld: 'The signer bit is the cheapest check in the runtime and the most skipped. Missing-signer is the #1 bug class by frequency.',
  },
  {
    id: 'ownership-and-validation',
    tier: 0,
    kind: 'lesson',
    title: 'Ownership = Trust',
    vulnClass: 'foundations',
    concept:
      'A program can only write to accounts it owns — the runtime enforces that. What it does NOT enforce: that an account you READ was created by who you think. Any program can craft an account whose bytes deserialize perfectly into your struct. Checking account.owner == expected_program is what turns "bytes that look right" into "data I can trust".',
    realWorld: 'Fake-account attacks powered the early Solana exploit wave. Anchor\'s Account<\'info, T> validates owner + discriminator automatically; raw AccountInfo validates nothing.',
  },
  {
    id: 'pdas',
    tier: 0,
    kind: 'lesson',
    title: 'PDAs — Program Derived Addresses',
    vulnClass: 'foundations',
    concept:
      'A PDA is an address derived deterministically from seeds + program id that deliberately falls OFF the ed25519 curve — no private key exists, so only the program can "sign" for it (via invoke_signed + the same seeds). PDAs are how programs hold authority: vaults, mint authorities, pool signers. The seeds ARE the security policy — collide them or reuse one PDA for everything and the walls come down.',
    realWorld: 'PDA seed design is protocol design. Wormhole-era exploits, share-inflation attacks and vault drains routinely trace back to seeds that didn\'t encode enough context.',
  },
  {
    id: 'cpi',
    tier: 0,
    kind: 'lesson',
    title: 'CPI — Cross-Program Invocation',
    vulnClass: 'foundations',
    concept:
      'Programs call programs: invoke passes your signer privileges down the call. That means the program_id you invoke decides who inherits your authority. Pin it to the expected address or an attacker supplies a program that says "transfer succeeded" while pocketing the tokens. CPI is composability — and the trust boundary where composability gets exploited.',
    realWorld: 'The pack CONFIRMED this class live: arbitrary program id + propagated signer bit = the callee can do anything your program can.',
  },
  {
    id: 'how-the-pack-hunts',
    tier: 0,
    kind: 'lesson',
    title: 'How the Pack Hunts',
    vulnClass: 'methodology',
    concept:
      'The pipeline mirrors a human auditor: FETCH the target → STATIC lint maps the surface → RESEARCH the protocol lineage → ANALYZE hypotheses per vuln class → DEVIL tries to kill every candidate (false positives burn bounty reputation) → POC writes the exploit → REVIEW runs treatment vs control on a local validator → REPORT. A finding only ships when code execution proves it — the gate, not the model, decides.',
    realWorld: 'This is the discipline Immunefi payouts reward: proof-of-concept required means the report must demonstrate impact, not argue it.',
  },
  {
    id: 'missing-signer',
    dir: '0-signer-authorization',
    tier: 1,
    kind: 'lab',
    title: 'Missing Signer Check',
    vulnClass: 'signer-authorization',
    concept:
      'In Solana, nothing stops anyone from passing any account as "authority". If the handler never calls `is_signer`, a stranger can invoke privileged actions as someone else — no signature required. The single most common root cause in Solana exploits.',
    realWorld: 'Class behind countless drains; the pack proved it on our own vault corpus — 5 SOL gone in one tx.',
    proven: 'run_1789557416_ab10c0',
  },
  {
    id: 'account-data-matching',
    dir: '1-account-data-matching',
    tier: 1,
    title: 'Account Data Matching',
    vulnClass: 'account-data-matching',
    concept:
      'An account that is structurally right but semantically wrong: the type checks out, the data inside belongs to someone else. Without checking a stored field (e.g. `account.authority == signer.key`), the program trusts whatever was passed.',
    realWorld: 'Variant of the Cashio infinite-mint: an unvalidated collateral account let the attacker mint $52M of CASH.',
  },
  {
    id: 'owner-checks',
    dir: '2-owner-checks',
    tier: 1,
    title: 'Owner Checks',
    vulnClass: 'owner-checks',
    concept:
      'Any program can create an account with any bytes in it. If you deserialize an AccountInfo without checking `account.owner == expected_program`, an attacker crafts a fake account that parses perfectly and drains the vault.',
    realWorld: 'Owner-check bypass = the "fake account" primitive behind most pre-Anchor exploits; Anchor `Account<T>` does it for you — AccountInfo never does.',
  },
  {
    id: 'type-cosplay',
    dir: '3-type-cosplay',
    tier: 1,
    title: 'Type Cosplay',
    vulnClass: 'type-cosplay',
    concept:
      'Two account structs with identical layout but different meaning. Pass account B where A is expected: fields reinterpreted, authority fields become balances. Anchor fixes this with the 8-byte discriminator — raw Solana programs must roll their own.',
    realWorld: 'The reason Anchor prepends a type discriminator to every account — without it, bytes are just bytes.',
  },
  {
    id: 'initialization',
    dir: '4-initialization',
    tier: 2,
    title: 'Reinitialization',
    vulnClass: 'reinitialization',
    concept:
      'An `init`-style instruction callable twice on the same account resets authority/data to attacker-controlled values. `init_if_needed` is the classic footgun: "needed" is decided by the caller, and a re-init overwrites the admin.',
    realWorld: 'Reinit bugs killed several early Solana protocols; Anchor 0.25+ made `init_if_needed` require explicit opt-in flags for a reason.',
  },
  {
    id: 'arbitrary-cpi',
    dir: '5-arbitrary-cpi',
    tier: 2,
    title: 'Arbitrary CPI',
    vulnClass: 'arbitrary-cpi',
    concept:
      '`invoke`/`invoke_signed` trust the program_id account passed in. If it isn\'t pinned to an expected address, the attacker supplies their own program — which happily reports "transfer succeeded" while keeping the tokens.',
    realWorld: 'The pack CONFIRMED this class on sealevel-attacks: invoke with arbitrary program id + signer-bit propagation = real drain.',
    proven: 'run_1789547662_fca40c',
  },
  {
    id: 'duplicate-mutable-accounts',
    dir: '6-duplicate-mutable-accounts',
    tier: 2,
    title: 'Duplicate Mutable Accounts',
    vulnClass: 'duplicate-mutable-accounts',
    concept:
      'Pass the same account twice in the accounts array and the runtime hands your handler two mutable references to one account. Debit it as "A" and "B" — you just debited twice the same balance.',
    realWorld: 'Classic double-spend primitive; the fix is a one-line key equality check Anchor does via constraints.',
  },
  {
    id: 'bump-canonicalization',
    dir: '7-bump-seed-canonicalization',
    tier: 2,
    title: 'Bump Seed Canonicalization',
    vulnClass: 'bump-seed-canonicalization',
    concept:
      'A PDA can be derived with multiple valid bumps, but only one is canonical. Accepting a non-canonical bump lets an attacker derive a second address for the "same" PDA — two accounts where the program expects one.',
    realWorld: 'Subtle but real: non-canonical PDAs break the one-account-one-vault invariant protocols rely on.',
  },
  {
    id: 'pda-sharing',
    dir: '8-pda-sharing',
    tier: 2,
    title: 'PDA Sharing',
    vulnClass: 'pda-sharing',
    concept:
      'Reusing one PDA as the authority for many things (vault + mint + pool) means any instruction that can sign with it controls all of them. Seeds should encode domain + instance: one PDA, one job.',
    realWorld: 'Over-powered PDAs turn one buggy instruction into total protocol control.',
  },
  {
    id: 'closing-accounts',
    dir: '9-closing-accounts',
    tier: 3,
    title: 'Closing Accounts & Revival',
    vulnClass: 'closing-accounts',
    concept:
      'Marking an account closed (lamports → 0) is not enough: a later instruction in the same tx can "revive" it by refunding rent, leaving a zeroed-but-live account ready for reinit. The exit writeback stomps the zeroing — the pack confirmed revival survives every "fixed" variant.',
    realWorld: 'The pack found an inverted check in the "secure" variant of this lesson — a real upstream bug in the teaching repo itself.',
    proven: 'run_1789547662_fca40c',
  },
  {
    id: 'sysvar-address-checking',
    dir: '10-sysvar-address-checking',
    tier: 3,
    title: 'Sysvar Address Checking',
    vulnClass: 'sysvar-address-checking',
    concept:
      'Before `sysvar::instructions` became a real syscall, the instruction sysvar was just an account — and attackers passed a fake one to forge instruction introspection. Always pin sysvar accounts to their known addresses.',
    realWorld: 'Wormhole lost $326M to a forged sysvar account — the largest bridge exploit in crypto started exactly here.',
  },
]

function readRs(dir, variant) {
  const p = join(CORPUS, dir, variant, 'src', 'lib.rs')
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

const labs = LABS.map((l) => ({
  kind: l.dir ? 'lab' : 'lesson',
  ...l,
  insecure: l.dir ? readRs(l.dir, 'insecure') : null,
  secure: l.dir ? readRs(l.dir, 'secure') : null,
  recommended: l.dir ? readRs(l.dir, 'recommended') : null,
  repoUrl: l.dir ? `${REPO_URL}/tree/master/programs/${l.dir}` : null,
  huntTarget: l.dir ? REPO_URL : null,
}))

const missing = labs.filter((l) => l.kind === 'lab' && (!l.insecure || !l.secure))
if (missing.length) {
  console.error('missing variants for:', missing.map((l) => l.id).join(', '))
  process.exit(1)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: REPO_URL, labs }, null, 2))
console.log(`labs.json: ${labs.length} labs, ${labs.filter((l) => l.proven).length} pack-proven`)
