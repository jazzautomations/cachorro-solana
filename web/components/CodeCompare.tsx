'use client'

import { useState } from 'react'

const TABS = [
  { key: 'insecure', label: 'VULNERABLE', cls: 'text-neon-red border-neon-red' },
  { key: 'secure', label: 'SECURE', cls: 'text-neon-green border-neon-green' },
  { key: 'recommended', label: 'RECOMMENDED', cls: 'text-neon-cyan border-neon-cyan' },
] as const

export default function CodeCompare({
  insecure,
  secure,
  recommended,
}: {
  insecure: string | null
  secure: string | null
  recommended: string | null
}) {
  const variants = { insecure, secure, recommended }
  const available = TABS.filter((t) => variants[t.key])
  const [tab, setTab] = useState(available[0]?.key ?? 'insecure')
  const code = variants[tab]

  return (
    <div className="border border-dark-600 bg-black/80">
      <div className="flex border-b border-dark-600 bg-dark-800">
        {available.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[8px] sm:text-[9px] font-arcade border-r border-dark-600 transition-colors ${
              tab === t.key ? t.cls + ' bg-dark-900' : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto px-3 py-2 text-[8px] font-mono text-gray-700">rust · anchor</span>
      </div>
      <pre className="p-3 sm:p-4 text-[9px] sm:text-[11px] font-mono leading-relaxed overflow-x-auto text-gray-300 max-h-[520px] overflow-y-auto">
        {code}
      </pre>
    </div>
  )
}
