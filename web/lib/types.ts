export interface JobStatus {
  id: string
  target: string
  kind: 'repo' | 'program-id'
  cluster?: string
  status: 'running' | 'done' | 'error'
  stage: string
  mode?: 'quick' | 'deep' | 'full'
  stages: Record<string, string>
  staticNote?: string
  error?: string
  engine?: string
  reportFile?: string
  createdAt: number
  updatedAt?: number
  targetRev?: string
  stale?: boolean
  staleRev?: string
  staleSince?: number
}

export interface LintEntry { file: string; line: number; code: string }
export interface LintSection { title: string; lines: LintEntry[]; raw: string[] }

export interface HuntEvent {
  ts: number
  stage: string
  agent: string
  kind: 'action' | 'thought' | 'obs' | 'finding' | 'verdict' | 'poc' | 'note' | 'error' | string
  text: string
}

export interface Finding {
  id?: string
  vulnerability_type: string
  severity: 'critical' | 'high' | 'medium' | 'low' | string
  file: string
  function?: string
  line_range?: string
  description?: string
  impact?: string
}

export interface ScanReport extends JobStatus {
  events?: HuntEvent[]
  engine?: string
  reportFile?: string
  findings?: Finding[]
  survivorCount?: number
  summary?: Record<string, string>
  sections?: LintSection[]
  zkModules?: string[]
  onchain?: {
    owner?: string
    executable?: boolean
    lamports?: number
    dataLen?: number
    space?: number
  }
  fetchLog?: string[]
  staticLog?: string[]
}

export interface Bounty {
  id: string
  source: string
  project: string
  slug: string
  url: string
  maxBounty: number | null
  kyc: boolean
  pocType: string | null
  ecosystems: string[]
  languages: string[]
  solana: boolean
  logo: string | null
  repos: string[]
  updatedDate: string | null
}

export interface BountyIndex {
  updatedAt: string
  sources: Record<string, { status: string; count?: number; error?: string }>
  bounties: Bounty[]
}

export interface Lab {
  id: string
  dir: string
  tier: 1 | 2 | 3
  title: string
  vulnClass: string
  concept: string
  realWorld: string
  proven?: string
  insecure: string | null
  secure: string | null
  recommended: string | null
  repoUrl: string
  huntTarget: string
}

export interface LabIndex {
  generatedAt: string
  source: string
  labs: Lab[]
}

export interface RunListItem {
  id: string
  target: string
  kind: string
  status: string
  createdAt: number
}
