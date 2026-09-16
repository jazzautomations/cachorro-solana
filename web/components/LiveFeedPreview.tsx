'use client'

import { useEffect, useState } from 'react'

// Real events captured from run_1789547662 — fallback when no hunt is live.
const FEED: { agent: string; kind: string; text: string }[] = [
  { agent: 'researcher', kind: 'thought', text: 'Target = Coral teaching repo: 11 Sealevel bug classes, each with insecure/secure/recommended. Real metric = recall on planted bugs, zero FP on fixed variants.' },
  { agent: 'analyzer', kind: 'action', text: 'Fan-out into 3 clusters: access-control · CPI/PDA/sysvar · closing-accounts.' },
  { agent: 'devil', kind: 'verdict', text: 'F-09 CONFIRMED critical — invoke with arbitrary program id + signer-bit propagation = real drain.' },
  { agent: 'devil', kind: 'verdict', text: 'F-06 CONFIRMED high — inverted check in the "secure" variant of dir4: a real upstream bug, not a planted one.' },
  { agent: 'devil', kind: 'verdict', text: 'F-15/16/17 CONFIRMED — exit writeback stomps the zeroing; account revival survives in every variant.' },
  { agent: 'pocsmith', kind: 'poc', text: 'treatment: vault drained to 0 · control: blocked with Custom(1) — oracle: SUPPORTS' },
]

const KIND_CLS: Record<string, string> = {
  action: 'text-neon-cyan',
  thought: 'text-neon-purple',
  obs: 'text-neon-cyan',
  finding: 'text-neon-yellow',
  verdict: 'text-neon-orange',
  poc: 'text-neon-green',
  note: 'text-gray-500',
  error: 'text-neon-red',
}

interface LiveEvent { ts: number; stage: string; agent: string; kind: string; text: string }

export default function LiveFeedPreview() {
  const [n, setN] = useState(0)
  const [live, setLive] = useState<null | { id: string; target: string; events: LiveEvent[] }>(null)

  // canned replay ticker (used only when nothing is hunting)
  useEffect(() => {
    if (live) return
    const t = setInterval(() => setN((v) => (v + 1) % (FEED.length + 4)), 1400)
    return () => clearInterval(t)
  }, [live])

  // poll for a live hunt; if one exists, stream its real events
  useEffect(() => {
    let dead = false
    const tick = async () => {
      try {
        const r = await fetch('/api/scans')
        const { runs } = await r.json()
        const running = (runs || []).find((x: { status: string }) => x.status === 'running')
        if (!running) { if (!dead) setLive(null); return }
        const d = await (await fetch(`/api/scan/${running.id}`)).json()
        if (!dead && d.events?.length) setLive({ id: running.id, target: d.target, events: d.events })
      } catch { /* keep last state */ }
    }
    tick()
    const t = setInterval(tick, 4000)
    return () => { dead = true; clearInterval(t) }
  }, [])

  const shown = live ? live.events.slice(-7) : FEED.slice(0, Math.min(n, FEED.length))

  return (
    <div className="border border-dark-600 bg-black/80 text-left pixel-border-glow h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600 bg-dark-800 gap-2">
        <span className="text-[9px] sm:text-[10px] font-arcade text-neon-purple shrink-0">PACK MIND</span>
        {live ? (
          <a href={`/scan/${live.id}`} className="flex items-center gap-1.5 text-[8px] font-mono text-neon-red hover:text-neon-green min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse shrink-0" />
            <span className="truncate">LIVE: {live.target.replace('https://github.com/', '')}</span>
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-[8px] font-mono text-gray-600 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            replay of a real hunt
          </span>
        )}
      </div>
      <div className="p-3 space-y-1.5 flex-1 font-mono">
        {shown.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`text-[8px] sm:text-[9px] uppercase shrink-0 w-14 pt-px ${KIND_CLS[e.kind] || 'text-gray-500'}`}>
              {e.kind}
            </span>
            <span className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed break-words">
              <span className="text-gray-700">{e.agent} </span>
              {e.text}
            </span>
          </div>
        ))}
        {live && <span className="text-neon-green animate-blink text-[10px]">▊</span>}
        {!live && n < FEED.length && <span className="text-neon-green animate-blink text-[10px]">▊</span>}
      </div>
    </div>
  )
}
