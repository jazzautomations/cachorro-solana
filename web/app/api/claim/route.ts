import { NextResponse } from 'next/server'
import { upgradeAuthority, verifyClaim, putClaim, getClaim } from '@/lib/claims'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PID_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// POST /api/claim { programId, signature } — prove ownership: the signature must
// be the program's on-chain upgrade authority over "cachorro:claim:<programId>".
export async function POST(req: Request) {
  const { programId, signature } = await req.json().catch(() => ({}))
  if (!PID_RE.test(programId || '')) return NextResponse.json({ error: 'bad program id' }, { status: 400 })
  if (!signature) return NextResponse.json({ error: 'signature required' }, { status: 400 })

  const authority = await upgradeAuthority(programId).catch((e) => { throw e })
  if (!authority) return NextResponse.json({ error: 'program has no upgrade authority (immutable or not found)' }, { status: 400 })

  if (!verifyClaim(programId, authority, signature)) {
    return NextResponse.json({ error: 'signature does not verify against the on-chain upgrade authority' }, { status: 403 })
  }
  putClaim({ programId, authority, signature, claimedAt: Math.floor(Date.now() / 1000) })
  return NextResponse.json({ claimed: true, programId, authority })
}

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get('programId') || ''
  const c = PID_RE.test(pid) ? getClaim(pid) : null
  return NextResponse.json({ claimed: !!c, authority: c?.authority ?? null })
}
