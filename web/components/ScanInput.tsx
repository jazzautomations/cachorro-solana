'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SITE_RE = /^https?:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}.*$/i

export default function ScanInput() {
  const router = useRouter()
  const params = useSearchParams()
  const [target, setTarget] = useState('')
  const [cluster, setCluster] = useState('mainnet')
  const [mode, setMode] = useState('quick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = params.get('target')
    if (t) setTarget(t)
  }, [params])

  const t = target.trim()
  const kind: 'repo' | 'program-id' | 'site' | null =
    REPO_RE.test(t) ? 'repo' : PUBKEY_RE.test(t) ? 'program-id'
    : SITE_RE.test(t) ? 'site' : null

  const unleash = async () => {
    if (!t) { setError('Paste a GitHub repo, a site URL, or a Solana program ID'); return }
    if (!kind) {
      setError('Not a repo URL, site URL, nor base58 program ID')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: t, kind, cluster, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      router.push(`/scan/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong')
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={target}
          onChange={(e) => { setTarget(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && !busy && unleash()}
          placeholder="repo · site · program id — https://github.com/org/x · https://app.x.com · Tokenkeg…"
          spellCheck={false}
          className="flex-1 min-w-0 px-4 py-3 bg-dark-900 border border-dark-600 text-white font-mono text-[11px] sm:text-[13px]
                     placeholder:text-gray-600 focus:border-neon-green focus:outline-none transition-colors"
        />
        <select
          value={cluster}
          onChange={(e) => setCluster(e.target.value)}
          disabled={kind !== 'program-id'}
          className="px-3 py-3 bg-dark-900 border border-dark-600 text-neon-cyan font-mono text-[11px] sm:text-[13px]
                     focus:border-neon-green focus:outline-none disabled:opacity-40 sm:w-auto"
        >
          <option value="mainnet">mainnet</option>
          <option value="devnet">devnet</option>
        </select>
        <button
          onClick={unleash}
          disabled={busy}
          className="px-5 py-3 border-2 border-neon-green text-neon-green font-arcade text-[11.5px] sm:text-[13px] whitespace-nowrap
                     hover:bg-neon-green hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'RELEASING…' : 'UNLEASH THE PACK'}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11.5px] sm:text-[10.5px] font-mono">
        <span className="text-gray-600 mr-1">mode:</span>
        {([
          ['quick', 'QUICK ~40min · top-1'],
          ['deep', 'DEEP ~90min · top-3'],
          ['full', 'FULL ~2.5h · everything'],
        ] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2 py-0.5 border transition-colors ${
              mode === m ? 'border-neon-green text-neon-green' : 'border-dark-600 text-gray-500 hover:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10.5px] sm:text-[11.5px] font-mono">
        <span className={kind ? 'text-neon-cyan' : 'text-gray-600'}>
          {kind === 'repo' ? '▸ target: GitHub repo (source audit)'
            : kind === 'program-id' ? `▸ target: on-chain program on ${cluster}`
            : kind === 'site' ? '▸ target: live site (black-box recon)'
            : '▸ repo · site · program id'}
        </span>
        <span className="text-gray-600 hidden xs:inline">local validator only · never mainnet</span>
      </div>

      {error && <div className="mt-3 text-[11.5px] text-neon-red font-mono break-words">✗ {error}</div>}
    </div>
  )
}
