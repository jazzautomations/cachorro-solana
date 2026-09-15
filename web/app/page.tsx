import Navbar from '@/components/Navbar'
import ScanInput from '@/components/ScanInput'
import RecentHunts from '@/components/RecentHunts'
import { STAGES } from '@/lib/stages'

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />

      {/* HERO */}
      <section id="hunt" className="relative px-4 py-10 sm:py-20 overflow-hidden scroll-mt-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-[9px] sm:text-xs text-neon-green mb-4 animate-blink font-mono">
            ▶ THE PACK IS AWAKE — 8 AGENTS, ONE HUNT
          </div>

          <h1 className="text-xl sm:text-5xl font-arcade text-neon-green mb-4 leading-tight">
            FIND THE EXPLOIT<br />
            <span className="text-neon-cyan">BEFORE MAINNET DOES.</span>
          </h1>

          <p className="text-[11px] sm:text-base text-gray-400 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            Paste a program ID or a GitHub repo. A pack of agents — FETCH, STATIC, RESEARCH, ANALYZE,
            DEVIL, POC, REVIEW, REPORT — tears through your Anchor/Rust like an attacker with a grudge.
            Findings ship with an <span className="text-neon-green">executable PoC on a local validator</span>,
            never mainnet. Proof, not opinion.
          </p>

          <ScanInput />
        </div>
      </section>

      {/* PIPELINE STRIP */}
      <section className="px-4 py-6 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2">
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`agent-node flex items-center gap-1.5 px-2.5 py-1.5 border text-[9px] sm:text-[10px] font-arcade ${
                  i < 2 ? 'border-neon-green text-neon-green' : 'border-dark-600 text-gray-600'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-3 text-[9px] text-gray-700 font-mono">
            green = live today · gray = AI stages coming online (M1)
          </div>
        </div>
      </section>

      {/* WHY SOLANA IS DIFFERENT */}
      <section className="px-4 py-10 sm:py-14 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs sm:text-lg font-arcade text-neon-green mb-6 sm:mb-8 text-center">
            [ WHAT THE PACK HUNTS ]
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                t: 'ACCOUNT VALIDATION',
                d: 'Missing signer and owner checks, account substitution, type confusion, has_one and constraint gaps, duplicate mutable accounts — the classics that empty a vault in one instruction.',
                c: 'text-neon-cyan',
              },
              {
                t: 'PDA & CPI',
                d: 'Seed and bump collisions, init_if_needed reinit, unpinned program IDs on arbitrary CPI, instruction-introspection atomicity, close/rent theft.',
                c: 'text-neon-yellow',
              },
              {
                t: 'MATH & ZK',
                d: 'Sign and cast bugs, lamport accounting, SPL/token-2022 mint↔vault binding — plus on-chain verifier soundness, nullifier double-spend and root validation for zk programs.',
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

      {/* STATS */}
      <section className="px-4 py-8 sm:py-12 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { v: '8', l: 'Pipeline stages', s: 'FETCH → REPORT', c: 'text-neon-green' },
              { v: '2', l: 'Live today', s: 'DETERMINISTIC, NO AI', c: 'text-neon-cyan' },
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
      <section className="px-4 py-8 sm:py-12 border-t border-dark-600">
        <div className="max-w-4xl mx-auto">
          <RecentHunts />
        </div>
      </section>

      {/* RULES */}
      <section className="px-4 py-8 sm:py-12 border-t border-dark-600">
        <div className="max-w-4xl mx-auto border border-dark-600 bg-dark-900 p-4 sm:p-6">
          <div className="text-[11px] sm:text-sm font-arcade text-neon-red mb-3">[ RULES OF ENGAGEMENT ]</div>
          <ul className="text-[10px] sm:text-xs text-gray-500 space-y-1.5 leading-relaxed">
            <li>▸ Audit only what you are authorized to audit — an active bounty with a defined scope.</li>
            <li>▸ PoCs run on a local validator or a local fork. No attack transaction ever touches mainnet.</li>
            <li>▸ Nothing is submitted automatically. A human reproduces the bug and files it through the official channel.</li>
            <li>▸ Untrusted targets are cloned, never built — a third-party build.rs is arbitrary code execution.</li>
          </ul>
        </div>
      </section>

      <footer className="px-4 py-8 border-t border-dark-600 text-center">
        <div className="text-[9px] sm:text-[10px] text-gray-700 font-mono">
          CACHORRO · Solana program auditor · proof, not opinion
        </div>
      </footer>
    </main>
  )
}
