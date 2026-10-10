import Navbar from '@/components/Navbar'

export const metadata = { title: 'Privacy & AI notice' }

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">MINIMAL BY DEFAULT</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green chroma-soft mb-6">[ PRIVACY &amp; AI NOTICE ]</h1>

          <div className="space-y-4 font-mono text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">WHAT WE COLLECT</div>
              <ul className="list-none space-y-2">
                <li><span className="text-neon-green">▸ Scan targets</span> — the repo URL / program id you paste. <span className="text-neon-yellow">This is the most sensitive datum we hold:</span> it reveals what you want audited. Treated as confidential; never published unsealed; never used for anything but running your hunt.</li>
                <li><span className="text-neon-green">▸ Run artifacts</span> — fetch logs, static output, findings, PoCs, reports. Stored on our server so your certificate page and evidence bundle keep working.</li>
                <li><span className="text-neon-green">▸ IP address</span> — used for rate limiting anonymous hunts (3 concurrent). Not logged beyond the limiter.</li>
                <li><span className="text-neon-green">▸ GitHub login (optional)</span> — only if you connect GitHub for private hunts. We store your login + session id to show your private reports to you alone.</li>
              </ul>
            </div>

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">WHAT WE NEVER DO</div>
              <ul className="list-none space-y-2">
                <li><span className="text-neon-red">✗</span> No marketing trackers, pixels, or analytics scripts — inside the app or on these pages.</li>
                <li><span className="text-neon-red">✗</span> No selling or sharing of targets, findings, or reports.</li>
                <li><span className="text-neon-red">✗</span> No public listing of unsealed targets — sealed hunts show an anonymized label until the owner claims them.</li>
              </ul>
            </div>

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">AI PROCESSING — READ THIS BEFORE YOU SCAN</div>
              <p>
                Hunts are executed by AI agents (LLM pipelines). <span className="text-gray-200">The target&apos;s source code is sent to third-party model providers for analysis.</span> Do not
                point the pack at code you are not allowed to share with an LLM provider. Private hunts stay visible only to your
                connected GitHub session, but the analysis path is the same.
              </p>
            </div>

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">AI OUTPUT — NO WARRANTY</div>
              <p>
                Every report is <span className="text-gray-200">AI-assisted analysis delivered as-is</span>. It is{' '}
                <span className="text-neon-yellow">not a formal audit</span> and does not replace human review. Findings and PoCs
                require verification before any action. <span className="text-neon-yellow">Absence of findings does not mean the code is safe.</span>
              </p>
            </div>

            <p className="text-gray-500 text-[11.5px]">
              Questions or deletion requests: open a private advisory via{' '}
              <a href="https://github.com/jazzautomations/cachorro-solana/security/advisories/new" target="_blank" rel="noreferrer" className="text-neon-cyan hover:text-neon-green">GitHub ↗</a>{' '}
              or see <a href="/disclosure" className="text-neon-cyan hover:text-neon-green">/disclosure</a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
