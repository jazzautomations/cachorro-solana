import { NextResponse } from 'next/server'
import { createInvoice, PLANS, TREASURY, RPC } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const inv = createInvoice((body.plan || '').trim())
  if (!inv) return NextResponse.json({ error: 'unknown or free plan' }, { status: 400 })
  const plan = PLANS.find((p) => p.id === inv.plan)!
  return NextResponse.json({
    invoice: inv.id,
    plan: plan.id,
    amountSol: plan.priceSol,
    amountLamports: inv.amountLamports,
    treasury: TREASURY,
    memo: inv.memo,
    cluster: RPC.includes('devnet') ? 'devnet' : 'mainnet',
    how: `send ${plan.priceSol} SOL to the treasury with the memo attached — the memo binds payment to this invoice`,
  })
}
