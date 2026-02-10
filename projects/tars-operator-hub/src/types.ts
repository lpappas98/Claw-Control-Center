export type Health = 'ok' | 'warn' | 'down' | 'unknown'

export type SystemStatus = {
  updatedAt: string
  gateway: { health: Health; summary: string; details?: string[] }
  nodes: { health: Health; pairedCount: number; pendingCount: number; details?: string[] }
  browserRelay: { health: Health; attachedTabs: number; details?: string[] }
}

export type WatchdogDiagnostics = {
  health: Health
  summary: string
  heartbeatFile?: {
    exists: boolean
    path?: string
    mtime?: string
    ageMs?: number
    sizeBytes?: number
    parseOk?: boolean
    error?: string
    workerCount?: number
  }
}

/** Single bridge-computed snapshot to avoid UI false positives from mixed polling timestamps. */
export type LiveSnapshot = {
  updatedAt: string
  status: SystemStatus
  workers: WorkerHeartbeat[]
  blockers: Blocker[]
  watchdog: WatchdogDiagnostics
}

export type WorkerStatus = 'active' | 'waiting' | 'stale' | 'offline'

export type WorkerHeartbeat = {
  slot: string
  /** Optional human-friendly label (may differ from slot). */
  label?: string
  status: WorkerStatus
  task?: string
  lastBeatAt?: string
  beats: Array<{ at: string }>
}

export type ProjectInfo = {
  id: string
  name: string
  path: string
  status: 'Active' | 'Paused' | 'Unknown'
  lastUpdatedAt?: string
  notes?: string

  /** Optional enrichment when using the local bridge. */
  git?: {
    root?: string
    branch?: string
    dirty?: boolean
    ahead?: number
    behind?: number
    lastCommitAt?: string
  }

  node?: {
    hasPackageJson?: boolean
    packageName?: string
    scripts?: string[]
  }
}

export type ActivityLevel = 'info' | 'warn' | 'error'

export type ActivityEvent = {
  id: string
  at: string
  level: ActivityLevel
  source: string
  message: string
  meta?: Record<string, unknown>
}

export type Blocker = {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Low'
  detectedAt: string
  details?: string
  remediation: Array<{ label: string; command: string; action?: ControlAction }>
}

export type ControlAction =
  | { kind: 'gateway.start' }
  | { kind: 'gateway.stop' }
  | { kind: 'gateway.restart' }
  | { kind: 'nodes.refresh' }

export type ControlResult = { ok: boolean; message: string; output?: string }

export type Rule = {
  id: string
  title: string
  description?: string
  enabled: boolean
  /** Freeform rule body (prompt, policy text, etc.). */
  content: string
  updatedAt: string
}

export type RuleUpdate = {
  id: string
  title?: string
  description?: string
  content?: string
}

export type RuleChangeAction = 'create' | 'update' | 'toggle'

export type RuleChange = {
  id: string
  at: string
  ruleId: string
  action: RuleChangeAction
  summary: string
  before?: Partial<Rule>
  after?: Partial<Rule>
  source?: string
}
