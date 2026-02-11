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

  listRules(): Promise<Rule[]>
  createRule(create: RuleCreate): Promise<Rule>
  updateRule(update: RuleUpdate): Promise<Rule>
  deleteRule(id: string): Promise<RuleDeleteResult>
  toggleRule(id: string, enabled: boolean): Promise<Rule>
  listRuleHistory(limit: number): Promise<RuleChange[]>

  listTasks(): Promise<Task[]>
  createTask(create: TaskCreate): Promise<Task>
  updateTask(update: TaskUpdate): Promise<Task>

  // PM/PO intake projects (local single-user)
  listIntakeProjects(): Promise<IntakeProject[]>
  getIntakeProject(id: string): Promise<IntakeProject>
  createIntakeProject(create: IntakeProjectCreate): Promise<IntakeProject>
  updateIntakeProject(update: IntakeProjectUpdate): Promise<IntakeProject>
  generateIntakeQuestions(id: string): Promise<IntakeProject>
  generateIntakeScope(id: string): Promise<IntakeProject>
  exportIntakeMarkdown(id: string): Promise<string>
}
