import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  assertEngine, countRunning, isValidId, listRuns, pickRunner,
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
    recordHunt(apiKey!)
  }

  if (!target) return NextResponse.json({ error: 'target is required' }, { status: 400 })
  if (!kind) kind = target.startsWith('http') ? 'repo' : 'program-id'

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
  } else {
    return NextResponse.json({ error: 'kind must be repo or program-id' }, { status: 400 })
  }

  if (countRunning() >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: `the pack is busy — ${MAX_CONCURRENT} hunts already running, try again in a minute` },
      { status: 429 }
    )
  }

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
  const child = spawn('bash', [runner, id, kind, target, cluster, mode], {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(path.dirname(runner)),
  })
  child.unref()

  return NextResponse.json({ id, status: 'running' }, { status: 202 })
}
