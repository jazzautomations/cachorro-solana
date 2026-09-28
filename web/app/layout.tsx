import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CACHORRO — Solana program auditor',
    template: '%s | CACHORRO',
  },
  description:
    'The audit your users can verify. An agentic security service for Solana/Anchor programs — every finding ships an executable PoC proven on a local validator, anchored on-chain. Proof, not opinion.',
  keywords: ['solana audit', 'anchor security', 'program audit', 'rust security', 'proof of concept', 'bug bounty'],
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="crt">
        <div className="scanline" />
        <div className="fixed top-0 left-0 w-full h-1 bg-neon-green shadow-[0_0_10px_#00ff41] z-50" />
        {children}
      </body>
    </html>
  )
}
