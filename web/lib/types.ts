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
  createdAt: number
  updatedAt?: number
}

export interface LintEntry { file: string; line: number; code: string }
export interface LintSection { title: string; lines: LintEntry[]; raw: string[] }

export interface ScanReport extends JobStatus {
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
