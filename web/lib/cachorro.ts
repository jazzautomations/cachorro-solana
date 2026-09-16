import fs from 'fs'
import path from 'path'

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
import type { JobStatus, LintSection, ScanReport } from './types'

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

export function readReport(id: string): ScanReport | null {
  const st = readStatus(id)
  if (!st) return null
  const dir = runDir(id)
  const staticDir = path.join(dir, 'static')
  const repoPrefix = path.join(dir, 'repo')
  return {
    ...st,
    summary: parseSummary(path.join(staticDir, 'summary.txt')),
    sections: parseLints(path.join(staticDir, 'grep_lints.txt'), repoPrefix),
    zkModules: parseZk(path.join(staticDir, 'zk_surface.txt'), repoPrefix),
    onchain: parseOnchain(path.join(dir, 'onchain', 'program_account.json')),
    fetchLog: tail(path.join(dir, 'fetch.log')),
    staticLog: tail(path.join(dir, 'static.log')),
    events: parseEvents(path.join(dir, 'events.jsonl')),
  }
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
    .slice(0, limit)
    .map(({ id }) => {
      const st = readStatus(id)
      return {
        id,
        target: st?.target ?? '?',
        kind: st?.kind ?? 'repo',
        status: st?.status ?? 'error',
        createdAt: st?.createdAt ?? 0,
      }
    })
}

export function countRunning(): number {
  try {
    return fs.readdirSync(RUNS_DIR).filter(isValidId)
      .filter((id) => readStatus(id)?.status === 'running').length
  } catch {
    return 0
  }
}
