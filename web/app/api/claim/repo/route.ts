import { NextResponse } from 'next/server'
import { newRepoClaim, getRepoClaim, verifyRepoClaim, markRepoPayoutSent } from '@/lib/claims'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/

// POST /api/claim/repo { repo: "owner/name" }
//   step 1 → returns nonce; user commits CACHORRO.md containing it
//   step 2 → POST { repo, verify: true } re-checks the repo file
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const repo = (body.repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
  if (!REPO_RE.test(repo)) return NextResponse.json({ error: 'repo must be owner/name' }, { status: 400 })

  if (body.verify) {
    // payout may only ever fire on the unverified→verified transition — an
    // already-claimed repo must never retrigger a treasury movement
    const before = getRepoClaim(repo)
    const wasVerified = !!before?.verified
    const ok = await verifyRepoClaim(repo)
    const c = getRepoClaim(repo)
    if (!ok) return NextResponse.json({ verified: false, error: 'nonce not found in CACHORRO.md (checked main/master/HEAD)', nonce: c?.nonce }, { status: 403 })

    // optional private bounty payout — claimant passes their Solana address,
    // treasury shields + withdraws via Cloak: no on-chain link treasury↔owner.
    // The treasury moves at most once per repo claim and only on the
    // verified:false→true transition — a replayed verify can never retrigger.
    let payout: { ok: boolean; depositSig?: string; withdrawSig?: string; error?: string } | undefined
    const payoutAddr = (body.payoutAddress || '').trim()
    if (!wasVerified && payoutAddr && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payoutAddr)) {
      const amount = BigInt(process.env.CACHORRO_CLAIM_PAYOUT_LAMPORTS || '0')
      if (amount > 0n && markRepoPayoutSent(repo)) {
        const { cloakPrivatePayout } = await import('@/lib/cloak')
        payout = await cloakPrivatePayout(payoutAddr, amount)
      }
    }
    return NextResponse.json({ verified: true, repo, claimedAt: c?.claimedAt, payout })
  }

  const c = newRepoClaim(repo)
  if (!c) return NextResponse.json({ error: 'invalid repo' }, { status: 400 })
  if (c.verified) return NextResponse.json({ verified: true, repo, already: true })
  return NextResponse.json({
    repo, nonce: c.nonce, verified: false,
    instructions: `Commit a file named CACHORRO.md at the repo root containing: ${c.nonce} — then POST again with { repo, verify: true }`,
  })
}

export async function GET(req: Request) {
  const repo = (new URL(req.url).searchParams.get('repo') || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
  const c = REPO_RE.test(repo) ? getRepoClaim(repo) : null
  return NextResponse.json({ repo, verified: !!c?.verified, claimedAt: c?.claimedAt ?? null })
}
