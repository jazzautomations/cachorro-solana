'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'

function Verifier() {
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('sha') || params.get('sig') || '')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Record<string, unknown> | null>(null)

  const run = async (query: string) => {
    setBusy(true); setRes(null)
    const isSig = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(query)
    const r = await fetch(`/api/verify?${isSig ? 'sig' : 'sha'}=${encodeURIComponent(query)}`)
    setRes(await r.json())
    setBusy(false)
  }

  return (
    <section className="px-3 sm:px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <div className="text-[9px] text-gray-600 font-mono mb-1">TRUSTLESS CHECK</div>
        <h1 className="text-sm sm:text-xl font-arcade text-neon-yellow mb-1">[ VERIFY A RECEIPT ]</h1>
        <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-6 leading-relaxed">
          Paste an attestation digest, a report sha256, or a transaction signature.
          We recompute the canonical payload and check the on-chain memo —
          verification that doesn't trust this website.
        </p>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && q.trim() && run(q.trim())}
            placeholder="attestation sha256 · report sha256 · or tx signature"
            spellCheck={false}
            className="flex-1 min-w-0 px-3 py-2.5 bg-dark-900 border border-dark-600 text-white font-mono text-[10px] sm:text-xs placeholder:text-gray-700 focus:border-neon-yellow focus:outline-none"
          />
          <button
            onClick={() => run(q.trim())}
            disabled={busy || !q.trim()}
            className="px-4 py-2.5 border-2 border-neon-yellow text-neon-yellow font-arcade text-[9px] sm:text-[10px] hover:bg-neon-yellow hover:text-black transition-all disabled:opacity-50"
          >
            {busy ? '…' : 'VERIFY ▸'}
          </button>
        </div>

        {res && (
          <div className={`mt-4 border p-4 ${res.found ? 'border-neon-green' : 'border-neon-red'} bg-dark-900`}>
            {res.found ? (
              <>
                <div className="text-[10px] sm:text-xs font-arcade text-neon-green mb-3">RECEIPT FOUND</div>
                <dl className="space-y-1.5 text-[9px] sm:text-[10px] font-mono">
                  {(() => {
                    const r = res.receipt as Record<string, unknown> | null
                    const oc = res.onchain as Record<string, unknown>
                    return (
                      <>
                        <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">payload digest</dt><dd className={res.recomputed ? 'text-neon-green' : 'text-neon-red'}>{res.recomputed ? 'recomputed ✓ matches' : 'MISMATCH ✗'}</dd></div>
                        <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">on-chain anchor</dt><dd className={oc?.onchain ? 'text-neon-green' : 'text-neon-yellow'}>{oc?.onchain ? `anchored · slot ${oc.slot}` : String(oc?.why || 'pending')}</dd></div>
                        {r && <>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">target</dt><dd className="text-gray-300 break-all">{String(r.target)}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">audited commit</dt><dd className="text-neon-cyan">{String(r.audited_commit).slice(0, 12)}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">report sha256</dt><dd className="text-gray-400 break-all">{String(r.report_sha256)}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">journal head</dt><dd className="text-gray-400 break-all">{String(r.journal_head)}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">memo</dt><dd className="text-neon-purple break-all">{String(r.memo)}</dd></div>
                          <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">cluster</dt><dd className="text-gray-400">{String(r.cluster)}</dd></div>
                          {r.signature ? (
                            <div className="flex gap-2"><dt className="text-gray-600 w-32 shrink-0">tx</dt><dd><a className="text-neon-cyan hover:underline break-all" href={`https://explorer.solana.com/tx/${r.signature}?cluster=${r.cluster}`} target="_blank" rel="noreferrer">{String(r.signature).slice(0, 32)}… ↗</a></dd></div>
                          ) : null}
                        </>}
                        {res.why ? <div className="text-neon-yellow pt-1">{String(res.why)}</div> : null}
                      </>
                    )
                  })()}
                </dl>
              </>
            ) : (
              <div className="text-[10px] font-mono text-neon-red">✗ {String(res.why || res.error || 'not found')}</div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <Suspense fallback={<div className="p-10 text-center text-[10px] font-mono text-gray-600">…</div>}>
        <Verifier />
      </Suspense>
    </main>
  )
}
