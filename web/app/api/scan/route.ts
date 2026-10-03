import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  allowedTarget, assertEngine, countRunning, isValidId, listRuns, pickRunner,
  PUBKEY_RE, REPO_RE, RUNS_DIR,
} from '@/lib/cachorro'
import { planFor, recordHunt, huntsLeft } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CONCURRENT = 3

export async function GET() {
  try {
    assertEngine()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  return NextResponse.json({ runs: listRuns(10) })
}

export async function POST(req: Request) {
  try {
    assertEngine()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let body: { target?: string; kind?: string; cluster?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const target = (body.target || '').trim()
  const cluster = (body.cluster || 'mainnet').trim()
  const mode = (body.mode || 'deep').trim()
  let kind = (body.kind || '').trim()

  // GitHub OAuth session — "scan my private repo" (Snyk-style). The
  // session cookie maps to a server-side token; consent = their repos.
  const ghSid = req.headers.get('cookie')?.match(/cch_gh_session=([a-f0-9]+)/)?.[1]
  let ghToken: string | undefined
  let ghLogin: string | undefined
  if (ghSid) {
    try {
      const store = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'data', 'gh_oauth.json'), 'utf8')
      ) as Record<string, { token: string; login: string }>
      const e = store[ghSid]
      if (e) { ghToken = e.token; ghLogin = e.login }
    } catch { /* no store yet */ }
  }

  if (!['quick', 'deep', 'full'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be quick, deep or full' }, { status: 400 })
  }

  // plan gate: anonymous = STRAY (quick+deep); FULL needs a paid key
  const apiKey = req.headers.get('x-cachorro-key')
  const { plan, keyEntry } = planFor(apiKey)
  if (apiKey && !keyEntry) {
    return NextResponse.json({ error: 'invalid API key' }, { status: 401 })
  }
  if (!plan.modes.includes(mode)) {
    return NextResponse.json(
      { error: `mode ${mode.toUpperCase()} requires ${plan.id === 'free' ? 'a paid plan — see /pricing' : 'a higher plan'}` },
      { status: 402 }
    )
  }
  // monthly quota for keyed hunts (anonymous stays on the shared concurrency cap)
  if (keyEntry) {
    if (huntsLeft(apiKey, 0) === 0) {
      return NextResponse.json({ error: `monthly hunt quota reached for ${plan.name}` }, { status: 429 })
    }
  }

  if (!target) return NextResponse.json({ error: 'target is required' }, { status: 400 })
  if (!kind) {
    kind = target.startsWith('http')
      ? REPO_RE.test(target) ? 'repo' : 'site'
      : 'program-id'
  }

  // anonymous QUICK is open season — any public repo. DEEP/FULL stay keyed:
  // deeper hunts run heavier, paid, claimed-workload pipelines. A GitHub-
  // connected user consented via OAuth — their repos bypass the org gate
  // (DEEP allowed on own code), still unkeyed.
  if (!keyEntry && mode !== 'quick' && !(ghToken && kind === 'repo')) {
    const gate = allowedTarget(target, kind)
    if (!gate.ok) return NextResponse.json({ error: gate.why }, { status: 403 })
  }

  if (kind === 'repo') {
    if (!REPO_RE.test(target)) {
      return NextResponse.json(
        { error: 'not a valid public GitHub repo URL (https://github.com/org/repo)' },
        { status: 400 }
      )
    }
  } else if (kind === 'program-id') {
    if (!PUBKEY_RE.test(target)) {
      return NextResponse.json({ error: 'not a valid base58 Solana pubkey' }, { status: 400 })
    }
    if (cluster !== 'mainnet' && cluster !== 'devnet') {
      return NextResponse.json({ error: 'cluster must be mainnet or devnet' }, { status: 400 })
    }
  } else if (kind === 'site') {
    // black-box web target — GET-only recon, SSRF-guarded at fetch time
    if (!/^https?:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i.test(target)) {
      return NextResponse.json({ error: 'not a valid site URL (https://app.example.com)' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'kind must be repo, program-id, or site' }, { status: 400 })
  }

  if (countRunning() >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: `the pack is busy — ${MAX_CONCURRENT} hunts already running, try again in a minute` },
      { status: 429 }
    )
  }

  // anonymous abuse guard: one open hunt per IP per 10min, and no duplicate
  // hunt on a repo that's already running. Keyed hunts skip this.
  if (!keyEntry) {
    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const rlPath = path.join(process.cwd(), 'data', 'ratelimit.json')
    let rl: Record<string, number[]> = {}
    try { rl = JSON.parse(fs.readFileSync(rlPath, 'utf8')) } catch { /* fresh */ }
    const now = Math.floor(Date.now() / 1000)
    const recent = (Array.isArray(rl[ip]) ? rl[ip] : []).filter((t) => now - t < 600)
    // 3 free hunts per 10min per IP — tolerates shared event NAT, still stops spam
    if (recent.length >= 3) {
      return NextResponse.json(
        { error: 'easy, cowboy — 3 free hunts per 10 minutes. paid keys have no leash (/pricing)' },
        { status: 429 }
      )
    }
    const dup = listRuns(10).some((r) => r.status === 'running')
    if (dup) {
      for (const d of fs.readdirSync(RUNS_DIR)) {
        try {
          const st = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, d, 'status.json'), 'utf8'))
          if (st.status === 'running' && st.target === target) {
            return NextResponse.json(
              { error: `the pack is already hunting that repo — watch it live at /report/${d}` },
              { status: 409 }
            )
          }
        } catch { /* skip */ }
      }
    }
    rl[ip] = [...recent, now]
    fs.mkdirSync(path.dirname(rlPath), { recursive: true })
    fs.writeFileSync(rlPath, JSON.stringify(rl))
  }

  if (keyEntry) recordHunt(apiKey!)

  const id = `run_${Math.floor(Date.now() / 1000)}_${crypto.randomBytes(3).toString('hex')}`
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'failed to mint job id' }, { status: 500 })
  }

  const dir = path.join(RUNS_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  const status = {
    id,
    target,
    kind,
    cluster: kind === 'program-id' ? cluster : undefined,
    status: 'running',
    stage: 'fetch',
    mode,
    stages: { fetch: 'running' },
    createdAt: Math.floor(Date.now() / 1000),
  }
  const tmp = path.join(dir, 'status.json.tmp')
  fs.writeFileSync(tmp, JSON.stringify(status, null, 2))
  fs.renameSync(tmp, path.join(dir, 'status.json'))

  const runner = pickRunner()
  const runnerCwd = path.dirname(path.dirname(runner))
  // Escapes the web service cgroup: a cachorro-web restart must not kill a
  // running hunt. systemd-run puts the job in its own transient unit; setsid
  // is the fallback for non-systemd hosts.
  const useSystemd = fs.existsSync('/usr/bin/systemd-run') || fs.existsSync('/bin/systemd-run')
  // private-repo consent token — env-only, never written to the run dir
  const ghEnv = ghToken ? { CACHORRO_GH_TOKEN: ghToken } : {}
  const child = useSystemd
    ? spawn('systemd-run', [
        '--quiet', '--collect', '--unit', `cachorro-hunt-${id}`,
        '--setenv', `HOME=${process.env.HOME || '/root'}`,
        '--setenv', `PATH=${process.env.PATH}`,
        '--setenv', `CACHORRO_ROOT=${runnerCwd}`,
        ...(ghToken ? ['--setenv', `CACHORRO_GH_TOKEN=${ghToken}`] : []),
        'bash', runner, id, kind, target, cluster, mode,
      ], { detached: true, stdio: 'ignore', cwd: runnerCwd })
    : spawn('setsid', ['bash', runner, id, kind, target, cluster, mode], {
        detached: true, stdio: 'ignore', cwd: runnerCwd,
        env: { ...process.env, ...ghEnv },
      })
  child.unref()

  return NextResponse.json({ id, status: 'running' }, { status: 202 })
}
