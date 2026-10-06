import fs from 'fs'
import path from 'path'
import crypto from 'node:crypto'

export const CACHORRO_ROOT =
  process.env.CACHORRO_ROOT || path.resolve(process.cwd(), '..')

export const RUNNER = path.join(CACHORRO_ROOT, 'scripts', 'run-job.sh')
const DEVIN_RUNNER = path.join(CACHORRO_ROOT, 'scripts', 'run-job-devin.sh')

/** Devin is the default engine; CACHORRO_ENGINE=static forces the deterministic-only runner. */
export function pickRunner(): string {
  if (process.env.CACHORRO_ENGINE === 'static') return RUNNER
  return fs.existsSync(DEVIN_RUNNER) ? DEVIN_RUNNER : RUNNER
}
export const RUNS_DIR = path.join(CACHORRO_ROOT, 'cachorro-out', 'runs')

/** Throws if the engine isn't where we think it is — fail loud, not silently mock. */
export function assertEngine(): void {
  if (!fs.existsSync(RUNNER)) {
    throw new Error(
      `cachorro engine not found: ${RUNNER} (set CACHORRO_ROOT)`
    )
  }
}

export const ID_RE = /^run_\d+_[a-f0-9]{6}$/
export const REPO_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?\/?$/
export const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function isValidId(id: string): boolean {
  return ID_RE.test(id)
}

export function runDir(id: string): string {
  if (!isValidId(id)) throw new Error('invalid job id')
  return path.join(RUNS_DIR, id)
}

export { STAGES } from './stages'
export type { Stage } from './stages'

export * from './types'
import type { Finding, JobStatus, LintSection, ScanReport } from './types'

function tail(file: string, n = 40): string[] | undefined {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const lines = raw.split('\n')
    while (lines.length && lines[lines.length - 1] === '') lines.pop()
    return lines.slice(-n)
  } catch {
    return undefined
  }
}

/** `key: value` lines produced by static-scan.sh */
function parseSummary(file: string): Record<string, string> | undefined {
  try {
    const out: Record<string, string> = {}
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (line.startsWith('STATIC SCAN SUMMARY')) continue
      const i = line.indexOf(':')
      if (i <= 0) continue
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    return out
  } catch {
    return undefined
  }
}

/** `### TITLE ###` sections holding `path:line:code` grep -n output. */
function parseLints(file: string, stripPrefix: string): LintSection[] | undefined {
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  const sections: LintSection[] = []
  let cur: LintSection | null = null
  for (const line of raw.split('\n')) {
    const header = line.match(/^###\s*(.*?)\s*###\s*$/)
    if (header) {
      cur = { title: header[1], lines: [], raw: [] }
      sections.push(cur)
      continue
    }
    if (!cur || !line.trim()) continue
    cur.raw.push(line)
    const m = line.match(/^(.*?):(\d+):(.*)$/)
    if (m) {
      let f = m[1]
      if (f.startsWith(stripPrefix)) f = f.slice(stripPrefix.length).replace(/^\/+/, '')
      cur.lines.push({ file: f, line: Number(m[2]), code: m[3].trim() })
    }
  }
  return sections
}

function parseZk(file: string, stripPrefix: string): string[] | undefined {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const mods: string[] = []
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('###')) continue
      if (!t.endsWith('.rs')) continue
      mods.push(t.startsWith(stripPrefix) ? t.slice(stripPrefix.length).replace(/^\/+/, '') : t)
    }
    return mods
  } catch {
    return undefined
  }
}

function parseOnchain(file: string): ScanReport['onchain'] | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    const acc = j.account || j
    return {
      owner: acc.owner,
      executable: acc.executable,
      lamports: acc.lamports,
      dataLen: Array.isArray(acc.data) && typeof acc.data[0] === 'string'
        ? Math.floor((acc.data[0].length * 3) / 4)
        : acc.space,
      space: acc.space,
    }
  } catch {
    return undefined
  }
}

export function readStatus(id: string): JobStatus | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir(id), 'status.json'), 'utf8'))
  } catch {
    return null
  }
}

/** events.jsonl appended by scripts/emit-event.sh — the live "pack thinking" feed. */
function parseEvents(file: string): ScanReport['events'] | undefined {
  try {
    const out: NonNullable<ScanReport['events']> = []
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line)
        if (e && typeof e.ts === 'number' && typeof e.text === 'string') out.push(e)
      } catch { /* partial last line while writer is mid-append — skip */ }
    }
    return out.length ? out : undefined
  } catch {
    return undefined
  }
}

/** findings.json — analyzer candidates that survived the DEVIL stage live in survivors.json. */
function parseFindings(file: string): Finding[] | undefined {
  try {
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(arr) && arr.length ? arr : undefined
  } catch {
    return undefined
  }
}

function countJson(file: string): number | undefined {
  try {
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(arr) ? arr.length : undefined
  } catch {
    return undefined
  }
}

// ── public identity ──────────────────────────────────────────────────────────
// Reports are public receipts — but naming someone's repo in a public verdict is
// disclosure. A repo stays a codename until its owner claims it (CACHORRO.md
// nonce in the repo root → verified=true). Our own org is always named.
const OUR_ORGS = new Set(['jazzautomations'])

export function repoVerified(target: string): boolean {
  const m = /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git|\/)?$/.exec(target)
  if (!m) return false
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'repo_claims.json'), 'utf8'))
    return !!s[m[1]]?.verified
  } catch { return false }
}

let anonSaltCache: string | null = null
// server-side salt for anon labels — without it, anyone with a repo list can
// rainbow-table sha256(url)[:8] and deanonymize the public feed. env first,
// else a persisted random secret; last resort is a per-process secret (labels
// change on restart — cosmetic only, still private).
function anonSalt(): string {
  if (anonSaltCache) return anonSaltCache
  if (process.env.CACHORRO_ANON_SALT) return (anonSaltCache = process.env.CACHORRO_ANON_SALT)
  try {
    const p = path.join(process.cwd(), 'data', 'anon_salt')
    if (fs.existsSync(p)) return (anonSaltCache = fs.readFileSync(p, 'utf8').trim())
    const s = crypto.randomBytes(16).toString('hex')
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, s)
    return (anonSaltCache = s)
  } catch { return (anonSaltCache = crypto.randomBytes(16).toString('hex')) }
}

export function publicTarget(target: string | undefined): string {
  if (!target) return 'unknown target'
  const m = /^https:\/\/github\.com\/([^/]+)\//.exec(target)
  if (!m) return 'on-chain program'
  if (OUR_ORGS.has(m[1].toLowerCase()) || repoVerified(target)) return target
  const h = crypto.createHash('sha256').update(`${anonSalt()}:${target}`).digest('hex').slice(0, 8)
  return `anonymous target · ${h}`
}

/** Scrub repo identity out of free text for unclaimed targets. */
export function maskRepoRefs(text: string, realTarget: string, pub: string): string {
  if (pub === realTarget) return text
  let out = text.split(realTarget).join(pub)
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/)?$/.exec(realTarget)
  if (!m) return out
  out = out.split(`${m[1]}/${m[2]}`).join(pub)
  const repoRe = new RegExp(`\\b${m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
  return out.replace(repoRe, pub)
}

export function readReport(id: string): ScanReport | null {
  const st = readStatus(id)
  if (!st) return null
  const dir = runDir(id)
  const staticDir = path.join(dir, 'static')
  const repoPrefix = path.join(dir, 'repo')
  const pub = publicTarget(st.target)
  const mask = (s: string) => (st.target ? maskRepoRefs(s, st.target, pub) : s)
  const summary = parseSummary(path.join(staticDir, 'summary.txt'))
  const maskedSummary = summary
    ? Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, mask(v)]))
    : summary
  const events = parseEvents(path.join(dir, 'events.jsonl'))?.map((e) => ({
    ...e, text: mask(e.text),
  }))
  const findings = parseFindings(path.join(dir, 'findings.json'))?.map((f) => ({
    ...f,
    vulnerability_type: mask(f.vulnerability_type),
    file: mask(f.file),
    description: f.description ? mask(f.description) : f.description,
    impact: f.impact ? mask(f.impact) : f.impact,
  }))
  const sealedView = isSealedView(st)
  return {
    ...st,
    target: pub,
    // a raw commit sha is searchable on GitHub — it deanonymizes a sealed hunt
    targetRev: sealedView ? undefined : st.targetRev,
    summary: maskedSummary,
    sections: parseLints(path.join(staticDir, 'grep_lints.txt'), repoPrefix),
    zkModules: parseZk(path.join(staticDir, 'zk_surface.txt'), repoPrefix),
    onchain: parseOnchain(path.join(dir, 'onchain', 'program_account.json')),
    fetchLog: tail(path.join(dir, 'fetch.log'))?.map(mask),
    staticLog: tail(path.join(dir, 'static.log'))?.map(mask),
    events,
    findings,
    survivorCount: countJson(path.join(dir, 'survivors.json')),
  }
}

// ── sealed view ──────────────────────────────────────────────────────────────
// A hunt's payload (files, PoC, exploit path) stays sealed for the public until
// the owner proves control. Sites have no claim path → always sealed. Private
// hunts (githubLogin) are never public. Our own orgs publish by design.
export function isSealedView(
  st: { sealed?: boolean; githubLogin?: string | null; kind?: string; target?: string } | null | undefined,
): boolean {
  if (!st) return true
  if (st.sealed === true) return true
  if (st.githubLogin) return true
  if (st.kind === 'site') return true
  const t = String(st.target ?? '')
  const m = /^https:\/\/github\.com\/([^/]+)\//.exec(t)
  if (m && OUR_ORGS.has(m[1].toLowerCase())) return false
  if (m) return !repoVerified(t)
  return true
}

/** Public payload for a sealed hunt: counts + severity/class rows only. */
export function publicScanView(r: ScanReport): Record<string, unknown> {
  return {
    id: r.id,
    target: r.target,
    kind: r.kind,
    status: r.status,
    sealed: true,
    createdAt: r.createdAt,
    survivorCount: r.survivorCount,
    findings: (r.findings ?? []).map((f) => ({
      id: f.id,
      severity: f.severity,
      vulnerability_type: f.vulnerability_type,
    })),
    note: 'sealed — the owner unseals by claiming the target (CACHORRO.md nonce)',
  }
}

/** Sealed public report markdown — counts + classes, never files/snippets. */
export function sealedReportMd(id: string, st: { target?: string } | null | undefined): string {
  const dir = runDir(id)
  let rows = ''
  let n = 0
  for (const f of ['survivors.json', 'findings.json']) {
    try {
      const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      const arr = Array.isArray(list) ? list : list.findings || list.survivors || []
      for (const it of arr) {
        n++
        rows += `| ${it.id ?? `F${n}`} | ${it.severity ?? '?'} | ${it.class ?? it.title ?? '?'} |\n`
      }
      break
    } catch { /* next file */ }
  }
  const pub = st?.target ? publicTarget(String(st.target)) : 'the target'
  return [
    `# sealed hunt — ${pub}`,
    '',
    `run \`${id}\` · the pack hunted this target. the findings are **sealed** —`,
    `a leaked vulnerability is an attack vector, so the pack doesn't leak.`,
    '',
    '## what ships publicly',
    '',
    '| ID | Severity | Class |',
    '|---|---|---|',
    rows || '| — | — | details sealed |\n',
    '',
    '## unseal',
    '',
    'The owner unlocks the full report by claiming the target:',
    'commit `CACHORRO.md` with a pack nonce (POST /api/claim/repo) — proof of',
    'control, then the findings open. Private-repo hunts (GitHub connected)',
    'never appear publicly at all.',
    '',
    'proof, not opinion — but only to those with skin in it.',
  ].join('\n')
}

export function listRuns(limit = 10) {
  let names: string[]
  try {
    names = fs.readdirSync(RUNS_DIR)
  } catch {
    return []
  }
  return names
    .filter(isValidId)
    .map((id) => {
      let mtime = 0
      try {
        mtime = fs.statSync(path.join(RUNS_DIR, id, 'status.json')).mtimeMs
      } catch { /* keep 0 */ }
      return { id, mtime }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ id }) => {
      const st = readStatus(id)
      // private-repo hunts never reach the public feed; failed/aborted
      // runs are internal noise, not public receipts
      if (st?.githubLogin) return null
      if (st?.status !== 'done' && st?.status !== 'running') return null
      return {
        id,
        target: publicTarget(st?.target),
        kind: st?.kind ?? 'repo',
        status: st?.status ?? 'error',
        sealed: isSealedView(st),
        createdAt: st?.createdAt ?? 0,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, limit)
}

export function countRunning(): number {
  try {
    return fs.readdirSync(RUNS_DIR).filter(isValidId)
      .filter((id) => readStatus(id)?.status === 'running').length
  } catch {
    return 0
  }
}

// ── target gate ──────────────────────────────────────────────────────────────
// A public scan endpoint that clones+compiles arbitrary repos is an RCE
// waiting to happen (build.rs executes). Anonymous hunts are restricted to
// orgs with a live bounty on the board, plus admin-listed orgs in
// data/allowed_orgs.json (cohort projects, client engagements). Keyed hunts
// bypass — engagement implies an approved target.
export function allowedOrgs(): Set<string> {
  const orgs = new Set<string>()
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'bounties.json'), 'utf8'))
    for (const b of d.bounties ?? [])
      for (const r of b.repos ?? []) {
        const m = /^https?:\/\/github\.com\/([^/]+)\//.exec(r)
        if (m) orgs.add(m[1].toLowerCase())
      }
  } catch { /* keep hunting safe */ }
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'allowed_orgs.json'), 'utf8'))
    for (const o of d.orgs ?? []) orgs.add(String(o).toLowerCase())
  } catch { /* none yet */ }
  return orgs
}

export function allowedTarget(target: string, kind: string): { ok: boolean; why?: string } {
  if (kind === 'program-id') return { ok: true } // program dumps don't compile anything
  const m = /^https:\/\/github\.com\/([^/]+)\//.exec(target)
  if (!m) return { ok: false, why: 'unparseable repo org' }
  if (allowedOrgs().has(m[1].toLowerCase())) return { ok: true }
  return {
    ok: false,
    why: `anonymous hunts are restricted to programs with a live bounty (see /bounties) — ${m[1]} isn't on the board. Engagement hunts go through a key`,
  }
}
