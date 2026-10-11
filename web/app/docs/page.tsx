import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import { PUBLIC_PLANS, RPC } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'API' }

const BASE = 'https://cachorro.jazzautomations.com.br'

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto border border-dark-600 bg-black/70 p-3 text-[10.5px] sm:text-[11.5px] leading-relaxed text-neon-green whitespace-pre">
      {children.trim()}
    </pre>
  )
}

function Card({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <div id={id} className="border border-dark-600 bg-dark-900 p-4 scroll-mt-20">
      <div className="text-[10.5px] font-arcade text-miami-sky mb-2">{title}</div>
      {children}
    </div>
  )
}

const ENDPOINTS: [string, string, string][] = [
  ['POST', '/api/scan', 'start a hunt → 202 { id, status: "running" }'],
  ['GET', '/api/scan/{id}', 'status, stages, findings (sealed view if the target is unclaimed)'],
  ['GET', '/api/scan/{id}/report', 'the report as markdown, once status is done'],
  ['GET', '/api/scan/{id}/evidence', 'report + PoCs + event log as .tar.gz — owner only'],
  ['GET', '/api/scans', 'the 10 most recent public hunts'],
  ['GET', '/api/verify?sha=… | ?sig=…', 'recompute an attestation and check its memo on-chain'],
  ['GET', '/badge/{id}.svg', 'embeddable README badge for a hunt'],
  ['POST', '/api/billing/checkout', 'open an invoice for a plan → treasury + memo'],
  ['POST', '/api/billing/verify', 'redeem the payment signature → your key'],
]

const ERRORS: [string, string][] = [
  ['400', 'bad input — missing target, unknown mode or kind, malformed program id or URL'],
  ['401', 'X-Cachorro-Key was sent but is not a valid key'],
  ['402', 'your plan does not include that mode (e.g. DEEP or FULL without a key)'],
  ['403', 'target not allowed for anonymous DEEP, or the hunt is sealed and not yours'],
  ['404', 'unknown hunt, or no finished report yet'],
  ['429', 'monthly quota reached, anonymous rate limit hit, or 3 hunts already running'],
  ['502', 'Solana RPC failed while verifying a payment or receipt — retry'],
]

export default function DocsPage() {
  const cluster = RPC.includes('devnet') ? 'devnet' : 'mainnet'

  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">CURL · SCRIPTS · CI</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green chroma-soft mb-2">[ API ]</h1>
          <p className="text-[11.5px] sm:text-[13px] font-mono text-gray-400 mb-6 leading-relaxed">
            Everything the site does is one HTTP call away. No SDK needed — JSON in, JSON out, one header for auth.
          </p>

          <div className="space-y-4 font-mono text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">

            <Card title="QUICKSTART — THREE CALLS" id="quickstart">
              <p>Start a hunt, poll until it finishes, read the report. Anonymous callers get QUICK mode for free.</p>
              <Code>{`
# 1. unleash the pack
curl -s -X POST ${BASE}/api/scan \\
  -H 'content-type: application/json' \\
  -d '{"target":"https://github.com/coral-xyz/sealevel-attacks","mode":"quick"}'
# → {"id":"run_1791…","status":"running"}

# 2. poll — status goes running → done (or error)
curl -s ${BASE}/api/scan/run_1791… | jq '{status, stage, survivorCount}'

# 3. the report, as markdown
curl -s ${BASE}/api/scan/run_1791…/report
`}</Code>
            </Card>

            <Card title="AUTH — ONE HEADER" id="auth">
              <p>
                Send your key as <span className="text-neon-cyan">X-Cachorro-Key</span>. Without it you are anonymous:
                QUICK only, 3 hunts per 10 minutes per IP. Keyed hunts skip the IP limit and unlock the modes of your plan.
                Everyone shares a cap of 3 hunts running at once — past that you get a 429 and retry in a minute.
              </p>
              <Code>{`
curl -s -X POST ${BASE}/api/scan \\
  -H 'content-type: application/json' \\
  -H "X-Cachorro-Key: $CACHORRO_KEY" \\
  -d '{"target":"https://github.com/your-org/your-program","mode":"deep"}'
`}</Code>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[10.5px] sm:text-[11.5px]">
                  <thead className="text-gray-500">
                    <tr><th className="pr-3 py-1">PLAN</th><th className="pr-3">MODES</th><th className="pr-3">HUNTS / MONTH</th><th>PRICE</th></tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-dark-600">
                      <td className="pr-3 py-1 text-gray-300">no key</td><td className="pr-3">quick</td><td className="pr-3">3 per 10 min / IP</td><td>free</td>
                    </tr>
                    {PUBLIC_PLANS.filter((p) => p.priceSol > 0).map((p) => (
                      <tr key={p.id} className="border-t border-dark-600">
                        <td className="pr-3 py-1 text-gray-300">{p.name} <span className="text-gray-600">({p.id})</span></td>
                        <td className="pr-3">{p.modes.join(' · ')}</td>
                        <td className="pr-3">{p.huntsPerMonth < 0 ? 'unlimited' : p.huntsPerMonth}</td>
                        <td>{p.priceSol === 0 ? 'free' : `${p.priceSol} SOL / ${p.unit}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="GET A KEY" id="key">
              <p>
                <span className="text-neon-green">▸ Buy one with SOL</span> ({cluster}). No account: the key is bound to the payment.
                Keep the invoice id — posting it to verify again returns the same key.
              </p>
              <Code>{`
# 1. open an invoice (plan: ${PUBLIC_PLANS.filter((p) => p.priceSol > 0).map((p) => p.id).join(' | ')})
curl -s -X POST ${BASE}/api/billing/checkout \\
  -H 'content-type: application/json' -d '{"plan":"payg"}'
# → {"invoice":"inv_…","amountSol":0.5,"treasury":"7sZ1…","memo":"cachorro:payg:…"}

# 2. pay — the memo binds the payment to the invoice
solana transfer <treasury> 0.5 --with-memo "cachorro:payg:…" --url ${cluster === 'devnet' ? 'devnet' : 'mainnet-beta'}

# 3. redeem the signature
curl -s -X POST ${BASE}/api/billing/verify \\
  -H 'content-type: application/json' \\
  -d '{"invoice":"inv_…","signature":"<tx signature>"}'
# → {"paid":true,"key":"cch_…","plan":"payg"}
`}</Code>
              <p className="mt-3">
                <span className="text-neon-green">▸ Building on Cachorro?</span> Audit firms and teams integrating the pack get a
                design-partner key — all modes, no monthly cap, and the full results of every hunt the key launches.{' '}
                <a href="https://github.com/jazzautomations/cachorro-solana/issues/new?title=Design%20partner%20key" target="_blank" rel="noreferrer" className="text-neon-cyan hover:text-neon-green">
                  Ask for one ↗
                </a>
              </p>
            </Card>

            <Card title="SCAN REQUEST" id="scan">
              <ul className="list-none space-y-1.5">
                <li><span className="text-neon-cyan">target</span> — GitHub repo URL, Solana program id (base58), or https site. Required.</li>
                <li><span className="text-neon-cyan">mode</span> — <span className="text-gray-300">quick</span> | <span className="text-gray-300">deep</span> | <span className="text-gray-300">full</span>. Defaults to deep, so anonymous callers must send <span className="text-gray-300">&quot;quick&quot;</span>.</li>
                <li><span className="text-neon-cyan">kind</span> — repo | program-id | site. Optional: inferred from the target.</li>
                <li><span className="text-neon-cyan">cluster</span> — mainnet | devnet, for program ids. Defaults to mainnet.</li>
              </ul>
            </Card>

            <Card title="ENDPOINTS" id="endpoints">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10.5px] sm:text-[11.5px]">
                  <tbody>
                    {ENDPOINTS.map(([m, p, d]) => (
                      <tr key={m + p} className="border-t border-dark-600 first:border-t-0 align-top">
                        <td className="pr-3 py-1.5 text-neon-yellow">{m}</td>
                        <td className="pr-3 py-1.5 text-neon-cyan whitespace-nowrap">{p}</td>
                        <td className="py-1.5">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="SEALED RESULTS" id="sealed">
              <p>
                The pack never hands an exploit map to someone who doesn&apos;t own the target — key or no key. On a target you
                haven&apos;t claimed, <span className="text-neon-cyan">/api/scan/{'{id}'}</span> returns counts, severity and
                bug class only, the report comes back sealed, and the evidence bundle is refused.
                Prove ownership on <a href="/claim" className="text-neon-cyan hover:text-neon-green">/claim</a> (upgrade-authority
                signature or a <span className="text-neon-cyan">CACHORRO.md</span> nonce commit) and the same calls return everything.
                Design-partner keys are the one exception: send the same key on the GET calls and the hunts it launched come back
                in full — status, report and evidence bundle. Partner keys are issued by hand to firms working under an engagement.
                See <a href="/disclosure" className="text-neon-cyan hover:text-neon-green">coordinated disclosure</a>.
              </p>
            </Card>

            <Card title="IN CI" id="ci">
              <p>Hunt every push and fail the build while the pack keeps a surviving finding. Store the key as a repo secret. Works on sealed hunts too — status and counts are always public.</p>
              <Code>{`
# .github/workflows/cachorro.yml (step)
- name: unleash the pack
  env: { CACHORRO_KEY: \${{ secrets.CACHORRO_KEY }} }
  run: |
    ID=$(curl -sf -X POST ${BASE}/api/scan -H 'content-type: application/json' \\
      -H "X-Cachorro-Key: $CACHORRO_KEY" \\
      -d "{\\"target\\":\\"https://github.com/\${{ github.repository }}\\",\\"mode\\":\\"deep\\"}" | jq -r .id)
    while :; do
      R=$(curl -sf ${BASE}/api/scan/$ID); S=$(echo "$R" | jq -r .status)
      [ "$S" != running ] && break; sleep 60
    done
    echo "$R" | jq '{status, survivorCount}'
    [ "$S" = done ] && [ "$(echo "$R" | jq '.survivorCount // 0')" = 0 ]
`}</Code>
            </Card>

            <Card title="VERIFY A RECEIPT" id="verify">
              <p>Anyone can check a verdict without trusting this site: the server recomputes the digest and reads the memo from chain.</p>
              <Code>{`
curl -s "${BASE}/api/verify?sha=<attestation or report sha256>"
curl -s "${BASE}/api/verify?sig=<memo tx signature>"
`}</Code>
              <p className="mt-2">Badge for your README:</p>
              <Code>{`[![hunted by the pack](${BASE}/badge/<id>.svg)](${BASE}/report/<id>)`}</Code>
            </Card>

            <Card title="ERRORS" id="errors">
              <p className="mb-2">Every error is JSON: <span className="text-gray-300">{'{"error":"…"}'}</span>.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10.5px] sm:text-[11.5px]">
                  <tbody>
                    {ERRORS.map(([c, d]) => (
                      <tr key={c} className="border-t border-dark-600 first:border-t-0 align-top">
                        <td className="pr-3 py-1.5 text-neon-yellow">{c}</td>
                        <td className="py-1.5">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
