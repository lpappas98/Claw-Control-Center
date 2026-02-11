import { useCallback, useMemo } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AdapterConfig } from '../lib/adapterState'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import type { ActivityEvent, LiveSnapshot } from '../types'

type HomeTask = {
  id: string
  title: string
  lane: 'working' | 'sleeping' | 'blocked'
  agent: string
}

function fmtAgo(iso?: string) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

function agentProfile(slot: string, fallback?: string) {
  if (slot === 'dev-1') return { name: 'Forge', role: 'Developer' }
  if (slot === 'dev-2') return { name: 'Patch', role: 'Developer' }
  if (slot === 'qa') return { name: 'Sentinel', role: 'QA' }
  if (slot === 'architect') return { name: 'Blueprint', role: 'Architect' }
  return { name: fallback ?? slot, role: 'Agent' }
}

function homeStatus(status: string) {
  return status === 'active' ? 'working' : 'sleeping'
}

export function MissionControl({
  adapter,
}: {
  adapter: Adapter
  cfg: AdapterConfig
  onCfg: (cfg: AdapterConfig) => void
}) {
  const liveFn = useCallback(async (): Promise<LiveSnapshot> => {
    if (adapter.getLiveSnapshot) return adapter.getLiveSnapshot()
    const [status, workers, blockers] = await Promise.all([adapter.getSystemStatus(), adapter.listWorkers(), adapter.listBlockers()])
    return {
      updatedAt: new Date().toISOString(),
      status,
      workers,
      blockers,
      watchdog: { health: 'unknown', summary: 'not supported by adapter' },
    }
  }, [adapter])

  const live = usePoll(liveFn, 5000)
  const activity = usePoll<ActivityEvent[]>(() => adapter.listActivity(40), 7000)

  const agents = useMemo(() => {
    return (live.data?.workers ?? []).map((w) => {
      const profile = agentProfile(w.slot, w.label)
      return {
        id: w.slot,
        name: profile.name,
        role: profile.role,
        status: homeStatus(w.status),
        rawStatus: w.status,
        task: w.task ?? 'No active task',
        lastBeatAt: w.lastBeatAt,
      }
    })
  }, [live.data?.workers])

  const tasks = useMemo<HomeTask[]>(() => {
    const workerTasks: HomeTask[] = (live.data?.workers ?? [])
      .filter((w) => !!w.task)
      .map((w, idx) => {
        const profile = agentProfile(w.slot, w.label)
        return {
          id: `${w.slot}-${idx}`,
          title: w.task ?? 'Untitled task',
          lane: w.status === 'active' ? 'working' : 'sleeping',
          agent: profile.name,
        }
      })

    const blockerTasks: HomeTask[] = (live.data?.blockers ?? []).map((b) => ({
      id: `blocker-${b.id}`,
      title: b.title,
      lane: 'blocked',
      agent: 'Unassigned',
    }))

    return [...workerTasks, ...blockerTasks]
  }, [live.data?.workers, live.data?.blockers])

  const lanes = useMemo(
    () => ({
      working: tasks.filter((t) => t.lane === 'working'),
      sleeping: tasks.filter((t) => t.lane === 'sleeping'),
      blocked: tasks.filter((t) => t.lane === 'blocked'),
    }),
    [tasks],
  )

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Home</h2>
            <p className="muted">Active agents, current tasks, and unified activity feed.</p>
          </div>
          <div className="right" style={{ textAlign: 'right' }}>
            <div className="muted">updated: {live.data?.updatedAt ? new Date(live.data.updatedAt).toLocaleTimeString() : '—'}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {live.refreshing ? 'refreshing…' : live.lastSuccessAt ? `last ok: ${new Date(live.lastSuccessAt).toLocaleTimeString()}` : ''}
            </div>
          </div>
        </div>

        {live.error && (
          <div className="callout warn">
            <strong>Live snapshot error:</strong> {live.error.message}
          </div>
        )}

        <div className="agent-strip">
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id}>
              <div className="agent-head">
                <div>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role muted">{agent.role}</div>
                </div>
                <Badge kind={agent.rawStatus} />
              </div>
              <div className="agent-mode">{agent.status === 'working' ? 'Working' : 'Sleeping'}</div>
              <div className="muted">{agent.task}</div>
              <div className="muted">heartbeat: {fmtAgo(agent.lastBeatAt)}</div>
            </article>
          ))}
          {!live.loading && agents.length === 0 && <div className="muted">No active agents reported.</div>}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <h3>Task Board</h3>
            <p className="muted">Each task is tagged with assigned agent.</p>
          </div>
        </div>

        <div className="home-board">
          {([
            ['working', 'Working', lanes.working],
            ['sleeping', 'Sleeping', lanes.sleeping],
            ['blocked', 'Blocked', lanes.blocked],
          ] as const).map(([key, title, laneTasks]) => (
            <div className="home-lane" key={key}>
              <div className="home-lane-title">{title}</div>
              <div className="stack">
                {laneTasks.length === 0 && <div className="muted">No tasks</div>}
                {laneTasks.map((task) => (
                  <div className="home-task" key={task.id}>
                    <div>{task.title}</div>
                    <div className="home-task-tag">{task.agent}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <h3>Activity Feed</h3>
            <p className="muted">Unified activity across agents and operator actions.</p>
          </div>
        </div>

        <div className="stack">
          {(activity.data ?? []).slice(0, 18).map((item) => (
            <article className={`feed-item ${item.level}`} key={item.id}>
              <div className="feed-head">
                <span className="feed-source">{item.source}</span>
                <span className="muted">{fmtAgo(item.at)}</span>
              </div>
              <div className="feed-msg">{item.message}</div>
            </article>
          ))}
          {!activity.loading && (activity.data?.length ?? 0) === 0 && <div className="muted">No activity yet.</div>}
        </div>
      </section>
    </main>
  )
}
