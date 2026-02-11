import type { Adapter } from './adapter'
import type {
  ActivityEvent,
  Blocker,
  ControlAction,
  ControlResult,
  FeatureNode,
  LiveSnapshot,
  ProjectInfo,
  Rule,
  RuleChange,
  RuleCreate,
  RuleDeleteResult,
  RuleUpdate,
  SystemStatus,
  Task,
  TaskCreate,
  TaskUpdate,
  WatchdogDiagnostics,
  WorkerHeartbeat,
} from '../types'

const nowIso = () => new Date().toISOString()

let mockRules: Rule[] = [
  {
    id: 'safety-core',
    title: 'Safety core',
    description: 'High-level guardrails for autonomous actions.',
    enabled: true,
    content: 'Never perform destructive operations without confirmation. Prefer least-privilege actions. Escalate when uncertain.',
    updatedAt: nowIso(),
  },
  {
    id: 'commits',
    title: 'Commits',
    description: 'Commit messages and hygiene.',
    enabled: true,
    content: 'Use short, imperative commit subject. Run lint + build before committing. Avoid WIP commits on main.',
    updatedAt: nowIso(),
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'When to notify the operator.',
    enabled: false,
    content: 'Notify on urgent errors, failing builds, or external API downtime > 5 minutes.',
    updatedAt: nowIso(),
  },
]

const mockRuleHistory: RuleChange[] = [
  {
    id: `chg-${Math.random().toString(16).slice(2)}`,
    at: new Date(Date.now() - 3600_000).toISOString(),
    ruleId: 'notifications',
    action: 'toggle',
    summary: 'Disabled rule',
    before: { enabled: true },
    after: { enabled: false },
    source: 'mock',
  },
]

let mockTasks: Task[] = []

let mockIntakeProjects: import('../types').IntakeProject[] = []



function pushRuleChange(change: Omit<RuleChange, 'id'>) {
  mockRuleHistory.unshift({ id: `chg-${Math.random().toString(16).slice(2)}-${Date.now()}`, ...change })
  while (mockRuleHistory.length > 250) mockRuleHistory.pop()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const mockAdapter: Adapter = {
  name: 'Mock (offline)',

  async getLiveSnapshot(): Promise<LiveSnapshot> {
    const [status, workers, blockers] = await Promise.all([this.getSystemStatus(), this.listWorkers(), this.listBlockers()])
    const watchdog: WatchdogDiagnostics = {
      health: 'warn',
      summary: 'mock diagnostics',
      heartbeatFile: { exists: false },
    }
    return { updatedAt: nowIso(), status, workers, blockers, watchdog }
  },

  async getSystemStatus(): Promise<SystemStatus> {
    await sleep(150)
    return {
      updatedAt: nowIso(),
      gateway: { health: 'warn', summary: 'Bridge not connected (mock data)' },
      nodes: { health: 'unknown', pairedCount: 0, pendingCount: 0, details: ['No live node telemetry.'] },
      browserRelay: { health: 'unknown', attachedTabs: 0 },
    }
  },

  async listProjects(): Promise<ProjectInfo[]> {
    await sleep(150)
    return [
      {
        id: 'tars-operator-hub',
        name: 'TARS Operator Hub',
        path: '~/.openclaw/workspace/projects/tars-operator-hub',
        status: 'Active',
        lastUpdatedAt: nowIso(),
        notes: 'Local-only UI. Start the bridge for live status and controls.',
      },
    ]
  },

  async listActivity(limit: number): Promise<ActivityEvent[]> {
    await sleep(150)
    const base = Date.now()
    const mkAt = (msAgo: number) => new Date(base - msAgo).toISOString()

    return Array.from({ length: Math.min(limit, 18) }).map((_, idx) => {
      const isWarn = idx % 7 === 0
      const isError = idx % 13 === 0
      const level: ActivityEvent['level'] = isError ? 'error' : isWarn ? 'warn' : 'info'
      const actor = idx % 3 === 0 ? 'dev-1' : idx % 3 === 1 ? 'dev-2' : 'qa'
      const type = isError ? 'bridge.error' : isWarn ? 'heartbeat.drift' : idx % 2 ? 'task.update' : 'telemetry'
      const severity = level === 'error' ? 'High' : level === 'warn' ? 'Medium' : 'Low'

      const at = mkAt(idx * 55_000)
      const startedAt = mkAt(idx * 55_000 - 12_000)
      const finishedAt = mkAt(idx * 55_000 - 2_000)

      return {
        id: `mock-${idx}`,
        at,
        level,
        source: idx % 2 ? 'orchestrator' : 'verify',
        message: isError
          ? 'Bridge unreachable (mock)'
          : isWarn
            ? `Heartbeat drift detected for ${actor} (mock)`
            : `Event ${idx + 1} (mock)`,
        meta: {
          actor,
          type,
          severity,
          startedAt,
          finishedAt,
          durationMs: 10_000,
          timeline: [
            { label: 'received', at },
            { label: 'started', at: startedAt },
            { label: 'finished', at: finishedAt },
          ],
          details: isError ? { host: 'localhost', port: 8787 } : undefined,
        },
      }
    })
  },

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    await sleep(150)
    const base = Date.now()
    const mkBeats = (count: number) => Array.from({ length: count }).map((_, i) => ({ at: new Date(base - i * 15_000).toISOString() }))
    return [
      { slot: 'dev-1', status: 'active', task: 'Integrations — status adapters + panels', lastBeatAt: new Date(base - 12_000).toISOString(), beats: mkBeats(24) },
      { slot: 'dev-2', status: 'waiting', task: 'Awaiting approval', lastBeatAt: new Date(base - 90_000).toISOString(), beats: mkBeats(6) },
      { slot: 'qa', status: 'offline', task: 'n/a', lastBeatAt: undefined, beats: [] },
    ]
  },

  async listBlockers(): Promise<Blocker[]> {
    await sleep(150)
    return [
      {
        id: 'bridge-offline',
        title: 'Operator bridge not running',
        severity: 'High',
        detectedAt: nowIso(),
        details: 'Run the optional local bridge to enable real system status, projects, and controls.',
        remediation: [
          { label: 'Start bridge', command: 'cd ~/.openclaw/workspace/projects/tars-operator-hub && npm run bridge' },
          { label: 'Start UI', command: 'cd ~/.openclaw/workspace/projects/tars-operator-hub && npm run dev' },
        ],
      },
    ]
  },

  async runControl(action: ControlAction): Promise<ControlResult> {
    await sleep(250)
    return { ok: false, message: `Mock adapter: control disabled (${action.kind})` }
  },

  async listModels(): Promise<import('../types').ModelList> {
    await sleep(120)
    return {
      defaultModel: 'openai-codex/gpt-5.2',
      models: [
        { key: 'openai-codex/gpt-5.2', name: 'GPT-5.2', available: true, tags: ['default'] },
        { key: 'openai-codex/gpt-5.3-codex', name: 'GPT-5.3 Codex', available: true, tags: ['fallback#1'] },
      ],
    }
  },

  async setDefaultModel(modelKey: string): Promise<import('../types').ModelSetResult> {
    await sleep(200)
    return { ok: true, message: `Mock: default model set to ${modelKey}`, defaultModel: modelKey }
  },

  async listRules(): Promise<Rule[]> {
    await sleep(100)
    return mockRules.slice().sort((a, b) => a.title.localeCompare(b.title))
  },

  async createRule(create: RuleCreate): Promise<Rule> {
    await sleep(150)
    const id = (create.id ?? create.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) || `rule-${Date.now()}`
    if (mockRules.some((r) => r.id === id)) throw new Error(`Rule already exists: ${id}`)
    const next: Rule = {
      id,
      title: create.title,
      description: create.description,
      content: create.content,
      enabled: create.enabled ?? true,
      updatedAt: nowIso(),
    }
    mockRules = [...mockRules, next]
    pushRuleChange({
      at: next.updatedAt,
      ruleId: next.id,
      action: 'create',
      summary: 'Created rule',
      after: { title: next.title, description: next.description, content: next.content, enabled: next.enabled },
      source: 'mock',
    })
    return next
  },

  async updateRule(update: RuleUpdate): Promise<Rule> {
    await sleep(150)
    const idx = mockRules.findIndex((r) => r.id === update.id)
    if (idx < 0) throw new Error(`Rule not found: ${update.id}`)
    const before = mockRules[idx]
    const next: Rule = {
      ...before,
      title: update.title ?? before.title,
      description: update.description ?? before.description,
      content: update.content ?? before.content,
      updatedAt: nowIso(),
    }
    mockRules = [...mockRules.slice(0, idx), next, ...mockRules.slice(idx + 1)]
    pushRuleChange({
      at: next.updatedAt,
      ruleId: next.id,
      action: 'update',
      summary: 'Updated rule content',
      before: { title: before.title, description: before.description, content: before.content },
      after: { title: next.title, description: next.description, content: next.content },
      source: 'mock',
    })
    return next
  },

  async deleteRule(id: string): Promise<RuleDeleteResult> {
    await sleep(120)
    const idx = mockRules.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error(`Rule not found: ${id}`)
    const before = mockRules[idx]
    mockRules = [...mockRules.slice(0, idx), ...mockRules.slice(idx + 1)]
    pushRuleChange({
      at: nowIso(),
      ruleId: id,
      action: 'delete',
      summary: 'Deleted rule',
      before: { title: before.title, description: before.description, content: before.content, enabled: before.enabled },
      source: 'mock',
    })
    return { ok: true }
  },

  async toggleRule(id: string, enabled: boolean): Promise<Rule> {
    await sleep(120)
    const idx = mockRules.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error(`Rule not found: ${id}`)
    const before = mockRules[idx]
    const next: Rule = { ...before, enabled, updatedAt: nowIso() }
    mockRules = [...mockRules.slice(0, idx), next, ...mockRules.slice(idx + 1)]
    pushRuleChange({
      at: next.updatedAt,
      ruleId: next.id,
      action: 'toggle',
      summary: enabled ? 'Enabled rule' : 'Disabled rule',
      before: { enabled: before.enabled },
      after: { enabled: next.enabled },
      source: 'mock',
    })
    return next
  },

  async listRuleHistory(limit: number): Promise<RuleChange[]> {
    await sleep(100)
    return mockRuleHistory.slice(0, Math.max(1, Math.min(500, limit)))
  },

  async listTasks(): Promise<Task[]> {
    await sleep(120)
    return mockTasks.slice().sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  },

  async createTask(create: TaskCreate): Promise<Task> {
    await sleep(150)
    const baseFromTitle = (create.title ?? '')
      .toLowerCase()
      .replace(/\b(p[0-3])\b/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const id = create.id ?? (baseFromTitle || `task-${Date.now()}`)
    if (mockTasks.some((t) => t.id === id)) throw new Error(`Task already exists: ${id}`)

    const now = nowIso()
    const lane = create.lane ?? 'queued'
    const next: Task = {
      id,
      title: create.title,
      lane,
      priority: create.priority ?? 'P2',
      owner: create.owner,
      problem: create.problem,
      scope: create.scope,
      acceptanceCriteria: create.acceptanceCriteria ?? [],
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ at: now, to: lane, note: 'created' }],
    }
    mockTasks = [next, ...mockTasks]
    return next
  },

  async updateTask(update: TaskUpdate): Promise<Task> {
    await sleep(150)
    const idx = mockTasks.findIndex((t) => t.id === update.id)
    if (idx < 0) throw new Error(`Task not found: ${update.id}`)
    const before = mockTasks[idx]
    const now = nowIso()
    const nextLane = update.lane ?? before.lane
    const laneChanged = nextLane !== before.lane

    const next: Task = {
      ...before,
      title: update.title ?? before.title,
      lane: nextLane,
      priority: update.priority ?? before.priority,
      owner: update.owner ?? before.owner,
      problem: update.problem ?? before.problem,
      scope: update.scope ?? before.scope,
      acceptanceCriteria: update.acceptanceCriteria ?? before.acceptanceCriteria,
      updatedAt: now,
      statusHistory: laneChanged
        ? [{ at: now, from: before.lane, to: nextLane, note: 'moved' }, ...(before.statusHistory ?? [])]
        : before.statusHistory ?? [],
    }

    mockTasks = [next, ...mockTasks.slice(0, idx), ...mockTasks.slice(idx + 1)]
    // keep most recently updated at the top
    mockTasks = mockTasks.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    return next
  },

  async listIntakeProjects() {
    await sleep(120)
    return mockIntakeProjects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  async getIntakeProject(id: string) {
    await sleep(80)
    const p = mockIntakeProjects.find((x) => x.id === id)
    if (!p) throw new Error(`Intake project not found: ${id}`)
    return p
  },

  async createIntakeProject(create: import('../types').IntakeProjectCreate) {
    await sleep(150)
    const now = nowIso()
    const id = (create.id ?? create.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const safeId = id || `intake-${Date.now()}`
    if (mockIntakeProjects.some((p) => p.id === safeId)) throw new Error(`Intake project already exists: ${safeId}`)

    const next: import('../types').IntakeProject = {
      id: safeId,
      title: create.title,
      idea: create.idea,
      status: 'idea',
      tags: [],
      questions: [],
      scope: null,
      featureTree: [],
      createdAt: now,
      updatedAt: now,
    }

    mockIntakeProjects = [next, ...mockIntakeProjects]
    return next
  },

  async updateIntakeProject(update: import('../types').IntakeProjectUpdate) {
    await sleep(150)
    const idx = mockIntakeProjects.findIndex((p) => p.id === update.id)
    if (idx < 0) throw new Error(`Intake project not found: ${update.id}`)
    const before = mockIntakeProjects[idx]
    const next = { ...before, ...update, id: before.id, createdAt: before.createdAt, updatedAt: nowIso() }
    mockIntakeProjects = [...mockIntakeProjects.slice(0, idx), next, ...mockIntakeProjects.slice(idx + 1)]
    return next
  },

  async generateIntakeQuestions(id: string) {
    await sleep(200)
    const p = await this.getIntakeProject(id)
    const questions = [
      { id: `q-${Date.now()}-1`, category: 'Goal', prompt: 'What problem are we solving?', required: true, answer: '' },
      { id: `q-${Date.now()}-2`, category: 'Users', prompt: 'Who are the primary users?', required: true, answer: '' },
      { id: `q-${Date.now()}-3`, category: 'Scope', prompt: 'What is out of scope for v1?', required: true, answer: '' },
    ]
    return this.updateIntakeProject({ id: p.id, questions, status: 'questions' })
  },

  async generateIntakeScope(id: string) {
    await sleep(200)
    const p = await this.getIntakeProject(id)
    const scope = {
      summary: p.idea.slice(0, 240),
      inScope: ['Create intake project', 'Answer questions', 'Generate feature tree'],
      outOfScope: ['Multi-user collaboration'],
      assumptions: ['Local single-user usage'],
      risks: ['Answers incomplete'],
    }
    const featureTree: FeatureNode[] = [
      {
        id: `f-${Date.now()}-1`,
        title: 'Intake workflow',
        priority: 'P0',
        description: 'Create project, questions, answers.',
        acceptanceCriteria: ['Can create project', 'Can save answers'],
        children: [],
      },
    ]
    return this.updateIntakeProject({ id: p.id, scope, featureTree, status: 'scoped' })
  },

  async exportIntakeMarkdown(id: string) {
    await sleep(80)
    const p = await this.getIntakeProject(id)
    return `# ${p.title}\n\n${p.idea}`
  },
}
