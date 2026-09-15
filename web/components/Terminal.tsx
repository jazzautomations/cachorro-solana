'use client'

import { useEffect, useRef } from 'react'

interface TerminalProps {
  title?: string
  lines: string[]
  height?: string
  live?: boolean
  empty?: string
}

/** Read-only log viewer. Shows what the engine actually printed — no fake commands. */
export default function Terminal({
  title = 'CACHORRO TERMINAL',
  lines,
  height = 'h-48',
  live = false,
  empty = 'waiting for output…',
}: TerminalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  const color = (l: string) => {
    if (l.startsWith('[+]') || l.includes('✓')) return 'text-neon-green'
    if (l.startsWith('[!]') || l.toLowerCase().includes('error') || l.toLowerCase().includes('failed')) return 'text-neon-red'
    if (l.startsWith('[~]')) return 'text-neon-yellow'
    if (l.startsWith('[*]')) return 'text-neon-cyan'
    return 'text-gray-400'
  }

  return (
    <div className="border border-dark-600 bg-dark-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600 bg-dark-800">
        <span className="text-[10px] text-neon-green font-arcade truncate">{title}</span>
        <div className="flex gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-neon-red" />
          <div className="w-2 h-2 rounded-full bg-neon-yellow" />
          <div className="w-2 h-2 rounded-full bg-neon-green" />
        </div>
      </div>
      <div ref={ref} className={`${height} overflow-auto p-3 font-mono text-[10px] sm:text-xs leading-relaxed bg-black`}>
        {lines.length === 0 ? (
          <span className="text-gray-700 animate-pulse">▸ {empty}</span>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${color(l)}`}>{l}</div>
          ))
        )}
        {live && <span className="text-neon-green animate-blink">▊</span>}
      </div>
    </div>
  )
}
