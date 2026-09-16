import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { isValidId, readStatus, runDir } from '@/lib/cachorro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Serves the final hunt report (report_*.md) written by the REPORT stage. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'invalid job id' }, { status: 400 })
  }
  const st = readStatus(id)
  const name = st?.reportFile
  if (!name || !/^[\w.-]+$/.test(name)) {
    return NextResponse.json({ error: 'no report yet' }, { status: 404 })
  }
  const file = path.join(runDir(id), name)
  let body: string
  try {
    body = fs.readFileSync(file, 'utf8')
  } catch {
    return NextResponse.json({ error: 'report file missing' }, { status: 404 })
  }
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `inline; filename="${name}"`,
    },
  })
}
