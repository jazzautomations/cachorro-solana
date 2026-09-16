import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Navbar from '@/components/Navbar'
import { Markdown } from '@/lib/markdown'
import { readReport, isValidId, runDir } from '@/lib/cachorro'

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

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = isValidId(id) ? readReport(id) : null
  const file = data?.reportFile ? path.join(runDir(id), data.reportFile) : null
  const md = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null

  const sha = md ? crypto.createHash('sha256').update(md).digest('hex') : null
  const receipt = sha ? findReceipt(sha) : null

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-4xl mx-auto">
          {!md ? (
            <div className="border border-neon-red bg-dark-900 p-4 text-[11px] font-mono text-neon-red">
              ✗ no report for this hunt yet
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5 border border-dark-600 bg-dark-900 p-3">
                <span className="text-[10px] sm:text-xs font-arcade text-neon-green">[ HUNT REPORT ]</span>
                <a href={`/scan/${id}`} className="text-[9px] font-mono text-neon-cyan hover:text-neon-green">{id} ↗</a>
                <span className="text-[9px] font-mono text-gray-600 ml-auto break-all">sha256:{sha?.slice(0, 16)}…</span>
                {receipt && (
                  <a href={`/verify?sha=${receipt.attestation_sha256}`} className="text-[9px] font-mono text-neon-yellow hover:text-neon-green">
                    attestation ↗
                  </a>
                )}
              </div>
              <article className="border border-dark-600 bg-dark-900 p-4 sm:p-6">
                <Markdown src={md} />
              </article>
              <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-mono text-gray-600">
                <a href={`/api/scan/${id}/report`} className="text-neon-cyan hover:text-neon-green">▸ raw .md</a>
                <a href={`/badge/${id}.svg`} className="text-neon-cyan hover:text-neon-green">▸ embed badge</a>
                <a href="/verify" className="text-neon-yellow hover:text-neon-green">▸ verify a report</a>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
