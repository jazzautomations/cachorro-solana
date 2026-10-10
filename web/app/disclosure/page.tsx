import Navbar from '@/components/Navbar'

export const metadata = { title: 'Coordinated disclosure' }

export default function DisclosurePage() {
  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10.5px] text-gray-500 font-mono mb-1">RESPONSIBLE BY DESIGN</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green chroma-soft mb-6">[ COORDINATED DISCLOSURE ]</h1>

          <div className="space-y-4 font-mono text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">REPORT A BUG IN CACHORRO</div>
              <p>
                Found a vulnerability in this service or in our engine? Report it privately via{' '}
                <a href="https://github.com/jazzautomations/cachorro-solana/security/advisories/new" target="_blank" rel="noreferrer" className="text-neon-cyan hover:text-neon-green">
                  GitHub Security Advisories ↗
                </a>{' '}
                (also linked from <a href="/.well-known/security.txt" className="text-neon-cyan hover:text-neon-green">/.well-known/security.txt</a>).
                We triage within 7 days and follow a 90-day coordinated-disclosure window (ISO/IEC 29147), shorter when funds are at active risk.
              </p>
            </div>

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">HOW WE HANDLE BUGS THE PACK FINDS</div>
              <ul className="list-none space-y-2">
                <li><span className="text-neon-green">▸ Sealed by default.</span> Every report ships sealed: the target is anonymized on public pages. A finding only identifies its target to the owner.</li>
                <li><span className="text-neon-green">▸ Owner unseals by claiming.</span> The program&apos;s upgrade authority (or a <span className="text-neon-cyan">CACHORRO.md</span> nonce commit) proves ownership on <a href="/claim" className="text-neon-cyan hover:text-neon-green">/claim</a> — verified on-chain, no wallet connect, no custody.</li>
                <li><span className="text-neon-green">▸ No public PoC before fix.</span> Executable exploits live in the evidence bundle, delivered to the verified owner — never published while a finding is unfixed.</li>
                <li><span className="text-neon-green">▸ Local forks only.</span> PoCs execute against local validators and forks of public state. No attack transaction is ever sent to mainnet or a public testnet — that rail is architectural, not a promise.</li>
              </ul>
            </div>

            <div className="border border-dark-600 bg-dark-900 p-4">
              <div className="text-[10.5px] font-arcade text-miami-sky mb-2">SCOPE &amp; AUTHORIZATION</div>
              <p>
                The pack hunts only what it may: public bug-bounty scope (Immunefi / Sherlock / Superteam), open-source code analyzed
                with exploits confined to local forks, or targets submitted through this site by their owners. PoCs are produced for
                human review — a human always decides what gets submitted, and only through the program&apos;s official channel.
              </p>
            </div>

            <p className="text-gray-500 text-[11.5px]">
              Canonical receipts are anchored as devnet memos (<span className="text-neon-cyan">cachorro:v1:&lt;digest&gt;</span>) —
              they prove <span className="text-gray-300">what was analyzed, at which commit, producing which report</span>.
              They are not a seal of safety and carry no warranty.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
