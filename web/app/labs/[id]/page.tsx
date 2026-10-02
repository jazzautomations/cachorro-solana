import Navbar from '@/components/Navbar'
import CodeCompare from '@/components/CodeCompare'
import { readLabs, TIER_META } from '@/lib/labs'

export const dynamic = 'force-dynamic'

export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { labs } = readLabs()
  const lab = labs.find((l) => l.id === id)
  const idx = labs.findIndex((l) => l.id === id)

  if (!lab) {
    return (
      <main className="min-h-screen bg-black">
        <Navbar />
        <section className="px-4 py-10">
          <div className="max-w-4xl mx-auto border border-neon-red bg-dark-900 p-4 text-[11px] font-mono text-neon-red">
            ✗ unknown lab — <a href="/labs" className="underline">back to labs</a>
          </div>
        </section>
      </main>
    )
  }

  const next = labs[idx + 1]

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          <a href="/labs" className="text-[10.5px] font-mono text-gray-500 hover:text-neon-green">◂ labs</a>
          <div className="text-[10.5px] text-gray-500 font-mono mt-3 mb-1">
            {TIER_META[lab.tier].name}{lab.dir ? ` · ${lab.dir}` : ''}
          </div>
          <h1 className={`text-sm sm:text-xl font-arcade mb-4 ${lab.kind === 'lab' ? 'text-neon-red' : 'text-neon-cyan'}`}>
            {lab.title.toUpperCase()}
          </h1>

          <p className="text-[11.5px] sm:text-sm text-gray-400 leading-relaxed mb-4 max-w-3xl">
            {lab.concept}
          </p>

          <div className="border-l-2 border-neon-yellow/50 bg-dark-900 px-3 py-2.5 mb-6">
            <div className="text-[11.5px] font-mono text-neon-yellow uppercase mb-1">seen in the wild</div>
            <div className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 leading-relaxed">{lab.realWorld}</div>
          </div>

          {lab.insecure && (
            <CodeCompare insecure={lab.insecure} secure={lab.secure} recommended={lab.recommended} />
          )}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lab.huntTarget && (
              <a
                href={`/?target=${encodeURIComponent(lab.huntTarget)}#hunt`}
                className="flex items-center justify-between border border-neon-green bg-dark-900 px-4 py-3 hover:bg-dark-800 transition-colors"
              >
                <span className="text-[11.5px] sm:text-[13px] font-arcade text-neon-green">[ UNLEASH THE PACK ]</span>
                <span className="text-[11.5px] sm:text-[10.5px] font-mono text-gray-500">hunt this class ↗</span>
              </a>
            )}
            {lab.repoUrl && (
              <a
                href={lab.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between border border-dark-600 bg-dark-900 px-4 py-3 hover:bg-dark-800 transition-colors"
              >
                <span className="text-[11.5px] sm:text-[13px] font-mono text-gray-400">full program + tests</span>
                <span className="text-[11.5px] sm:text-[10.5px] font-mono text-gray-500">github ↗</span>
              </a>
            )}
            {lab.kind === 'lesson' && (
              <a
                href="/#hunt"
                className="flex items-center justify-between border border-dark-600 bg-dark-900 px-4 py-3 hover:border-neon-green/60 transition-colors sm:col-span-2"
              >
                <span className="text-[11.5px] sm:text-[13px] font-mono text-gray-400">see the model in action — hunt a real target</span>
                <span className="text-[11.5px] sm:text-[10.5px] font-mono text-gray-500">▸</span>
              </a>
            )}
          </div>

          {lab.proven && (
            <div className="mt-3 border border-neon-purple/40 bg-dark-900 px-3 py-2.5 text-[10.5px] sm:text-[11.5px] font-mono text-gray-400">
              ▸ the pack already hunted this class — watch the live feed of{' '}
              <a href={`/scan/${lab.proven}`} className="text-neon-purple hover:text-neon-cyan">{lab.proven}</a>
            </div>
          )}

          {next && (
            <div className="mt-8 pt-4 border-t border-dark-600 flex justify-between items-center">
              <span className="text-[10.5px] font-mono text-gray-600">next lab</span>
              <a href={`/labs/${next.id}`} className="text-[11.5px] sm:text-[13px] font-arcade text-neon-cyan hover:text-neon-green transition-colors">
                {next.title.toUpperCase()} ▸
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
