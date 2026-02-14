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

export type BoardLane = 'proposed' | 'queued' | 'development' | 'review' | 'blocked' | 'done'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export type TaskStatusHistoryEntry = {
  at: string
  from?: BoardLane
  to: BoardLane
  note?: string
}

/**
 * Operator task details (TPO-level) persisted locally by the bridge.
 * These are used to seed/enrich the live board (e.g. queued work before assignment).
 */
export type Task = {
  id: string
  title: string
  lane: BoardLane
  priority: Priority
  owner?: string
  problem?: string
  scope?: string
  acceptanceCriteria?: string[]
  createdAt: string
  updatedAt: string
  statusHistory: TaskStatusHistoryEntry[]
}

export type TaskCreate = {
  id?: string
  title: string
  lane?: BoardLane
  priority?: Priority
  owner?: string
  problem?: string
  scope?: string
  acceptanceCriteria?: string[]
}

export type TaskUpdate = {
  id: string
  title?: string
  lane?: BoardLane
  priority?: Priority
  owner?: string
  problem?: string
  scope?: string
  acceptanceCriteria?: string[]
}

// ---- Projects ----
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export type Project = {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  priority: Priority
  owner?: string
  createdAt: string
  updatedAt: string
}

export type ProjectCreate = {
  id?: string
  name: string
  description?: string
  status?: ProjectStatus
  priority?: Priority
  owner?: string
}

export type ProjectUpdate = {
  id: string
  name?: string
  description?: string
  status?: ProjectStatus
  priority?: Priority
  owner?: string
}

// ---- PM/PO Intake ----
export type IntakeProjectStatus = 'idea' | 'questions' | 'scoped'

export type IntakeQuestion = {
  id: string
  category: string
  prompt: string
  required: boolean
  answer: string
}

export type IntakeScopeDraft = {
  summary: string
  inScope: string[]
  outOfScope: string[]
  assumptions: string[]
  risks: string[]
}

export type FeatureNode = {
  id: string
  title: string
  priority: Priority
  description?: string
  acceptanceCriteria: string[]
  children: FeatureNode[]
}

export type IntakeProject = {
  id: string
  title: string
  idea: string
  status: IntakeProjectStatus
  tags: string[]
  questions: IntakeQuestion[]
  scope: IntakeScopeDraft | null
  featureTree: FeatureNode[]
  createdAt: string
  updatedAt: string
}

export type IntakeProjectCreate = {
  id?: string
  title: string
  idea: string
}

export type IntakeProjectUpdate = Partial<Omit<IntakeProject, 'id' | 'createdAt'>> & { id: string }

export type Rule = {
  id: string
  title: string
  description?: string
  enabled: boolean
  /** Freeform rule body (prompt, policy text, etc.). */
  content: string
  updatedAt: string
}

export type RuleCreate = {
  /** Optional explicit id; if omitted the bridge will generate one. */
  id?: string
  title: string
  description?: string
  content: string
  enabled?: boolean
}

export type RuleUpdate = {
  id: string
  title?: string
  description?: string
  content?: string
}

export type RuleDeleteResult = { ok: true }

export type RuleChangeAction = 'create' | 'update' | 'toggle' | 'delete'

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

// ---- Models/config ----
export type ModelInfo = {
  key: string
  name?: string
  input?: string
  contextWindow?: number
  local?: boolean
  available?: boolean
  tags?: string[]
  missing?: boolean
}

export type ModelList = {
  defaultModel?: string
  models: ModelInfo[]
}

export type ModelSetResult = {
  ok: boolean
  message: string
  defaultModel?: string
}

// ---- Multi-Agent Task Management ----
export type TaskStatus = 'queued' | 'development' | 'review' | 'blocked' | 'done'

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type AgentStatus = 'online' | 'offline' | 'busy'

export type Agent = {
  id: string
  name: string
  emoji: string
  role: string
  status: AgentStatus
  lastSeenAt: string
  currentTaskId?: string
  workload: number // number of active tasks
  tags?: string[]
}

export type TaskComment = {
  id: string
  agentId: string
  text: string
  createdAt: string
}

export type TimeLog = {
  id: string
  agentId: string
  hours: number
  note?: string
  loggedAt: string
}

export type TaskDependency = {
  id: string
  dependsOnTaskId: string
  dependsOnTask?: Task
  blockedByTaskId?: string
}

export type AgentTask = {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  assignee?: Agent
  estimatedHours?: number
  actualHours?: number
  tags?: string[]
  projectId?: string
  createdAt: string
  updatedAt: string
  comments?: TaskComment[]
  timeLogs?: TimeLog[]
  dependencies?: TaskDependency[]
  blockedBy?: string[] // task ids that block this
  blocks?: string[] // task ids that this blocks
  subtaskCount?: number
  commentCount?: number
}

export type Notification = {
  id: string
  agentId: string
  type: 'task_assigned' | 'task_commented' | 'task_blocked' | 'task_completed' | 'status_change'
  title: string
  message: string
  taskId?: string
  read: boolean
  createdAt: string
}

// ---- Integration Types ----
export type IntegrationStatus = 'connected' | 'not_configured' | 'error'

export type GitHubIntegration = {
  id: string
  status: IntegrationStatus
  enabled: boolean
  token?: string
  username?: string
  linkedIssues?: Record<string, string> // taskId -> issueUrl
  commits?: Array<{
    taskId: string
    sha: string
    message: string
    date: string
  }>
}

export type TelegramIntegration = {
  id: string
  status: IntegrationStatus
  enabled: boolean
  botToken?: string
  chatIds: Record<string, string> // eventType -> chatId
  eventMappings?: Record<string, string[]> // channelId -> eventTypes
}

export type CalendarIntegration = {
  id: string
  status: IntegrationStatus
  enabled: boolean
  token?: string
  calendarId?: string
  syncedDeadlines?: Record<string, string> // taskId -> eventId
}

export type IntegrationConfig = {
  github?: GitHubIntegration
  telegram?: TelegramIntegration
  calendar?: CalendarIntegration
}

// Extended AgentTask with integration fields
export type AgentTaskWithIntegrations = AgentTask & {
  deadline?: string // ISO date string
  githubIssueUrl?: string
  calendarEventId?: string
  commits?: Array<{
    sha: string
    message: string
    date: string
  }>
}
