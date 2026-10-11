import { NextResponse } from 'next/server'
import { assertEngine, isValidId, readReport, readStatus, isSealedView, publicScanView } from '@/lib/cachorro'
import { partnerOwnsHunt } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
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
  const st = readStatus(id)
  const partner = partnerOwnsHunt(req, st)
  const report = readReport(id, { unmasked: partner })
  if (!report) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }
  // sealed hunts: public gets counts + severity/class only — never the exploit map.
  // A design-partner key sees its own hunts in full.
  if (isSealedView(st) && !partner) {
    return NextResponse.json(publicScanView(report))
  }
  return NextResponse.json(report)
}
