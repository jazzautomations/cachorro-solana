import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import crypto from 'node:crypto'

export const RPC = process.env.CACHORRO_RPC || 'https://api.devnet.solana.com'
const DATA = join(process.cwd(), 'data', 'claims.json')
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function b58decode(s: string): Buffer {
  let n = BigInt(0)
  for (const c of s) {
    const i = B58.indexOf(c)
    if (i < 0) throw new Error('bad base58')
    n = n * 58n + BigInt(i)
  }
  let hex = n.toString(16)
  if (hex.length % 2) hex = '0' + hex
  let buf = Buffer.from(hex, 'hex')
  let zeros = 0
  while (zeros < s.length && s[zeros] === '1') zeros++
  return Buffer.concat([Buffer.alloc(zeros), buf])
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const j = await res.json()
  if (j.error) throw new Error(j.error.message)
  return j.result
}

/**
 * Resolve a program's upgrade authority on-chain.
 * BPFLoaderUpgradeable: Program account → programdata address (bytes 4..36);
 * ProgramData account → Option<Pubkey> upgrade authority at byte 12..48
 * (u32 option tag + 32-byte key, after 4-byte enum + 8-byte slot).
 */
export async function upgradeAuthority(programId: string): Promise<string | null> {
  const prog = await rpc('getAccountInfo', [programId, { encoding: 'base64' }])
  const data = Buffer.from(prog?.value?.data?.[0] || '', 'base64')
  if (!data.length) return null
  const tag = data.readUInt32LE(0)
  if (tag !== 3) return null // not an upgradeable Program account
  const pdAddr = Buffer.from(data.subarray(4, 36)).toString('hex')
  const pdB58 = b58encode(Buffer.from(pdAddr, 'hex'))
  const pd = await rpc('getAccountInfo', [pdB58, { encoding: 'base64' }])
  const pdd = Buffer.from(pd?.value?.data?.[0] || '', 'base64')
  if (pdd.length < 48 || pdd.readUInt32LE(0) !== 2) return null
  if (pdd.readUInt32LE(12) !== 1) return null // immutable / authority revoked
  return b58encode(pdd.subarray(16, 48))
}

export function b58encode(b: Buffer): string {
  let n = BigInt('0x' + (b.toString('hex') || '0'))
  let out = ''
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n }
  let zeros = 0
  while (zeros < b.length && b[zeros] === 0) zeros++
  return '1'.repeat(zeros) + out
}

export function claimMessage(programId: string): string {
  return `cachorro:claim:${programId}`
}

/** ed25519 verify via node crypto — pubkey wrapped in a minimal SPKI/DER header. */
export function verifyClaim(programId: string, authority: string, signatureB58: string): boolean {
  try {
    const pk = b58decode(authority)
    const sig = b58decode(signatureB58)
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pk])
    const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return crypto.verify(null, Buffer.from(claimMessage(programId), 'utf8'), key, sig)
  } catch { return false }
}

interface Claim { programId: string; authority: string; signature: string; claimedAt: number }
type Store = Record<string, Claim>

function load(): Store {
  try { return JSON.parse(readFileSync(DATA, 'utf8')) } catch { return {} }
}
function save(s: Store) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  const tmp = DATA + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, DATA)
}

export function getClaim(programId: string): Claim | null {
  return load()[programId] ?? null
}
export function putClaim(c: Claim) {
  const s = load(); s[c.programId] = c; save(s)
}

// ── repo claims: prove control by committing CACHORRO.md with our nonce ──

interface RepoClaim { repo: string; nonce: string; verified: boolean; claimedAt: number }
type RepoStore = Record<string, RepoClaim>

const REPO_DATA = join(process.cwd(), 'data', 'repo_claims.json')
const REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/

function loadRepos(): RepoStore {
  try { return JSON.parse(readFileSync(REPO_DATA, 'utf8')) } catch { return {} }
}
function saveRepos(s: RepoStore) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  const tmp = REPO_DATA + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, REPO_DATA)
}

export function newRepoClaim(repo: string): RepoClaim | null {
  if (!REPO_RE.test(repo)) return null
  const s = loadRepos()
  if (s[repo]?.verified) return s[repo]
  const c: RepoClaim = { repo, nonce: 'cachorro-claim-' + crypto.randomBytes(8).toString('hex'), verified: false, claimedAt: Math.floor(Date.now() / 1000) }
  s[repo] = c; saveRepos(s)
  return c
}

export function getRepoClaim(repo: string): RepoClaim | null {
  return loadRepos()[repo] ?? null
}

/** Fetch CACHORRO.md at the repo root and check it carries our nonce. */
export async function verifyRepoClaim(repo: string): Promise<boolean> {
  const c = loadRepos()[repo]
  if (!c || c.verified) return !!c?.verified
  for (const branch of ['main', 'master', 'HEAD']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/CACHORRO.md`,
        { signal: AbortSignal.timeout(10_000) })
      if (res.ok && (await res.text()).includes(c.nonce)) {
        const s = loadRepos(); s[repo].verified = true; saveRepos(s)
        return true
      }
    } catch { /* try next branch */ }
  }
  return false
}
