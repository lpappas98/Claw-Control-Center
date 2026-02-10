import type { ActivityEvent, Blocker, ControlAction, ControlResult, ProjectInfo, SystemStatus, WorkerHeartbeat } from '../types'

export type Adapter = {
  name: string
  getSystemStatus(): Promise<SystemStatus>
  listProjects(): Promise<ProjectInfo[]>
  listActivity(limit: number): Promise<ActivityEvent[]>
  listWorkers(): Promise<WorkerHeartbeat[]>
  listBlockers(): Promise<Blocker[]>
  runControl(action: ControlAction): Promise<ControlResult>
}
