import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import ScanInput from '@/components/ScanInput'
import RecentHunts from '@/components/RecentHunts'
import LiveFeedPreview from '@/components/LiveFeedPreview'
import { readBounties, solanaBounties } from '@/lib/bounties'
import { fmtUsd } from '@/lib/format'

export const dynamic = 'force-dynamic'

const JOURNEY = [
  {
    n: '1',
    t: 'PASTE A TARGET',
    d: 'A GitHub repo or an on-chain program ID. Fetch and static lint run in seconds — no wallet, no signup.',
  },
  {
    n: '2',
    t: 'WATCH THE PACK THINK',
    d: 'RESEARCH → ANALYZE → DEVIL → POC → REVIEW. Every hypothesis, dead-end and verdict streams live — you watch the reasoning, not a spinner.',
  },
  {
    n: '3',
    t: 'VERIFY THE RECEIPT',
    d: 'Findings ship with an executable PoC (treatment drains, control blocks) and an on-chain attestation anchored to the exact bytes tested.',
  },
]

const LADDER = [
  { t: 'OBSERVATION', d: 'static lint + on-chain dump become typed graph nodes', live: true },
  { t: 'HYPOTHESIS', d: 'each candidate carries a falsifier — what would disprove it', live: true },
  { t: 'EXPERIMENT', d: 'treatment vs negative control on a local validator', live: true },
  { t: 'VERIFIED', d: 'the gate refuses promotion without oracle SUPPORTS + reproduction', live: true },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      {/* HERO */}
      <section id="hunt" className="relative px-4 pt-12 pb-10 sm:pt-20 sm:pb-14 overflow-hidden scroll-mt-16">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-[9px] sm:text-xs text-neon-green mb-4 animate-blink font-mono">
            ▶ THE PACK IS AWAKE — 8 STAGES, ONE HUNT, ZERO OPINIONS
          </div>

          <h1 className="text-2xl sm:text-5xl font-arcade text-neon-green mb-5 leading-tight">
            PROOF,<br />
            <span className="text-neon-cyan">NOT OPINION.</span>
          </h1>

          <p className="text-[11px] sm:text-base text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Point the pack at an Anchor program. It finds the bug class, writes the exploit,
            <span className="text-neon-green"> runs it on a local validator — never mainnet —</span>
            and anchors the verdict on-chain. The audit you can verify yourself.
          </p>

          <div className="relative mb-8 sm:mb-10 border border-dark-600 pixel-border-glow overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero.jpg"
              alt="The cachorro — a wireframe guard dog in neon phosphor green, chained to a Solana program"
              className="w-full h-auto block"
              loading="eager"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent pointer-events-none" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch text-left">
            <div className="flex flex-col justify-center">
              <Suspense fallback={<div className="h-24" />}>
                <ScanInput />
              </Suspense>
            </div>
            <LiveFeedPreview />
          </div>
        </div>
      </section>

      {/* JOURNEY */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-green mb-6 sm:mb-8 text-center">
            [ THE HUNT, END TO END ]
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-dark-600">
            {JOURNEY.map((j, i) => (
              <div
                key={j.n}
                className={`p-4 sm:p-5 bg-dark-900 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-dark-600' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 flex items-center justify-center border border-neon-green text-neon-green font-arcade text-[10px]">
                    {j.n}
                  </span>
                  <span className="text-[10px] sm:text-xs font-arcade text-white">{j.t}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{j.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOUNTY BOARD — pick a target with money on it */}
      <BountyTeaser />

      {/* NARRATIVE — why now (the web3 story that wins) */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-red mb-6 sm:mb-8 text-center">
            [ EVERY AUDIT IS AN OPINION UNTIL PROVEN ]
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-dark-600">
            <div className="p-4 sm:p-6 bg-dark-900">
              <div className="text-xl sm:text-3xl font-bold text-neon-red mb-2">$285M</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed">
                drained from Drift in <span className="text-gray-300">128 seconds</span> — after the audit.
                The same bug classes keep paying because reports ship prose.
              </div>
            </div>
            <div className="p-4 sm:p-6 bg-dark-900 border-t sm:border-t-0 sm:border-l border-dark-600">
              <div className="text-xl sm:text-3xl font-bold text-neon-yellow mb-2">PoC REQUIRED</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed">
                Immunefi won&apos;t pay a bounty without a runnable exploit.
                The market already decided: <span className="text-gray-300">proof is the product.</span>
              </div>
            </div>
            <div className="p-4 sm:p-6 bg-dark-900 border-t sm:border-t-0 sm:border-l border-dark-600">
              <div className="text-xl sm:text-3xl font-bold text-neon-cyan mb-2">COMMODITY</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed">
                Detection is crowded — Sec3, Trident, CertiK. The gap nobody automates is
                <span className="text-gray-300"> proving it safely and attesting it trustlessly.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE GATE — proof, not opinion, made concrete */}
      <section id="gate" className="px-4 py-10 sm:py-14 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-green mb-2 text-center">
            [ NOTHING PROMOTES WITHOUT PROOF ]
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 text-center mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            A finding can&apos;t be voted in. The promotion gate demands a differential oracle
            verdict — treatment drains, control blocks — plus a clean-room reproduction.
            The machine enforces it, not the prompt.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-dark-600">
            {LADDER.map((s, i) => (
              <div key={s.t} className={`p-3 sm:p-4 bg-dark-900 ${i > 0 ? 'border-l border-dark-600' : ''} ${i > 1 ? 'max-sm:border-t max-sm:border-l-0' : ''} ${i === 3 ? 'max-sm:border-l' : ''}`}>
                <div className="text-[9px] sm:text-[10px] font-arcade text-neon-green mb-1.5">{s.t}</div>
                <div className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed">{s.d}</div>
                <div className="mt-2 text-[8px] font-mono text-neon-green">● ENFORCED</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-3 text-[9px] sm:text-[10px] text-gray-600 font-mono">
            oracle verdict on the last hunt: <span className="text-neon-green">SUPPORTS</span> — treatment drained
            5,000,000,000 lamports, control rejected with Custom(1)
          </div>
        </div>
      </section>

      {/* ATTESTATION — the moat */}
      <section id="receipt" className="px-4 py-10 sm:py-14 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div>
            <h2 className="text-xs sm:text-lg font-arcade text-neon-green mb-3">
              [ ON-CHAIN RECEIPT ]
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed mb-3">
              Every finished hunt anchors a SHA-256 digest of the report — bound to the audited
              commit, the build digest and the hash-chained evidence journal — as a Solana memo.
              Tamper with either side and the digests diverge.
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
              And the receipt knows when it&apos;s stale: the program upgrades, the digest stops
              matching, the attestation expires on its own.
            </p>
          </div>
          <div className="border border-dark-600 bg-dark-900 font-mono">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/receipt.jpg" alt="A holographic attestation scroll chained on-chain" className="w-full h-32 sm:h-40 object-cover object-center block" loading="lazy" />
            <div className="px-3 py-2 border-b border-t border-dark-600 bg-dark-800 flex items-center justify-between">
              <span className="text-[9px] font-arcade text-neon-cyan">ATTESTATION</span>
              <span className="text-[8px] text-gray-600">devnet</span>
            </div>
            <div className="p-3 space-y-1.5 text-[9px] sm:text-[10px]">
              <div className="flex justify-between gap-2"><span className="text-gray-600">memo</span><span className="text-neon-green break-all">cachorro:v1:24037a60…</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-600">journal_head</span><span className="text-gray-400">1a44a53f… → b94cbb55…</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-600">report_sha256</span><span className="text-gray-400">sha256:✓</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-600">verify</span><span className="text-neon-green">attest verify → PASS</span></div>
            </div>
            <div className="px-3 py-2 border-t border-dark-600 text-[8px] sm:text-[9px] text-gray-600 leading-relaxed">
              trivial for them to verify — hard for us to fake
            </div>
          </div>
        </div>
      </section>

      {/* WHAT THE PACK HUNTS */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-green mb-6 sm:mb-8 text-center">
            [ WHAT THE PACK HUNTS ]
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                t: 'ACCOUNTS & AUTHORITY',
                d: 'Missing signer/owner checks, account substitution, type confusion, remaining_accounts abuse, duplicate mutable accounts — the classes that empty a vault in one instruction.',
                c: 'text-neon-cyan',
              },
              {
                t: 'PDA · CPI · MATH',
                d: 'Seed collisions and init_if_needed reinit, unpinned program IDs on arbitrary CPI, introspection atomicity, share inflation, cast/rounding bugs, close & rent theft.',
                c: 'text-neon-yellow',
              },
              {
                t: 'ORACLE · TOKEN-2022 · ZK',
                d: 'Stale/manipulable price feeds, mint↔vault binding, transfer hooks — plus on-chain verifier soundness, nullifier double-spend and root validation for zk programs.',
                c: 'text-neon-purple',
              },
            ].map((x) => (
              <div key={x.t} className="border border-dark-600 bg-dark-900 p-4 sm:p-5">
                <div className={`text-[11px] sm:text-sm font-arcade mb-2 ${x.c}`}>{x.t}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LABS — learn by hunting */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-purple mb-2">
            [ LEARN BY HUNTING ]
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-6 font-mono max-w-2xl mx-auto leading-relaxed">
            11 labs · every Sealevel vulnerability class · vulnerable vs secure code side by side ·
            the real exploit it caused · and a button that sets the pack loose on it.
          </p>
          <a
            href="/labs"
            className="inline-block px-5 py-2.5 border border-neon-purple text-neon-purple font-arcade text-[9px] sm:text-[10px] hover:bg-neon-purple hover:text-black transition-all"
          >
            ENTER THE LABS ▸
          </a>
        </div>
      </section>

      {/* STATS — true numbers only */}
      <section className="px-4 py-8 sm:py-12 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { v: '8', l: 'Pipeline stages', s: 'FETCH → REPORT', c: 'text-neon-green' },
              { v: '18', l: 'Findings last hunt', s: 'DEVIL-TESTED', c: 'text-neon-cyan' },
              { v: '0', l: 'Mainnet txs', s: 'LOCAL VALIDATOR ONLY', c: 'text-neon-yellow' },
              { v: '1', l: 'Human in the loop', s: 'NOTHING AUTO-SUBMITTED', c: 'text-neon-purple' },
            ].map((t) => (
              <div key={t.l} className="border border-dark-600 bg-dark-900 p-4 text-center">
                <div className={`text-xl sm:text-3xl font-bold ${t.c}`}>{t.v}</div>
                <div className="text-[9px] sm:text-[10px] text-gray-600 mt-1">{t.l}</div>
                <div className={`text-[8px] sm:text-[9px] mt-1 ${t.c}`}>{t.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECENT HUNTS */}
      <section id="hunts" className="px-4 py-8 sm:py-12 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <RecentHunts />
        </div>
      </section>

      {/* RULES + HONEST LIMITS */}
      <section className="px-4 py-8 sm:py-12 border-t border-dark-600">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[11px] sm:text-sm font-arcade text-neon-red mb-3">[ RULES OF ENGAGEMENT ]</div>
            <ul className="text-[10px] sm:text-xs text-gray-500 space-y-1.5 leading-relaxed">
              <li>▸ Audit only what you are authorized to audit — an active bounty with a defined scope.</li>
              <li>▸ PoCs run on a local validator or a local fork. No attack transaction ever touches mainnet.</li>
              <li>▸ Nothing is submitted automatically. A human reproduces the bug and files it through the official channel.</li>
              <li>▸ Untrusted targets are cloned, never built — a third-party build.rs is arbitrary code execution.</li>
            </ul>
          </div>
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[11px] sm:text-sm font-arcade text-neon-yellow mb-3">[ WHAT ATTESTED MEANS ]</div>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed mb-3">
              <span className="text-neon-yellow">cachorro-attested</span> = this exact artifact was
              adversarially tested and here is the reproducible evidence, on-chain and revocable.
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
              It is <span className="text-gray-300">not</span> a proof the program is safe.
              Verified builds have been hacked twice. We narrow the gap — reproduced PoCs,
              negative controls, bytes-bound digests — and say so out loud.
            </p>
          </div>
        </div>
      </section>

      {/* HACKATHON NARRATIVE — built in the open */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-[9px] sm:text-[10px] font-mono text-neon-purple mb-3">
            COLOSSEUM · CRYPTO WORLD&apos;S FAIR · 2026
          </div>
          <h2 className="text-xs sm:text-lg font-arcade text-white mb-4 leading-relaxed">
            BUILT IN THE OPEN,<br />HUNTING IN THE WINDOW.
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed max-w-2xl mx-auto mb-4">
            This engine was assembled during the Colosseum window by a Brazilian team that took
            <span className="text-neon-green"> 1st place at the Oracle+Runflow hackathon</span> — the same
            pipeline we hunt bounties with, productized. No vaporware: the hunts on this page are
            real runs, the journal is hash-chained, and the receipt verifies without us.
          </p>
          <p className="text-[9px] sm:text-[10px] font-mono text-gray-600">
            Solana track · Trilha Brasil · honest limits over loud badges
          </p>
        </div>
      </section>

      {/* PRICING teaser */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-yellow mb-2">
            [ RUN WITH THE PACK ]
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 mb-6 font-mono max-w-2xl mx-auto leading-relaxed">
            Free hunts forever. Paid tiers unlock FULL mode, API keys and the watchlist —
            paid in SOL, verified on-chain. Your payment receipt is your account.
          </p>
          <a
            href="/pricing"
            className="inline-block px-5 py-2.5 border border-neon-yellow text-neon-yellow font-arcade text-[9px] sm:text-[10px] hover:bg-neon-yellow hover:text-black transition-all"
          >
            SEE PACK RANKS ▸
          </a>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600 text-center">
        <div className="text-sm sm:text-xl font-arcade text-neon-green mb-4">READY TO HUNT?</div>
        <a
          href="#hunt"
          className="inline-block px-6 py-3 border-2 border-neon-green text-neon-green font-arcade text-[10px] sm:text-xs hover:bg-neon-green hover:text-black transition-all"
        >
          UNLEASH THE PACK
        </a>
      </section>

      <footer className="px-4 py-8 border-t border-dark-600 text-center">
        <div className="text-[9px] sm:text-[10px] text-gray-700 font-mono">
          CACHORRO · Solana program auditor · proof, not opinion
        </div>
      </footer>
    </main>
  )
}

function BountyTeaser() {
  const idx = readBounties()
  const sol = solanaBounties(idx).slice(0, 6)
  if (!sol.length) return null
  const total = solanaBounties(idx).reduce((s, b) => s + (b.maxBounty || 0), 0)

  return (
    <section id="board" className="px-4 py-10 sm:py-14 border-t border-dark-600 scroll-mt-16">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xs sm:text-lg font-arcade text-neon-yellow mb-2 text-center">
          [ LIVE BOUNTY BOARD ]
        </h2>
        <p className="text-[10px] sm:text-xs text-gray-500 text-center mb-6 font-mono">
          {fmtUsd(total)} in active Solana bounties indexed — pick a target with money on it.
        </p>
        <div className="border border-dark-600 divide-y divide-dark-600">
          {sol.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-dark-900">
              <span className="text-[11px] sm:text-sm font-mono text-white flex-1 min-w-0 truncate">{b.project}</span>
              <span className="text-[8px] font-mono text-gray-600 uppercase shrink-0 hidden sm:inline">{b.source}</span>
              <span className="text-[10px] sm:text-xs font-mono text-neon-green w-16 text-right shrink-0">{fmtUsd(b.maxBounty)}</span>
              {b.repos[0] ? (
                <a
                  href={`/?target=${encodeURIComponent(b.repos[0])}#hunt`}
                  className="px-2 py-1 border border-neon-green/60 text-neon-green text-[8px] sm:text-[9px] font-mono hover:bg-neon-green hover:text-black transition-all shrink-0"
                >
                  HUNT ▸
                </a>
              ) : (
                <a href={b.url} target="_blank" rel="noreferrer" className="px-2 py-1 border border-dark-600 text-gray-500 text-[8px] sm:text-[9px] font-mono hover:text-neon-cyan shrink-0">
                  SCOPE ↗
                </a>
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <a href="/bounties" className="text-[9px] sm:text-[10px] font-mono text-neon-cyan hover:text-neon-green transition-colors">
            ▸ full board — {idx.bounties.length} programs indexed ↗
          </a>
        </div>
      </div>
    </section>
  )
}
