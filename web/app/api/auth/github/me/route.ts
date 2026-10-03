import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// whoami for the UI — is a github session connected, and as whom
export async function GET(req: Request) {
  const ghSid = req.headers.get('cookie')?.match(/cch_gh_session=([a-f0-9]+)/)?.[1]
  if (!ghSid) return NextResponse.json({ connected: false })
  try {
    const store = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'gh_oauth.json'), 'utf8')
    ) as Record<string, { token: string; login: string }>
    const e = store[ghSid]
    if (!e) return NextResponse.json({ connected: false })
    return NextResponse.json({ connected: true, login: e.login })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
