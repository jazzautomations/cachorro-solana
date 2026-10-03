import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import ScanInput from '@/components/ScanInput'
import RecentHunts from '@/components/RecentHunts'
import LiveFeedPreview from '@/components/LiveFeedPreview'
import { listRuns, readStatus } from '@/lib/cachorro'
import fs from 'node:fs'
import path from 'node:path'
import { runDir } from '@/lib/cachorro'

export const dynamic = 'force-dynamic'

const JOURNEY = [
  {
    cmd: 'cachorro hunt <your-program>',
    t: 'POINT AT YOUR PROGRAM',
    d: 'Your contract, wallet or protocol — GitHub repo or on-chain program ID. Fetch and static lint run in seconds — no wallet, no signup, no sales call.',
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

const RECEIPTS_DIR = path.resolve(process.cwd(), '..', 'attest', 'receipts')

function anchoredCount(): number {
  try {
    return fs.readdirSync(RECEIPTS_DIR).filter((f) => {
      try { return !!JSON.parse(fs.readFileSync(path.join(RECEIPTS_DIR, f), 'utf8')).signature }
      catch { return false }
    }).length
  } catch { return 0 }
}

// aggregate honesty scoreboard — the refusal rate IS the brand
function scoreboard() {
  let verde = 0, vermelho = 0
  for (const r of listRuns(50)) {
    const st = readStatus(r.id)
    if (!st?.reportFile) continue
    try {
      const md = fs.readFileSync(path.join(runDir(r.id), st.reportFile), 'utf8')
      verde += (md.match(/VERDE/g) || []).length
      vermelho += (md.match(/VERMELHO/g) || []).length
    } catch { /* missing file */ }
  }
  return { verde, vermelho }
}

export default function Home() {
  const nHunts = listRuns(50).length
  const sb = scoreboard()
  const nAnchored = anchoredCount()

  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      {/* ═══ HERO — the product is usable in the first viewport ═══ */}
      <section id="hunt" className="relative px-4 pt-10 pb-12 sm:pt-16 sm:pb-16 scroll-mt-16 overflow-hidden">
        <div className="synth-grid" />
        <div className="synth-sun absolute right-[4%] top-2 w-36 h-36 sm:w-60 sm:h-60 opacity-50 pointer-events-none hidden sm:block" />
        <div className="max-w-6xl mx-auto relative">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div className="text-[10.5px] sm:text-[13px] text-neon-green animate-blink neon-flicker font-mono">
              ▶ THE PACK IS AWAKE — AGENTS ARE ALREADY HUNTING YOU
            </div>
            <div className="text-[11.5px] sm:text-[10.5px] font-mono text-gray-600">
              COLOSSEUM · CRYPTO WORLD'S FAIR '26
            </div>
          </div>

          <h1 className="font-arcade leading-[1.05] mb-4 sm:mb-6">
            <span className="block text-[1.55rem] xs:text-[1.8rem] sm:text-6xl lg:text-7xl text-neon-green chroma">PROOF,</span>
            <span className="block text-[1.55rem] xs:text-[1.8rem] sm:text-6xl lg:text-7xl vapor-text chroma whitespace-nowrap">NOT&nbsp;OPINION.</span>
          </h1>

          <p className="text-[11px] sm:text-sm text-gray-400 mb-8 max-w-xl leading-relaxed">
            AI made offense cheap — autonomous agents are already reading your code.
            Someone&apos;s pack will find your bug. Ours runs first: repo, site, or program id —
            Solana, EVM, or the web2↔web3 wiring — it finds the bug class, writes the exploit,
            <span className="text-neon-green"> runs it on a local validator — never mainnet —</span>
            and anchors the verdict on-chain. Born at the Colosseum Crypto World&apos;s Fair —
            the pack that hunts this cohort&apos;s code. Proof, not opinion.
          </p>

          {/* the console: screen on top, prompt at the bottom edge */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-stretch">
            <div className="border border-dark-600 pixel-border-glow bg-dark-900/40 flex flex-col">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-dark-600 bg-dark-800">
                <span className="w-2 h-2 rounded-full bg-neon-red/70" />
                <span className="w-2 h-2 rounded-full bg-neon-yellow/70" />
                <span className="w-2 h-2 rounded-full bg-neon-green/70" />
                <span className="ml-2 text-[11.5px] font-mono text-gray-500">cachorro — the pack terminal</span>
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
                <div className="text-[11.5px] font-mono text-gray-500 mb-2">$ unleash &lt;target&gt;</div>
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
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4 sm:gap-6 text-[11.5px] sm:text-[10.5px] font-mono text-gray-400 whitespace-nowrap overflow-x-auto">
          <span><span className="text-neon-yellow">open season</span> — free QUICK hunts for the cohort until Oct 12</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-white">repo · site · program id</span> — one input, all stacks</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-yellow">owner-claimed</span> hunts earn the doberman seal</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-cyan">{nHunts}</span> hunts logged</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-green">{sb.verde}</span> proven · <span className="text-miami-pink">{sb.vermelho}</span> refuted by gate · <span className="text-white">0</span> false positives shipped</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-cyan">{nAnchored}</span> receipts anchored on devnet</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-green">0</span> mainnet txs — local validator only</span>
          <span className="text-dark-600">|</span>
          <span>journal: <span className="text-neon-purple">hash-chained</span></span>
        </div>
      </div>

      {/* ═══ THE HUNT — a terminal timeline, not three cards ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-8">
            <span className="text-neon-green font-arcade text-[11.5px]">~/</span>
            <h2 className="text-xs sm:text-base font-arcade text-white">THE HUNT, END TO END</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[11.5px] font-mono text-gray-500">~40min — 2.5h</span>
          </div>
          <div>
            {JOURNEY.map((j, i) => (
              <div key={j.t} className="flex gap-4 sm:gap-6">
                <div className="flex flex-col items-center shrink-0 w-5">
                  <span className={`w-5 h-5 flex items-center justify-center border font-arcade text-[10.5px] bg-black ${['border-neon-green text-neon-green', 'border-miami-sky text-miami-sky', 'border-miami-pink text-miami-pink'][i % 3]}`}>
                    {i + 1}
                  </span>
                  {i < JOURNEY.length - 1 && <span className="w-px flex-1 bg-gradient-to-b from-neon-green/60 to-dark-600" />}
                </div>
                <div className={i < JOURNEY.length - 1 ? 'pb-8' : ''}>
                  <div className="text-[11.5px] sm:text-[10.5px] font-mono text-gray-500 mb-1">$ {j.cmd}</div>
                  <div className="text-[11px] sm:text-sm font-arcade text-white mb-1.5">{j.t}</div>
                  <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed max-w-xl">{j.d}</p>
                  <div className="mt-1.5 text-[11.5px] font-mono text-neon-green/70">{j.meta}</div>
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
          <p className="text-[11.5px] sm:text-[13px] text-gray-400 mt-3 max-w-xl mx-auto leading-relaxed">
            drained from Drift in <span className="text-gray-200">128 seconds</span> — after the audit.
            Reports ship prose; Immunefi won't pay without a runnable exploit.
            Detection is commodity. <span className="text-neon-green">Proof is the product.</span>
          </p>
        </div>
        <div className="px-4 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="text-[10.5px] sm:text-[11.5px] font-mono text-gray-500 text-center mb-5">
              nothing promotes without proof — the gate is enforced by the machine, not the prompt
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-dark-600 border border-dark-600">
              {LADDER.map((s) => (
                <div key={s.t} className="p-3 sm:p-4 bg-dark-900">
                  <div className="text-[10.5px] sm:text-[11.5px] font-arcade text-neon-green mb-1.5">{s.t}</div>
                  <div className="text-[10.5px] sm:text-[11.5px] text-gray-400 leading-relaxed">{s.d}</div>
                  <div className="mt-2 text-[11.5px] font-mono text-neon-green">● ENFORCED</div>
                </div>
              ))}
            </div>
            <div className="text-center mt-3 text-[10.5px] sm:text-[11.5px] text-gray-500 font-mono">
              oracle verdict on the last hunt: <span className="text-neon-green">SUPPORTS</span> — treatment drained
              5,000,000,000 lamports, control rejected with Custom(1)
            </div>
          </div>
        </div>
      </section>



      {/* ═══ THE PROOF STACK — probabilistic recalls, calibrated weighs, machine decides ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">THE PROOF STACK</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[10.5px] sm:text-[11.5px] font-mono text-miami-purple shrink-0">probabilistic → calibrated → deterministic</span>
          </div>
          <p className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 mb-6 leading-relaxed max-w-2xl">
            Probabilistic models hallucinate bugs — false positives. Statistical scanners sleep through them — false negatives.
            The pack uses each where it wins:
          </p>
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
            <div className="hidden sm:flex absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-6 items-center justify-center text-miami-rose font-arcade text-sm" style={{left:"33.333%"}}>→</div>
            <div className="hidden sm:flex absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-6 items-center justify-center text-neon-green font-arcade text-sm" style={{left:"66.666%"}}>→</div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[10.5px] font-arcade text-miami-rose mb-1.5">PROPOSE</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-300 mb-2">the model hunts</div>
              <div className="text-[10.5px] sm:text-[11.5px] text-gray-400 leading-relaxed">
                Research + analysis fan out for <span className="text-gray-300">recall</span> — semgrep sets the coverage floor,
                the model reads what patterns miss. It may be wrong; that&apos;s allowed here.
              </div>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5 border-x border-dark-600/60">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-1.5">WEIGH</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-300 mb-2">the judge calibrates</div>
              <div className="text-[10.5px] sm:text-[11.5px] text-gray-400 leading-relaxed">
                Every promoted claim gets a typed exploit-plausibility score from a System One judge —
                <span className="text-gray-300"> a probability, not prose</span>. Dissent shows on the certificate.
              </div>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[10.5px] font-arcade text-neon-green mb-1.5">PROVE</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-300 mb-2">the machine disposes</div>
              <div className="text-[10.5px] sm:text-[11.5px] text-gray-400 leading-relaxed">
                Nothing ships without oracle verdict + reproduction on a local validator — treatment drains, control blocks.
                <span className="text-gray-300"> The gate is code, not a prompt.</span>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-[10.5px] sm:text-[11.5px] font-mono text-gray-500 leading-relaxed">
            then the pack audits itself: <span className="text-neon-cyan">self-audit tripwires</span> catch bias —
            promotion without proof, suspiciously-easy verification, confirmation collapse —
            and <span className="text-neon-cyan">atlas coverage</span> reports which vuln classes were actually exercised.
            flags become part of the receipt&apos;s journal.
          </div>
        </div>
      </section>

      {/* ═══ THE INVOICE — audit-price anchoring, the startup case ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-2">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">WHAT A $150K AUDIT SHIPS</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[11.5px] font-mono text-gray-500">vs what the pack ships</span>
          </div>
          <p className="text-[11.5px] sm:text-[13px] text-gray-400 font-mono mb-6 max-w-2xl leading-relaxed">
            For protocol teams about to wire five figures for a PDF — contracts, wallets, protocols. And for every team that already knows Immunefi pays for
            exploits, not prose.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-dark-600 border border-dark-600">
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[10.5px] sm:text-[11.5px] font-arcade text-neon-red mb-3">THE FIRM</div>
              <ul className="space-y-2 text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
                <li><span className="text-miami-pink">✗</span> 8–16 week queue while your TVL sits exposed</li>
                <li><span className="text-miami-pink">✗</span> a PDF where most &ldquo;findings&rdquo; are informational noise</li>
                <li><span className="text-miami-pink">✗</span> you pay for triage — they never prove a thing executes</li>
                <li><span className="text-miami-pink">✗</span> expires silently the day you ship an upgrade</li>
              </ul>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[10.5px] sm:text-[11.5px] font-arcade text-neon-green mb-3">THE PACK</div>
              <ul className="space-y-2 text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
                <li><span className="text-neon-green">✓</span> hours, not months — you watch the hunt live</li>
                <li><span className="text-neon-green">✓</span> executable PoCs — treatment drains, control blocks</li>
                <li><span className="text-neon-green">✓</span> machine-enforced gate: no proof, no finding</li>
                <li><span className="text-neon-green">✓</span> a receipt on-chain that expires when your program does</li>
              </ul>
            </div>
          </div>
          <div className="text-center mt-4">
            <a href="/pricing" className="text-[10.5px] sm:text-[11.5px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
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
            <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed mb-3">
              Every finished hunt anchors a SHA-256 digest of the report — bound to the audited
              commit, the build digest and the hash-chained evidence journal — as a Solana memo.
              Tamper with either side and the digests diverge.
            </p>
            <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed mb-4">
              And the receipt knows when it&apos;s stale: the program upgrades, the digest stops
              matching, the attestation expires on its own.
            </p>
            <a href="/verify" className="text-[10.5px] sm:text-[11.5px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              ▸ verify a receipt yourself — no trust in us required ↗
            </a>
          </div>
          <div className="holo-frame font-mono">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/receipt.jpg" alt="A holographic attestation scroll chained on-chain" className="w-full h-32 sm:h-40 object-cover object-center block" loading="lazy" />
            <div className="px-3 py-2 border-b border-t border-dark-600 bg-dark-800 flex items-center justify-between">
              <span className="text-[10.5px] font-arcade text-neon-cyan">ATTESTATION</span>
              <span className="text-[11.5px] text-gray-500">devnet</span>
            </div>
            <div className="p-3 space-y-1.5 text-[10.5px] sm:text-[11.5px]">
              <div className="flex justify-between gap-2"><span className="text-gray-500">memo</span><span className="text-neon-green break-all">cachorro:v1:3987b6c4…</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-500">tx</span><span className="text-neon-cyan break-all">5QnooNTuvmjZ… ↗</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-500">recomputed</span><span className="text-neon-green">digest ✓ matches</span></div>
              <div className="flex justify-between gap-2"><span className="text-gray-500">verify</span><span className="text-neon-green">recomputed → MATCH</span></div>
            </div>
            <div className="px-3 py-2 border-t border-dark-600 text-[11.5px] sm:text-[10.5px] text-gray-500 leading-relaxed">
              trivial for your users to verify — hard for anyone to fake
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
            <span className="text-[11.5px] font-mono text-gray-500 hidden sm:inline">vuln atlas · 3 tiers · real exploits as reference</span>
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
                <div className={`text-[11.5px] sm:text-[13px] font-arcade mb-2 ${x.c}`}>{x.t}</div>
                <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FULL SURFACE — web2↔web3 + business logic ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">BEYOND THE PROGRAM</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[11.5px] font-mono text-gray-500 hidden sm:inline">where the real exploits live</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[11.5px] sm:text-[13px] font-arcade mb-2 text-neon-cyan">BUSINESS LOGIC</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
                The pack reasons about economic intent, not just patterns: who can move whose money,
                which invariant a vault actually relies on, what breaks when a keeper is honest-but-late.
                Share inflation, donation attacks, fee redirection — the bugs that are legal Rust and fatal economics.
              </div>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[11.5px] sm:text-[13px] font-arcade mb-2 text-neon-yellow">WEB2↔WEB3 BRIDGE</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
                SwissBorg lost 1M through an API-side authority reassignment no scanner saw. We map the
                off-chain trust surface — keeper keys, oracle wiring, admin ops, signing backends — and trace
                where an off-chain compromise becomes an on-chain drain.
              </div>
            </div>
            <div className="bg-dark-900 p-4 sm:p-5">
              <div className="text-[11.5px] sm:text-[13px] font-arcade mb-2 text-neon-green">HONEST CONFIDENCE</div>
              <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
                <span className="text-neon-green">VERDE</span> = exploit executed on a validator.
                <span className="text-neon-yellow"> AMARELO</span> = structural evidence across a boundary we can&apos;t
                fully execute locally. <span className="text-gray-400">detected-not-proven</span> = toolchain said no.
                Every report ships a coverage map — what was exercised, not just what was found.
              </div>
            </div>
          </div>
          <div className="mt-4 text-[10.5px] sm:text-[11.5px] font-mono text-gray-500 text-center">
            built for Solana startups: run us before the 50K audit, after every upgrade, and on the bridges between
          </div>
        </div>
      </section>

      {/* ═══ THE SEAL — claim your repo, wear the badge ═══ */}
      <section className="border-t border-dark-600">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="text-xs sm:text-base font-arcade text-neon-purple shrink-0">THE DOBERMAN SEAL</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[11.5px] font-mono text-gray-500">proof you can put in your README</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
            {[
              { n: '1', t: 'CLAIM', d: 'POST /api/claim/repo — commit the nonce we give you as CACHORRO.md. Now the pack knows it\'s yours.' },
              { n: '2', t: 'HUNT', d: 'Drop your repo in the terminal above. The pack hunts it end to end — programs, wiring, business logic.' },
              { n: '3', t: 'WEAR IT', d: 'Your report gets a public URL, an on-chain receipt, and an embeddable SVG badge. Verified-owner hunts show your name.' },
            ].map((x) => (
              <div key={x.n} className="bg-dark-900 p-4 sm:p-5">
                <div className="text-neon-purple font-arcade text-lg mb-1">{x.n}</div>
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-white mb-2">{x.t}</div>
                <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FIELD LOG — evidence ═══ */}
            {/* ═══ THE GAP — competitive honesty ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="text-[10.5px] sm:text-[11.5px] font-arcade text-gray-500 tracking-widest mb-6">WHY ANOTHER LAYER</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
            <div className="bg-dark-900 p-5">
              <div className="text-[11.5px] font-mono text-gray-500 mb-2">AUDIT FIRM</div>
              <div className="text-sm font-mono text-white mb-2">$20K–$150K · 4–8 week wait</div>
              <div className="text-[11.5px] font-mono text-gray-400 leading-relaxed">Expert humans, point-in-time, one commit. The report expires the day you merge again. Zellic missed Wasabi; Neodyme audited Wormhole before $326M.</div>
            </div>
            <div className="bg-dark-900 p-5">
              <div className="text-[11.5px] font-mono text-gray-500 mb-2">STATIC SCANNER</div>
              <div className="text-sm font-mono text-white mb-2">cheap · instant · noisy</div>
              <div className="text-[11.5px] font-mono text-gray-400 leading-relaxed">Pattern-matching ships false-positive piles. The fourth alert is real — but you've learned to skim by the third.</div>
            </div>
            <div className="bg-dark-900 p-5 border-2 border-neon-green/50">
              <div className="text-[11.5px] font-mono text-neon-green mb-2">CACHORRO</div>
              <div className="text-sm font-mono text-white mb-2">the layer between audits</div>
              <div className="text-[11.5px] font-mono text-gray-400 leading-relaxed">Every claim must reproduce the exploit on a validator — treatment vs control — then the verdict anchors on-chain as a receipt anyone can verify. Maybes die at the gate; you get proofs or nothing.</div>
            </div>
          </div>
          <div className="mt-4 text-[10.5px] sm:text-[11.5px] font-mono text-gray-500 text-center">
            we don't replace auditors — we make their work verifiable, and catch what slips between engagements
          </div>
        </div>
      </section>

<section id="hunts" className="px-4 py-12 sm:py-16 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">FIELD LOG</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
            <span className="text-[11.5px] font-mono text-gray-500">every row is a real run</span>
          </div>
                    <div className="mb-6 border border-neon-green/40 bg-dark-900 p-4 sm:p-5">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-[10.5px] font-arcade text-neon-green">REPLAYED EXPLOIT</span>
              <span className="flex-1 border-b border-dashed border-dark-600" />
              <span className="text-[11.5px] font-mono text-gray-500">validation — not vibes</span>
            </div>
            <div className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 leading-relaxed">
              Blind replay of the <span className="text-white">$52M Cashio exploit</span> (Mar 2022): the pack
              re-found <span className="text-neon-green">CRITICAL · infinite-mint</span> on the pre-patch commit —
              <span className="text-neon-green">PoC-verified</span> on a mainnet fork — and the exploit got
              <span className="text-neon-cyan"> blocked</span> on the patched commit. Treatment vs control on a real exploit.
            </div>
          </div>
<RecentHunts />
        </div>
      </section>

      {/* ═══ HONEST FOOTER — rules + limits, then the close ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[11.5px] sm:text-[13px] font-arcade text-neon-red mb-3">RULES OF ENGAGEMENT</div>
            <ul className="text-[11.5px] sm:text-[13px] text-gray-400 space-y-1.5 leading-relaxed">
              <li>▸ Audit only what you are authorized to audit — your own repo, or a program whose owner claims it. Anonymous hunts hit the allowlist, not random strangers.</li>
              <li>▸ PoCs run on a local validator or a local fork. No attack transaction ever touches mainnet.</li>
              <li>▸ Nothing is submitted automatically. A human reproduces the bug and files it through the official channel.</li>
              <li>▸ Untrusted targets are cloned, never built — a third-party build.rs is arbitrary code execution.</li>
            </ul>
          </div>
          <div className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
            <div className="text-[11.5px] sm:text-[13px] font-arcade text-neon-yellow mb-3">WHAT ATTESTED MEANS</div>
            <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed mb-3">
              <span className="text-neon-yellow">cachorro-attested</span> = this exact artifact was
              adversarially tested and here is the reproducible evidence, on-chain and revocable.
            </p>
            <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
              It is <span className="text-gray-300">not</span> a proof the program is safe.
              Verified builds have been hacked twice. We narrow the gap — reproduced PoCs,
              negative controls, bytes-bound digests — and say so out loud.
            </p>
          </div>
        </div>
      </section>


      {/* ═══ FAQ — kill the objections before the judges raise them ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="text-xs sm:text-base font-arcade text-white shrink-0">THE SKEPTIC SECTION</h2>
            <span className="flex-1 border-b border-dashed border-dark-600" />
          </div>
          <div className="space-y-px bg-dark-600 border border-dark-600">
            {[
              ['"isn\'t this just an LLM reading code?"',
               'Probabilistic models hallucinate bugs (false positives); statistical scanners sleep through them (false negatives). The pack couples both: the model proposes for recall, the machine disposes for precision — nothing becomes a finding without oracle verdict + reproduction.'],
              ['"does it replace a human audit?"',
               'No — and anyone who says otherwise is selling you noise. It\'s the verified floor under one: cheap, continuous, executable. Deep economic exploits still want a human brain.'],
              ['"does it touch mainnet?"',
               'Never. Every PoC runs on a local validator or fork. The only on-chain write is the memo receipt.'],
              ['"who submits the bug?"',
               'A human, after reproducing it — private disclosure to the owner, or the fix itself. Nothing auto-submits, nothing leaks: unclaimed targets stay anonymous codenames.'],
              ['"why trust the receipt?"',
               'Don\'t. Recompute the digest yourself — that\'s the whole point. /verify'],
            ].map(([q, a]) => (
              <div key={q} className="bg-dark-900 p-4 sm:p-5">
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-miami-rose mb-1.5">{q}</div>
                <div className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CLOSE — one ask ═══ */}
      <div className="vapor-strip" />
      <section className="px-4 py-14 sm:py-20 text-center relative overflow-hidden">
        <div className="synth-sun absolute left-1/2 -translate-x-1/2 bottom-[-40%] w-72 h-72 sm:w-96 sm:h-96 opacity-40 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-[10.5px] sm:text-[11.5px] font-mono text-gray-500 mb-4">your contract. your wallet. your protocol. your move.</div>
          <div className="text-lg sm:text-3xl font-arcade text-neon-green mb-3 chroma">TEST IT. PROVE IT. SHIP THE RECEIPT.</div>
          <p className="text-[11.5px] sm:text-[13px] text-gray-400 font-mono mb-6 max-w-lg mx-auto leading-relaxed">
            Free QUICK hunts for everyone building at the Fair — until Oct 12.
            After the hackathon the pack closes: engagement hunts become paid, keys-gated,
            priced against the audit you didn&apos;t buy — paid in SOL, verified on-chain.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#hunt"
              className="px-6 py-3 border-2 border-neon-green text-neon-green font-arcade text-[11.5px] sm:text-[13px] hover:bg-neon-green hover:text-black transition-all"
            >
              UNLEASH THE PACK
            </a>
            <a href="/pricing" className="text-[10.5px] sm:text-[11.5px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              engagement pricing ↗
            </a>
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 border-t border-dark-600">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] sm:text-[11.5px] font-mono text-gray-600">
          <span>CACHORRO · the audit your users can verify · proof, not opinion</span>
          <span className="flex items-center gap-3">
            <a href={process.env.CACHORRO_CONTACT_URL || '/pricing'} className="text-neon-yellow hover:text-neon-green transition-colors">TALK TO THE PACK ▸</a>
            <span>born at Colosseum Crypto World&apos;s Fair · multi-track</span>
          </span>
        </div>
      </footer>
    </main>
  )
}
