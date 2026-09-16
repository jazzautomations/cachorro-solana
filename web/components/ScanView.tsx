'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AgentFlow from './AgentFlow'
import AgentFeed from './AgentFeed'
import Terminal from './Terminal'
import type { LintSection, ScanReport } from '@/lib/types'

const SEV_CLS: Record<string, string> = {
  critical: 'text-neon-red border-neon-red',
  high: 'text-neon-orange border-neon-orange',
  medium: 'text-neon-yellow border-neon-yellow',
  low: 'text-gray-500 border-dark-600',
}

const TILES: { key: string; label: string; color: string }[] = [
  { key: 'rust files', label: 'RUST FILES', color: 'text-neon-green' },
  { key: 'instruction handlers (pub fn)', label: 'HANDLERS', color: 'text-neon-cyan' },
  { key: 'Accounts structs', label: '#[derive(Accounts)]', color: 'text-neon-yellow' },
  { key: 'UncheckedAccount/AccountInfo', label: 'UNCHECKED ACCTS', color: 'text-neon-orange' },
  { key: 'zk modules', label: 'ZK MODULES', color: 'text-neon-purple' },
]

function Section({ s, open }: { s: LintSection; open: boolean }) {
  const [expanded, setExpanded] = useState(open)
  const n = s.lines.length
  return (
    <div className="border border-dark-600 bg-dark-900">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-800 transition-colors"
      >
        <span className="text-neon-green text-[10px] w-3 shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="flex-1 min-w-0 text-[10px] sm:text-[11px] text-gray-300 font-mono break-words">{s.title}</span>
        <span className={`text-[10px] font-arcade shrink-0 ${n ? 'text-neon-yellow' : 'text-gray-700'}`}>{n}</span>
      </button>
      {expanded && (
        <div className="border-t border-dark-700 max-h-80 overflow-auto">
          {n === 0 ? (
            <div className="px-3 py-3 text-[10px] text-gray-700 font-mono">
              {s.raw.length ? s.raw.join('\n') : 'nothing matched — clean on this heuristic.'}
            </div>
          ) : (
            s.lines.map((l, i) => (
              <div key={i} className="px-3 py-1.5 border-b border-dark-800 last:border-b-0">
                <div className="text-[9px] text-neon-cyan font-mono break-all">{l.file}:{l.line}</div>
                <div className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">{l.code}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function ScanView({ id }: { id: string }) {
  const [data, setData] = useState<ScanReport | null>(null)
  const [err, setErr] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/scan/${id}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || `HTTP ${res.status}`); return true }
      setData(j)
      return j.status !== 'running'
    } catch {
      return false
    }
  }, [id])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      const finished = await poll()
      if (!alive || finished) return
      timer = setTimeout(loop, 2000)
    }
    loop()
    return () => { alive = false; clearTimeout(timer) }
  }, [poll])

  useEffect(() => {
    if (data && data.status !== 'running') {
      if (data.updatedAt && data.createdAt) setElapsed(data.updatedAt - data.createdAt)
      return
    }
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [data])

  if (err) {
    return (
      <div className="border border-neon-red bg-dark-900 p-4 text-[11px] font-mono text-neon-red">
        ✗ {err}
      </div>
    )
  }
  if (!data) {
    return <div className="text-[11px] font-mono text-gray-600 animate-pulse">▸ loading hunt {id}…</div>
  }

  const logs = [
    ...(data.fetchLog?.length ? ['── fetch ──', ...data.fetchLog] : []),
    ...(data.staticLog?.length ? ['', '── static ──', ...data.staticLog] : []),
  ]
  const sections = data.sections || []
  const running = data.status === 'running'
  const sev = (data.findings || []).reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* target header */}
      <div className="border border-dark-600 bg-dark-900 p-3 sm:p-4">
        <div className="text-[9px] text-gray-600 font-mono mb-1">TARGET · {data.kind}{data.cluster ? ` · ${data.cluster}` : ''}{data.engine ? ` · ${data.engine}` : ''}</div>
        <div className="text-[11px] sm:text-sm text-neon-green font-mono break-all">{data.target}</div>
        <div className="text-[9px] text-gray-700 font-mono mt-1">{data.id}</div>
      </div>

      {/* verdict banner — the outcome first, then the process */}
      {!running && data.status === 'done' && (
        <div className="border border-neon-green bg-dark-900 p-4 sm:p-5 pixel-border-glow">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[11px] sm:text-sm font-arcade text-neon-green">HUNT COMPLETE</span>
            <div className="flex gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).filter((s) => sev[s]).map((s) => (
                <span key={s} className={`text-[8px] sm:text-[9px] font-mono border px-1.5 py-0.5 uppercase ${SEV_CLS[s]}`}>
                  {sev[s]} {s}
                </span>
              ))}
            </div>
            <span className="text-[9px] font-mono text-gray-600 ml-auto">⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
          </div>
          {data.reportFile && (
            <a href={`/api/scan/${data.id}/report`} target="_blank"
               className="mt-3 inline-block text-[10px] sm:text-xs font-mono text-neon-cyan hover:text-neon-green transition-colors">
              ▸ {data.reportFile} — full hunt report ↗
            </a>
          )}
        </div>
      )}

      <AgentFlow stages={data.stages || {}} status={data.status} elapsed={elapsed} />

      {(data.events?.length || running) && (
        <AgentFeed events={data.events || []} live={running} />
      )}

      {/* findings — candidates that passed through ANALYZE; survivors = post-DEVIL */}
      {data.findings && data.findings.length > 0 && (
        <div>
          <h2 className="text-[11px] sm:text-sm font-arcade text-neon-green mb-3">
            [ FINDINGS · {data.findings.length}
            {data.survivorCount != null && ` · ${data.survivorCount} SURVIVED THE DEVIL`} ]
          </h2>
          <div className="border border-dark-600 bg-dark-900 divide-y divide-dark-700">
            {data.findings.map((f, i) => (
              <details key={i} className="group">
                <summary className="flex items-center gap-2 sm:gap-3 px-3 py-2 cursor-pointer hover:bg-dark-800 transition-colors list-none">
                  <span className={`text-[8px] sm:text-[9px] font-mono border px-1.5 py-0.5 uppercase shrink-0 ${SEV_CLS[f.severity] || SEV_CLS.low}`}>
                    {f.severity}
                  </span>
                  <span className="flex-1 min-w-0 text-[10px] sm:text-[11px] text-gray-300 font-mono truncate">
                    {f.id && <span className="text-gray-600">{f.id} </span>}{f.vulnerability_type}
                  </span>
                  <span className="text-[9px] text-neon-cyan font-mono truncate hidden sm:inline max-w-[40%]">
                    {f.file}{f.line_range ? `:${f.line_range}` : ''}
                  </span>
                  <span className="text-neon-green text-[9px] shrink-0 group-open:rotate-90 transition-transform">▸</span>
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-dark-700">
                  {f.function && (
                    <div className="text-[9px] text-gray-600 font-mono">fn: {f.function}</div>
                  )}
                  {f.description && (
                    <p className="text-[10px] sm:text-[11px] text-gray-400 font-mono leading-relaxed whitespace-pre-wrap break-words">{f.description}</p>
                  )}
                  {f.impact && (
                    <p className="text-[10px] sm:text-[11px] text-neon-yellow font-mono leading-relaxed break-words">impact: {f.impact}</p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* final report link — only shown while running (done hunts get the verdict banner) */}
      {running && data.reportFile && (
        <a
          href={`/api/scan/${data.id}/report`}
          target="_blank"
          className="flex items-center justify-between border border-neon-green bg-dark-900 px-4 py-3 hover:bg-dark-800 transition-colors"
        >
          <span className="text-[10px] sm:text-xs font-arcade text-neon-green">[ HUNT REPORT READY ]</span>
          <span className="text-[9px] sm:text-[10px] font-mono text-neon-cyan">{data.reportFile} ↗</span>
        </a>
      )}

      {data.status === 'error' && (
        <div className="border border-neon-red bg-dark-900 p-3 text-[11px] font-mono text-neon-red break-words">
          ✗ {data.error || 'job failed'}
        </div>
      )}
      {data.staticNote && (
        <div className="border border-neon-yellow bg-dark-900 p-3 text-[10px] sm:text-[11px] font-mono text-neon-yellow break-words">
          ⚠ {data.staticNote}
        </div>
      )}

      {(logs.length > 0 || running) && (
        <Terminal
          title={`ENGINE LOG · ${data.id}`}
          lines={logs}
          height="h-56 sm:h-64"
          live={running}
          empty="spawning runner…"
        />
      )}

      {/* on-chain account */}
      {data.onchain && (
        <div>
          <h2 className="text-[11px] sm:text-sm font-arcade text-neon-green mb-3">[ ON-CHAIN ACCOUNT ]</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: 'OWNER (LOADER)', v: data.onchain.owner ?? '—', mono: true },
              { l: 'EXECUTABLE', v: String(data.onchain.executable ?? '—') },
              { l: 'LAMPORTS', v: data.onchain.lamports?.toLocaleString() ?? '—' },
              { l: 'DATA LENGTH', v: data.onchain.dataLen != null ? `${data.onchain.dataLen} B` : '—' },
            ].map((t) => (
              <div key={t.l} className="border border-dark-600 bg-dark-900 p-3">
                <div className="text-[8px] sm:text-[9px] text-gray-600 mb-1">{t.l}</div>
                <div className={`text-neon-cyan ${t.mono ? 'text-[9px] break-all font-mono' : 'text-base sm:text-lg font-bold'}`}>{t.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* static summary tiles */}
      {data.summary && (
        <div>
          <h2 className="text-[11px] sm:text-sm font-arcade text-neon-green mb-3">[ STATIC REPORT ]</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {TILES.map((t) => (
              <div key={t.key} className="border border-dark-600 bg-dark-900 p-3 text-center">
                <div className={`text-lg sm:text-2xl font-bold ${t.color}`}>{data.summary?.[t.key] ?? '—'}</div>
                <div className="text-[8px] sm:text-[9px] text-gray-600 mt-1 leading-tight">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* zk modules */}
      {data.zkModules && data.zkModules.length > 0 && (
        <div>
          <h2 className="text-[11px] sm:text-sm font-arcade text-neon-purple mb-3">[ ZK SURFACE ]</h2>
          <div className="border border-dark-600 bg-dark-900 p-3 space-y-1">
            {data.zkModules.map((m) => (
              <div key={m} className="text-[10px] text-neon-purple font-mono break-all">◆ {m}</div>
            ))}
          </div>
        </div>
      )}

      {/* lint sections */}
      {sections.length > 0 && (
        <div>
          <h2 className="text-[11px] sm:text-sm font-arcade text-neon-green mb-3">
            [ ATTACK SURFACE · {sections.length} HEURISTICS ]
          </h2>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <Section key={i} s={s} open={i === 0} />
            ))}
          </div>
          <p className="text-[9px] text-gray-700 mt-3 leading-relaxed">
            Static heuristics are leads, not findings. The AI stages (ANALYZE → DEVIL → POC) turn a lead
            into an exploit proven on a local validator — they come online in M1.
          </p>
        </div>
      )}
    </div>
  )
}
