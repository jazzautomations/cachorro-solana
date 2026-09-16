export interface JobStatus {
  id: string
  target: string
  kind: 'repo' | 'program-id'
  cluster?: string
  status: 'running' | 'done' | 'error'
  stage: string
  stages: Record<string, string>
  staticNote?: string
  error?: string
  engine?: string
  reportFile?: string
  createdAt: number
  updatedAt?: number
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

export interface RunListItem {
  id: string
  target: string
  kind: string
  status: string
  createdAt: number
}
