import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { isValidId, publicTarget, runDir, readStatus, isSealedView } from '@/lib/cachorro'

function ghLoginOf(req: Request): string | undefined {
  const sid = req.headers.get('cookie')?.match(/cch_gh_session=([a-f0-9]+)/)?.[1]
  if (!sid) return undefined
  try {
    const store = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'gh_oauth.json'), 'utf8')
    ) as Record<string, { login: string }>
    return store[sid]?.login
  } catch { return undefined }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT = process.env.CACHORRO_ROOT || path.resolve(process.cwd(), '..')
const MAX_BYTES = 40 * 1024 * 1024

// the deliverable: everything a skeptic needs to re-run the proof themselves
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isValidId(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const dir = runDir(id)
  const st = readStatus(id)
  if (!st || st.status !== 'done' || !st.reportFile) {
    return NextResponse.json({ error: 'no finished report for this hunt' }, { status: 404 })
  }
  // private hunts: owner session only
  const owner = st.githubLogin as string | undefined
  if (owner && ghLoginOf(req) !== owner) {
    return NextResponse.json({ error: 'sealed — this hunt belongs to a github session that is not yours' }, { status: 403 })
  }
  // the bundle names the repo everywhere (report body, findings, bridge map) —
  // sealed/unclaimed targets keep the bundle owner-only
  if (isSealedView(st as Record<string, unknown>) || (st.target && publicTarget(st.target) !== st.target)) {
    return NextResponse.json({
      error: 'evidence bundle is owner-only — claim this repo at /api/claim/repo to unlock the full tarball',
    }, { status: 403 })
  }

  const names = fs.readdirSync(dir).filter((n) =>
    /^(report_.*\.md|research_context\.md|poc_review_report\.md|events\.jsonl|status\.json|findings\.json|survivors\.json|pocs|pocs_reviewed|review|attest\.log)$/.test(n),
  )
  if (!names.length) return NextResponse.json({ error: 'no evidence on disk' }, { status: 404 })

  // attach the on-chain receipt if one exists for this report
  const mdPath = path.join(dir, st.reportFile)
  const sha = crypto.createHash('sha256').update(fs.readFileSync(mdPath)).digest('hex')
  const receiptsDir = path.join(ROOT, 'attest', 'receipts')
  let receiptName: string | null = null
  try {
    for (const f of fs.readdirSync(receiptsDir)) {
      if (!f.endsWith('.json')) continue
      const r = JSON.parse(fs.readFileSync(path.join(receiptsDir, f), 'utf8'))
      if (r.report_sha256 === sha) { receiptName = f; break }
    }
  } catch { /* none */ }

  const args = ['-czf', '-', '--exclude=target', '--exclude=node_modules', '--exclude=.git', '-C', dir, ...names]
  if (receiptName) args.push('-C', receiptsDir, receiptName)

  const tar = spawn('tar', args)
  const chunks: Buffer[] = []
  let size = 0
  let tooBig = false
  tar.stdout.on('data', (c: Buffer) => {
    size += c.length
    if (size > MAX_BYTES) { tooBig = true; tar.kill('SIGKILL'); return }
    chunks.push(c)
  })
  const err: Buffer[] = []
  tar.stderr.on('data', (c: Buffer) => err.push(c))

  const rc: number = await new Promise((res) => tar.on('close', res))
  if (tooBig) return NextResponse.json({ error: 'evidence bundle too large' }, { status: 413 })
  if (rc !== 0) return NextResponse.json({ error: 'tar failed', log: Buffer.concat(err).toString().slice(0, 500) }, { status: 500 })

  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="cachorro-evidence-${id}.tar.gz"`,
    },
  })
}
