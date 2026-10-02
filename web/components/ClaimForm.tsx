'use client'

import { useState } from 'react'

export default function ClaimForm() {
  const [pid, setPid] = useState('')
  const [sig, setSig] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: pid.trim(), signature: sig.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setOk(true)
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="border border-dark-600 bg-dark-900 p-4 space-y-3">
      {ok ? (
        <div className="text-[11.5px] font-arcade text-neon-green">✓ PROGRAM CLAIMED — your certificates now carry OWNER-VERIFIED</div>
      ) : (
        <>
          <input
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            placeholder="program id (base58)"
            spellCheck={false}
            className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-white font-mono text-[11.5px] placeholder:text-gray-600 focus:border-neon-green focus:outline-none"
          />
          <input
            value={sig}
            onChange={(e) => setSig(e.target.value)}
            placeholder="signature (base58) of cachorro:claim:<programId>"
            spellCheck={false}
            className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-white font-mono text-[11.5px] placeholder:text-gray-600 focus:border-neon-green focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={busy || !pid.trim() || !sig.trim()}
            className="w-full px-3 py-2 border border-neon-green text-neon-green font-arcade text-[10.5px] hover:bg-neon-green hover:text-black transition-all disabled:opacity-50"
          >
            {busy ? 'VERIFYING ON-CHAIN…' : 'CLAIM PROGRAM ▸'}
          </button>
          {msg && <div className="text-[10.5px] font-mono text-neon-red break-words">{msg}</div>}
        </>
      )}
    </div>
  )
}
