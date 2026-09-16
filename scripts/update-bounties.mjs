#!/usr/bin/env node
// update-bounties.mjs — index Solana bug bounties/VDPs into web/data/bounties.json
// Sources: immunefi.com (server-rendered list + per-program scope pages for github repos).
// Multi-source ready: each source fn returns {source, status, bounties[]}; failures are
// recorded, never fatal. Run: node scripts/update-bounties.mjs

import { mkdirSync, writeFileSync, readFileSync, renameSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'web', 'data', 'bounties.json')
const UA = 'cachorro-bounty-index/0.1 (+whitehat; local hunts only)'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Immunefi's /bug-bounty/ is server-rendered; the catalog sits in the RSC payload
// as "bounties":[{...}]. Unescape the pushed string chunks, then bracket-extract the array.
function extractBountiesArray(html) {
  let buf = ''
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
  let m
  while ((m = re.exec(html))) {
    try { buf += JSON.parse('"' + m[1] + '"') } catch { /* partial chunk — skip */ }
  }
  const k = buf.indexOf('"bounties":[')
  if (k < 0) throw new Error('bounties array not found in RSC payload')
  const start = buf.indexOf('[', k)
  let depth = 0, end = -1
  for (let i = start; i < buf.length; i++) {
    if (buf[i] === '[') depth++
    else if (buf[i] === ']' && --depth === 0) { end = i; break }
  }
  if (end < 0) throw new Error('unterminated bounties array')
  return JSON.parse(buf.slice(start, end + 1))
}

// scope page → github repo roots (org/repo) mentioned as in-scope assets
function extractRepos(html) {
  const repos = new Set()
  const re = /https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g
  let m
  while ((m = re.exec(html))) {
    const repo = m[1].replace(/\.git$/, '').replace(/[./]+$/, '')
    if (/^(sponsors|login|signup|topics|collections|orgs)\b/i.test(repo)) continue
    repos.add(`https://github.com/${repo}`)
  }
  return [...repos]
}

// rank repos: Solana-flavored first, EVM/other-chain/docs last; cap the list
const SOL_HINT = /solana|anchor|spl[-_]|program|sbpf|token-2022|whirlpool|marginfi|drift|jup|metaplex|pyth|wormhole|rust/i
const OFF_HINT = /evm|solidity|ethereum|aptos|sui|cosmos|starknet|adapter|docs?($|[-_.])|audit|website|frontend|dashboard|ui($|[-_.])|sdk|cli|bot|subgraph|keeper|monitor|example|hardhat|foundry|brownie/i

function rankRepos(repos) {
  return repos
    .map((r) => {
      const name = r.split('/').slice(-1)[0]
      let score = 0
      if (SOL_HINT.test(name)) score += 2
      if (OFF_HINT.test(name)) score -= 2
      return { r, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.r)
}

async function sourceImmunefi() {
  const list = await fetchText('https://immunefi.com/bug-bounty/')
  const raw = extractBountiesArray(list)
  const bounties = raw.map((b) => ({
    id: `immunefi:${b.slug}`,
    source: 'immunefi',
    project: b.project,
    slug: b.slug,
    url: `https://immunefi.com${b.url}`,
    maxBounty: b.maxBounty ?? null,
    kyc: !!b.kyc,
    pocType: b.proofOfConceptType ?? null,
    ecosystems: b.tags?.ecosystem ?? [],
    languages: b.tags?.language ?? [],
    solana: (b.tags?.ecosystem ?? []).some((e) => /solana/i.test(e)),
    logo: b.logo ?? null,
    repos: [],
    updatedDate: b.updatedDate ?? null,
  }))

  // scope pages only for solana-tagged programs — repo roots feed the HUNT button
  const sol = bounties.filter((b) => b.solana)
  for (const b of sol) {
    try {
      const page = await fetchText(b.url)
      b.repos = rankRepos(extractRepos(page))
    } catch (e) {
      b.reposError = String(e.message || e)
    }
    await sleep(1200) // be polite
  }
  return bounties
}

const SOURCES = [
  ['immunefi', sourceImmunefi],
  // future: superteam earn (earnapi unreachable from this host), cantina, hackenproof
]

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { bounties: [] }
const sources = {}
const all = []

for (const [name, fn] of SOURCES) {
  try {
    const got = await fn()
    sources[name] = { status: 'ok', count: got.length }
    all.push(...got)
  } catch (e) {
    sources[name] = { status: 'error', error: String(e.message || e) }
    all.push(...prev.bounties.filter((b) => b.source === name)) // keep stale rather than drop
  }
}

const out = {
  updatedAt: new Date().toISOString(),
  sources,
  bounties: all.sort((a, b) => (b.maxBounty ?? 0) - (a.maxBounty ?? 0)),
}

mkdirSync(dirname(OUT), { recursive: true })
const tmp = OUT + '.tmp'
writeFileSync(tmp, JSON.stringify(out, null, 2))
renameSync(tmp, OUT)

const solCount = all.filter((b) => b.solana).length
console.log(`bounties.json: ${all.length} total, ${solCount} solana —`, JSON.stringify(sources))
