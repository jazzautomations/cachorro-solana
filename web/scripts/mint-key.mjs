#!/usr/bin/env node
// Admin CLI for Cachorro API keys. Runs on the box that serves the web app,
// against the same data/billing.json the app reads. No HTTP surface on purpose:
// whoever can run this already owns the server.
//
//   node scripts/mint-key.mjs mint --plan partner --label "Proof of Exploit"
//   node scripts/mint-key.mjs list
//   node scripts/mint-key.mjs label <key-or-prefix> "new label"
//   node scripts/mint-key.mjs revoke <key-or-prefix>
//
// Plans come from lib/plans.ts. `partner` is the hidden, hand-issued plan.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.BILLING_FILE || join(WEB, 'data', 'billing.json')

function planIds() {
  const src = readFileSync(join(WEB, 'lib', 'plans.ts'), 'utf8')
  const block = src.slice(src.indexOf('export const PLANS'), src.indexOf('export const PUBLIC_PLANS'))
  return [...block.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1])
}

function load() {
  if (!existsSync(DATA)) return { invoices: [], keys: [] }
  return JSON.parse(readFileSync(DATA, 'utf8'))
}

function save(s) {
  mkdirSync(dirname(DATA), { recursive: true })
  const tmp = DATA + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 }) // holds live keys
  renameSync(tmp, DATA)
}

const mask = (k) => `${k.slice(0, 8)}…${k.slice(-4)}`

function find(s, needle) {
  const hits = s.keys.filter((k) => k.key === needle || k.key.startsWith(needle))
  if (hits.length === 0) die(`no key matches ${needle}`)
  if (hits.length > 1) die(`${needle} matches ${hits.length} keys — use more characters`)
  return hits[0]
}

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function flag(args, name) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'mint') {
  const plan = flag(args, 'plan') || 'partner'
  const label = flag(args, 'label')
  const ids = planIds()
  if (!ids.includes(plan)) die(`unknown plan ${plan} — one of: ${ids.join(', ')}`)
  if (!label) die('pass --label "<who this key is for>" so you can find and revoke it later')
  const s = load()
  const key = `cch_${crypto.randomBytes(16).toString('hex')}`
  s.keys.push({ key, plan, label, createdAt: Math.floor(Date.now() / 1000), huntsUsed: {} })
  save(s)
  console.log(`minted ${plan} key for "${label}" — shown once, send it privately:`)
  console.log(key)
} else if (cmd === 'list') {
  const s = load()
  const month = new Date().toISOString().slice(0, 7)
  if (s.keys.length === 0) console.log('no keys')
  for (const k of s.keys) {
    const when = new Date(k.createdAt * 1000).toISOString().slice(0, 10)
    const used = (k.huntsUsed || {})[month] || 0
    console.log(`${mask(k.key)}  plan=${k.plan.padEnd(10)} hunts(${month})=${String(used).padEnd(4)} created=${when}  ${k.label || '(no label)'}`)
  }
} else if (cmd === 'label') {
  const [needle, ...rest] = args
  const label = rest.join(' ').trim()
  if (!needle || !label) die('usage: label <key-or-prefix> "new label"')
  const s = load()
  const k = find(s, needle)
  k.label = label
  save(s)
  console.log(`${mask(k.key)} → "${label}"`)
} else if (cmd === 'revoke') {
  const [needle] = args
  if (!needle) die('usage: revoke <key-or-prefix>')
  const s = load()
  const k = find(s, needle)
  s.keys = s.keys.filter((x) => x !== k)
  save(s)
  console.log(`revoked ${mask(k.key)} (${k.plan}, ${k.label || 'no label'}) — requests with it now get 401`)
} else {
  console.log(`usage:
  node scripts/mint-key.mjs mint --plan <${planIds().join('|')}> --label "<who>"
  node scripts/mint-key.mjs list
  node scripts/mint-key.mjs label <key-or-prefix> "<label>"
  node scripts/mint-key.mjs revoke <key-or-prefix>`)
  process.exit(cmd ? 1 : 0)
}
