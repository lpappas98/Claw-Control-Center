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
  RuleCreate,
  RuleDeleteResult,
  RuleUpdate,
  SystemStatus,
  Task,
  TaskCreate,
  TaskUpdate,
  WorkerHeartbeat,
} from '../types'

export type BridgeAdapterOptions = {
  baseUrl: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? `\n${text}` : ''}`)
  }
  return (await res.json()) as T
}

export function bridgeAdapter(opts: BridgeAdapterOptions): Adapter {
  const base = opts.baseUrl.replace(/\/$/, '')

  return {
    name: `Bridge (${base})`,

    getLiveSnapshot() {
      return fetchJson<LiveSnapshot>(`${base}/api/live`)
    },

    getSystemStatus() {
      return fetchJson<SystemStatus>(`${base}/api/status`)
    },

    listProjects() {
      return fetchJson<ProjectInfo[]>(`${base}/api/projects`)
    },

    listActivity(limit: number) {
      const qs = new URLSearchParams({ limit: String(limit) }).toString()
      return fetchJson<ActivityEvent[]>(`${base}/api/activity?${qs}`)
    },

    listWorkers() {
      return fetchJson<WorkerHeartbeat[]>(`${base}/api/workers`)
    },

    listBlockers() {
      return fetchJson<Blocker[]>(`${base}/api/blockers`)
    },

    runControl(action: ControlAction): Promise<ControlResult> {
      return fetchJson<ControlResult>(`${base}/api/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action),
      })
    },

    listRules() {
      return fetchJson<Rule[]>(`${base}/api/rules`)
    },

    createRule(create: RuleCreate) {
      return fetchJson<Rule>(`${base}/api/rules`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updateRule(update: RuleUpdate) {
      return fetchJson<Rule>(`${base}/api/rules/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deleteRule(id: string) {
      return fetchJson<RuleDeleteResult>(`${base}/api/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },

    toggleRule(id: string, enabled: boolean) {
      return fetchJson<Rule>(`${base}/api/rules/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
    },

    listRuleHistory(limit: number) {
      const qs = new URLSearchParams({ limit: String(limit) }).toString()
      return fetchJson<RuleChange[]>(`${base}/api/rules/history?${qs}`)
    },

    listTasks() {
      return fetchJson<Task[]>(`${base}/api/tasks`)
    },

    createTask(create: TaskCreate) {
      return fetchJson<Task>(`${base}/api/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updateTask(update: TaskUpdate) {
      return fetchJson<Task>(`${base}/api/tasks/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    // ---- Intake projects ----
    listIntakeProjects() {
      return fetchJson<import('../types').IntakeProject[]>(`${base}/api/intake/projects`)
    },

    getIntakeProject(id: string) {
      return fetchJson<import('../types').IntakeProject>(`${base}/api/intake/projects/${encodeURIComponent(id)}`)
    },

    createIntakeProject(create: import('../types').IntakeProjectCreate) {
      return fetchJson<import('../types').IntakeProject>(`${base}/api/intake/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updateIntakeProject(update: import('../types').IntakeProjectUpdate) {
      return fetchJson<import('../types').IntakeProject>(`${base}/api/intake/projects/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    generateIntakeQuestions(id: string) {
      return fetchJson<import('../types').IntakeProject>(`${base}/api/intake/projects/${encodeURIComponent(id)}/generate-questions`, {
        method: 'POST',
      })
    },

    generateIntakeScope(id: string) {
      return fetchJson<import('../types').IntakeProject>(`${base}/api/intake/projects/${encodeURIComponent(id)}/generate-scope`, {
        method: 'POST',
      })
    },

    async exportIntakeMarkdown(id: string) {
      const res = await fetch(`${base}/api/intake/projects/${encodeURIComponent(id)}/export.md`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.text()
    },
  }
}
