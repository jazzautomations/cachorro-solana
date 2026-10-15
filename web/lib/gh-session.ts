import fs from 'fs'
import path from 'path'

// The GitHub OAuth session the callback parked server side, if any.
export function ghSession(req: Request): { token: string; login: string } | null {
  const sid = req.headers.get('cookie')?.match(/cch_gh_session=([a-f0-9]+)/)?.[1]
  if (!sid) return null
  try {
    const store = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'gh_oauth.json'), 'utf8')
    ) as Record<string, { token: string; login: string }>
    return store[sid] ?? null
  } catch {
    return null
  }
}
