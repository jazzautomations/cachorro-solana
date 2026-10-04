import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

export const TREASURY = process.env.CACHORRO_TREASURY || '7sZ1fsa3UEUPodZBxbE9W61QPE3vxfgkcrWD6W9LsYh3'
export const RPC = process.env.CACHORRO_RPC || 'https://api.mainnet-beta.solana.com'
const DATA = join(process.cwd(), 'data', 'billing.json')

export interface Plan {
  id: string
  name: string
  priceSol: number // 0 = free
  unit: 'mo' | 'engagement'
  huntsPerMonth: number // -1 = unlimited
  modes: string[]
  blurb: string
  anchor: string // the audit-price comparison line
  perks: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free', name: 'SNIFF', priceSol: 0, unit: 'mo', huntsPerMonth: 3, modes: ['quick'],
    blurb: 'watch the pack think on your program',
    anchor: 'the free scan a firm charges a discovery call for',
    perks: ['3 QUICK hunts / month', 'live PACK MIND feed', 'static surface map + bridge map', 'public receipt per run'],
  },
  {
    id: 'payg', name: 'PAY-PER-PROOF', priceSol: 0.5, unit: 'engagement', huntsPerMonth: -1, modes: ['quick', 'deep'],
    blurb: 'one program, one DEEP hunt — every finding with an executable PoC or it does not ship',
    anchor: '~$100 to know if you are exploitable before anyone else finds out',
    perks: [
      'DEEP-mode hunt on one program',
      'PoC-gated findings — maybes die at the gate',
      'web2↔web3 bridge map (AMARELO tier)',
      'on-chain receipt — verify trustless',
    ],
  },
  {
    id: 'preaudit', name: 'PRE-AUDIT', priceSol: 2, unit: 'engagement', huntsPerMonth: 1, modes: ['quick', 'deep', 'full'],
    blurb: 'FULL-mode hunt on your whole codebase before the audit firm bills you $50K+',
    anchor: '1% of an audit engagement — find the holes before they invoice you for finding them',
    perks: [
      'FULL-mode hunt · all survivors PoC\'d',
      'business-logic + web2↔web3 surface',
      'on-chain receipt + coverage map',
      'dup-check vs every public audit',
      're-run after you patch — verify the fix closed it',
    ],
  },
  {
    id: 'postaudit', name: 'POST-AUDIT', priceSol: 4, unit: 'mo', huntsPerMonth: -1, modes: ['quick', 'deep', 'full'],
    blurb: 'the pack never sleeps — audits expire on merge day, receipts don\'t',
    anchor: 'your $150K report is stale the first time you ship — we re-prove every upgrade',
    perks: [
      'continuous re-hunts · all modes',
      'stale-receipt watchlist — auto re-hunt on upgrade',
      'API key for CI — block deploy without a live receipt',
      'priority queue · attestation on every report',
    ],
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

/** 1:1 binding — one payment signature can redeem at most one invoice. */
export function signatureConsumed(signature: string, exceptInvoiceId?: string): boolean {
  return load().invoices.some((i) => i.signature === signature && i.id !== exceptInvoiceId)
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
  if (entry && !PLANS.some((p) => p.id === entry.plan)) {
    // key references a retired plan — fail closed to anonymous, never crash
    return { plan: PLANS[0], keyEntry: null }
  }
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
