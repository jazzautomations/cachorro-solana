import { NextResponse } from 'next/server'
import { getInvoice, markPaid, signatureConsumed, TREASURY, RPC } from '@/lib/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  })
  const j = await res.json()
  if (j.error) throw new Error(j.error.message)
  return j.result
}

// verify: tx must contain a system transfer to treasury >= invoice amount
// AND a memo instruction (or log) containing the invoice memo string.
async function verifyPayment(signature: string, memo: string, lamports: number) {
  const tx = await rpc('getTransaction', [
    signature,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
  ])
  if (!tx) return { ok: false, why: 'transaction not found (yet)' }
  if (tx.meta?.err) return { ok: false, why: 'transaction failed on-chain' }

  const instructions = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i: { instructions?: unknown[] }) => i.instructions ?? []),
  ]

  const paid = instructions.some((ix: { parsed?: { type?: string; info?: { destination?: string; lamports?: number } } }) => {
    const p = ix.parsed
    return p?.type === 'transfer' && p.info?.destination === TREASURY && (p.info?.lamports ?? 0) >= lamports
  })

  // exact memo equality — one transaction can carry many memo instructions
  // with attacker-chosen text, so substring matching would let one payment
  // masquerade as bound to invoices it never intended to pay
  const memoInIx = instructions.some((ix: { programId?: string; parsed?: string }) =>
    ix.programId === MEMO_PROGRAM && ix.parsed === memo
  )

  if (!paid) return { ok: false, why: 'no transfer to treasury covering the amount' }
  if (!memoInIx) return { ok: false, why: 'memo missing — payment not bound to this invoice' }
  return { ok: true }
}

export async function POST(req: Request) {
  let body: { invoice?: string; signature?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const inv = getInvoice((body.invoice || '').trim())
  if (!inv) return NextResponse.json({ error: 'unknown invoice' }, { status: 404 })
  if (inv.paid) return NextResponse.json({ paid: true, key: inv.key, plan: inv.plan })

  const sig = (body.signature || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig)) {
    return NextResponse.json({ error: 'not a transaction signature' }, { status: 400 })
  }

  try {
    const v = await verifyPayment(sig, inv.memo, inv.amountLamports)
    if (!v.ok) return NextResponse.json({ paid: false, why: v.why }, { status: 402 })
    // one payment signature redeems at most one invoice — a tx can carry
    // several memos, so binding must be enforced at redemption, not just match
    if (signatureConsumed(sig, inv.id)) {
      return NextResponse.json({ paid: false, why: 'payment signature already redeemed for another invoice' }, { status: 402 })
    }
    const res = markPaid(inv.id, sig)!
    return NextResponse.json({ paid: true, key: res.key, plan: res.plan })
  } catch (e) {
    return NextResponse.json({ error: `rpc: ${(e as Error).message}` }, { status: 502 })
  }
}
