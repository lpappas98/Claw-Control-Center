import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import type { Adapter } from './adapter'
import type {
  ActivityEvent,
  AgentProfile,
  AgentProfileCreate,
  AgentProfileUpdate,
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
  IntakeProject,
  IntakeProjectCreate,
  IntakeProjectUpdate,
  ModelList,
  ModelSetResult,
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
  BoardLane,
  Priority,
  ConnectionToken,
  ConnectedInstance,
  ConnectionTokenCreate,
  ConnectionValidateRequest,
  ConnectionValidateResponse,
  ActiveSession,
  ActiveSessionCreate,
  ActiveSessionUpdate,
} from '../types'

// Helper to get current user ID or throw
function getUserId(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

// Helper to generate IDs
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

// Collection paths
const getUserCollection = (path: string) => {
  const userId = getUserId()
  return collection(db, 'users', userId, path)
}

const getUserDoc = (path: string, id: string) => {
  const userId = getUserId()
  return doc(db, 'users', userId, path, id)
}

// PM Project sub-collection paths
const getPMProjectSubCollection = (projectId: string, subPath: string) => {
  const userId = getUserId()
  return collection(db, 'users', userId, 'pmProjects', projectId, subPath)
}

const getPMProjectSubDoc = (projectId: string, subPath: string, docId: string) => {
  const userId = getUserId()
  return doc(db, 'users', userId, 'pmProjects', projectId, subPath, docId)
}

// Convert Firestore timestamps to ISO strings
function convertTimestamps<T>(data: T): T {
  if (!data || typeof data !== 'object') return data
  const result = { ...data } as Record<string, unknown>
  for (const key in result) {
    const val = result[key]
    if (val instanceof Timestamp) {
      result[key] = val.toDate().toISOString()
    } else if (Array.isArray(val)) {
      result[key] = val.map(item => convertTimestamps(item))
    } else if (typeof val === 'object' && val !== null) {
      result[key] = convertTimestamps(val)
    }
  }
  return result as T
}

// Helper to log activity
async function logActivity(source: string, message: string): Promise<void> {
  const id = makeId()
  const event: ActivityEvent = {
    id,
    at: new Date().toISOString(),
    level: 'info',
    source,
    message,
  }
  await setDoc(getUserDoc('activity', id), event)
}

export const firestoreAdapter: Adapter = {
  name: 'firestore',

  // ─────────────────────────────────────────────────────────────
  // System Status / Live Snapshot
  // ─────────────────────────────────────────────────────────────

  async getLiveSnapshot(): Promise<LiveSnapshot> {
    const now = new Date().toISOString()
    return {
      updatedAt: now,
      status: await this.getSystemStatus(),
      workers: await this.listWorkers(),
      blockers: [],
      watchdog: { health: 'ok', summary: 'Firestore mode' },
    }
  },

  async getSystemStatus(): Promise<SystemStatus> {
    return {
      updatedAt: new Date().toISOString(),
      gateway: { health: 'ok', summary: 'Cloud mode (Firestore)' },
      nodes: { health: 'ok', pairedCount: 0, pendingCount: 0 },
      browserRelay: { health: 'unknown', attachedTabs: 0 },
    }
  },

  async listProjects(): Promise<ProjectInfo[]> {
    // Workspace projects are not applicable in cloud mode
    return []
  },

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    try {
      const workersRef = getUserCollection('workers')
      const snap = await getDocs(workersRef)
      return snap.docs.map(d => {
        const data = d.data()
        return convertTimestamps({
          slot: d.id,
          status: data.status || 'offline',
          beats: data.beats || [],
          ...data,
        } as WorkerHeartbeat)
      })
    } catch {
      return []
    }
  },

  async listBlockers(): Promise<Blocker[]> {
    return []
  },

  async runControl(_action: ControlAction): Promise<ControlResult> {
    return { ok: false, message: 'Control actions not available in cloud mode' }
  },

  // ─────────────────────────────────────────────────────────────
  // Activity
  // ─────────────────────────────────────────────────────────────

  async listActivity(limit: number): Promise<ActivityEvent[]> {
    try {
      const activityRef = getUserCollection('activity')
      const q = query(activityRef, orderBy('at', 'desc'), firestoreLimit(limit))
      const snap = await getDocs(q)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as ActivityEvent))
    } catch {
      return []
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Models/Config
  // ─────────────────────────────────────────────────────────────

  async listModels(): Promise<ModelList> {
    return { models: [] }
  },

  async setDefaultModel(_modelKey: string): Promise<ModelSetResult> {
    return { ok: false, message: 'Model configuration not available in cloud mode' }
  },

  // ─────────────────────────────────────────────────────────────
  // Rules
  // ─────────────────────────────────────────────────────────────

  async listRules(): Promise<Rule[]> {
    try {
      const rulesRef = getUserCollection('rules')
      const snap = await getDocs(rulesRef)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as Rule))
    } catch {
      return []
    }
  },

  async createRule(create: RuleCreate): Promise<Rule> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const rule: Rule = {
      id,
      title: create.title,
      description: create.description,
      content: create.content,
      enabled: create.enabled ?? true,
      updatedAt: now,
    }
    await setDoc(getUserDoc('rules', id), rule)
    return rule
  },

  async updateRule(update: RuleUpdate): Promise<Rule> {
    const ref = getUserDoc('rules', update.id)
    await updateDoc(ref, { ...update, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    return convertTimestamps({ id: snap.id, ...snap.data() } as Rule)
  },

  async deleteRule(id: string): Promise<RuleDeleteResult> {
    await deleteDoc(getUserDoc('rules', id))
    return { ok: true }
  },

  async toggleRule(id: string, enabled: boolean): Promise<Rule> {
    const ref = getUserDoc('rules', id)
    await updateDoc(ref, { enabled, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    return convertTimestamps({ id: snap.id, ...snap.data() } as Rule)
  },

  async listRuleHistory(_limit: number): Promise<RuleChange[]> {
    try {
      const historyRef = getUserCollection('ruleHistory')
      const q = query(historyRef, orderBy('at', 'desc'), firestoreLimit(_limit))
      const snap = await getDocs(q)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as RuleChange))
    } catch {
      return []
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Tasks
  // ─────────────────────────────────────────────────────────────

  async listTasks(): Promise<Task[]> {
    try {
      const tasksRef = getUserCollection('tasks')
      const snap = await getDocs(tasksRef)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as Task))
    } catch {
      return []
    }
  },

  async createTask(create: TaskCreate): Promise<Task> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const lane: BoardLane = create.lane || 'queued'
    const priority: Priority = create.priority || 'P2'
    
    const task: Task = {
      id,
      title: create.title,
      lane,
      priority,
      owner: create.owner,
      problem: create.problem,
      scope: create.scope,
      acceptanceCriteria: create.acceptanceCriteria || [],
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ at: now, to: lane }],
    }
    await setDoc(getUserDoc('tasks', id), task)
    await logActivity('task', `Task created: ${task.title}`)
    return task
  },

  async updateTask(update: TaskUpdate): Promise<Task> {
    const ref = getUserDoc('tasks', update.id)
    const oldSnap = await getDoc(ref)
    const oldTask = oldSnap.data() as Task
    const now = new Date().toISOString()
    
    const updateData: Partial<Task> = { ...update, updatedAt: now }
    
    // Track lane changes in status history
    if (update.lane && oldTask.lane !== update.lane) {
      updateData.statusHistory = [
        ...(oldTask.statusHistory || []),
        { at: now, from: oldTask.lane, to: update.lane },
      ]
    }
    
    await updateDoc(ref, updateData)
    const snap = await getDoc(ref)
    const task = convertTimestamps({ id: snap.id, ...snap.data() } as Task)
    
    if (update.lane && oldTask.lane !== update.lane) {
      await logActivity('task', `Task moved to ${update.lane}: ${task.title}`)
    }
    
    return task
  },

  // ─────────────────────────────────────────────────────────────
  // Agent Profiles
  // ─────────────────────────────────────────────────────────────

  async listAgentProfiles(): Promise<AgentProfile[]> {
    try {
      const ref = getUserCollection('agentProfiles')
      const q = query(ref, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as AgentProfile))
    } catch {
      return []
    }
  },

  async getAgentProfile(id: string): Promise<AgentProfile> {
    const snap = await getDoc(getUserDoc('agentProfiles', id))
    if (!snap.exists()) throw new Error('Agent profile not found')
    return convertTimestamps({ id: snap.id, ...snap.data() } as AgentProfile)
  },

  async createAgentProfile(create: AgentProfileCreate): Promise<AgentProfile> {
    const userId = getUserId()
    const id = makeId()
    const now = new Date().toISOString()
    
    const profile: AgentProfile = {
      id,
      userId,
      name: create.name,
      role: create.role,
      emoji: create.emoji || '🤖',
      createdAt: now,
      updatedAt: now,
    }
    
    // Only include model if it has a value (Firestore doesn't accept undefined)
    if (create.model) {
      profile.model = create.model
    }
    
    await setDoc(getUserDoc('agentProfiles', id), profile)
    await logActivity('agent', `Agent profile created: ${profile.name}`)
    return profile
  },

  async updateAgentProfile(update: AgentProfileUpdate): Promise<AgentProfile> {
    const ref = getUserDoc('agentProfiles', update.id)
    const now = new Date().toISOString()
    
    // Filter out undefined values (Firestore doesn't accept them)
    const updateData: Record<string, unknown> = { updatedAt: now }
    if (update.name !== undefined) updateData.name = update.name
    if (update.role !== undefined) updateData.role = update.role
    if (update.emoji !== undefined) updateData.emoji = update.emoji
    if (update.model !== undefined) updateData.model = update.model
    
    await updateDoc(ref, updateData)
    const snap = await getDoc(ref)
    const profile = convertTimestamps({ id: snap.id, ...snap.data() } as AgentProfile)
    
    await logActivity('agent', `Agent profile updated: ${profile.name}`)
    return profile
  },

  async deleteAgentProfile(id: string): Promise<{ ok: boolean }> {
    const snap = await getDoc(getUserDoc('agentProfiles', id))
    const profile = snap.data() as AgentProfile
    
    await deleteDoc(getUserDoc('agentProfiles', id))
    await logActivity('agent', `Agent profile deleted: ${profile?.name || id}`)
    return { ok: true }
  },

  // ─────────────────────────────────────────────────────────────
  // Intake Projects (wizard)
  // ─────────────────────────────────────────────────────────────

  async listIntakeProjects(): Promise<IntakeProject[]> {
    try {
      const ref = getUserCollection('intakeProjects')
      const snap = await getDocs(ref)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as IntakeProject))
    } catch {
      return []
    }
  },

  async getIntakeProject(id: string): Promise<IntakeProject> {
    const snap = await getDoc(getUserDoc('intakeProjects', id))
    if (!snap.exists()) throw new Error('Intake project not found')
    return convertTimestamps({ id: snap.id, ...snap.data() } as IntakeProject)
  },

  async createIntakeProject(create: IntakeProjectCreate): Promise<IntakeProject> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const project: IntakeProject = {
      id,
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
    await setDoc(getUserDoc('intakeProjects', id), project)
    return project
  },

  async updateIntakeProject(update: IntakeProjectUpdate): Promise<IntakeProject> {
    const ref = getUserDoc('intakeProjects', update.id)
    await updateDoc(ref, { ...update, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    return convertTimestamps({ id: snap.id, ...snap.data() } as IntakeProject)
  },

  async generateIntakeQuestions(_id: string): Promise<IntakeProject> {
    // This requires AI - return unchanged for now
    return this.getIntakeProject(_id)
  },

  async generateIntakeScope(_id: string): Promise<IntakeProject> {
    // This requires AI - return unchanged for now
    return this.getIntakeProject(_id)
  },

  async exportIntakeMarkdown(id: string): Promise<string> {
    const project = await this.getIntakeProject(id)
    let md = `# ${project.title}\n\n`
    md += `## Idea\n${project.idea}\n\n`
    if (project.questions?.length) {
      md += `## Q&A\n`
      for (const q of project.questions) {
        md += `### ${q.prompt}\n`
        md += `${q.answer || '_No answer_'}\n\n`
      }
    }
    return md
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects (full hub)
  // ─────────────────────────────────────────────────────────────

  async listPMProjects(): Promise<PMProject[]> {
    try {
      const ref = getUserCollection('pmProjects')
      const q = query(ref, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as PMProject))
    } catch {
      return []
    }
  },

  async getPMProject(id: string): Promise<PMProject> {
    const snap = await getDoc(getUserDoc('pmProjects', id))
    if (!snap.exists()) throw new Error('PM Project not found')
    return convertTimestamps({ id: snap.id, ...snap.data() } as PMProject)
  },

  async createPMProject(create: PMProjectCreate): Promise<PMProject> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const project: PMProject = {
      id,
      name: create.name,
      summary: create.summary,
      status: create.status || 'active',
      tags: create.tags || [],
      links: [],
      owner: create.owner,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(getUserDoc('pmProjects', id), project)
    
    // Initialize empty intake
    const emptyIntake: PMIntake = {
      ideas: [],
      analyses: [],
      questions: [],
      requirements: [],
    }
    await setDoc(getPMProjectSubDoc(id, 'meta', 'intake'), emptyIntake)
    
    await logActivity('project', `Project created: ${project.name}`)
    return project
  },

  async updatePMProject(update: PMProjectUpdate): Promise<PMProject> {
    const ref = getUserDoc('pmProjects', update.id)
    await updateDoc(ref, { ...update, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    return convertTimestamps({ id: snap.id, ...snap.data() } as PMProject)
  },

  async deletePMProject(id: string): Promise<{ ok: boolean }> {
    await updateDoc(getUserDoc('pmProjects', id), {
      status: 'archived',
      deletedAt: new Date().toISOString(),
    })
    return { ok: true }
  },

  async exportPMProjectJSON(id: string): Promise<object> {
    const project = await this.getPMProject(id)
    const tree = await this.getPMTree(id)
    const cards = await this.listPMCards(id)
    const intake = await this.getPMIntake(id)
    const activity = await this.listPMActivity(id)
    return { project, tree, cards, intake, activity }
  },

  async exportPMProjectMarkdown(id: string): Promise<string> {
    const project = await this.getPMProject(id)
    const tree = await this.getPMTree(id)
    const intake = await this.getPMIntake(id)
    
    let md = `# ${project.name}\n\n`
    
    if (intake.ideas?.length) {
      const latest = intake.ideas[intake.ideas.length - 1]
      md += `## Idea\n${latest.text}\n\n`
    }
    
    if (tree.length) {
      md += `## Features\n`
      const roots = tree.filter(n => !n.parentId)
      for (const node of roots) {
        md += `- ${node.title}\n`
        const children = tree.filter(n => n.parentId === node.id)
        for (const child of children) {
          md += `  - ${child.title}\n`
        }
      }
    }
    
    return md
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects - Tree
  // ─────────────────────────────────────────────────────────────

  async getPMTree(projectId: string): Promise<PMTreeNode[]> {
    try {
      const ref = getPMProjectSubCollection(projectId, 'tree')
      const snap = await getDocs(ref)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as PMTreeNode))
    } catch {
      return []
    }
  },

  async createPMTreeNode(projectId: string, create: PMTreeNodeCreate): Promise<PMTreeNode> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const node: PMTreeNode = {
      id,
      parentId: create.parentId,
      title: create.title,
      description: create.description,
      status: create.status || 'draft',
      priority: create.priority || 'P2',
      owner: create.owner,
      tags: create.tags || [],
      acceptanceCriteria: create.acceptanceCriteria || [],
      dependsOn: create.dependsOn || [],
      sources: create.sources || [],
      children: [],
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(getPMProjectSubDoc(projectId, 'tree', id), node)
    
    await this.addPMActivity(projectId, {
      action: 'created',
      target: node.title,
    })
    
    return node
  },

  async updatePMTreeNode(projectId: string, update: PMTreeNodeUpdate): Promise<PMTreeNode> {
    const ref = getPMProjectSubDoc(projectId, 'tree', update.id)
    await updateDoc(ref, { ...update, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    return convertTimestamps({ id: snap.id, ...snap.data() } as PMTreeNode)
  },

  async deletePMTreeNode(projectId: string, nodeId: string): Promise<{ ok: boolean }> {
    await deleteDoc(getPMProjectSubDoc(projectId, 'tree', nodeId))
    return { ok: true }
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects - Feature-Level Intake
  // ─────────────────────────────────────────────────────────────

  async getFeatureIntake(projectId: string, nodeId: string): Promise<FeatureIntake | null> {
    try {
      const snap = await getDoc(getPMProjectSubDoc(projectId, 'featureIntakes', nodeId))
      if (!snap.exists()) return null
      return convertTimestamps(snap.data() as FeatureIntake)
    } catch {
      return null
    }
  },

  async setFeatureIntake(projectId: string, nodeId: string, intake: FeatureIntake): Promise<FeatureIntake> {
    await setDoc(getPMProjectSubDoc(projectId, 'featureIntakes', nodeId), {
      ...intake,
      updatedAt: new Date().toISOString(),
    })
    return intake
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects - Kanban Cards
  // ─────────────────────────────────────────────────────────────

  async listPMCards(projectId: string): Promise<PMCard[]> {
    try {
      const ref = getPMProjectSubCollection(projectId, 'cards')
      const snap = await getDocs(ref)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as PMCard))
    } catch {
      return []
    }
  },

  async createPMCard(projectId: string, create: PMCardCreate): Promise<PMCard> {
    const id = create.id || makeId()
    const now = new Date().toISOString()
    const card: PMCard = {
      id,
      featureId: create.featureId,
      title: create.title,
      lane: create.lane || 'proposed',
      priority: create.priority || 'P2',
      owner: create.owner,
      description: create.description,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(getPMProjectSubDoc(projectId, 'cards', id), card)
    
    await this.addPMActivity(projectId, {
      action: 'card_created',
      target: card.title,
    })
    
    return card
  },

  async updatePMCard(projectId: string, update: PMCardUpdate): Promise<PMCard> {
    const ref = getPMProjectSubDoc(projectId, 'cards', update.id)
    const oldSnap = await getDoc(ref)
    const oldCard = oldSnap.data() as PMCard
    
    await updateDoc(ref, { ...update, updatedAt: new Date().toISOString() })
    const snap = await getDoc(ref)
    const card = convertTimestamps({ id: snap.id, ...snap.data() } as PMCard)
    
    // Log lane changes
    if (update.lane && oldCard.lane !== update.lane) {
      await this.addPMActivity(projectId, {
        action: 'card_moved',
        target: card.title,
        details: { from: oldCard.lane, to: update.lane },
      })
    }
    
    return card
  },

  async deletePMCard(projectId: string, cardId: string): Promise<{ ok: boolean }> {
    await deleteDoc(getPMProjectSubDoc(projectId, 'cards', cardId))
    return { ok: true }
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects - Intake
  // ─────────────────────────────────────────────────────────────

  async getPMIntake(projectId: string): Promise<PMIntake> {
    try {
      const snap = await getDoc(getPMProjectSubDoc(projectId, 'meta', 'intake'))
      if (!snap.exists()) {
        return { ideas: [], analyses: [], questions: [], requirements: [] }
      }
      return convertTimestamps(snap.data() as PMIntake)
    } catch {
      return { ideas: [], analyses: [], questions: [], requirements: [] }
    }
  },

  async setPMIntake(projectId: string, intake: PMIntake): Promise<PMIntake> {
    await setDoc(getPMProjectSubDoc(projectId, 'meta', 'intake'), intake)
    return intake
  },

  async addPMIdeaVersion(projectId: string, text: string): Promise<PMIntake> {
    const intake = await this.getPMIntake(projectId)
    const id = makeId()
    intake.ideas = intake.ideas || []
    intake.ideas.push({ id, text, createdAt: new Date().toISOString() })
    return this.setPMIntake(projectId, intake)
  },

  async addPMAnalysis(projectId: string, summary: string, keyPoints: string[]): Promise<PMIntake> {
    const intake = await this.getPMIntake(projectId)
    const id = makeId()
    intake.analyses = intake.analyses || []
    intake.analyses.push({ id, summary, keyPoints, createdAt: new Date().toISOString() })
    return this.setPMIntake(projectId, intake)
  },

  async generatePMQuestions(projectId: string): Promise<PMIntake> {
    // This requires AI - return unchanged for now
    return this.getPMIntake(projectId)
  },

  async answerPMQuestion(projectId: string, questionId: string, answer: string): Promise<PMIntake> {
    const intake = await this.getPMIntake(projectId)
    const question = intake.questions?.find(q => q.id === questionId)
    if (question) {
      question.answer = answer
      question.answeredAt = new Date().toISOString()
    }
    return this.setPMIntake(projectId, intake)
  },

  // ─────────────────────────────────────────────────────────────
  // PM Projects - Activity
  // ─────────────────────────────────────────────────────────────

  async listPMActivity(projectId: string, limit = 50): Promise<PMActivity[]> {
    try {
      const ref = getPMProjectSubCollection(projectId, 'activity')
      const q = query(ref, orderBy('at', 'desc'), firestoreLimit(limit))
      const snap = await getDocs(q)
      return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as PMActivity))
    } catch {
      return []
    }
  },

  async addPMActivity(projectId: string, activity: Omit<PMActivity, 'id' | 'at'>): Promise<PMActivity> {
    const id = makeId()
    const full: PMActivity = {
      id,
      at: new Date().toISOString(),
      ...activity,
    }
    await setDoc(getPMProjectSubDoc(projectId, 'activity', id), full)
    return full
  },

  // ─────────────────────────────────────────────────────────────
  // Migration
  // ─────────────────────────────────────────────────────────────

  async migrateIntakeToPM(intakeProjectId: string): Promise<PMProject> {
    const intake = await this.getIntakeProject(intakeProjectId)
    const pmProject = await this.createPMProject({ name: intake.title })
    
    // Copy idea
    if (intake.idea) {
      await this.addPMIdeaVersion(pmProject.id, intake.idea)
    }
    
    // Copy feature tree
    if (intake.featureTree?.length) {
      for (const node of intake.featureTree) {
        await this.createPMTreeNode(pmProject.id, {
          title: node.title,
          description: node.description,
          priority: node.priority,
        })
      }
    }
    
    return pmProject
  },

  // ─────────────────────────────────────────────────────────────
  // OpenClaw Connections
  // ─────────────────────────────────────────────────────────────

  async generateConnectionToken(opts?: ConnectionTokenCreate): Promise<ConnectionToken> {
    const userId = getUserId()
    const id = makeId()
    // Generate 6-character alphanumeric token (similar to UTTH46)
    const token = Array.from({ length: 6 }, () => 
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]
    ).join('')
    
    const expiresInMs = (opts?.expiresInMinutes || 15) * 60 * 1000
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInMs)
    
    const connectionToken: ConnectionToken = {
      id,
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
    }
    
    await setDoc(getUserDoc('connectionTokens', id), connectionToken)
    
    return connectionToken
  },

  async listConnectionTokens(): Promise<ConnectionToken[]> {
    const ref = getUserCollection('connectionTokens')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() } as ConnectionToken))
  },

  async validateConnectionToken(req: ConnectionValidateRequest): Promise<ConnectionValidateResponse> {
    try {
      // Find token across all users (for validation)
      // Note: This requires a different approach since we can't query across user subcollections
      // For now, we'll use a global connectionTokens collection
      const tokensRef = collection(db, 'connectionTokens')
      const q = query(tokensRef, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      
      const tokenDoc = snap.docs.find(d => {
        const data = d.data() as ConnectionToken
        return data.token === req.token && !data.used
      })
      
      if (!tokenDoc) {
        return { success: false, error: 'Invalid or already used token' }
      }
      
      const tokenData = tokenDoc.data() as ConnectionToken
      
      // Check expiration
      if (new Date(tokenData.expiresAt) < new Date()) {
        return { success: false, error: 'Token expired' }
      }
      
      // Create connected instance
      const instanceId = makeId()
      const instance: ConnectedInstance = {
        id: instanceId,
        userId: tokenData.userId,
        name: req.instanceName,
        connectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'active',
        metadata: req.metadata,
      }
      
      // Save instance under user's collection
      await setDoc(doc(db, 'users', tokenData.userId, 'connectedInstances', instanceId), instance)
      
      // Mark token as used
      await updateDoc(tokenDoc.ref, {
        used: true,
        usedAt: new Date().toISOString(),
        instanceId,
      })
      
      return {
        success: true,
        userId: tokenData.userId,
        instanceId,
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  async listConnectedInstances(): Promise<ConnectedInstance[]> {
    // New structure: single connection per user at connection/current
    try {
      const userId = getUserId()
      const connectionDoc = await getDoc(doc(db, 'users', userId, 'connection', 'current'))
      
      if (!connectionDoc.exists()) {
        return []
      }
      
      const data = connectionDoc.data()
      const instance: ConnectedInstance = {
        id: data.instanceId,
        userId,
        name: data.instanceName,
        connectedAt: data.connectedAt,
        lastSeenAt: data.lastHeartbeat,
        status: data.status,
        metadata: data.metadata,
      }
      
      return [convertTimestamps(instance)]
    } catch {
      return []
    }
  },

  async updateInstanceHeartbeat(_instanceId: string): Promise<void> {
    const userId = getUserId()
    await updateDoc(doc(db, 'users', userId, 'connection', 'current'), {
      lastHeartbeat: new Date().toISOString(),
      status: 'active',
    })
  },

  async disconnectInstance(_instanceId: string): Promise<{ ok: boolean }> {
    const userId = getUserId()
    await deleteDoc(doc(db, 'users', userId, 'connection', 'current'))
    return { ok: true }
  },

  // ---- Active Sessions ----

  async registerSession(create: ActiveSessionCreate): Promise<ActiveSession> {
    const userId = getUserId()
    const sessionId = makeId()
    const now = new Date().toISOString()

    const session: ActiveSession = {
      id: sessionId,
      userId,
      instanceId: create.instanceId,
      sessionKey: create.sessionKey,
      label: create.label,
      agentId: create.agentId,
      model: create.model,
      task: create.task,
      status: create.status ?? 'active',
      spawnedAt: now,
      lastSeenAt: now,
      metadata: create.metadata,
    }

    await setDoc(getUserDoc('activeSessions', sessionId), session)
    await logActivity('session', `Session registered: ${create.label || create.sessionKey}`)
    return session
  },

  async updateSession(update: ActiveSessionUpdate): Promise<ActiveSession> {
    const docRef = getUserDoc('activeSessions', update.id)
    const snap = await getDoc(docRef)
    
    if (!snap.exists()) {
      throw new Error(`Session ${update.id} not found`)
    }

    const existing = convertTimestamps(snap.data()) as ActiveSession
    const updated: ActiveSession = {
      ...existing,
      label: update.label ?? existing.label,
      task: update.task ?? existing.task,
      status: update.status ?? existing.status,
      model: update.model ?? existing.model,
      lastSeenAt: new Date().toISOString(),
    }

    await setDoc(docRef, updated)
    await logActivity('session', `Session updated: ${updated.label || updated.sessionKey}`)
    return updated
  },

  async listActiveSessions(instanceId?: string): Promise<ActiveSession[]> {
    try {
      const snapshot = await getDocs(getUserCollection('activeSessions'))
      let sessions = snapshot.docs.map((doc) => convertTimestamps(doc.data()) as ActiveSession)
      
      // Filter by instance if provided
      if (instanceId) {
        sessions = sessions.filter(s => s.instanceId === instanceId)
      }

      // Filter out terminated sessions older than 1 hour
      const oneHourAgo = Date.now() - 3600000
      sessions = sessions.filter(s => {
        if (s.status === 'terminated') {
          return new Date(s.lastSeenAt).getTime() > oneHourAgo
        }
        return true
      })

      // Sort by lastSeenAt descending
      sessions.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())

      return sessions
    } catch (e) {
      console.error('listActiveSessions error:', e)
      return []
    }
  },

  async terminateSession(sessionId: string): Promise<{ ok: boolean }> {
    const docRef = getUserDoc('activeSessions', sessionId)
    const snap = await getDoc(docRef)
    
    if (!snap.exists()) {
      return { ok: false }
    }

    const session = convertTimestamps(snap.data()) as ActiveSession
    
    // Update status to terminated
    await setDoc(docRef, {
      ...session,
      status: 'terminated',
      lastSeenAt: new Date().toISOString(),
    })

    await logActivity('session', `Session terminated: ${session.label || session.sessionKey}`)
    return { ok: true }
  },
}
