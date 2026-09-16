import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { LabIndex } from './types'

const DATA = join(process.cwd(), 'data', 'labs.json')

export function readLabs(): LabIndex {
  if (!existsSync(DATA)) return { generatedAt: '', source: '', labs: [] }
  try {
    return JSON.parse(readFileSync(DATA, 'utf8'))
  } catch {
    return { generatedAt: '', source: '', labs: [] }
  }
}

export const TIER_META: Record<number, { name: string; blurb: string }> = {
  0: { name: 'TIER 0 · FOUNDATIONS', blurb: 'read these first — the mental model every vuln class exploits' },
  1: { name: 'TIER 1 · THE ACCOUNT MODEL', blurb: 'where Solana bugs live: who signed, who owns, what the bytes mean' },
  2: { name: 'TIER 2 · CPI & PDAs', blurb: 'cross-program trust, derived addresses, and the edges between them' },
  3: { name: 'TIER 3 · LIFECYCLE & SYSVARS', blurb: 'account death, revival, and forged runtime inputs' },
}
