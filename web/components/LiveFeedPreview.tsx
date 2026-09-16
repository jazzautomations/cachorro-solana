'use client'

import { useEffect, useState } from 'react'

// Real events captured from run_1789547662_fca40c — the pack hunting sealevel-attacks.
const FEED: { agent: string; kind: string; text: string }[] = [
  { agent: 'devin-researcher', kind: 'thought', text: 'Alvo = repo didático da Coral: 11 classes de bug Sealevel. Métrica real = recall nos plantados + zero FP nas variantes corrigidas.' },
  { agent: 'devin-analyzer', kind: 'action', text: 'Fan-out em 3 clusters: access-control · CPI/PDA/sysvar · closing-accounts.' },
  { agent: 'devil-advocate', kind: 'verdict', text: 'F-09 CONFIRMED critical — invoke com program id arbitrário + signer-bit propagation = drain real.' },
  { agent: 'devil-advocate', kind: 'verdict', text: 'F-06 CONFIRMED high — check invertido no "secure" do dir4: bug upstream real, não plantado.' },
  { agent: 'devil-advocate', kind: 'verdict', text: 'F-15/16/17 CONFIRMED — exit writeback pisa o zeroing; revival segue em todas variantes.' },
  { agent: 'devin-pocsmith', kind: 'poc', text: 'treatment: vault drenado · control: bloqueado com Custom(1) — oráculo: SUPPORTS' },
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

export default function LiveFeedPreview() {
  const [n, setN] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % (FEED.length + 4)), 1400)
    return () => clearInterval(t)
  }, [])

  const shown = FEED.slice(0, Math.min(n, FEED.length))

  return (
    <div className="border border-dark-600 bg-black/80 text-left pixel-border-glow">
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-600 bg-dark-800">
        <span className="text-[9px] sm:text-[10px] font-arcade text-neon-purple">PACK MIND · AO VIVO</span>
        <span className="flex items-center gap-1.5 text-[8px] font-mono text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-red animate-pulse" />
          capturado de uma caçada real
        </span>
      </div>
      <div className="p-3 space-y-1.5 min-h-[168px] sm:min-h-[188px] font-mono">
        {shown.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`text-[8px] sm:text-[9px] uppercase shrink-0 w-14 pt-px ${KIND_CLS[e.kind]}`}>
              {e.kind}
            </span>
            <span className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed break-words">
              <span className="text-gray-700">{e.agent} </span>
              {e.text}
            </span>
          </div>
        ))}
        {n < FEED.length && <span className="text-neon-green animate-blink text-[10px]">▊</span>}
      </div>
    </div>
  )
}
