import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Navbar from '@/components/Navbar'
import { Markdown } from '@/lib/markdown'
import { readReport, isValidId, runDir } from '@/lib/cachorro'
import { getClaim } from '@/lib/claims'

function readSelfAudit(id: string): { clean: boolean; flags: { kind: string; severity: string }[]; coverage?: { atlas_classes: number; exercised: string[]; not_exercised: string[] } } | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir(id), 'self_audit.json'), 'utf8'))
  } catch { return null }
}

export const dynamic = 'force-dynamic'

// find the attestation receipt whose report_sha256 matches this run's report
function findReceipt(sha: string) {
  const dir = path.join(process.env.CACHORRO_ROOT || path.resolve(process.cwd(), '..'), 'attest', 'receipts')
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      if (r.report_sha256 === sha) return r
    }
  } catch { /* no receipts dir */ }
  return null
}

interface ParsedReport {
  title: string | null
  findings: { id: string; title: string; sev: string | null }[]
  verde: number
  vermelho: number
  dup: number
  sections: string[]
}

function parseReport(md: string): ParsedReport {
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? null
  const findings: ParsedReport['findings'] = []
  const sections: string[] = []
  for (const m of md.matchAll(/^(#{2,4})\s+(.+)$/gm)) {
    const txt = m[2].trim()
    const f = txt.match(/^(F\d+)\s*[—–-]\s*(.+?)(?:\s*\(([^)]+)\))?$/)
    if (m[1].length >= 3 && f) findings.push({ id: f[1], title: f[2], sev: f[3] ?? null })
    else if (m[1].length === 2) sections.push(txt)
  }
  const verde = (md.match(/VERDE/g) || []).length
  const vermelho = (md.match(/VERMELHO/g) || []).length
  const dup = (md.match(/dup\s*:\s*true|`dup: true`|já (?:é|são) conhecido/gi) || []).length
  return { title, findings, verde, vermelho, dup, sections }
}

function SevChip({ sev }: { sev: string | null }) {
  const k = (sev || '').toLowerCase()
  const cls = k.startsWith('crit')
    ? 'text-neon-red border-neon-red/60'
    : k.startsWith('high')
      ? 'text-miami-sunset border-miami-sunset/60'
      : k.startsWith('med')
        ? 'text-neon-yellow border-neon-yellow/50'
        : 'text-neon-cyan border-neon-cyan/50'
  return <span className={`border px-1.5 py-0.5 text-[8px] font-arcade uppercase shrink-0 ${cls}`}>{sev || '—'}</span>
}

// program id from the report header — backtick-quoted base58 near "program",
// else first non-hex base58 32–44 token (hex is filtered: commits collide otherwise)
function extractProgramId(md: string): string | null {
  const head = md.slice(0, 4000)
  const re = /program[^\n]{0,100}?`?([1-9A-HJ-NP-Za-km-z]{32,44})`?/gi
  for (const m of head.matchAll(re)) {
    if (!/^[0-9a-f]+$/i.test(m[1])) return m[1]
  }
  return null
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = isValidId(id) ? readReport(id) : null
  const file = data?.reportFile ? path.join(runDir(id), data.reportFile) : null
  const md = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null

  const sha = md ? crypto.createHash('sha256').update(md).digest('hex') : null
  const receipt = sha ? findReceipt(sha) : null
  const parsed = md ? parseReport(md) : null
  const anchored = !!receipt?.signature
  const programId = md ? extractProgramId(md) : null
  const claim = programId ? getClaim(programId) : null
  const selfAudit = readSelfAudit(id)

  const attestState = receipt
    ? anchored
      ? { label: 'ANCHORED · devnet', cls: 'text-neon-green border-neon-green' }
      : { label: 'PENDING ANCHOR', cls: 'text-neon-yellow border-neon-yellow' }
    : { label: 'NO RECEIPT', cls: 'text-gray-600 border-dark-600' }

  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          {!md ? (
            <div className="border border-neon-red bg-dark-900 p-4 text-[11px] font-mono text-neon-red">
              ✗ no report for this hunt yet
            </div>
          ) : (
            <>
              {/* ═══ CERTIFICATE HEADER ═══ */}
              <div className="holo-frame p-4 sm:p-5 mb-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                  <span className="text-[10px] sm:text-xs font-arcade vapor-text chroma-soft">[ AUDIT CERTIFICATE ]</span>
                  <a href={`/scan/${id}`} className="text-[9px] font-mono text-miami-sky hover:text-neon-green transition-colors">{id} ↗</a>
                  {data?.mode === 'quick' && (
                    <span className="border border-dark-600 text-gray-500 px-2 py-0.5 text-[8px] sm:text-[9px] font-arcade">RECON · no PoC gate</span>
                  )}
                  {claim ? (
                    <span className="border border-miami-sky text-miami-sky px-2 py-0.5 text-[8px] sm:text-[9px] font-arcade chroma-soft">OWNER-VERIFIED</span>
                  ) : programId ? (
                    <a href="/claim" className="border border-dark-600 text-gray-500 px-2 py-0.5 text-[8px] sm:text-[9px] font-arcade hover:text-neon-cyan hover:border-neon-cyan transition-colors">UNCLAIMED — claim ↗</a>
                  ) : null}
                  <span className={`ml-auto border px-2 py-0.5 text-[8px] sm:text-[9px] font-arcade ${attestState.cls}`}>
                    {attestState.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[9px] sm:text-[10px] font-mono">
                  <div className="flex justify-between gap-3 border-b border-dark-600/60 py-1">
                    <span className="text-gray-600">target</span>
                    <span className="text-gray-300 text-right break-all">{data?.target}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-dark-600/60 py-1">
                    <span className="text-gray-600">audited commit</span>
                    <span className="text-neon-cyan">{data?.targetRev ? data.targetRev.slice(0, 12) : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-dark-600/60 py-1">
                    <span className="text-gray-600">mode</span>
                    <span className="text-gray-300 uppercase">{data?.mode || 'deep'}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-dark-600/60 py-1">
                    <span className="text-gray-600">report sha256</span>
                    <span className="text-gray-400">sha256:{sha?.slice(0, 16)}…</span>
                  </div>
                </div>

                {/* verdict strip — the numbers that matter */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="border border-neon-green/60 text-neon-green px-2 py-1 text-[8px] sm:text-[9px] font-arcade">
                    {parsed?.findings.length ?? 0} FINDINGS
                  </span>
                  <span className="border border-neon-green text-neon-green px-2 py-1 text-[8px] sm:text-[9px] font-arcade">
                    ✓ {parsed?.verde ?? 0} VERDE
                  </span>
                  {(parsed?.vermelho ?? 0) > 0 && (
                    <span className="border border-miami-pink text-miami-pink px-2 py-1 text-[8px] sm:text-[9px] font-arcade">
                      ✗ {parsed!.vermelho} VERMELHO
                    </span>
                  )}
                  {(parsed?.dup ?? 0) > 0 && (
                    <span className="border border-neon-yellow/60 text-neon-yellow px-2 py-1 text-[8px] sm:text-[9px] font-arcade">
                      dup-flagged
                    </span>
                  )}
                  {data?.survivorCount !== undefined && (
                    <span className="border border-dark-600 text-gray-500 px-2 py-1 text-[8px] sm:text-[9px] font-arcade">
                      {data.survivorCount} survivors tested
                    </span>
                  )}
                  {selfAudit && (
                    <>
                      <span className={`border px-2 py-1 text-[8px] sm:text-[9px] font-arcade ${selfAudit.clean ? 'border-neon-cyan/60 text-neon-cyan' : 'border-neon-yellow text-neon-yellow'}`}>
                        SELF-AUDIT {selfAudit.clean ? '✓ CLEAN' : `${selfAudit.flags.length} FLAG${selfAudit.flags.length === 1 ? '' : 'S'}`}
                      </span>
                      {selfAudit.coverage && (
                        <span className="border border-dark-600 text-gray-500 px-2 py-1 text-[8px] sm:text-[9px] font-arcade"
                          title={`exercised: ${selfAudit.coverage.exercised.join(', ') || 'none'} · not exercised: ${selfAudit.coverage.not_exercised.join(', ')}`}>
                          ATLAS {selfAudit.coverage.exercised.length}/{selfAudit.coverage.atlas_classes}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ═══ ATTESTATION — the on-chain receipt ═══ */}
              {receipt && (
                <div className="border border-dark-600 bg-dark-900 mb-4 font-mono">
                  <div className="px-3 py-2 border-b border-dark-600 bg-dark-800 flex items-center justify-between">
                    <span className="text-[9px] font-arcade text-miami-sky chroma-soft">ON-CHAIN RECEIPT</span>
                    <a href={`/verify?sha=${receipt.attestation_sha256}`} className="text-[8px] font-mono text-neon-yellow hover:text-neon-green">
                      verify trustless ↗
                    </a>
                  </div>
                  <div className="p-3 space-y-1.5 text-[9px] sm:text-[10px]">
                    <div className="flex justify-between gap-3"><span className="text-gray-600">memo</span><span className="text-neon-green break-all text-right">{receipt.memo}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-600">attestation</span><span className="text-gray-400 break-all text-right">{receipt.attestation_sha256?.slice(0, 24)}…</span></div>
                    {receipt.journal_head && (
                      <div className="flex justify-between gap-3"><span className="text-gray-600">journal_head</span><span className="text-gray-400 text-right">{String(receipt.journal_head).slice(0, 16)}…</span></div>
                    )}
                    {anchored ? (
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-600">tx</span>
                        <a href={receipt.explorer_url} target="_blank" rel="noreferrer" className="text-miami-sky hover:text-neon-green break-all text-right">
                          {receipt.signature.slice(0, 20)}… ↗
                        </a>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-3"><span className="text-gray-600">chain</span><span className="text-neon-yellow">digest anchor-ready — awaiting devnet slot</span></div>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t border-dark-600 text-[8px] text-gray-600">
                    trivial to verify · hard to fake · expires when the program upgrades
                  </div>
                </div>
              )}

              {/* ═══ FINDINGS INDEX — arcade case board ═══ */}
              {(parsed?.findings.length ?? 0) > 0 && (
                <div className="mb-4">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-[9px] font-arcade text-white">FINDINGS</span>
                    <span className="flex-1 vapor-strip-thin" />
                  </div>
                  <div className="grid grid-cols-1 gap-px bg-dark-600 border border-dark-600">
                    {parsed!.findings.map((f) => (
                      <div key={f.id} className="bg-dark-900 px-3 py-2 flex items-center gap-3">
                        <span className="text-[9px] font-arcade text-miami-rose shrink-0">{f.id}</span>
                        <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 truncate flex-1">{f.title}</span>
                        <SevChip sev={f.sev} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ THE REPORT BODY ═══ */}
              <article className="border border-dark-600 bg-dark-900 p-4 sm:p-6 pixel-notch">
                <Markdown src={md} />
              </article>

              {/* ═══ FOOTER — artifacts & embed ═══ */}
              <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-mono text-gray-600">
                <a href={`/api/scan/${id}/evidence`} className="text-neon-green hover:text-white">▸ evidence bundle (.tar.gz — the PoCs, run them yourself)</a>
                <a href={`/api/scan/${id}/report`} className="text-neon-cyan hover:text-neon-green">▸ raw .md</a>
                <a href={`/badge/${id}.svg`} className="text-neon-cyan hover:text-neon-green">▸ embed badge</a>
                <a href="/verify" className="text-neon-yellow hover:text-neon-green">▸ verify a report</a>
              </div>
              <div className="mt-3 border border-dark-600 bg-dark-900/60 p-3 text-[8px] sm:text-[9px] font-mono text-gray-600 overflow-x-auto">
                <span className="text-gray-500">embed in your README — </span>
                <code className="text-miami-cream">[![hunted by the pack](/badge/{id}.svg)](/report/{id})</code>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
