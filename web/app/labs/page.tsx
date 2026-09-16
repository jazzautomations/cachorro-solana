import Navbar from '@/components/Navbar'
import { readLabs, TIER_META } from '@/lib/labs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Labs' }

export default function LabsPage() {
  const { labs } = readLabs()
  const tiers = [0, 1, 2, 3] as const

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-[9px] text-gray-600 font-mono mb-1">FIELD MANUAL</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green mb-1">
            [ LABS · LEARN BY HUNTING ]
          </h1>
          <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-8 leading-relaxed max-w-2xl">
            A Solana security curriculum: foundations first (the account model every bug exploits),
            then eleven vulnerability classes — each lab shows the vulnerable code, the fix, the
            real-world exploit it caused, and lets you unleash the pack on it. No slides.
          </p>

          {tiers.map((tier) => (
            <div key={tier} className="mb-8">
              <div className="mb-3">
                <div className="text-[10px] sm:text-xs font-arcade text-neon-purple">{TIER_META[tier].name}</div>
                <div className="text-[9px] font-mono text-gray-600">{TIER_META[tier].blurb}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {labs.filter((l) => l.tier === tier).map((l) => (
                  <a
                    key={l.id}
                    href={`/labs/${l.id}`}
                    className="border border-dark-600 bg-dark-900 p-3 sm:p-4 hover:border-neon-green/60 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] sm:text-xs font-arcade text-white group-hover:text-neon-green transition-colors">
                        {l.title}
                      </span>
                      {l.proven ? (
                        <span className="text-[7px] sm:text-[8px] font-mono text-neon-green border border-neon-green/40 px-1.5 py-0.5 shrink-0">
                          PACK-PROVEN
                        </span>
                      ) : l.kind === 'lesson' ? (
                        <span className="text-[7px] sm:text-[8px] font-mono text-gray-500 border border-dark-600 px-1.5 py-0.5 shrink-0">
                          LESSON
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono text-gray-600">
                      {l.vulnClass}{l.dir ? ` · ${l.dir}` : ''}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div className="text-[9px] font-mono text-gray-700 text-center mt-6">
            lab programs from <a href="https://github.com/coral-xyz/sealevel-attacks" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-neon-cyan">coral-xyz/sealevel-attacks</a> (Apache-2.0) — insecure / secure / recommended variants
          </div>
        </div>
      </section>
    </main>
  )
}
