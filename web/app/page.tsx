import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import ScanInput from '@/components/ScanInput'
import RecentHunts from '@/components/RecentHunts'
import LiveFeedPreview from '@/components/LiveFeedPreview'
import { readBounties, solanaBounties } from '@/lib/bounties'
import { listRuns } from '@/lib/cachorro'
import { fmtUsd } from '@/lib/format'

export const dynamic = 'force-dynamic'

const JOURNEY = [
  {
    cmd: 'cachorro hunt <target>',
    t: 'PASTE A TARGET',
    d: 'A GitHub repo or an on-chain program ID. Fetch and static lint run in seconds — no wallet, no signup.',
    meta: 'fetch 5s · static 7s',
  },
  {
    cmd: 'pack --stages research..review',
    t: 'WATCH THE PACK THINK',
    d: 'RESEARCH → ANALYZE → DEVIL → POC → REVIEW. Every hypothesis, dead-end and verdict streams live — you watch the reasoning, not a spinner.',
    meta: 'reasoning, not a spinner',
  },
  {
    cmd: 'attest verify <sha256>',
    t: 'VERIFY THE RECEIPT',
    d: 'Findings ship with an executable PoC (treatment drains, control blocks) and an on-chain attestation anchored to the exact bytes tested.',
    meta: 'anchored on-chain · revocable',
  },
]

const LADDER = [
  { t: 'OBSERVATION', d: 'static lint + on-chain dump become typed graph nodes' },
  { t: 'HYPOTHESIS', d: 'each candidate carries a falsifier — what would disprove it' },
  { t: 'EXPERIMENT', d: 'treatment vs negative control on a local validator' },
  { t: 'VERIFIED', d: 'the gate refuses promotion without oracle SUPPORTS + reproduction' },
]

export default function Home() {
  const idx = readBounties()
  const nHunts = listRuns(50).length

  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      {/* ═══ HERO — the product is usable in the first viewport ═══ */}
      <section id="hunt" className="relative px-4 pt-10 pb-12 sm:pt-16 sm:pb-16 scroll-mt-16 overflow-hidden">
        <div className="synth-grid" />
        <div className="synth-sun absolute right-[4%] top-2 w-36 h-36 sm:w-60 sm:h-60 opacity-50 pointer-events-none hidden sm:block" />
        <div className="max-w-6xl mx-auto relative">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div className="text-[9px] sm:text-xs text-neon-green animate-blink neon-flicker font-mono">
              ▶ THE PACK IS AWAKE — 8 STAGES, ONE HUNT, ZERO OPINIONS
            </div>
            <div className="text-[8px] sm:text-[9px] font-mono text-gray-700">
              COLOSSEUM · CRYPTO WORLD'S FAIR '26
            </div>
          </div>

          <h1 className="font-arcade leading-[1.05] mb-4 sm:mb-6">
            <span className="block text-4xl sm:text-6xl lg:text-7xl text-neon-green chroma">PROOF,</span>
            <span className="block text-4xl sm:text-6xl lg:text-7xl vapor-text chroma">NOT OPINION.</span>
          </h1>

          <p className="text-[11px] sm:text-sm text-gray-400 mb-8 max-w-xl leading-relaxed">
            Point the pack at an Anchor program. It finds the bug class, writes the exploit,
            <span className="text-neon-green"> runs it on a local validator — never mainnet —</span>
            and anchors the verdict on-chain. The audit you can verify yourself.
          </p>

          {/* the console: screen on top, prompt at the bottom edge */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-stretch">
            <div className="border border-dark-600 pixel-border-glow bg-dark-900/40 flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-dark-600 bg-dark-800">
                <span className="w-2 h-2 rounded-full bg-neon-red/70" />
                <span className="w-2 h-2 rounded-full bg-neon-yellow/70" />
                <span className="w-2 h-2 rounded-full bg-neon-green/70" />
                <span className="ml-2 text-[8px] font-mono text-gray-600">cachorro — the pack terminal</span>
              </div>
              <div className="relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hero.jpg"
                  alt="The cachorro — a wireframe guard dog in neon phosphor green, chained to a Solana program"
                  className="w-full h-auto block"
                  loading="eager"
                />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
              </div>
              <div className="border-t border-dark-600 bg-black/70 p-3 sm:p-4">
                <div className="text-[8px] font-mono text-gray-600 mb-2">$ unleash &lt;target&gt;</div>
                <Suspense fallback={<div className="h-24" />}>
                  <ScanInput />
                </Suspense>
              </div>
            </div>
            <LiveFeedPreview />
          </div>
        </div>
      </section>

      {/* ═══ TICKER — one line, not a section ═══ */}
      <div className="border-y border-dark-600 bg-dark-900/60 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4 sm:gap-6 text-[8px] sm:text-[9px] font-mono text-gray-500 whitespace-nowrap overflow-x-auto">
          <span><span className="text-neon-yellow">{fmtUsd(solanaBounties(idx).reduce((s, b) => s + (b.maxBounty || 0), 0))}</span> on the board</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-white">{idx.bounties.length}</span> programs indexed</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-cyan">{nHunts}</span> hunts logged</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-green">0</span> mainnet txs — local validator only</span>
          <span className="text-dark-600">|</span>
          <span>journal: <span className="text-neon-purple">hash-chained</span></span>
        </div>
      </div>

      {/* ═══ BOARD — money first: pick a target that pays ═══ */}
      <BountyTeaser />

      {/* ═══ THE HUNT — a terminal timeline, not three cards ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-8">
            <span className="text-neon-green font-arcade text-[10px]">~/</span>
            <h2 className="text-xs sm:text-base font-arcade text-white">THE HUNT, END TO END</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[8px] font-mono text-gray-600">~40min — 2.5h</span>
          </div>
          <div>
            {JOURNEY.map((j, i) => (
              <div key={j.t} className="flex gap-4 sm:gap-6">
                <div className="flex flex-col items-center shrink-0 w-5">
                  <span className={`w-5 h-5 flex items-center justify-center border font-arcade text-[9px] bg-black ${['border-neon-green text-neon-green', 'border-miami-sky text-miami-sky', 'border-miami-pink text-miami-pink'][i % 3]}`}>
                    {i + 1}
                  </span>
                  {i < JOURNEY.length - 1 && <span className="w-px flex-1 bg-gradient-to-b from-neon-green/60 to-dark-600" />}
                </div>
                <div className={i < JOURNEY.length - 1 ? 'pb-8' : ''}>
                  <div className="text-[8px] sm:text-[9px] font-mono text-gray-600 mb-1">$ {j.cmd}</div>
                  <div className="text-[11px] sm:text-sm font-arcade text-white mb-1.5">{j.t}</div>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed max-w-xl">{j.d}</p>
                  <div className="mt-1.5 text-[8px] font-mono text-neon-green/70">{j.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE GATE — the argument, once, loud ═══ */}
      <div className="vapor-strip" />
      <section id="gate" className="scroll-mt-16">
        <div className="px-4 pt-12 sm:pt-16 pb-8 text-center">
          <div className="text-5xl sm:text-8xl font-bold font-arcade text-neon-red leading-none chroma neon-flicker">$285M</div>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-3 max-w-xl mx-auto leading-relaxed">
            drained from Drift in <span className="text-gray-200">128 seconds</span> — after the audit.
            Reports ship prose; Immunefi won't pay without a runnable exploit.
            Detection is commodity. <span className="text-neon-green">Proof is the product.</span>
          </p>
        </div>
        <div className="px-4 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-[9px] sm:text-[10px] font-mono text-gray-600 text-center mb-5">
              nothing promotes without proof — the gate is enforced by the machine, not the prompt
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-dark-600 border border-dark-600">
              {LADDER.map((s) => (
                <div key={s.t} className="p-3 sm:p-4 bg-dark-900">
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
        </div>
      </section>


      {/* ═══ THE INVOICE — audit-price anchoring, the startup case ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">WHAT A $150K AUDIT SHIPS</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[8px] font-mono text-gray-600">vs what the pack ships</span>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 font-mono mb-6 max-w-2xl leading-relaxed">
            For protocol teams about to wire six figures to an audit firm — and for the hunter
            who knows Immunefi pays for exploits, not prose.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-dark-600 border border-dark-600">
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[9px] sm:text-[10px] font-arcade text-neon-red mb-3">THE FIRM</div>
              <ul className="space-y-2 text-[10px] sm:text-xs text-gray-500 leading-relaxed">
                <li><span className="text-miami-pink">✗</span> 8–16 week queue while your TVL sits exposed</li>
                <li><span className="text-miami-pink">✗</span> a PDF where most &ldquo;findings&rdquo; are informational noise</li>
                <li><span className="text-miami-pink">✗</span> you pay for triage — they never prove a thing executes</li>
                <li><span className="text-miami-pink">✗</span> expires silently the day you ship an upgrade</li>
              </ul>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[9px] sm:text-[10px] font-arcade text-neon-green mb-3">THE PACK</div>
              <ul className="space-y-2 text-[10px] sm:text-xs text-gray-400 leading-relaxed">
                <li><span className="text-neon-green">✓</span> hours, not months — you watch the hunt live</li>
                <li><span className="text-neon-green">✓</span> executable PoCs — treatment drains, control blocks</li>
                <li><span className="text-neon-green">✓</span> machine-enforced gate: no proof, no finding</li>
                <li><span className="text-neon-green">✓</span> a receipt on-chain that expires when your program does</li>
              </ul>
            </div>
          </div>
          <div className="text-center mt-4">
            <a href="/pricing" className="text-[9px] sm:text-[10px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              ▸ engagement pricing — SOL-native, verified on-chain ↗
            </a>
          </div>
        </div>
      </section>

      {/* ═══ RECEIPT — the moat ═══ */}
      <div className="vapor-strip" />
      <section id="receipt" className="px-4 py-12 sm:py-16 scroll-mt-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div>
            <h2 className="text-xs sm:text-base font-arcade text-neon-green mb-3">
              THE RECEIPT LIVES ON-CHAIN
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed mb-3">
              Every finished hunt anchors a SHA-256 digest of the report — bound to the audited
              commit, the build digest and the hash-chained evidence journal — as a Solana memo.
              Tamper with either side and the digests diverge.
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed mb-4">
              And the receipt knows when it&apos;s stale: the program upgrades, the digest stops
              matching, the attestation expires on its own.
            </p>
            <a href="/verify" className="text-[9px] sm:text-[10px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              ▸ verify a receipt yourself — no trust in us required ↗
            </a>
          </div>
          <div className="holo-frame font-mono">
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
              <div className="flex justify-between gap-2"><span className="text-gray-600">verify</span><span className="text-neon-green">recomputed → MATCH</span></div>
            </div>
            <div className="px-3 py-2 border-t border-dark-600 text-[8px] sm:text-[9px] text-gray-600 leading-relaxed">
              trivial for them to verify — hard for us to fake
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ARSENAL — what the pack hunts ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">WHAT THE PACK HUNTS</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[8px] font-mono text-gray-600 hidden sm:inline">vuln atlas · 3 tiers · real exploits as reference</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
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
              <div key={x.t} className="bg-dark-900 p-4 sm:p-5">
                <div className={`text-[10px] sm:text-xs font-arcade mb-2 ${x.c}`}>{x.t}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LABS — split banner ═══ */}
      <section className="border-t border-dark-600">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
          <div className="flex-1">
            <h2 className="text-xs sm:text-base font-arcade text-neon-purple mb-1.5">LEARN BY HUNTING</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 font-mono leading-relaxed">
              17 lessons &amp; labs · every Sealevel vulnerability class · vulnerable vs secure side by side ·
              the real exploit it caused · a button that sets the pack loose on it.
            </p>
          </div>
          <a
            href="/labs"
            className="px-5 py-2.5 border border-neon-purple text-neon-purple font-arcade text-[9px] sm:text-[10px] hover:bg-neon-purple hover:text-black transition-all shrink-0"
          >
            ENTER THE LABS ▸
          </a>
        </div>
      </section>

      {/* ═══ FIELD LOG — evidence ═══ */}
      <section id="hunts" className="px-4 py-12 sm:py-16 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">FIELD LOG</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[8px] font-mono text-gray-600">every row is a real run</span>
          </div>
          <RecentHunts />
        </div>
      </section>

      {/* ═══ HONEST FOOTER — rules + limits, then the close ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[10px] sm:text-xs font-arcade text-neon-red mb-3">RULES OF ENGAGEMENT</div>
            <ul className="text-[10px] sm:text-xs text-gray-500 space-y-1.5 leading-relaxed">
              <li>▸ Audit only what you are authorized to audit — an active bounty with a defined scope.</li>
              <li>▸ PoCs run on a local validator or a local fork. No attack transaction ever touches mainnet.</li>
              <li>▸ Nothing is submitted automatically. A human reproduces the bug and files it through the official channel.</li>
              <li>▸ Untrusted targets are cloned, never built — a third-party build.rs is arbitrary code execution.</li>
            </ul>
          </div>
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[10px] sm:text-xs font-arcade text-neon-yellow mb-3">WHAT ATTESTED MEANS</div>
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

      {/* ═══ CLOSE — one ask ═══ */}
      <div className="vapor-strip" />
      <section className="px-4 py-14 sm:py-20 text-center relative overflow-hidden">
        <div className="synth-sun absolute left-1/2 -translate-x-1/2 bottom-[-40%] w-72 h-72 sm:w-96 sm:h-96 opacity-40 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-lg sm:text-3xl font-arcade text-neon-green mb-3 chroma">READY TO HUNT?</div>
          <p className="text-[10px] sm:text-xs text-gray-500 font-mono mb-6 max-w-lg mx-auto leading-relaxed">
            Recon hunts are free forever. Engagements price against the audit you didn&apos;t buy —
            paid in SOL, verified on-chain. Your payment receipt is your account.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#hunt"
              className="px-6 py-3 border-2 border-neon-green text-neon-green font-arcade text-[10px] sm:text-xs hover:bg-neon-green hover:text-black transition-all"
            >
              UNLEASH THE PACK
            </a>
            <a href="/pricing" className="text-[9px] sm:text-[10px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              engagement pricing ↗
            </a>
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 border-t border-dark-600">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] sm:text-[10px] font-mono text-gray-700">
          <span>CACHORRO · Solana program auditor · proof, not opinion</span>
          <span>built in the open during Colosseum · Solana track</span>
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
    <section id="board" className="px-4 py-12 sm:py-16 border-t border-dark-600 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">MONEY ON THE TABLE</h2>
          <span className="flex-1 border-b border-dashed border-dark-600" />
          <span className="text-[8px] sm:text-[9px] font-mono text-neon-yellow shrink-0">
            {fmtUsd(total)} in active Solana bounties
          </span>
        </div>
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
        <div className="mt-4">
          <a href="/bounties" className="text-[9px] sm:text-[10px] font-mono text-neon-cyan hover:text-neon-green transition-colors">
            ▸ full board — {idx.bounties.length} programs indexed ↗
          </a>
        </div>
      </div>
    </section>
  )
}
