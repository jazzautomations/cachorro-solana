import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isValidId, maskRepoRefs, publicTarget, readStatus, runDir, isSealedView, sealedReportMd } from '@/lib/cachorro'
import { getRepoClaim } from '@/lib/claims'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

/** Sealed public view — counts + classes, never files/snippets/exploits. */
const sealedReport = sealedReportMd

/** Serves the final hunt report (report_*.md) written by the REPORT stage. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'invalid job id' }, { status: 400 })
  }
  const st = readStatus(id) as unknown as Record<string, unknown> | undefined
  const name = st?.reportFile as string | undefined
  if (!name || !/^[\w.-]+$/.test(name)) {
    return NextResponse.json({ error: 'no report yet' }, { status: 404 })
  }

  // private-repo hunts: report only for the github session that launched it
  const owner = st?.githubLogin as string | undefined
  if (owner) {
    if (ghLoginOf(req) !== owner) {
      return NextResponse.json({ error: 'sealed — this hunt belongs to a github session that is not yours' }, { status: 403 })
    }
  }

  const file = path.join(runDir(id), name)
  let body: string
  try {
    body = fs.readFileSync(file, 'utf8')
  } catch {
    return NextResponse.json({ error: 'report file missing' }, { status: 404 })
  }

  // sealed hunts: public sees counts/classes only; owner unseals via claim.
  const target = st?.target as string | undefined
  if (isSealedView(st)) {
    return new NextResponse(sealedReport(id, st ?? {}), {
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })
  }
  if (target) {
    const pub = publicTarget(target)
    if (pub !== target) body = maskRepoRefs(body, target, pub)
  }
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `inline; filename="${name}"`,
    },
  })
}
