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

// ---- PM Projects Hub ----

export type PMProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

/** Source citation linking back to intake answers */
export type PMSource = {
  questionId: string
  excerpt: string
}

/** Tree node for feature/epic/story breakdown */
export type PMTreeNode = {
  id: string
  parentId?: string
  title: string
  description?: string
  status: 'draft' | 'ready' | 'in-progress' | 'done'
  priority: Priority
  owner?: string
  tags: string[]
  acceptanceCriteria: string[]
  dependsOn: string[]
  sources: PMSource[]
  children: PMTreeNode[]
  createdAt: string
  updatedAt: string
}

/** Kanban card linked to a tree node */
export type PMCard = {
  id: string
  featureId: string
  title: string
  lane: BoardLane
  priority: Priority
  owner?: string
  description?: string
  createdAt: string
  updatedAt: string
}

/** Intake idea version (immutable once saved) */
export type PMIdeaVersion = {
  id: string
  text: string
  createdAt: string
}

/** Intake analysis version */
export type PMAnalysis = {
  id: string
  summary: string
  keyPoints: string[]
  createdAt: string
}

/** Intake question with answer */
export type PMIntakeQuestion = {
  id: string
  category: string
  prompt: string
  required: boolean
  answer: string
  answeredAt?: string
}

/** Intake requirement derived from answers */
export type PMRequirement = {
  id: string
  text: string
  sources: PMSource[]
  createdAt: string
}

/** Full intake artifacts for a project */
export type PMIntake = {
  ideas: PMIdeaVersion[]
  analyses: PMAnalysis[]
  questions: PMIntakeQuestion[]
  requirements: PMRequirement[]
}

/** Activity event for a project */
export type PMActivity = {
  id: string
  at: string
  actor?: string
  action: string
  target?: string
  details?: Record<string, unknown>
}

/** Full PM Project entity */
export type PMProject = {
  id: string
  name: string
  summary?: string
  status: PMProjectStatus
  tags: string[]
  links: Array<{ label: string; url: string }>
  owner?: string
  createdAt: string
  updatedAt: string
}

export type PMProjectCreate = {
  id?: string
  name: string
  summary?: string
  status?: PMProjectStatus
  tags?: string[]
  owner?: string
}

export type PMProjectUpdate = {
  id: string
  name?: string
  summary?: string
  status?: PMProjectStatus
  tags?: string[]
  links?: Array<{ label: string; url: string }>
  owner?: string
}

export type PMTreeNodeCreate = {
  id?: string
  parentId?: string
  title: string
  description?: string
  status?: 'draft' | 'ready' | 'in-progress' | 'done'
  priority?: Priority
  owner?: string
  tags?: string[]
  acceptanceCriteria?: string[]
  dependsOn?: string[]
  sources?: PMSource[]
}

export type PMTreeNodeUpdate = {
  id: string
  parentId?: string
  title?: string
  description?: string
  status?: 'draft' | 'ready' | 'in-progress' | 'done'
  priority?: Priority
  owner?: string
  tags?: string[]
  acceptanceCriteria?: string[]
  dependsOn?: string[]
  sources?: PMSource[]
}

export type PMCardCreate = {
  id?: string
  featureId: string
  title: string
  lane?: BoardLane
  priority?: Priority
  owner?: string
  description?: string
}

export type PMCardUpdate = {
  id: string
  featureId?: string
  title?: string
  lane?: BoardLane
  priority?: Priority
  owner?: string
  description?: string
}

// ---- Feature-Level Intake ----

export type FeatureIntakeStatus = 'not_started' | 'in_progress' | 'complete'

/** Single question in feature-level intake */
export type FeatureIntakeQuestion = {
  id: string
  category: 'goal' | 'trigger' | 'flow' | 'edge_cases' | 'success' | 'dependencies' | 'priority' | 'constraints'
  prompt: string
  hint?: string
  answer?: string
  answeredAt?: string
}

/** Feature-level intake data stored per tree node */
export type FeatureIntake = {
  status: FeatureIntakeStatus
  startedAt?: string
  completedAt?: string
  currentQuestionIndex: number
  questions: FeatureIntakeQuestion[]
  /** AI-generated acceptance criteria with citations */
  generatedAC?: Array<{
    id: string
    text: string
    sourceQuestionIds: string[]
    createdAt: string
  }>
  /** AI-generated spec summary with citations */
  generatedSpec?: {
    problem?: string
    solution?: string
    nonGoals?: string
    sourceQuestionIds: string[]
    createdAt: string
  }
}

/** Extended tree node with feature-level intake */
export type PMTreeNodeWithIntake = PMTreeNode & {
  featureIntake?: FeatureIntake
}

// ---- OpenClaw Connection ----

/** Connection token for linking OpenClaw instances */
export type ConnectionToken = {
  id: string
  token: string
  userId: string
  createdAt: string
  expiresAt: string
  used: boolean
  usedAt?: string
  instanceId?: string
}

/** Connected OpenClaw instance */
export type ConnectedInstance = {
  id: string
  userId: string
  name: string
  host?: string
  connectedAt: string
  lastSeenAt: string
  status: 'active' | 'inactive'
  metadata?: {
    version?: string
    os?: string
    node?: string
  }
}

export type ConnectionTokenCreate = {
  expiresInMinutes?: number
}

export type ConnectionValidateRequest = {
  token: string
  instanceName: string
  metadata?: ConnectedInstance['metadata']
}

export type ConnectionValidateResponse = {
  success: boolean
  userId?: string
  instanceId?: string
  error?: string
}
