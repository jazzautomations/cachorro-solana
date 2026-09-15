export type Stage =
  | 'fetch' | 'static' | 'research' | 'analyze'
  | 'devil' | 'poc' | 'review' | 'report'

export const STAGES: { id: Stage; name: string; label: string; icon: string }[] = [
  { id: 'fetch',    name: 'FETCH',    label: 'Clone repo / dump on-chain program', icon: '⇩' },
  { id: 'static',   name: 'STATIC',   label: 'Anchor/Rust lint + cargo-audit',     icon: '#' },
  { id: 'research', name: 'RESEARCH', label: 'Protocol context recon',             icon: '?' },
  { id: 'analyze',  name: 'ANALYZE',  label: 'Deep vulnerability analysis',        icon: '!' },
  { id: 'devil',    name: 'DEVIL',    label: "Devil's Advocate — kill false-pos",  icon: '×' },
  { id: 'poc',      name: 'POC',      label: 'PoC on a local validator',           icon: '⚡' },
  { id: 'review',   name: 'REVIEW',   label: 'Run & verify the PoC',               icon: '✓' },
  { id: 'report',   name: 'REPORT',   label: 'Assemble audit report',              icon: '▤' },
]
