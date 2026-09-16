import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

export const TREASURY = process.env.CACHORRO_TREASURY || '6Ze5CGeF77xyS5p7aTcZUMKR86g8XjjUM3sTePFfDAjb'
export const RPC = process.env.CACHORRO_RPC || 'https://api.devnet.solana.com'
const DATA = join(process.cwd(), 'data', 'billing.json')

export interface Plan {
  id: string
  name: string
  priceSol: number // 0 = free
  huntsPerMonth: number // -1 = unlimited
  modes: string[]
  blurb: string
  perks: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free', name: 'STRAY', priceSol: 0, huntsPerMonth: 3, modes: ['quick', 'deep'],
    blurb: 'sniff around',
    perks: ['3 quick hunts / month', 'live PACK MIND feed', 'bounty board access', 'labs access'],
  },
  {
    id: 'hunter', name: 'HUNTER', priceSol: 0.5, huntsPerMonth: 30, modes: ['quick', 'deep', 'full'],
    blurb: 'runs with the pack',
    perks: ['30 hunts / month · all modes', 'bounty alerts on criticals', 'stale-receipt watchlist', 'report export'],
  },
  {
    id: 'pack', name: 'ALPHA', priceSol: 2, huntsPerMonth: -1, modes: ['quick', 'deep', 'full'],
    blurb: 'leads the hunt',
    perks: ['unlimited hunts · all modes', 'API key for CI/CD', 'priority queue', 'attestation on every report'],
  },
]

export interface Invoice {
  id: string
  plan: string
  amountLamports: number
  memo: string
  createdAt: number
  paid?: boolean
  signature?: string
  key?: string
}

interface Store { invoices: Invoice[]; keys: { key: string; plan: string; createdAt: number; huntsUsed: Record<string, number> }[] }

function load(): Store {
  if (!existsSync(DATA)) return { invoices: [], keys: [] }
  try { return JSON.parse(readFileSync(DATA, 'utf8')) } catch { return { invoices: [], keys: [] } }
}
function save(s: Store) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  const tmp = DATA + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, DATA)
}

export function createInvoice(planId: string): Invoice | null {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan || plan.priceSol <= 0) return null
  const s = load()
  const inv: Invoice = {
    id: `inv_${crypto.randomBytes(6).toString('hex')}`,
    plan: planId,
    amountLamports: Math.round(plan.priceSol * 1e9),
    memo: `cachorro:${planId}:${crypto.randomBytes(4).toString('hex')}`,
    createdAt: Math.floor(Date.now() / 1000),
  }
  s.invoices.push(inv)
  save(s)
  return inv
}

export function getInvoice(id: string): Invoice | null {
  return load().invoices.find((i) => i.id === id) ?? null
}

export function markPaid(id: string, signature: string): { key: string; plan: string } | null {
  const s = load()
  const inv = s.invoices.find((i) => i.id === id)
  if (!inv || inv.paid) return inv ? { key: inv.key!, plan: inv.plan } : null
  const key = `cch_${crypto.randomBytes(16).toString('hex')}`
  inv.paid = true
  inv.signature = signature
  inv.key = key
  s.keys.push({ key, plan: inv.plan, createdAt: Math.floor(Date.now() / 1000), huntsUsed: {} })
  save(s)
  return { key, plan: inv.plan }
}

export function lookupKey(key: string) {
  return load().keys.find((k) => k.key === key) ?? null
}

export function planFor(key: string | null): { plan: Plan; keyEntry: ReturnType<typeof lookupKey> } {
  const entry = key ? lookupKey(key) : null
  const plan = entry ? PLANS.find((p) => p.id === entry.plan)! : PLANS[0]
  return { plan, keyEntry: entry }
}

// quota: hunts this calendar month. Free tier counts against MAX_CONCURRENT-shared pool.
export function huntsLeft(key: string | null, monthHunts: number): number {
  const { plan, keyEntry } = planFor(key)
  if (plan.huntsPerMonth < 0) return -1
  const month = new Date().toISOString().slice(0, 7)
  const used = keyEntry ? (keyEntry.huntsUsed[month] || 0) : monthHunts
  return Math.max(0, plan.huntsPerMonth - used)
}

export function recordHunt(key: string) {
  const s = load()
  const k = s.keys.find((x) => x.key === key)
  if (!k) return
  const month = new Date().toISOString().slice(0, 7)
  k.huntsUsed[month] = (k.huntsUsed[month] || 0) + 1
  save(s)
}
