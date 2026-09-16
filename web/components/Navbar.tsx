export default function Navbar() {
  return (
    <nav className="border-b border-dark-600 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between gap-3">
        <a href="/" className="text-[10px] sm:text-xs font-arcade text-neon-green hover:text-green-400 transition-colors shrink-0">
          CACHORRO
        </a>
        <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono">
          <a href="/labs" className="text-gray-600 hover:text-neon-green transition-colors">LABS</a>
          <a href="/bounties" className="text-gray-600 hover:text-neon-green transition-colors">BOARD</a>
          <a href="/#gate" className="text-gray-600 hover:text-neon-green transition-colors">PROOF</a>
          <a href="/#receipt" className="text-gray-600 hover:text-neon-green transition-colors">RECEIPT</a>
          <a href="/#hunts" className="text-gray-600 hover:text-neon-green transition-colors">HUNTS</a>
          <a href="/pricing" className="text-gray-600 hover:text-neon-yellow transition-colors">PRICING</a>
        </div>
        <a
          href="/#hunt"
          className="px-3 py-1.5 border border-neon-green text-neon-green text-[10px] sm:text-xs hover:bg-neon-green hover:text-black transition-all shrink-0"
        >
          NEW HUNT
        </a>
      </div>
    </nav>
  )
}
