import { readReport, isValidId } from '@/lib/cachorro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /badge/<run>.svg — embeddable "hunted by the pack" shield.
// README usage: [![hunted by cachorro](https://<host>/badge/<run>.svg)](https://<host>/scan/<run>)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  const id = raw.replace(/\.svg$/, '')
  const valid = isValidId(id)
  const data = valid ? readReport(id) : null
  const displayId = valid ? id : 'invalid-id'

  const done = data?.status === 'done'
    const survivors = data?.survivorCount ?? 0
  const label = done
    ? survivors > 0 ? `${survivors} proven finding${survivors === 1 ? '' : 's'} · PoC verified` : 'clean hunt · no survivors'
    : data?.status === 'running' ? 'hunt in progress' : 'hunt failed'
  const color = done ? (survivors > 0 ? '#00ff41' : '#00d4ff') : '#888'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="64" role="img" aria-label="hunted by the pack">
  <rect width="560" height="64" fill="#0a0a0f" stroke="${color}" stroke-width="2"/>
  <rect x="2" y="2" width="556" height="60" fill="none" stroke="${color}" stroke-opacity="0.25"/>
  <text x="16" y="28" font-family="monospace" font-size="18" fill="${color}" font-weight="bold">▶ HUNTED BY THE PACK</text>
  <text x="16" y="48" font-family="monospace" font-size="13" fill="#9ca3af">${label} — cachorro-solana · proof, not opinion</text>
  <text x="544" y="28" text-anchor="end" font-family="monospace" font-size="11" fill="#4b5563">${displayId}</text>
</svg>`

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
  })
}
