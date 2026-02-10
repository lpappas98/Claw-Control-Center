export type Health = 'ok' | 'warn' | 'down' | 'unknown'

export type SystemStatus = {
  updatedAt: string
  gateway: { health: Health; summary: string; details?: string[] }
  nodes: { health: Health; pairedCount: number; pendingCount: number; details?: string[] }
  browserRelay: { health: Health; attachedTabs: number; details?: string[] }
}

export type WorkerStatus = 'active' | 'waiting' | 'stale' | 'offline'

export type WorkerHeartbeat = {
  slot: string
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
  remediation: Array<{ label: string; command: string }>
}

export type ControlAction =
  | { kind: 'gateway.start' }
  | { kind: 'gateway.stop' }
  | { kind: 'gateway.restart' }
  | { kind: 'nodes.refresh' }

export type ControlResult = { ok: boolean; message: string; output?: string }
