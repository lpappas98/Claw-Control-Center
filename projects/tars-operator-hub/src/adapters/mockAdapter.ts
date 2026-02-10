import type { Adapter } from './adapter'
import type { ActivityEvent, Blocker, ControlAction, ControlResult, ProjectInfo, SystemStatus, WorkerHeartbeat } from '../types'

const nowIso = () => new Date().toISOString()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const mockAdapter: Adapter = {
  name: 'Mock (offline)',

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
}
