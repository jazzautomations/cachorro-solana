'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SITE_RE = /^https?:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}.*$/i

type Box = 'white' | 'grey' | 'black'

const BOXES: { id: Box; label: string; hint: string }[] = [
  { id: 'white', label: 'WHITE BOX', hint: 'We read your code.' },
  { id: 'grey', label: 'GREY BOX', hint: 'Your code plus what is live. We check one against the other.' },
  { id: 'black', label: 'BLACK BOX', hint: 'Only what an attacker sees from outside. A site or a program id.' },
]

const field = 'w-full min-w-0 px-4 py-3 bg-dark-900 border border-dark-600 text-white font-mono text-[11px] sm:text-[13px] placeholder:text-gray-600 focus:border-neon-green focus:outline-none transition-colors'

export default function ScanInput() {
  const router = useRouter()
  const params = useSearchParams()
  const [box, setBox] = useState<Box>('white')
  const [target, setTarget] = useState('')
  const [deployed, setDeployed] = useState('')
  const [scope, setScope] = useState('')
  const [cluster, setCluster] = useState('mainnet')
  const [mode, setMode] = useState('quick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [gh, setGh] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/github/me').then((r) => r.json()).then((d) => {
      if (d.connected) setGh(d.login)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const t = params.get('target')
    if (t) {
      setTarget(t)
      if (!REPO_RE.test(t)) setBox('black')
    }
  }, [params])

  const t = target.trim()
  const d = deployed.trim()
  const kind: 'repo' | 'program-id' | 'site' | null =
    REPO_RE.test(t) ? 'repo' : PUBKEY_RE.test(t) ? 'program-id'
    : SITE_RE.test(t) ? 'site' : null
  const needsCluster = (box === 'black' && kind === 'program-id') || (box === 'grey' && PUBKEY_RE.test(d))

  const problem = (): string => {
    if (!t) return box === 'black' ? 'Paste a site or a Solana program id' : 'Paste a GitHub repo'
    if (box !== 'black' && kind !== 'repo') return 'That is not a GitHub repo link (https://github.com/org/repo)'
    if (box === 'black' && kind === 'repo') return 'A repo is source code. Pick WHITE or GREY box for that'
    if (box === 'black' && !kind) return 'That is not a site URL or a program id'
    if (box === 'grey' && !(PUBKEY_RE.test(d) || SITE_RE.test(d))) return 'Grey box also needs the live thing: a program id or a site URL'
    return ''
  }

  const unleash = async () => {
    const p = problem()
    if (p) { setError(p); return }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: t, kind, cluster, mode,
          ...(box === 'grey' ? { deployed: d } : {}),
          ...(box !== 'black' && scope.trim() ? { scope: scope.trim() } : {}),
        }),
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
    <div className="w-full space-y-3">
      {/* 1 · how much can we see */}
      <div className="grid grid-cols-3 gap-px bg-dark-600 border border-dark-600">
        {BOXES.map((b) => (
          <button
            key={b.id}
            onClick={() => { setBox(b.id); setError('') }}
            className={`px-2 py-2 font-arcade text-[9.5px] sm:text-[11px] transition-colors ${
              box === b.id ? 'bg-neon-green text-black' : 'bg-dark-900 text-gray-500 hover:text-gray-300'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="text-[11.5px] sm:text-[12px] text-gray-400">{BOXES.find((b) => b.id === box)!.hint}</div>

      {/* 2 · the target(s) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={target}
          onChange={(e) => { setTarget(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && !busy && unleash()}
          placeholder={box === 'black' ? 'https://app.example.com  or  program id' : 'https://github.com/your-org/your-repo'}
          spellCheck={false}
          className={field + ' flex-1'}
        />
        {needsCluster && (
          <select
            value={cluster}
            onChange={(e) => setCluster(e.target.value)}
            className="px-3 py-3 bg-dark-900 border border-dark-600 text-neon-cyan font-mono text-[11px] sm:text-[13px] focus:border-neon-green focus:outline-none"
          >
            <option value="mainnet">mainnet</option>
            <option value="devnet">devnet</option>
          </select>
        )}
      </div>
      {box === 'grey' && (
        <input
          type="text"
          value={deployed}
          onChange={(e) => { setDeployed(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && !busy && unleash()}
          placeholder="what is live: program id or https://app.example.com"
          spellCheck={false}
          className={field}
        />
      )}

      {/* 3 · scope (optional, needs source) */}
      {box !== 'black' && (
        <details className="group" open={!!scope}>
          <summary className="cursor-pointer list-none text-[11.5px] font-mono text-gray-500 hover:text-neon-cyan">
            ▸ only hunt part of the repo (optional)
          </summary>
          <textarea
            value={scope}
            onChange={(e) => { setScope(e.target.value); setError('') }}
            rows={3}
            placeholder={'programs/vault\nprograms/staking/src/*.rs\n!tests'}
            spellCheck={false}
            className={field + ' mt-2 resize-y'}
          />
          <div className="mt-1 text-[11px] text-gray-500">
            One folder or file per line. Start a line with <span className="text-gray-300">!</span> to skip it. Empty means the whole repo.
          </div>
        </details>
      )}

      {/* 4 · how deep */}
      <div className="flex flex-wrap items-center gap-1 text-[11.5px] sm:text-[10.5px] font-mono">
        <span className="text-gray-600 mr-1">depth:</span>
        {([
          ['quick', 'QUICK · ~40 min · free'],
          ['deep', 'DEEP · ~90 min'],
          ['full', 'FULL · ~2.5 h'],
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

      <button
        onClick={unleash}
        disabled={busy}
        className="w-full px-5 py-3 border-2 border-neon-green text-neon-green font-arcade text-[11.5px] sm:text-[13px]
                   hover:bg-neon-green hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'RELEASING…' : 'START THE HUNT ▸'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] sm:text-[11.5px] font-mono">
        {gh ? (
          <span className="text-neon-green">signed in as @{gh} · private repos work</span>
        ) : (
          <a href="/api/auth/github" className="text-gray-500 hover:text-neon-cyan transition-colors">
            private repo? sign in with GitHub ▸
          </a>
        )}
        <span className="text-gray-600">attacks run on a copy · never on mainnet</span>
      </div>

      {error && <div className="text-[11.5px] text-neon-red font-mono break-words">✗ {error}</div>}
    </div>
  )
}
