'use client'

import { useEffect, useState } from 'react'

const clean = (s: string) => s.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '')
const REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/

const btn = 'px-4 py-2.5 border-2 border-neon-green text-neon-green font-arcade text-[10.5px] sm:text-[11.5px] hover:bg-neon-green hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed'

export default function RepoClaim() {
  const [repo, setRepo] = useState('')
  const [gh, setGh] = useState<string | null>(null)
  const [nonce, setNonce] = useState('')
  const [done, setDone] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/auth/github/me').then((r) => r.json()).then((d) => d.connected && setGh(d.login)).catch(() => {})
    const saved = sessionStorage.getItem('cch_claim_repo')
    if (saved) setRepo(saved)
  }, [])

  const r = clean(repo)
  const valid = REPO_RE.test(r)

  const call = async (body: object) => {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/claim/repo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo: r, ...body }),
      })
      const d = await res.json()
      if (d.verified) setDone(d.repo || r)
      else if (d.nonce && !('verify' in body)) setNonce(d.nonce)
      else throw new Error(d.error || `HTTP ${res.status}`)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="border border-neon-green bg-dark-900 p-4 sm:p-5">
        <div className="font-arcade text-[11.5px] sm:text-[13px] text-neon-green mb-2">✓ {done} IS YOURS</div>
        <p className="text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed mb-4">
          Every hunt on this repo now shows you the full report. Run one now.
        </p>
        <a href={`/?target=${encodeURIComponent('https://github.com/' + done)}#hunt`} className={btn + ' inline-block'}>
          HUNT IT ▸
        </a>
      </div>
    )
  }

  return (
    <div className="border border-dark-600 bg-dark-900 p-4 sm:p-5 space-y-4">
      <div>
        <label className="block text-[10.5px] font-arcade text-gray-500 mb-2">1 · WHICH REPO?</label>
        <input
          value={repo}
          onChange={(e) => { setRepo(e.target.value); setNonce(''); setErr('') }}
          placeholder="github.com/your-org/your-repo"
          spellCheck={false}
          className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 text-white font-mono text-[11.5px] sm:text-[13px] placeholder:text-gray-600 focus:border-neon-green focus:outline-none"
        />
      </div>

      <div>
        <div className="text-[10.5px] font-arcade text-gray-500 mb-2">2 · PROVE IT&apos;S YOURS</div>
        {gh ? (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => call({ github: true })} disabled={!valid || busy} className={btn}>
              {busy ? 'CHECKING…' : 'CLAIM IT ▸'}
            </button>
            <span className="text-[11.5px] font-mono text-gray-500">signed in as <span className="text-neon-cyan">@{gh}</span>. We check that you can push to it.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/auth/github?next=/claim"
              onClick={() => { try { sessionStorage.setItem('cch_claim_repo', repo) } catch {} }}
              className={btn + ' inline-block'}
            >
              SIGN IN WITH GITHUB ▸
            </a>
            <span className="text-[11.5px] font-mono text-gray-500">one click. We check that you can push to the repo.</span>
          </div>
        )}
      </div>

      <details className="border-t border-dark-600 pt-3 group" open={!!nonce}>
        <summary className="cursor-pointer text-[11.5px] font-mono text-gray-500 hover:text-neon-cyan list-none">
          ▸ rather not sign in? add a file to the repo instead
        </summary>
        <div className="mt-3 space-y-3 text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
          {!nonce ? (
            <button onClick={() => call({})} disabled={!valid || busy} className={btn}>
              {busy ? '…' : 'GET MY CODE'}
            </button>
          ) : (
            <>
              <p>Create a file called <span className="text-neon-cyan">CACHORRO.md</span> at the top of the repo with this code inside:</p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 px-3 py-2 bg-black border border-dark-600 text-neon-green font-mono text-[11.5px] break-all">{nonce}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(nonce); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="px-3 border border-dark-600 text-gray-400 hover:text-neon-green font-mono text-[11.5px]"
                >
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://github.com/${r}/new/HEAD?filename=CACHORRO.md&value=${encodeURIComponent(nonce + '\n')}`}
                  target="_blank" rel="noreferrer"
                  className="px-4 py-2.5 border border-neon-cyan text-neon-cyan font-arcade text-[10.5px] hover:bg-neon-cyan hover:text-black transition-all"
                >
                  OPEN GITHUB WITH IT FILLED IN ↗
                </a>
                <button onClick={() => call({ verify: true })} disabled={busy} className={btn}>
                  {busy ? 'CHECKING…' : "DONE, CHECK IT"}
                </button>
              </div>
              <p className="text-[11.5px] text-gray-500">Commit it to your main branch. You can delete the file after.</p>
            </>
          )}
        </div>
      </details>

      {err && <div className="text-[11.5px] font-mono text-neon-red break-words">✗ {err}</div>}
    </div>
  )
}
