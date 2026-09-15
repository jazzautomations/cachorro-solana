import { NextResponse } from 'next/server'
import { assertEngine, listRuns } from '@/lib/cachorro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    assertEngine()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  return NextResponse.json({ runs: listRuns(10) })
}
