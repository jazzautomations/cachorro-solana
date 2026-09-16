import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { BountyIndex } from './types'

const DATA = join(process.cwd(), 'data', 'bounties.json')

export function readBounties(): BountyIndex {
  if (!existsSync(DATA)) return { updatedAt: '', sources: {}, bounties: [] }
  try {
    return JSON.parse(readFileSync(DATA, 'utf8'))
  } catch {
    return { updatedAt: '', sources: {}, bounties: [] }
  }
}

export function solanaBounties(idx: BountyIndex) {
  return idx.bounties.filter((b) => b.solana)
}
