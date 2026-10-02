'use client'

import { STAGES } from '@/lib/stages'

type State = 'running' | 'done' | 'skipped' | 'pending-ai' | 'error' | 'queued'

interface AgentFlowProps {
  stages: Record<string, string>
  status: string
  elapsed?: number
  title?: string
}

const stateOf = (v: string | undefined): State => {
  switch (v) {
    case 'running': return 'running'
    case 'done': return 'done'
    case 'skipped': return 'skipped'
    case 'pending-ai': return 'pending-ai'
    case 'error': return 'error'
    default: return 'queued'
  }
}

export default function AgentFlow({ stages, status, elapsed, title }: AgentFlowProps) {
  const done = STAGES.filter((s) => ['done', 'skipped'].includes(stateOf(stages[s.id]))).length
  const isDone = status === 'done'
  const isFail = status === 'error'
  const pct = isDone ? 100 : Math.round((done / STAGES.length) * 100)
  const mmss =
    elapsed == null
      ? null
      : `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div className="bg-dark-900 border border-dark-600 pixel-border-glow">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-dark-600 bg-dark-800 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-neon-green' : isFail ? 'bg-neon-red' : 'bg-neon-green animate-pulse'}`} />
          <span className="text-[11.5px] sm:text-[13px] font-arcade text-neon-green truncate">
            {title || (isDone ? 'HUNT COMPLETE' : isFail ? 'HUNT FAILED' : 'THE PACK IS HUNTING')}
          </span>
        </div>
        {mmss && <span className="text-[10.5px] sm:text-[11.5px] text-gray-400 font-mono shrink-0">⏱ {mmss}</span>}
      </div>

      <div className="h-1 bg-dark-700 overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${isFail ? 'bg-neon-red' : 'bg-neon-green'} shadow-[0_0_8px_#00ff41]`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-3 sm:p-4 space-y-1.5">
        {STAGES.map((a) => {
          const st = stateOf(stages[a.id])
          const box =
            st === 'running' ? 'border-neon-green bg-dark-700 animate-pulse-glow'
            : st === 'done' ? 'border-dark-600 bg-dark-800'
            : st === 'skipped' ? 'border-dark-600 bg-dark-800'
            : st === 'error' ? 'border-neon-red bg-dark-800'
            : st === 'pending-ai' ? 'border-dark-700 bg-dark-900 opacity-50'
            : 'border-dark-700 bg-dark-900 opacity-60'
          const icon =
            st === 'done' ? '✓' : st === 'error' ? '✕' : st === 'skipped' ? '–' : a.icon
          const iconCls =
            st === 'running' ? 'border-neon-green text-neon-green'
            : st === 'done' ? 'border-neon-green text-neon-green'
            : st === 'error' ? 'border-neon-red text-neon-red'
            : st === 'pending-ai' ? 'border-neon-purple text-neon-purple'
            : 'border-dark-600 text-gray-600'
          const nameCls =
            st === 'running' ? 'text-neon-green'
            : st === 'done' ? 'text-green-500'
            : st === 'error' ? 'text-neon-red'
            : st === 'skipped' ? 'text-gray-400'
            : 'text-gray-500'
          return (
            <div key={a.id} className={`agent-node flex items-center gap-3 px-2.5 py-2 border transition-all duration-300 ${box}`}>
              <div className={`w-7 h-7 shrink-0 flex items-center justify-center text-sm font-bold border ${iconCls}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] sm:text-[13px] font-bold ${nameCls}`}>{a.name}</div>
                <div className="text-[10.5px] sm:text-[11.5px] text-gray-500 truncate">
                  {st === 'pending-ai' ? 'AI stage · coming online' : a.label}
                </div>
              </div>
              <div className="text-[10.5px] sm:text-[11.5px] font-mono shrink-0">
                {st === 'running' && <span className="text-neon-green animate-pulse">● RUNNING</span>}
                {st === 'done' && <span className="text-gray-500">DONE</span>}
                {st === 'skipped' && <span className="text-gray-500">SKIPPED</span>}
                {st === 'error' && <span className="text-neon-red">FAIL</span>}
                {st === 'pending-ai' && <span className="text-neon-purple">M1</span>}
                {st === 'queued' && <span className="text-gray-600">QUEUED</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
