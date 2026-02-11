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
  PMProject,
  PMProjectCreate,
  PMProjectUpdate,
  PMTreeNode,
  PMTreeNodeCreate,
  PMTreeNodeUpdate,
  PMCard,
  PMCardCreate,
  PMCardUpdate,
  PMIntake,
  PMActivity,
  FeatureIntake,
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

    // ---- PM Projects Hub ----
    listPMProjects() {
      return fetchJson<PMProject[]>(`${base}/api/pm/projects`)
    },

    getPMProject(id: string) {
      return fetchJson<PMProject>(`${base}/api/pm/projects/${encodeURIComponent(id)}`)
    },

    createPMProject(create: PMProjectCreate) {
      return fetchJson<PMProject>(`${base}/api/pm/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updatePMProject(update: PMProjectUpdate) {
      return fetchJson<PMProject>(`${base}/api/pm/projects/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deletePMProject(id: string) {
      return fetchJson<{ ok: boolean }>(`${base}/api/pm/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },

    exportPMProjectJSON(id: string) {
      return fetchJson<object>(`${base}/api/pm/projects/${encodeURIComponent(id)}/export.json`)
    },

    async exportPMProjectMarkdown(id: string) {
      const res = await fetch(`${base}/api/pm/projects/${encodeURIComponent(id)}/export.md`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.text()
    },

    // PM Projects - Tree
    getPMTree(projectId: string) {
      return fetchJson<PMTreeNode[]>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree`)
    },

    createPMTreeNode(projectId: string, create: PMTreeNodeCreate) {
      return fetchJson<PMTreeNode>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updatePMTreeNode(projectId: string, update: PMTreeNodeUpdate) {
      return fetchJson<PMTreeNode>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree/nodes/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deletePMTreeNode(projectId: string, nodeId: string) {
      return fetchJson<{ ok: boolean }>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree/nodes/${encodeURIComponent(nodeId)}`, { method: 'DELETE' })
    },

    // PM Projects - Feature-Level Intake
    getFeatureIntake(projectId: string, nodeId: string) {
      return fetchJson<FeatureIntake | null>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree/nodes/${encodeURIComponent(nodeId)}/intake`)
    },

    setFeatureIntake(projectId: string, nodeId: string, intake: FeatureIntake) {
      return fetchJson<FeatureIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/tree/nodes/${encodeURIComponent(nodeId)}/intake`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(intake),
      })
    },

    // PM Projects - Kanban Cards
    listPMCards(projectId: string) {
      return fetchJson<PMCard[]>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/cards`)
    },

    createPMCard(projectId: string, create: PMCardCreate) {
      return fetchJson<PMCard>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/cards`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(create),
      })
    },

    updatePMCard(projectId: string, update: PMCardUpdate) {
      return fetchJson<PMCard>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/cards/${encodeURIComponent(update.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      })
    },

    deletePMCard(projectId: string, cardId: string) {
      return fetchJson<{ ok: boolean }>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' })
    },

    // PM Projects - Intake
    getPMIntake(projectId: string) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake`)
    },

    setPMIntake(projectId: string, intake: PMIntake) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(intake),
      })
    },

    addPMIdeaVersion(projectId: string, text: string) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake/idea`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    },

    addPMAnalysis(projectId: string, summary: string, keyPoints: string[]) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake/analysis`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary, keyPoints }),
      })
    },

    generatePMQuestions(projectId: string) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake/questions/generate`, {
        method: 'POST',
      })
    },

    answerPMQuestion(projectId: string, questionId: string, answer: string) {
      return fetchJson<PMIntake>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/intake/questions/${encodeURIComponent(questionId)}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
    },

    // PM Projects - Activity
    listPMActivity(projectId: string, limit = 50) {
      const qs = new URLSearchParams({ limit: String(limit) }).toString()
      return fetchJson<PMActivity[]>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/activity?${qs}`)
    },

    addPMActivity(projectId: string, activity: Omit<PMActivity, 'id' | 'at'>) {
      return fetchJson<PMActivity>(`${base}/api/pm/projects/${encodeURIComponent(projectId)}/activity`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(activity),
      })
    },

    // Migration helper
    migrateIntakeToPM(intakeProjectId: string) {
      return fetchJson<PMProject>(`${base}/api/pm/migrate/from-intake`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intakeProjectId }),
      })
    },

    // OpenClaw Connections (not implemented in bridge adapter)
    async generateConnectionToken() {
      throw new Error('Connection tokens only available with Firestore adapter')
    },
    async listConnectionTokens() {
      throw new Error('Connection tokens only available with Firestore adapter')
    },
    async validateConnectionToken() {
      throw new Error('Connection tokens only available with Firestore adapter')
    },
    async listConnectedInstances() {
      return []
    },
    async updateInstanceHeartbeat() {
      throw new Error('Connection management only available with Firestore adapter')
    },
    async disconnectInstance() {
      throw new Error('Connection management only available with Firestore adapter')
    },
  }
}
