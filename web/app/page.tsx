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

const STEPS = [
  { t: 'SHOW US THE TARGET', d: 'A GitHub repo, a website or a Solana program id. Pick how much we get to see and which part to hunt. No sign up, no wallet.' },
  { t: 'WATCH THE PACK', d: 'AI agents read your code looking for ways to steal money from it. You see every idea they have, live.' },
  { t: 'GET PROOF', d: 'For each bug, they write the attack and run it on a private copy. If it works, it goes in the report. If not, it gets thrown out.' },
]

const GETS = [
  { t: 'A REPORT', d: 'What is broken, how bad it is, and how to fix it. In plain markdown.' },
  { t: 'THE ATTACK', d: 'For each real bug, the exact code that breaks it. Run it yourself and watch it work.' },
  { t: 'A RECEIPT ON SOLANA', d: 'A fingerprint of the report goes on-chain. Anyone can check it was not changed. Check one at /verify.' },
  { t: 'A BADGE', d: 'Put it in your README so users can see your code was tested, and when.' },
]

const FAQ: [string, string][] = [
  ['Is this just ChatGPT reading my code?', 'The AI comes up with ideas. A bug only counts after the attack actually runs. Guesses get thrown out.'],
  ['Does it replace a human audit?', 'No. Use it before the audit, so you don\'t pay a firm to find the easy bugs. And after every update, because an audit only covers the code it saw.'],
  ['Does it touch my real program?', 'Never. Every attack runs on a copy on our own machine. The only thing we write on-chain is the receipt.'],
  ['White box, grey box, black box?', 'How much we get to see. White: your code. Grey: your code plus what is live, so we can catch where they differ. Black: only the outside, like a stranger would.'],
  ['Can I hunt just one part?', 'Yes. List the folders or files you care about. Start a line with ! to skip something, like tests.'],
  ['Who reports the bug?', 'You, or a human on our side after running it again. Nothing is sent anywhere automatically.'],
  ['Why trust the receipt?', 'You don\'t have to. Go to /verify and check it yourself.'],
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

          <p className="text-[12px] sm:text-base text-gray-300 mb-2 max-w-xl leading-relaxed">
            Paste your code. A pack of AI agents tries to break it.
          </p>
          <p className="text-[11.5px] sm:text-sm text-gray-400 mb-8 max-w-xl leading-relaxed">
            When they find a bug, they prove it by running the attack on a private copy.
            Your real program and real money are never touched.
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
                <div className="text-[11.5px] font-mono text-gray-500 mb-2">paste a GitHub repo, a website, or a Solana program id</div>
                <Suspense fallback={<div className="h-24" />}>
                  <ScanInput />
                </Suspense>
              </div>
            </div>
            <LiveFeedPreview />
          </div>
        </div>
      </section>

      {/* ═══ TICKER — live numbers, one line ═══ */}
      <div className="border-y border-dark-600 bg-dark-900/60 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-4 sm:gap-6 text-[11.5px] sm:text-[10.5px] font-mono text-gray-400 whitespace-nowrap overflow-x-auto">
          <span><span className="text-neon-cyan">{nHunts}</span> hunts run</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-green">{sb.verde}</span> bugs proven</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-miami-pink">{sb.vermelho}</span> guesses thrown out</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-cyan">{nAnchored}</span> receipts on Solana</span>
          <span className="text-dark-600">|</span>
          <span><span className="text-neon-green">0</span> attacks on mainnet</span>
        </div>
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="px-4 py-12 sm:py-16 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-base font-arcade text-white mb-8">HOW IT WORKS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600">
            {STEPS.map((x, i) => (
              <div key={x.t} className="bg-dark-900 p-4 sm:p-5">
                <div className={`font-arcade text-lg mb-2 ${['text-neon-green', 'text-miami-sky', 'text-miami-pink'][i]}`}>{i + 1}</div>
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-white mb-2">{x.t}</div>
                <p className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] sm:text-[13px] text-gray-500 text-center">
            A quick hunt takes about 40 minutes. The deepest one takes about 2 and a half hours.
          </p>
        </div>
      </section>

      {/* ═══ WHAT YOU GET ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-base font-arcade text-white mb-8">WHAT YOU GET</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-dark-600 border border-dark-600">
            {GETS.map((x) => (
              <div key={x.t} className="bg-dark-900 p-4 sm:p-5">
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-neon-green mb-2">{x.t}</div>
                <p className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 border border-dark-600 bg-dark-900 p-4 sm:p-5">
            <div className="text-[11.5px] sm:text-[13px] font-arcade text-white mb-3">WHAT THE COLORS MEAN</div>
            <ul className="space-y-2 text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">
              <li><span className="text-neon-green font-arcade text-[11.5px]">GREEN</span> · we ran the attack and it worked. This bug is real.</li>
              <li><span className="text-neon-yellow font-arcade text-[11.5px]">YELLOW</span> · strong signs of a bug, but part of it lives outside the code, so we couldn&apos;t run all of it.</li>
              <li><span className="text-gray-300 font-arcade text-[11.5px]">GRAY</span> · we suspected something and couldn&apos;t prove it. We tell you anyway and mark it as unproven.</li>
            </ul>
            <p className="mt-3 text-[11.5px] sm:text-[13px] text-gray-500">
              A report with no bugs means we didn&apos;t find any. It doesn&apos;t mean there are none.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ CLAIM ═══ */}
      <div className="vapor-strip" />
      <section id="claim" className="px-4 py-12 sm:py-16 scroll-mt-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-xs sm:text-base font-arcade text-neon-purple mb-4">IS IT YOUR CODE? CLAIM IT.</h2>
            <p className="text-[12px] sm:text-[14px] text-gray-300 leading-relaxed mb-3">
              Anyone can hunt public code. To keep attackers from using us, the full report with the attack
              only opens for the owner.
            </p>
            <p className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed mb-5">
              Everyone else sees how many bugs and how bad they are. That&apos;s all.
            </p>
            <a href="/claim" className="inline-block px-5 py-3 border-2 border-neon-purple text-neon-purple font-arcade text-[11.5px] hover:bg-neon-purple hover:text-black transition-all">
              CLAIM MY CODE ▸
            </a>
          </div>
          <ol className="space-y-3 text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">
            <li><span className="text-neon-purple font-arcade text-[11.5px] mr-2">1</span><span className="text-gray-200">GitHub repo:</span> sign in with GitHub. If you can push to it, it&apos;s yours. One click.</li>
            <li><span className="text-neon-purple font-arcade text-[11.5px] mr-2">2</span><span className="text-gray-200">Solana program:</span> sign a message with the wallet that can upgrade it.</li>
            <li><span className="text-neon-purple font-arcade text-[11.5px] mr-2">3</span>Done. You see every report in full, and your badge says OWNER-VERIFIED.</li>
          </ol>
        </div>
      </section>

      {/* ═══ API ═══ */}
      <section id="api" className="px-4 py-12 sm:py-16 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-base font-arcade text-white mb-4">USE IT FROM CODE</h2>
          <p className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed mb-4 max-w-2xl">
            Everything on this page works from a script or from your CI. Send the target, wait for it to finish, read the report.
            No key needed for quick hunts.
          </p>
          <pre className="overflow-x-auto border border-dark-600 bg-black/70 p-3 sm:p-4 text-[10.5px] sm:text-[12px] leading-relaxed text-neon-green">
{`curl -X POST https://cachorro.jazzautomations.com.br/api/scan \\
  -H 'content-type: application/json' \\
  -d '{"target":"https://github.com/you/your-program","mode":"quick"}'

# → {"id":"run_…","status":"running"}   then GET /api/scan/run_…`}
          </pre>
          <a href="/docs" className="inline-block mt-4 text-[11.5px] sm:text-[13px] font-mono text-neon-cyan hover:text-neon-green">
            ▸ full API guide
          </a>
        </div>
      </section>

      {/* ═══ FIELD LOG ═══ */}
      <section id="hunts" className="px-4 py-12 sm:py-16 border-t border-dark-600 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-base font-arcade text-white mb-6">RECENT HUNTS</h2>
          <div className="mb-6 border border-neon-green/40 bg-dark-900 p-4 sm:p-5">
            <div className="text-[11.5px] font-arcade text-neon-green mb-2">DOES IT WORK? WE TESTED IT ON A REAL HACK.</div>
            <p className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">
              In 2022 someone stole $52M from Cashio. We gave the pack the code from before the fix, without telling it anything.
              It found the same bug and ran the attack. On the fixed code, the same attack failed.
            </p>
          </div>
          <RecentHunts />
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="px-4 py-12 sm:py-16 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-base font-arcade text-white mb-6">QUESTIONS</h2>
          <div className="space-y-px bg-dark-600 border border-dark-600">
            {FAQ.map(([q, a]) => (
              <div key={q} className="bg-dark-900 p-4 sm:p-5">
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-miami-rose mb-1.5">{q}</div>
                <div className="text-[12px] sm:text-[14px] text-gray-400 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CLOSE ═══ */}
      <div className="vapor-strip" />
      <section className="px-4 py-14 sm:py-20 text-center relative overflow-hidden">
        <div className="synth-sun absolute left-1/2 -translate-x-1/2 bottom-[-40%] w-72 h-72 sm:w-96 sm:h-96 opacity-40 pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-lg sm:text-3xl font-arcade text-neon-green mb-4 chroma">FIND IT BEFORE THEY DO.</div>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#hunt"
              className="px-6 py-3 border-2 border-neon-green text-neon-green font-arcade text-[11.5px] sm:text-[13px] hover:bg-neon-green hover:text-black transition-all"
            >
              START A HUNT
            </a>
            <a href="/pricing" className="text-[11.5px] sm:text-[13px] font-mono text-neon-yellow hover:text-neon-green transition-colors">
              pricing ↗
            </a>
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 border-t border-dark-600">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10.5px] sm:text-[11.5px] font-mono text-gray-600">
          <span>CACHORRO · the audit your users can verify · proof, not opinion</span>
          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a href="/disclosure" className="text-gray-500 hover:text-neon-cyan transition-colors">disclosure</a>
            <a href="/privacy" className="text-gray-500 hover:text-neon-cyan transition-colors">privacy &amp; AI</a>
            <a href="/.well-known/security.txt" className="text-gray-500 hover:text-neon-cyan transition-colors">security.txt</a>
            <a href={process.env.CACHORRO_CONTACT_URL || '/pricing'} className="text-neon-yellow hover:text-neon-green transition-colors">TALK TO THE PACK ▸</a>
            <span>born at Colosseum Crypto World&apos;s Fair · multi-track</span>
          </span>
        </div>
        <div className="max-w-6xl mx-auto mt-4 text-[11.5px] font-mono text-gray-600 leading-relaxed">
          AI-assisted analysis, as-is — not a formal audit; absence of findings does not mean code is safe.
          Exploits run on local forks only — mainnet is never touched.
        </div>
      </footer>
    </main>
  )
}
