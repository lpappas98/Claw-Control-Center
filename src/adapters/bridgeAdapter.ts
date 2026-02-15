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
  WorkerStatus,
  Project,
  ProjectCreate,
  ProjectUpdate,
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

    listActivity(limit: number) {
      const qs = new URLSearchParams({ limit: String(limit) }).toString()
      return fetchJson<ActivityEvent[]>(`${base}/api/activity?${qs}`)
    },

    async listWorkers(): Promise<WorkerHeartbeat[]> {
      try {
        // Use new sub-agent status endpoint
        const data = await fetchJson<{ agents: Array<{
          id: string; name: string; role: string; emoji: string;
          status: string; currentTask: {
            id: string; title: string; priority: string; tag: string;
            startedAt: number; runningFor: number; tokenUsage: number | null;
            duration: number | null; totalTokens: number | null; model: string | null;
          } | null;
        }> }>(`${base}/api/agents/status`)
        
        return (data.agents || []).map(a => ({
          slot: a.id,
          label: a.name,
          status: (a.status === 'active' ? 'active' : 'waiting') as WorkerStatus,
          task: a.currentTask?.title || undefined,
          taskStartedAt: a.currentTask?.startedAt || undefined,
          lastBeatAt: a.currentTask?.startedAt ? new Date(a.currentTask.startedAt).toISOString() : undefined,
          beats: [],
        }))
      } catch {
        // Fallback to old endpoint
        return fetchJson<WorkerHeartbeat[]>(`${base}/api/workers`)
      }
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

    listModels() {
      return fetchJson<import('../types').ModelList>(`${base}/api/models`)
    },

    setDefaultModel(modelKey: string) {
      return fetchJson<import('../types').ModelSetResult>(`${base}/api/models/set`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey }),
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

    // ---- Projects ----
    listProjects() {
      return fetchJson<Project[]>(`${base}/api/projects`)
    },

    getProject(id: string) {
      return fetchJson<Project>(`${base}/api/projects/${encodeURIComponent(id)}`)
    },

    createProject(create: ProjectCreate) {
      return fetchJson<Project>(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updateProject(update: ProjectUpdate) {
      return fetchJson<Project>(`${base}/api/projects/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deleteProject(id: string) {
      return fetchJson<{ ok: boolean }>(`${base}/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    },

    // ---- Aspects ----
    listAspects(projectId?: string) {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
      return fetchJson<import('../types').Aspect[]>(`${base}/api/aspects${qs}`)
    },

    getAspect(id: string) {
      return fetchJson<import('../types').Aspect>(`${base}/api/aspects/${encodeURIComponent(id)}`)
    },

    createAspect(create: import('../types').AspectCreate) {
      return fetchJson<import('../types').Aspect>(`${base}/api/aspects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updateAspect(update: import('../types').AspectUpdate) {
      return fetchJson<import('../types').Aspect>(`${base}/api/aspects/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deleteAspect(id: string) {
      return fetchJson<{ ok: boolean }>(`${base}/api/aspects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
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
