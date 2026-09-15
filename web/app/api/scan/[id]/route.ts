import { NextResponse } from 'next/server'
import { assertEngine, isValidId, readReport } from '@/lib/cachorro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    assertEngine()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { id } = await ctx.params
  if (!isValidId(id)) {
    return NextResponse.json({ error: 'invalid job id' }, { status: 400 })
  }
  const report = readReport(id)
  if (!report) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }
  return NextResponse.json(report)
}
