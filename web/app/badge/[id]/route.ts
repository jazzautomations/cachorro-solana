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

  // low-poly doberman head, wireframe neon — ears up, muzzle down
  const dog = `
  <g transform="translate(10,8)" stroke="${color}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="16,2 9,22 22,19" fill="${color}22"/>
    <polygon points="44,2 51,22 38,19" fill="${color}22"/>
    <polygon points="22,19 18,32 24,44 30,50 34,46 42,32 38,19" fill="${color}0a"/>
    <line x1="22" y1="19" x2="38" y2="19" stroke-opacity="0.6"/>
    <line x1="24" y1="29" x2="28" y2="27.5"/>
    <line x1="32" y1="27.5" x2="36" y2="29"/>
    <polygon points="27,36 33,36 30,42" fill="${color}33"/>
    <line x1="30" y1="42" x2="30" y2="50" stroke-opacity="0.8"/>
    <line x1="24" y1="44" x2="30" y2="50" stroke-opacity="0.5"/>
    <line x1="30" y1="50" x2="36" y2="46" stroke-opacity="0.5"/>
  </g>`

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
