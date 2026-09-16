import Navbar from '@/components/Navbar'
import PayPanel from '@/components/PayPanel'
import { PLANS, RPC } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pricing' }

export default function PricingPage() {
  const cluster = RPC.includes('devnet') ? 'devnet' : 'mainnet'

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-[9px] text-gray-600 font-mono mb-1">SOL-PAYABLE · NO ACCOUNTS</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green mb-1">
            [ PICK YOUR PACK RANK ]
          </h1>
          <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-8 leading-relaxed max-w-2xl">
            Payment is a SOL transfer with a memo — verified on-chain, no signup, no custody.
            The key the chain hands you back is your whole account.
            <span className="text-neon-yellow"> Demo runs on {cluster}.</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`border bg-dark-900 p-4 sm:p-5 flex flex-col ${
                  p.id === 'hunter' ? 'border-neon-green pixel-border-glow' : 'border-dark-600'
                }`}
              >
                <div className="text-[10px] sm:text-xs font-arcade text-white mb-1">{p.name}</div>
                <div className="text-[9px] font-mono text-gray-600 mb-3">{p.blurb}</div>
                <div className="text-xl sm:text-2xl font-bold text-neon-green mb-3">
                  {p.priceSol === 0 ? 'free' : `${p.priceSol} SOL`}
                  <span className="text-[9px] font-mono text-gray-600 font-normal"> /mo</span>
                </div>
                <ul className="space-y-1.5 text-[9px] sm:text-[10px] font-mono text-gray-400 flex-1 mb-3">
                  {p.perks.map((perk) => (
                    <li key={perk}>▸ {perk}</li>
                  ))}
                </ul>
                {p.priceSol === 0 ? (
                  <a
                    href="/#hunt"
                    className="block text-center px-3 py-2 border border-dark-600 text-gray-400 font-arcade text-[9px] hover:border-neon-green hover:text-neon-green transition-all"
                  >
                    START FREE ▸
                  </a>
                ) : (
                  <PayPanel plan={p.id} priceSol={p.priceSol} />
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-[9px] font-mono text-gray-600 text-center leading-relaxed">
            how it works: checkout returns a treasury address + unique memo → you send SOL with that memo →
            we verify the tx on-chain → key issued, bound to nothing but the payment. cancel = stop paying.
          </div>
        </div>
      </section>
    </main>
  )
}
