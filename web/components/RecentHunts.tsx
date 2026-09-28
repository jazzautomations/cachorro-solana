'use client'

import { useEffect, useState } from 'react'
import type { RunListItem } from '@/lib/types'

const shorten = (s: string) =>
  s.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')

export default function RecentHunts() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null)

  useEffect(() => {
    fetch('/api/scans')
      .then((r) => r.json())
      .then((d) => setRuns(Array.isArray(d.runs) ? d.runs : []))
      .catch(() => setRuns([]))
  }, [])

  const color = (s: string) =>
    s === 'done' ? 'text-neon-green' : s === 'error' ? 'text-neon-red' : 'text-neon-yellow'

  return (
    <div className="border border-dark-600 bg-dark-900">
      <div className="px-3 py-2 border-b border-dark-600 bg-dark-800 flex items-center justify-between">
        <span className="text-[10px] font-arcade text-neon-green">RECENT HUNTS</span>
        <span className="text-[9px] text-gray-600 font-mono">{runs?.length ?? '—'}</span>
      </div>
      <div className="divide-y divide-dark-700">
        {runs === null ? (
          <div className="px-3 py-4 text-[10px] text-gray-700 font-mono animate-pulse">loading…</div>
        ) : runs.length === 0 ? (
          <div className="px-3 py-4 text-[10px] text-gray-700 font-mono">no hunts yet — be the first program on the board.</div>
        ) : (
          runs.map((r) => (
            <a
              key={r.id}
              href={`/scan/${r.id}`}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-dark-800 transition-colors"
            >
              <span className={`text-[9px] font-mono w-12 shrink-0 ${color(r.status)}`}>
                {r.status.toUpperCase()}
              </span>
              <span className="flex-1 min-w-0 text-[10px] sm:text-[11px] text-gray-300 font-mono truncate">
                {shorten(r.target)}
              </span>
              <span className="text-[9px] text-gray-700 font-mono shrink-0 hidden xs:inline">{r.kind}</span>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
