import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Kicks off the GitHub OAuth dance. Scope `repo` is what Snyk-style
// private-repo hunting needs — read access to the user's own repos.
export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured — the pack is still leashed' },
      { status: 503 }
    )
  }
  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.CACHORRO_ORIGIN || 'https://jazz-oracle.taild017e2.ts.net'}/api/auth/github/callback`,
    scope: 'repo',
    state,
    allow_signup: 'false',
  })
  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
  res.cookies.set('cch_gh_state', state, { httpOnly: true, maxAge: 600, sameSite: 'lax', secure: true })
  return res
}
