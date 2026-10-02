import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROOT = process.env.CACHORRO_ROOT || path.resolve(process.cwd(), '..')
const RECEIPTS = path.join(ROOT, 'attest', 'receipts')
const RPC = process.env.CACHORRO_RPC || 'https://api.mainnet-beta.solana.com'
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

// mirrors attest/lib/canonical.js — sorted keys, no whitespace, recursive.
// Recomputing the digest here is what makes verification trustless.
function canonicalize(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(o[k])).join(',') + '}'
}
const canonSha = (v: unknown) => crypto.createHash('sha256').update(Buffer.from(canonicalize(v), 'utf8')).digest('hex')

interface Receipt {
  schema: string
  report_sha256: string
  audited_commit: string
  verified_build_digest: string | null
  journal_head: string | null
  target: string
  cluster: string
  created_at: string
  attestation_sha256: string
  memo: string
  status: string
  signature: string | null
  slot: number | null
  explorer_url: string | null
}

function loadReceipts(): Receipt[] {
  try {
    return fs.readdirSync(RECEIPTS)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(RECEIPTS, f), 'utf8')))
  } catch { return [] }
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  })
  const j = await res.json()
  if (j.error) throw new Error(j.error.message)
  return j.result
}

async function checkTx(sig: string, memo: string) {
  const tx = await rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }])
  if (!tx) return { onchain: false, why: 'transaction not found' }
  if (tx.meta?.err) return { onchain: false, why: 'transaction failed on-chain' }
  const ixs = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((i: { instructions?: unknown[] }) => i.instructions ?? []),
  ]
  const hasMemo = ixs.some((ix: { programId?: string; parsed?: string }) =>
    ix.programId === MEMO_PROGRAM && typeof ix.parsed === 'string' && ix.parsed === memo)
  const inLogs = (tx.meta?.logMessages ?? []).some((l: string) => l.includes(memo))
  return hasMemo || inLogs
    ? { onchain: true, slot: tx.slot }
    : { onchain: false, why: 'memo not found in transaction' }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sha = (url.searchParams.get('sha') || '').trim().toLowerCase()
  const sig = (url.searchParams.get('sig') || '').trim()
  const receipts = loadReceipts()

  // sig lookup: fetch tx first, extract the cachorro memo, then match receipt
  if (sig && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig)) {
    try {
      const tx = await rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }])
      if (!tx) return NextResponse.json({ found: false, why: 'transaction not found' })
      const logs: string[] = tx.meta?.logMessages ?? []
      const memo = logs.map((l) => l.match(/cachorro:v1:[0-9a-f]{64}/)?.[0]).find(Boolean)
        ?? (tx.transaction?.message?.instructions ?? [])
          .filter((i: { programId?: string }) => i.programId === MEMO_PROGRAM)
          .map((i: { parsed?: string }) => i.parsed).find((p: string | undefined) => p?.startsWith('cachorro:v1:'))
      if (!memo) return NextResponse.json({ found: false, why: 'no cachorro attestation memo in this tx' })
      const hash = memo.split(':')[2]
      const r = receipts.find((x) => x.attestation_sha256 === hash)
      return NextResponse.json({
        found: true, onchain: true, slot: tx.slot, signature: sig,
        receipt: r ?? null,
        recomputed: r ? canonSha({
          schema: r.schema, report_sha256: r.report_sha256, audited_commit: r.audited_commit,
          verified_build_digest: r.verified_build_digest, journal_head: r.journal_head,
          target: r.target, cluster: r.cluster, created_at: r.created_at,
        }) === r.attestation_sha256 : null,
        why: r ? undefined : 'memo anchors a digest we have no local receipt for',
      })
    } catch (e) {
      return NextResponse.json({ error: `rpc: ${(e as Error).message}` }, { status: 502 })
    }
  }

  if (!/^[0-9a-f]{64}$/.test(sha)) {
    return NextResponse.json({ error: 'pass ?sha=<64-hex attestation or report sha256> or ?sig=<tx signature>' }, { status: 400 })
  }

  const r = receipts.find((x) => x.attestation_sha256 === sha || x.report_sha256 === sha)
  if (!r) return NextResponse.json({ found: false, why: 'no receipt matches this digest' })

  // recompute the attestation digest from the receipt's own payload fields
  const payload = {
    schema: r.schema, report_sha256: r.report_sha256, audited_commit: r.audited_commit,
    verified_build_digest: r.verified_build_digest, journal_head: r.journal_head,
    target: r.target, cluster: r.cluster, created_at: r.created_at,
  }
  const recomputed = canonSha(payload) === r.attestation_sha256

  let onchain: { onchain: boolean; slot?: number; why?: string } = { onchain: false, why: 'not anchored yet' }
  if (r.signature) {
    const memo = r.memo ?? `cachorro:v1:${r.attestation_sha256}`
    try { onchain = await checkTx(r.signature, memo) } catch (e) {
      onchain = { onchain: false, why: `rpc: ${(e as Error).message}` }
    }
  }

  return NextResponse.json({ found: true, recomputed, onchain, receipt: r })
}
