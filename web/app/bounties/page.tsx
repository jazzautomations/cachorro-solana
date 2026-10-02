import Navbar from '@/components/Navbar'
import BountyBoard from '@/components/BountyBoard'
import { readBounties } from '@/lib/bounties'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Bounty board' }

export default function BountiesPage() {
  const idx = readBounties()

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">LIVE INDEX</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green mb-1">
            [ BOUNTY BOARD ]
          </h1>
          <p className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 mb-6 leading-relaxed">
            Active bug bounties with Solana surface, indexed from public programs.
            Expand a program, pick an in-scope repo, unleash the pack —
            PoC runs on a local validator, never mainnet.
          </p>
          <BountyBoard bounties={idx.bounties} updatedAt={idx.updatedAt} />
        </div>
      </section>
    </main>
  )
}
