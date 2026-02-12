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
  ConnectionToken,
  ConnectedInstance,
  ConnectionTokenCreate,
  ConnectionValidateRequest,
  ConnectionValidateResponse,
} from '../types'

export type Adapter = {
  name: string

  /** Preferred: a single bridge-computed snapshot to keep timestamps consistent. */
  getLiveSnapshot?: () => Promise<LiveSnapshot>

  getSystemStatus(): Promise<SystemStatus>
  listProjects(): Promise<ProjectInfo[]>
  listActivity(limit: number): Promise<ActivityEvent[]>
  listWorkers(): Promise<WorkerHeartbeat[]>
  listBlockers(): Promise<Blocker[]>
  runControl(action: ControlAction): Promise<ControlResult>

  // models/config
  listModels(): Promise<ModelList>
  setDefaultModel(modelKey: string): Promise<ModelSetResult>

  listRules(): Promise<Rule[]>
  createRule(create: RuleCreate): Promise<Rule>
  updateRule(update: RuleUpdate): Promise<Rule>
  deleteRule(id: string): Promise<RuleDeleteResult>
  toggleRule(id: string, enabled: boolean): Promise<Rule>
  listRuleHistory(limit: number): Promise<RuleChange[]>

  listTasks(): Promise<Task[]>
  createTask(create: TaskCreate): Promise<Task>
  updateTask(update: TaskUpdate): Promise<Task>

  // Agent Profiles
  listAgentProfiles(): Promise<AgentProfile[]>
  getAgentProfile(id: string): Promise<AgentProfile>
  createAgentProfile(create: AgentProfileCreate): Promise<AgentProfile>
  updateAgentProfile(update: AgentProfileUpdate): Promise<AgentProfile>
  deleteAgentProfile(id: string): Promise<{ ok: boolean }>

  // PM/PO intake projects (local single-user)
  listIntakeProjects(): Promise<IntakeProject[]>
  getIntakeProject(id: string): Promise<IntakeProject>
  createIntakeProject(create: IntakeProjectCreate): Promise<IntakeProject>
  updateIntakeProject(update: IntakeProjectUpdate): Promise<IntakeProject>
  generateIntakeQuestions(id: string): Promise<IntakeProject>
  generateIntakeScope(id: string): Promise<IntakeProject>
  exportIntakeMarkdown(id: string): Promise<string>

  // PM Projects Hub (full persistence)
  listPMProjects(): Promise<PMProject[]>
  getPMProject(id: string): Promise<PMProject>
  createPMProject(create: PMProjectCreate): Promise<PMProject>
  updatePMProject(update: PMProjectUpdate): Promise<PMProject>
  deletePMProject(id: string): Promise<{ ok: boolean }>
  exportPMProjectJSON(id: string): Promise<object>
  exportPMProjectMarkdown(id: string): Promise<string>

  // PM Projects - Tree
  getPMTree(projectId: string): Promise<PMTreeNode[]>
  createPMTreeNode(projectId: string, create: PMTreeNodeCreate): Promise<PMTreeNode>
  updatePMTreeNode(projectId: string, update: PMTreeNodeUpdate): Promise<PMTreeNode>
  deletePMTreeNode(projectId: string, nodeId: string): Promise<{ ok: boolean }>

  // PM Projects - Feature-Level Intake
  getFeatureIntake(projectId: string, nodeId: string): Promise<FeatureIntake | null>
  setFeatureIntake(projectId: string, nodeId: string, intake: FeatureIntake): Promise<FeatureIntake>

  // PM Projects - Kanban Cards
  listPMCards(projectId: string): Promise<PMCard[]>
  createPMCard(projectId: string, create: PMCardCreate): Promise<PMCard>
  updatePMCard(projectId: string, update: PMCardUpdate): Promise<PMCard>
  deletePMCard(projectId: string, cardId: string): Promise<{ ok: boolean }>

  // PM Projects - Intake
  getPMIntake(projectId: string): Promise<PMIntake>
  setPMIntake(projectId: string, intake: PMIntake): Promise<PMIntake>
  addPMIdeaVersion(projectId: string, text: string): Promise<PMIntake>
  addPMAnalysis(projectId: string, summary: string, keyPoints: string[]): Promise<PMIntake>
  generatePMQuestions(projectId: string): Promise<PMIntake>
  answerPMQuestion(projectId: string, questionId: string, answer: string): Promise<PMIntake>

  // PM Projects - Activity
  listPMActivity(projectId: string, limit?: number): Promise<PMActivity[]>
  addPMActivity(projectId: string, activity: Omit<PMActivity, 'id' | 'at'>): Promise<PMActivity>

  // Migration helper
  migrateIntakeToPM(intakeProjectId: string): Promise<PMProject>

  // OpenClaw Connections
  generateConnectionToken(opts?: ConnectionTokenCreate): Promise<ConnectionToken>
  listConnectionTokens(): Promise<ConnectionToken[]>
  validateConnectionToken(req: ConnectionValidateRequest): Promise<ConnectionValidateResponse>
  listConnectedInstances(): Promise<ConnectedInstance[]>
  updateInstanceHeartbeat(instanceId: string): Promise<void>
  disconnectInstance(instanceId: string): Promise<{ ok: boolean }>
}
