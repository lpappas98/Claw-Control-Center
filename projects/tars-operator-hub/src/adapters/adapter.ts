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
  WorkerHeartbeat,
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
  updateRule(update: RuleUpdate): Promise<Rule>
  toggleRule(id: string, enabled: boolean): Promise<Rule>
  listRuleHistory(limit: number): Promise<RuleChange[]>
}
