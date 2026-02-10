import type { Adapter } from './adapter'
import type {
  ActivityEvent,
  Blocker,
  ControlAction,
  ControlResult,
  LiveSnapshot,
  ProjectInfo,
  Rule,
  RuleChange,
  RuleUpdate,
  SystemStatus,
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
    return Array.from({ length: Math.min(limit, 12) }).map((_, idx) => ({
      id: `mock-${idx}`,
      at: new Date(Date.now() - idx * 60_000).toISOString(),
      level: idx % 7 === 0 ? 'warn' : 'info',
      source: idx % 2 ? 'orchestrator' : 'verify',
      message: idx % 7 === 0 ? 'Heartbeat drift detected for dev-1 (mock)' : `Event ${idx + 1} (mock)`,
    }))
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

  async listRules(): Promise<Rule[]> {
    await sleep(100)
    return mockRules.slice().sort((a, b) => a.title.localeCompare(b.title))
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
}
