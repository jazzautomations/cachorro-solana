import { readReport, isValidId } from '@/lib/cachorro'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /badge/<run>.svg — embeddable "hunted by the pack" shield.
// README usage: [![hunted by cachorro](https://<host>/badge/<run>.svg)](https://<host>/report/<run>)
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

  // the real doberman — hero.jpg head crop, framed in verdict color
  const dog = `
  <clipPath id="df"><rect x="6" y="6" width="52" height="52" rx="3"/></clipPath>
  <image href="data:image/jpeg;base64,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" x="6" y="6" width="52" height="52" preserveAspectRatio="xMidYMid slice" clip-path="url(#df)"/>
  <rect x="6" y="6" width="52" height="52" rx="3" fill="none" stroke="${color}" stroke-width="1.5"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="64" role="img" aria-label="hunted by the pack">
  <rect width="560" height="64" fill="#0a0a0f" stroke="${color}" stroke-width="2"/>
  <rect x="2" y="2" width="556" height="60" fill="none" stroke="${color}" stroke-opacity="0.25"/>
  ${dog}
  <text x="76" y="27" font-family="monospace" font-size="17" fill="${color}" font-weight="bold" letter-spacing="1">HUNTED BY THE PACK</text>
  <text x="76" y="48" font-family="monospace" font-size="12.5" fill="#9ca3af">${label} — cachorro-solana · proof, not opinion</text>
  <text x="544" y="28" text-anchor="end" font-family="monospace" font-size="11" fill="#4b5563">${displayId}</text>
  <text x="544" y="46" text-anchor="end" font-family="monospace" font-size="9" fill="#3f4650" letter-spacing="1">DOBERMAN SEAL</text>
</svg>`

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
  })
}
