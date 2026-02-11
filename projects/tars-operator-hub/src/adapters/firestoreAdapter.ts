/**
 * Firestore Adapter
 * Replaces local bridge with Firebase Firestore for cloud persistence
 */

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
  limit,
  serverTimestamp,
  type Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
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
} from '../types'

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const toIso = (ts: Timestamp | undefined) => ts?.toDate().toISOString() ?? new Date().toISOString()

export type FirestoreAdapterOptions = {
  userId: string
}

export function firestoreAdapter(opts: FirestoreAdapterOptions): Adapter {
  const { userId } = opts
  
  // Collection paths scoped to user
  const projectsCol = () => collection(db, 'users', userId, 'projects')
  const projectDoc = (id: string) => doc(db, 'users', userId, 'projects', id)
  const tasksCol = () => collection(db, 'users', userId, 'tasks')
  const taskDoc = (id: string) => doc(db, 'users', userId, 'tasks', id)
  const rulesCol = () => collection(db, 'users', userId, 'rules')
  const ruleDoc = (id: string) => doc(db, 'users', userId, 'rules', id)
  const activityCol = () => collection(db, 'users', userId, 'activity')
  
  // PM Project sub-collections
  const pmTreeCol = (projectId: string) => collection(db, 'users', userId, 'projects', projectId, 'tree')
  const pmTreeDoc = (projectId: string, nodeId: string) => doc(db, 'users', userId, 'projects', projectId, 'tree', nodeId)
  const pmCardsCol = (projectId: string) => collection(db, 'users', userId, 'projects', projectId, 'cards')
  const pmCardDoc = (projectId: string, cardId: string) => doc(db, 'users', userId, 'projects', projectId, 'cards', cardId)
  const pmIntakeDoc = (projectId: string) => doc(db, 'users', userId, 'projects', projectId, 'intake', 'data')
  const pmActivityCol = (projectId: string) => collection(db, 'users', userId, 'projects', projectId, 'activity')
  const pmFeatureIntakeDoc = (projectId: string, nodeId: string) => doc(db, 'users', userId, 'projects', projectId, 'featureIntakes', nodeId)

  return {
    name: 'Firestore',

    // System status - not applicable for cloud mode, return healthy defaults
    async getSystemStatus(): Promise<SystemStatus> {
      return {
        updatedAt: new Date().toISOString(),
        gateway: { health: 'ok', summary: 'Cloud mode' },
        nodes: { health: 'ok', pairedCount: 0, pendingCount: 0 },
        browserRelay: { health: 'unknown', attachedTabs: 0 },
      }
    },

    async getLiveSnapshot(): Promise<LiveSnapshot> {
      return {
        updatedAt: new Date().toISOString(),
        status: await this.getSystemStatus(),
        workers: [],
        blockers: [],
        watchdog: { health: 'ok', summary: 'Cloud mode - no local watchdog' },
      }
    },

    async listProjects(): Promise<ProjectInfo[]> {
      const snap = await getDocs(projectsCol())
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name ?? 'Untitled',
          path: '',
          status: data.status ?? 'Active',
          lastUpdatedAt: toIso(data.updatedAt),
          notes: data.summary,
        }
      })
    },

    async listActivity(limitCount: number): Promise<ActivityEvent[]> {
      const q = query(activityCol(), orderBy('at', 'desc'), limit(limitCount))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          at: toIso(data.at),
          level: data.level ?? 'info',
          source: data.source ?? 'system',
          message: data.message ?? '',
          meta: data.meta,
        }
      })
    },

    async listWorkers(): Promise<WorkerHeartbeat[]> {
      // No local workers in cloud mode
      return []
    },

    async listBlockers(): Promise<Blocker[]> {
      // No local blockers in cloud mode
      return []
    },

    async runControl(_action: ControlAction): Promise<ControlResult> {
      return { ok: false, message: 'Control actions not supported in cloud mode' }
    },

    // Models - stub for cloud mode
    async listModels(): Promise<ModelList> {
      return { models: [] }
    },

    async setDefaultModel(_modelKey: string): Promise<ModelSetResult> {
      return { ok: false, message: 'Model config not supported in cloud mode' }
    },

    // Rules
    async listRules(): Promise<Rule[]> {
      const snap = await getDocs(rulesCol())
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: data.title ?? '',
          description: data.description,
          enabled: data.enabled ?? true,
          content: data.content ?? '',
          updatedAt: toIso(data.updatedAt),
        }
      })
    },

    async createRule(create: RuleCreate): Promise<Rule> {
      const id = create.id ?? `rule-${makeId()}`
      const now = serverTimestamp()
      const rule = {
        title: create.title,
        description: create.description,
        content: create.content,
        enabled: create.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(ruleDoc(id), rule)
      return { id, ...rule, updatedAt: new Date().toISOString() } as Rule
    },

    async updateRule(update: RuleUpdate): Promise<Rule> {
      const ref = ruleDoc(update.id)
      await updateDoc(ref, {
        ...(update.title !== undefined && { title: update.title }),
        ...(update.description !== undefined && { description: update.description }),
        ...(update.content !== undefined && { content: update.content }),
        updatedAt: serverTimestamp(),
      })
      const snap = await getDoc(ref)
      const data = snap.data()!
      return { id: update.id, ...data, updatedAt: toIso(data.updatedAt) } as Rule
    },

    async deleteRule(id: string): Promise<RuleDeleteResult> {
      await deleteDoc(ruleDoc(id))
      return { ok: true }
    },

    async toggleRule(id: string, enabled: boolean): Promise<Rule> {
      const ref = ruleDoc(id)
      await updateDoc(ref, { enabled, updatedAt: serverTimestamp() })
      const snap = await getDoc(ref)
      const data = snap.data()!
      return { id, ...data, updatedAt: toIso(data.updatedAt) } as Rule
    },

    async listRuleHistory(_limit: number): Promise<RuleChange[]> {
      // TODO: Implement rule history
      return []
    },

    // Tasks
    async listTasks(): Promise<Task[]> {
      const snap = await getDocs(tasksCol())
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: data.title ?? '',
          lane: data.lane ?? 'proposed',
          priority: data.priority ?? 'P2',
          owner: data.owner,
          problem: data.problem,
          scope: data.scope,
          acceptanceCriteria: data.acceptanceCriteria ?? [],
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
          statusHistory: data.statusHistory ?? [],
        }
      })
    },

    async createTask(create: TaskCreate): Promise<Task> {
      const id = create.id ?? `task-${makeId()}`
      const now = new Date().toISOString()
      const task = {
        title: create.title,
        lane: create.lane ?? 'proposed',
        priority: create.priority ?? 'P2',
        owner: create.owner,
        problem: create.problem,
        scope: create.scope,
        acceptanceCriteria: create.acceptanceCriteria ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        statusHistory: [{ at: now, to: create.lane ?? 'proposed', note: 'created' }],
      }
      await setDoc(taskDoc(id), task)
      return { id, ...task, createdAt: now, updatedAt: now } as Task
    },

    async updateTask(update: TaskUpdate): Promise<Task> {
      const ref = taskDoc(update.id)
      const snap = await getDoc(ref)
      const before = snap.data()
      
      const changes: DocumentData = { updatedAt: serverTimestamp() }
      if (update.title !== undefined) changes.title = update.title
      if (update.lane !== undefined) changes.lane = update.lane
      if (update.priority !== undefined) changes.priority = update.priority
      if (update.owner !== undefined) changes.owner = update.owner
      if (update.problem !== undefined) changes.problem = update.problem
      if (update.scope !== undefined) changes.scope = update.scope
      if (update.acceptanceCriteria !== undefined) changes.acceptanceCriteria = update.acceptanceCriteria
      
      // Track lane changes in history
      if (update.lane && before?.lane !== update.lane) {
        const history = before?.statusHistory ?? []
        history.push({ at: new Date().toISOString(), from: before?.lane, to: update.lane, note: 'updated' })
        changes.statusHistory = history
      }
      
      await updateDoc(ref, changes)
      const updated = await getDoc(ref)
      const data = updated.data()!
      return { id: update.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) } as Task
    },

    // Intake Projects (legacy)
    async listIntakeProjects(): Promise<IntakeProject[]> {
      return []
    },
    async getIntakeProject(_id: string): Promise<IntakeProject> {
      throw new Error('Legacy intake not supported')
    },
    async createIntakeProject(_create: IntakeProjectCreate): Promise<IntakeProject> {
      throw new Error('Legacy intake not supported')
    },
    async updateIntakeProject(_update: IntakeProjectUpdate): Promise<IntakeProject> {
      throw new Error('Legacy intake not supported')
    },
    async generateIntakeQuestions(_id: string): Promise<IntakeProject> {
      throw new Error('Legacy intake not supported')
    },
    async generateIntakeScope(_id: string): Promise<IntakeProject> {
      throw new Error('Legacy intake not supported')
    },
    async exportIntakeMarkdown(_id: string): Promise<string> {
      throw new Error('Legacy intake not supported')
    },

    // PM Projects
    async listPMProjects(): Promise<PMProject[]> {
      const snap = await getDocs(projectsCol())
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name ?? 'Untitled',
          summary: data.summary,
          status: data.status ?? 'active',
          tags: data.tags ?? [],
          links: data.links ?? [],
          owner: data.owner,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    },

    async getPMProject(id: string): Promise<PMProject> {
      const snap = await getDoc(projectDoc(id))
      if (!snap.exists()) throw new Error(`Project not found: ${id}`)
      const data = snap.data()
      return {
        id: snap.id,
        name: data.name ?? 'Untitled',
        summary: data.summary,
        status: data.status ?? 'active',
        tags: data.tags ?? [],
        links: data.links ?? [],
        owner: data.owner,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      }
    },

    async createPMProject(create: PMProjectCreate): Promise<PMProject> {
      const id = create.id ?? `proj-${makeId()}`
      const now = serverTimestamp()
      const project = {
        name: create.name,
        summary: create.summary,
        status: create.status ?? 'active',
        tags: create.tags ?? [],
        links: [],
        owner: create.owner,
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(projectDoc(id), project)
      
      // Initialize empty intake
      await setDoc(pmIntakeDoc(id), {
        ideas: [],
        analyses: [],
        questions: [],
        requirements: [],
      })
      
      const isoNow = new Date().toISOString()
      return { id, ...project, createdAt: isoNow, updatedAt: isoNow } as PMProject
    },

    async updatePMProject(update: PMProjectUpdate): Promise<PMProject> {
      const ref = projectDoc(update.id)
      const changes: DocumentData = { updatedAt: serverTimestamp() }
      if (update.name !== undefined) changes.name = update.name
      if (update.summary !== undefined) changes.summary = update.summary
      if (update.status !== undefined) changes.status = update.status
      if (update.tags !== undefined) changes.tags = update.tags
      if (update.links !== undefined) changes.links = update.links
      if (update.owner !== undefined) changes.owner = update.owner
      
      await updateDoc(ref, changes)
      return this.getPMProject(update.id)
    },

    async deletePMProject(id: string): Promise<{ ok: boolean }> {
      await deleteDoc(projectDoc(id))
      return { ok: true }
    },

    async exportPMProjectJSON(id: string): Promise<object> {
      const [project, tree, cards, intake] = await Promise.all([
        this.getPMProject(id),
        this.getPMTree(id),
        this.listPMCards(id),
        this.getPMIntake(id),
      ])
      return { project, tree, cards, intake }
    },

    async exportPMProjectMarkdown(id: string): Promise<string> {
      const data = await this.exportPMProjectJSON(id) as any
      let md = `# ${data.project.name}\n\n`
      md += `${data.project.summary ?? ''}\n\n`
      md += `## Tree\n\n`
      for (const node of data.tree) {
        md += `- ${node.title}\n`
      }
      return md
    },

    // PM Tree
    async getPMTree(projectId: string): Promise<PMTreeNode[]> {
      const snap = await getDocs(pmTreeCol(projectId))
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          parentId: data.parentId,
          title: data.title ?? '',
          description: data.description,
          status: data.status ?? 'draft',
          priority: data.priority ?? 'P2',
          owner: data.owner,
          tags: data.tags ?? [],
          acceptanceCriteria: data.acceptanceCriteria ?? [],
          dependsOn: data.dependsOn ?? [],
          sources: data.sources ?? [],
          children: [],
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    },

    async createPMTreeNode(projectId: string, create: PMTreeNodeCreate): Promise<PMTreeNode> {
      const id = create.id ?? `node-${makeId()}`
      const now = serverTimestamp()
      const node = {
        parentId: create.parentId,
        title: create.title,
        description: create.description,
        status: create.status ?? 'draft',
        priority: create.priority ?? 'P2',
        owner: create.owner,
        tags: create.tags ?? [],
        acceptanceCriteria: create.acceptanceCriteria ?? [],
        dependsOn: create.dependsOn ?? [],
        sources: create.sources ?? [],
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(pmTreeDoc(projectId, id), node)
      const isoNow = new Date().toISOString()
      return { id, ...node, children: [], createdAt: isoNow, updatedAt: isoNow } as PMTreeNode
    },

    async updatePMTreeNode(projectId: string, update: PMTreeNodeUpdate): Promise<PMTreeNode> {
      const ref = pmTreeDoc(projectId, update.id)
      const changes: DocumentData = { updatedAt: serverTimestamp() }
      if (update.parentId !== undefined) changes.parentId = update.parentId
      if (update.title !== undefined) changes.title = update.title
      if (update.description !== undefined) changes.description = update.description
      if (update.status !== undefined) changes.status = update.status
      if (update.priority !== undefined) changes.priority = update.priority
      if (update.owner !== undefined) changes.owner = update.owner
      if (update.tags !== undefined) changes.tags = update.tags
      if (update.acceptanceCriteria !== undefined) changes.acceptanceCriteria = update.acceptanceCriteria
      if (update.dependsOn !== undefined) changes.dependsOn = update.dependsOn
      if (update.sources !== undefined) changes.sources = update.sources
      
      await updateDoc(ref, changes)
      const snap = await getDoc(ref)
      const data = snap.data()!
      return {
        id: update.id,
        parentId: data.parentId,
        title: data.title ?? '',
        description: data.description,
        status: data.status ?? 'draft',
        priority: data.priority ?? 'P2',
        owner: data.owner,
        tags: data.tags ?? [],
        acceptanceCriteria: data.acceptanceCriteria ?? [],
        dependsOn: data.dependsOn ?? [],
        sources: data.sources ?? [],
        children: [],
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      } as PMTreeNode
    },

    async deletePMTreeNode(projectId: string, nodeId: string): Promise<{ ok: boolean }> {
      await deleteDoc(pmTreeDoc(projectId, nodeId))
      return { ok: true }
    },

    // Feature Intake
    async getFeatureIntake(projectId: string, nodeId: string): Promise<FeatureIntake | null> {
      const snap = await getDoc(pmFeatureIntakeDoc(projectId, nodeId))
      if (!snap.exists()) return null
      return snap.data() as FeatureIntake
    },

    async setFeatureIntake(projectId: string, nodeId: string, intake: FeatureIntake): Promise<FeatureIntake> {
      await setDoc(pmFeatureIntakeDoc(projectId, nodeId), intake)
      return intake
    },

    // PM Cards
    async listPMCards(projectId: string): Promise<PMCard[]> {
      const snap = await getDocs(pmCardsCol(projectId))
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          featureId: data.featureId ?? '',
          title: data.title ?? '',
          lane: data.lane ?? 'proposed',
          priority: data.priority ?? 'P2',
          owner: data.owner,
          description: data.description,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        }
      })
    },

    async createPMCard(projectId: string, create: PMCardCreate): Promise<PMCard> {
      const id = create.id ?? `card-${makeId()}`
      const now = serverTimestamp()
      const card = {
        featureId: create.featureId,
        title: create.title,
        lane: create.lane ?? 'proposed',
        priority: create.priority ?? 'P2',
        owner: create.owner,
        description: create.description,
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(pmCardDoc(projectId, id), card)
      const isoNow = new Date().toISOString()
      return { id, ...card, createdAt: isoNow, updatedAt: isoNow } as PMCard
    },

    async updatePMCard(projectId: string, update: PMCardUpdate): Promise<PMCard> {
      const ref = pmCardDoc(projectId, update.id)
      const changes: DocumentData = { updatedAt: serverTimestamp() }
      if (update.featureId !== undefined) changes.featureId = update.featureId
      if (update.title !== undefined) changes.title = update.title
      if (update.lane !== undefined) changes.lane = update.lane
      if (update.priority !== undefined) changes.priority = update.priority
      if (update.owner !== undefined) changes.owner = update.owner
      if (update.description !== undefined) changes.description = update.description
      
      await updateDoc(ref, changes)
      const snap = await getDoc(ref)
      const data = snap.data()!
      return { id: update.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) } as PMCard
    },

    async deletePMCard(projectId: string, cardId: string): Promise<{ ok: boolean }> {
      await deleteDoc(pmCardDoc(projectId, cardId))
      return { ok: true }
    },

    // PM Intake
    async getPMIntake(projectId: string): Promise<PMIntake> {
      const snap = await getDoc(pmIntakeDoc(projectId))
      if (!snap.exists()) {
        return { ideas: [], analyses: [], questions: [], requirements: [] }
      }
      const data = snap.data()
      return {
        ideas: data.ideas ?? [],
        analyses: data.analyses ?? [],
        questions: data.questions ?? [],
        requirements: data.requirements ?? [],
      }
    },

    async setPMIntake(projectId: string, intake: PMIntake): Promise<PMIntake> {
      await setDoc(pmIntakeDoc(projectId), intake)
      return intake
    },

    async addPMIdeaVersion(projectId: string, text: string): Promise<PMIntake> {
      const intake = await this.getPMIntake(projectId)
      intake.ideas.push({
        id: `idea-${makeId()}`,
        text,
        createdAt: new Date().toISOString(),
      })
      return this.setPMIntake(projectId, intake)
    },

    async addPMAnalysis(projectId: string, summary: string, keyPoints: string[]): Promise<PMIntake> {
      const intake = await this.getPMIntake(projectId)
      intake.analyses.push({
        id: `analysis-${makeId()}`,
        summary,
        keyPoints,
        createdAt: new Date().toISOString(),
      })
      return this.setPMIntake(projectId, intake)
    },

    async generatePMQuestions(_projectId: string): Promise<PMIntake> {
      throw new Error('Question generation not implemented in cloud mode')
    },

    async answerPMQuestion(projectId: string, questionId: string, answer: string): Promise<PMIntake> {
      const intake = await this.getPMIntake(projectId)
      const q = intake.questions.find((q) => q.id === questionId)
      if (q) {
        q.answer = answer
        q.answeredAt = new Date().toISOString()
      }
      return this.setPMIntake(projectId, intake)
    },

    // PM Activity
    async listPMActivity(projectId: string, limitCount?: number): Promise<PMActivity[]> {
      let q = query(pmActivityCol(projectId), orderBy('at', 'desc'))
      if (limitCount) q = query(q, limit(limitCount))
      const snap = await getDocs(q)
      return snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          at: toIso(data.at),
          actor: data.actor,
          action: data.action ?? '',
          target: data.target,
          details: data.details,
        }
      })
    },

    async addPMActivity(projectId: string, activity: Omit<PMActivity, 'id' | 'at'>): Promise<PMActivity> {
      const id = `activity-${makeId()}`
      const now = new Date().toISOString()
      const entry = {
        ...activity,
        at: serverTimestamp(),
      }
      await setDoc(doc(pmActivityCol(projectId), id), entry)
      return { id, at: now, ...activity }
    },

    // Migration helper
    async migrateIntakeToPM(_intakeProjectId: string): Promise<PMProject> {
      throw new Error('Migration not supported in cloud mode')
    },
  }
}
