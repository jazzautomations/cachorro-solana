'use client'

import { useEffect, useRef } from 'react'
import type { HuntEvent } from '@/lib/types'

const KIND_STYLE: Record<string, { icon: string; cls: string; label: string }> = {
  action:  { icon: '▸', cls: 'text-neon-cyan',   label: 'ACTION' },
  thought: { icon: '…', cls: 'text-neon-purple', label: 'THINKING' },
  obs:     { icon: '◈', cls: 'text-neon-cyan',   label: 'OBS' },
  finding: { icon: '!', cls: 'text-neon-yellow', label: 'FINDING' },
  verdict: { icon: '⚖', cls: 'text-neon-orange', label: 'VERDICT' },
  poc:     { icon: '⚡', cls: 'text-neon-green',  label: 'POC' },
  note:    { icon: '·', cls: 'text-gray-400',    label: 'NOTE' },
  error:   { icon: '✕', cls: 'text-neon-red',    label: 'ERROR' },
}

function hhmmss(ts: number): string {
  const d = new Date(ts * 1000)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export default function AgentFeed({ events, live }: { events: HuntEvent[]; live: boolean }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [events.length])

  return (
    <div className="bg-dark-900 border border-dark-600 pixel-border-glow">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-dark-600 bg-dark-800">
        <span className="text-[11.5px] sm:text-[13px] font-arcade text-neon-purple">PACK MIND</span>
        <span className="text-[10.5px] sm:text-[11.5px] font-mono text-gray-500">
          {events.length ? `${events.length} events` : live ? 'agents warming up…' : 'no events'}
        </span>
      </div>
      <div className="max-h-72 sm:max-h-96 overflow-y-auto p-2 sm:p-3 space-y-1 font-mono">
        {events.map((e, i) => {
          const k = KIND_STYLE[e.kind] || KIND_STYLE.note
          return (
            <div key={i} className="flex items-start gap-2 px-1.5 py-1 border-l-2 border-dark-700 hover:bg-dark-800/60">
              <span className="text-[10.5px] text-gray-600 shrink-0 pt-px w-14">{hhmmss(e.ts)}</span>
              <span className={`text-[10.5px] shrink-0 pt-px w-16 ${k.cls}`}>{k.icon} {k.label}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[10.5px] text-gray-500 mr-2">[{e.agent}·{e.stage}]</span>
                <span className={`text-[11.5px] sm:text-[11px] break-words ${
                  e.kind === 'finding' || e.kind === 'verdict'
                    ? /critical|CONFIRMED/i.test(e.text) ? 'text-neon-yellow animate-glitch' : 'text-neon-yellow'
                    : e.kind === 'error' ? 'text-neon-red' : 'text-gray-300'
                }`}>
                  {e.text}
                </span>
              </div>
            </div>
          )
        })}
        {live && (
          <div className="px-1.5 py-1 text-[11.5px] text-neon-purple animate-pulse">▸ the pack is thinking…</div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
