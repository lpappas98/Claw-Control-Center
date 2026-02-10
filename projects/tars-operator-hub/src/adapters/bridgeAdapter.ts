import type { Adapter } from './adapter'
import type { ActivityEvent, Blocker, ControlAction, ControlResult, ProjectInfo, SystemStatus, WorkerHeartbeat } from '../types'

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
  }
}
