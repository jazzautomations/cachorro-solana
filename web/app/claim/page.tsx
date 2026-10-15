import Navbar from '@/components/Navbar'
import ClaimForm from '@/components/ClaimForm'
import RepoClaim from '@/components/RepoClaim'

export const metadata = { title: 'Claim your code' }

export default function ClaimPage() {
  return (
    <main className="min-h-screen bg-black miami-bg">
      <Navbar />
      <section className="px-3 sm:px-4 py-6 sm:py-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-sm sm:text-xl font-arcade text-neon-green chroma-soft mb-3">[ CLAIM YOUR CODE ]</h1>
          <p className="text-[12px] sm:text-[14px] text-gray-300 mb-2 leading-relaxed">
            Anyone can hunt any public code. But if the dog finds a bug, only the owner gets to see how to exploit it.
          </p>
          <p className="text-[12px] sm:text-[14px] text-gray-400 mb-8 leading-relaxed">
            Claim your code once and you see every report in full, and your badge says <span className="text-neon-green">OWNER-VERIFIED</span>.
          </p>

          <h2 className="text-[11.5px] sm:text-[13px] font-arcade text-white mb-3">A GITHUB REPO</h2>
          <RepoClaim />

          <h2 className="text-[11.5px] sm:text-[13px] font-arcade text-white mt-10 mb-3">A SOLANA PROGRAM</h2>
          <div className="border border-dark-600 bg-dark-900 p-4 mb-3 text-[11.5px] sm:text-[13px] text-gray-400 leading-relaxed">
            <p className="mb-3">
              Sign one message with the wallet that can upgrade the program. We read who that is straight from the chain.
            </p>
            <pre className="text-[10.5px] sm:text-[11.5px] text-neon-green bg-black border border-dark-600 p-3 overflow-x-auto">
{`solana sign-offchain-message "cachorro:claim:<PROGRAM_ID>" \\
  -k <upgrade-authority.json>`}
            </pre>
            <p className="mt-2 text-[11.5px] text-gray-500">Paste the program id and the signature below.</p>
          </div>
          <ClaimForm />
        </div>
      </section>
    </main>
  )
}
