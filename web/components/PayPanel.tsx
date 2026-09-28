'use client'

import { useState } from 'react'

export default function PayPanel({ plan, priceSol }: { plan: string; priceSol: number }) {
  const [inv, setInv] = useState<null | { invoice: string; treasury: string; memo: string; cluster: string }>(null)
  const [sig, setSig] = useState('')
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const checkout = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setInv(d)
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  const verify = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/billing/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice: inv!.invoice, signature: sig.trim() }),
      })
      const d = await r.json()
      if (d.paid) { setKey(d.key); setMsg('') }
      else setMsg(d.why || d.error || 'not verified yet')
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  if (key) {
    return (
      <div className="mt-3 border border-neon-green bg-black/60 p-3">
        <div className="text-[8px] font-mono text-neon-green mb-1">▸ PAID — your API key (save it, it's shown once):</div>
        <div className="text-[10px] font-mono text-neon-cyan break-all select-all">{key}</div>
        <div className="text-[8px] font-mono text-gray-600 mt-1">pass it as X-Cachorro-Key on /api/scan</div>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {!inv ? (
        <button
          onClick={checkout}
          disabled={busy}
          className="w-full px-3 py-2 border border-neon-yellow text-neon-yellow font-arcade text-[9px] hover:bg-neon-yellow hover:text-black transition-all disabled:opacity-50"
        >
          {busy ? '…' : `PAY ${priceSol} SOL ▸`}
        </button>
      ) : (
        <div className="border border-dark-600 bg-black/60 p-3 space-y-2 text-left">
          <div className="text-[8px] font-mono text-gray-500">
            send <span className="text-neon-yellow">{priceSol} SOL</span> ({inv.cluster}) to:
          </div>
          <div className="text-[9px] font-mono text-neon-cyan break-all select-all">{inv.treasury}</div>
          <div className="text-[8px] font-mono text-gray-500">with memo:</div>
          <div className="text-[9px] font-mono text-neon-purple break-all select-all">{inv.memo}</div>
          <a
            href={`solana:${inv.treasury}?amount=${priceSol}&memo=${encodeURIComponent(inv.memo)}&label=Cachorro%20${plan}&message=cachorro%20hunt`}
            className="block text-center px-3 py-1.5 border border-neon-purple text-neon-purple font-arcade text-[8px] hover:bg-neon-purple hover:text-black transition-all"
          >
            PAY IN PHANTOM ▸
          </a>
          <div className="pt-1 border-t border-dark-600">
            <input
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              placeholder="paste tx signature"
              spellCheck={false}
              className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 text-white font-mono text-[9px] placeholder:text-gray-700 focus:border-neon-green focus:outline-none"
            />
            <button
              onClick={verify}
              disabled={busy || !sig.trim()}
              className="mt-2 w-full px-3 py-1.5 border border-neon-green text-neon-green font-arcade text-[8px] hover:bg-neon-green hover:text-black transition-all disabled:opacity-50"
            >
              {busy ? 'VERIFYING…' : 'VERIFY ON-CHAIN ▸'}
            </button>
          </div>
        </div>
      )}
      {msg && <div className="mt-2 text-[9px] font-mono text-neon-red break-words">{msg}</div>}
    </div>
  )
}
