import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Verifier from '@/components/Verifier'

export const metadata = { title: 'Verify a receipt' }

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">TRUSTLESS CHECK</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-yellow chroma-soft mb-1">[ VERIFY A RECEIPT ]</h1>
          <p className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 mb-4 leading-relaxed">
            Paste an attestation digest, a report sha256, or a transaction signature.
            We recompute the canonical payload and check the on-chain memo —
            verification that doesn&apos;t trust this website.
          </p>
          <Suspense fallback={<div className="h-24" />}>
            <Verifier />
          </Suspense>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px bg-dark-600 border border-dark-600 text-[10.5px] sm:text-[11.5px] font-mono">
            <div className="bg-dark-900 p-3"><span className="text-miami-sky">1 · recompute</span><div className="text-gray-400 mt-1">sha256 over the canonical receipt fields — same bytes, same digest, or it didn&apos;t happen.</div></div>
            <div className="bg-dark-900 p-3"><span className="text-miami-purple">2 · check the chain</span><div className="text-gray-400 mt-1">the memo <code className="text-neon-purple">cachorro:v1:&lt;digest&gt;</code> must exist on-chain — anchored, not claimed.</div></div>
            <div className="bg-dark-900 p-3"><span className="text-miami-rose">3 · watch staleness</span><div className="text-gray-400 mt-1">program upgraded? the digest stops matching and the receipt expires itself.</div></div>
          </div>
        </div>
      </section>
    </main>
  )
}
