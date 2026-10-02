import Navbar from '@/components/Navbar'
import PayPanel from '@/components/PayPanel'
import { PLANS, RPC } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pricing' }

const INVOICE_VS = [
  ['the quote', '$50k–500k', 'an engagement, not a mortgage'],
  ['the wait', '8–16 week queue', 'hours — watch it hunt live'],
  ['the deliverable', 'a PDF of opinions', 'executable PoCs — treatment drains, control blocks'],
  ['the noise', '60–80% filler you triage', 'machine-enforced gate: no proof, no finding'],
  ['the expiry', 'silent the day you ship', 'the receipt knows when it went stale'],
]

export default function PricingPage() {
  const cluster = RPC.includes('devnet') ? 'devnet' : 'mainnet'

  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">SOL-PAYABLE · NO ACCOUNTS · {cluster.toUpperCase()} DEMO</div>
          <h1 className="text-sm sm:text-xl font-arcade mb-1">
            <span className="vapor-text chroma-soft">[ ENGAGE THE PACK ]</span>
          </h1>
          <p className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 mb-6 leading-relaxed max-w-2xl">
            Audit firms sell opinions by the page. The pack sells proof by the byte —
            every finding arrives with an executable PoC and a receipt on-chain, or it doesn&apos;t ship.
          </p>

          {/* ═══ the anchor: the invoice you're not paying ═══ */}
          <div className="holo-frame mb-8">
            <div className="px-3 py-2 border-b border-dark-600/60 flex items-center justify-between">
              <span className="text-[10.5px] font-arcade text-miami-sky">THE AUDIT INVOICE, COMPARED</span>
              <span className="text-[11.5px] font-mono text-gray-500">why this is cheap</span>
            </div>
            <div className="grid grid-cols-3 text-[10.5px] sm:text-[11.5px] font-mono">
              <div className="px-3 py-2 text-gray-500 border-b border-dark-600/60"></div>
              <div className="px-3 py-2 text-neon-red border-b border-dark-600/60 font-arcade text-[11.5px]">TRADITIONAL AUDIT</div>
              <div className="px-3 py-2 text-neon-green border-b border-dark-600/60 font-arcade text-[11.5px]">THE PACK</div>
              {INVOICE_VS.map(([k, a, b]) => (
                <div key={k} className="contents">
                  <div className="px-3 py-2 text-gray-500 border-b border-dark-600/40">{k}</div>
                  <div className="px-3 py-2 text-gray-400 border-b border-dark-600/40 line-through decoration-miami-pink/60">{a}</div>
                  <div className="px-3 py-2 text-gray-300 border-b border-dark-600/40">{b}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ tiers ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`border bg-dark-900 p-4 sm:p-5 flex flex-col ${
                  p.id === 'hunter' ? 'holo-frame' : 'border-dark-600'
                }`}
              >
                <div className="text-[11.5px] sm:text-[13px] font-arcade text-white mb-1">{p.name}</div>
                <div className="text-[10.5px] font-mono text-gray-500 mb-1">{p.blurb}</div>
                <div className="text-[11.5px] font-mono text-miami-rose mb-3">{p.anchor}</div>
                <div className="text-xl sm:text-2xl font-bold text-neon-green mb-3 chroma-soft">
                  {p.priceSol === 0 ? 'free' : `${p.priceSol} SOL`}
                  <span className="text-[10.5px] font-mono text-gray-500 font-normal">
                    {p.priceSol === 0 ? '' : p.unit === 'engagement' ? ' /engagement' : ' /mo'}
                  </span>
                </div>
                <ul className="space-y-1.5 text-[10.5px] sm:text-[11.5px] font-mono text-gray-400 flex-1 mb-3">
                  {p.perks.map((perk) => (
                    <li key={perk}>▸ {perk}</li>
                  ))}
                </ul>
                {p.priceSol === 0 ? (
                  <a
                    href="/#hunt"
                    className="block text-center px-3 py-2 border border-dark-600 text-gray-400 font-arcade text-[10.5px] hover:border-neon-green hover:text-neon-green transition-all"
                  >
                    RUN RECON ▸
                  </a>
                ) : (
                  <PayPanel plan={p.id} priceSol={p.priceSol} />
                )}
              </div>
            ))}
          </div>

          {/* ═══ outcome pricing — the pitch in one line ═══ */}
          <div className="mt-6 border border-miami-purple/60 bg-dark-900/80 p-4">
            <div className="text-[10.5px] sm:text-[11.5px] font-arcade text-miami-purple mb-1.5">PAY-PER-PROOF PILOT</div>
            <p className="text-[10.5px] sm:text-[11.5px] font-mono text-gray-400 leading-relaxed">
              For bounty-scoped programs: flat retainer + bounty per VERDE finding, priced like Immunefi
              tiers (crit &gt; high &gt; med &gt; low). We only get paid when the gate proves it —
              <span className="text-neon-green"> a firm invoices for pages; the pack invoices for reproductions.</span>
            </p>
          </div>

          <div className="mt-8 text-[10.5px] font-mono text-gray-500 text-center leading-relaxed">
            how it works: checkout returns a treasury address + unique memo → you send SOL with that memo →
            we verify the tx on-chain → key issued, bound to nothing but the payment. cancel = stop paying.
          </div>
        </div>
      </section>
    </main>
  )
}
