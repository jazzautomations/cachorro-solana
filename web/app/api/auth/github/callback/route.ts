import { NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const STORE = () => path.join(process.cwd(), 'data', 'gh_oauth.json')

// GitHub sends the user back here after authorizing. We exchange the
// code for an access token and park it in a session cookie + store —
// private repos clone with it later.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.headers.get('cookie')?.match(/cch_gh_state=([a-f0-9]+)/)?.[1]

  if (!code) return NextResponse.json({ error: 'no code from github' }, { status: 400 })
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: 'bad oauth state — try again' }, { status: 403 })
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 503 })
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
  if (!tokenData.access_token) {
    return NextResponse.json({ error: `github said no: ${tokenData.error || 'unknown'}` }, { status: 502 })
  }

  const ghRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'cachorro' },
  })
  const ghUser = await ghRes.json() as { login?: string }
  if (!ghUser.login) {
    return NextResponse.json({ error: 'could not read your github user' }, { status: 502 })
  }

  // opaque session id -> token + login, server side only
  const sid = crypto.randomBytes(24).toString('hex')
  const file = STORE()
  let store: Record<string, { token: string; login: string; at: number }> = {}
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* fresh */ }
  store[sid] = { token: tokenData.access_token, login: ghUser.login, at: Date.now() }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store))

  const res = NextResponse.redirect(`${process.env.CACHORRO_ORIGIN || 'https://jazz-oracle.taild017e2.ts.net'}/?connected=github`)
  res.cookies.set('cch_gh_session', sid, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: true })
  return res
}
