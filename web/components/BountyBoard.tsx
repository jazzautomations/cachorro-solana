'use client'

import { useState } from 'react'
import type { Bounty } from '@/lib/types'
import { fmtUsd } from '@/lib/format'

export default function BountyBoard({ bounties, updatedAt }: { bounties: Bounty[]; updatedAt: string }) {
  const [solOnly, setSolOnly] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  const list = bounties.filter((b) => !solOnly || b.solana)
  const solCount = bounties.filter((b) => b.solana).length
  const totalUsd = bounties.filter((b) => b.solana).reduce((s, b) => s + (b.maxBounty || 0), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4 text-[9px] sm:text-[10px] font-mono">
        <button
          onClick={() => setSolOnly(true)}
          className={`px-2.5 py-1 border transition-colors ${solOnly ? 'border-neon-green text-neon-green' : 'border-dark-600 text-gray-600 hover:text-gray-400'}`}
        >
          SOLANA · {solCount}
        </button>
        <button
          onClick={() => setSolOnly(false)}
          className={`px-2.5 py-1 border transition-colors ${!solOnly ? 'border-neon-cyan text-neon-cyan' : 'border-dark-600 text-gray-600 hover:text-gray-400'}`}
        >
          ALL · {bounties.length}
        </button>
        <span className="text-gray-600 ml-auto">
          {fmtUsd(totalUsd)} on the table{updatedAt ? ` · indexed ${updatedAt.slice(0, 10)}` : ''}
        </span>
      </div>

      <div className="space-y-1.5">
        {list.map((b) => {
          const isOpen = open === b.id
          return (
            <div key={b.id} className="border border-dark-600 bg-dark-900">
              <button
                onClick={() => setOpen(isOpen ? null : b.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-800 transition-colors"
              >
                <span className="text-[11px] sm:text-sm font-mono text-white flex-1 min-w-0 truncate">
                  {b.project}
                </span>
                {b.pocType === 'required' && (
                  <span className="hidden sm:inline text-[8px] font-mono text-neon-purple border border-neon-purple/40 px-1.5 py-0.5 shrink-0">
                    PoC REQUIRED
                  </span>
                )}
                {b.kyc && (
                  <span className="hidden sm:inline text-[8px] font-mono text-gray-500 border border-dark-600 px-1.5 py-0.5 shrink-0">
                    KYC
                  </span>
                )}
                <span className="text-[10px] sm:text-xs font-mono text-neon-green shrink-0 w-16 text-right">
                  {fmtUsd(b.maxBounty)}
                </span>
                <span className="text-gray-700 text-[10px] shrink-0">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-dark-600 px-3 py-3 space-y-2.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] sm:text-[10px] font-mono text-gray-500">
                    <span>source: <a href={b.url} target="_blank" rel="noreferrer" className="text-neon-cyan hover:underline">{b.source} ↗</a></span>
                    {b.ecosystems.length > 0 && <span>ecosystems: {b.ecosystems.slice(0, 5).join(', ')}</span>}
                    {b.pocType && <span>PoC: {b.pocType}</span>}
                  </div>
                  {b.repos.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[8px] font-mono text-gray-600 uppercase">in-scope repos — pick a target:</div>
                      {b.repos.map((r) => (
                        <div key={r} className="flex items-center gap-2 min-w-0">
                          <a
                            href={`/?target=${encodeURIComponent(r)}#hunt`}
                            className="px-2 py-1 border border-neon-green/60 text-neon-green text-[9px] font-mono hover:bg-neon-green hover:text-black transition-all shrink-0"
                          >
                            HUNT ▸
                          </a>
                          <a href={r} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-gray-400 hover:text-neon-cyan truncate">
                            {r.replace('https://github.com/', '')}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] font-mono text-gray-600">
                      no public repo in scope listing — check the program page for on-chain targets
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
