import Navbar from '@/components/Navbar'
import ClaimForm from '@/components/ClaimForm'

export const metadata = { title: 'Claim your program' }

export default function ClaimPage() {
  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-[9px] text-gray-600 font-mono mb-1">PROOF OF OWNERSHIP</div>
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green chroma-soft mb-1">[ CLAIM YOUR PROGRAM ]</h1>
          <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-6 leading-relaxed">
            Anyone can point the pack at public code — that&apos;s the point of open verification.
            But only the program&apos;s <span className="text-neon-cyan">upgrade authority</span> can claim it:
            sign one off-chain message and every certificate the pack issues for your program carries
            <span className="text-neon-green"> OWNER-VERIFIED</span>. Commissioned audit vs. anonymous scan —
            the seal is the difference.
          </p>

          <div className="border border-dark-600 bg-dark-900 p-4 mb-4 font-mono">
            <div className="text-[9px] font-arcade text-miami-sky mb-2">SIGN THE CLAIM (upgrade authority key)</div>
            <pre className="text-[9px] sm:text-[10px] text-gray-400 overflow-x-auto leading-relaxed">
{`# sign "cachorro:claim:<programId>" with the program's upgrade authority
solana sign-offchain-message "cachorro:claim:<PROGRAM_ID>" \\
  -k <upgrade-authority-keypair.json>

# or from a wallet:  signMessage("cachorro:claim:<PROGRAM_ID>")`}
            </pre>
            <div className="text-[8px] text-gray-600 mt-2 leading-relaxed">
              we fetch the upgrade authority straight from the program&apos;s on-chain ProgramData
              account and verify the ed25519 signature — no wallet connect, no custody, no trust in us.
            </div>
          </div>

          <ClaimForm />
        </div>
      </section>
    </main>
  )
}
