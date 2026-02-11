import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AdapterConfig } from '../lib/adapterState'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { TaskModal } from '../components/TaskModal'
import type { ActivityEvent, BoardLane, LiveSnapshot, Priority, SystemStatus, Task, WorkerHeartbeat } from '../types'

type HomeTask = {
  id: string
  title: string
  lane: BoardLane
  priority: Priority
  agent?: string
  agentEmoji?: string
  details?: Task
  detailsMatch?: 'id' | 'title'
}

function fmtAgo(iso?: string) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

function inferPriority(title?: string): Priority {
  const m = (title ?? '').match(/\b(P[0-3])\b/i)
  const v = m?.[1]?.toUpperCase()
  if (v === 'P0' || v === 'P1' || v === 'P2' || v === 'P3') return v
  return 'P2'
}

function agentProfile(slot: string, fallback?: string) {
  if (slot === 'pm') return { name: 'TARS', role: 'Project Manager', emoji: '🧠' }
  if (slot === 'dev-1') return { name: 'Forge', role: 'Developer', emoji: '🛠️' }
  if (slot === 'dev-2') return { name: 'Patch', role: 'Developer', emoji: '🧩' }
  if (slot === 'architect') return { name: 'Blueprint', role: 'Architect', emoji: '🏗️' }
  if (slot === 'qa') return { name: 'Sentinel', role: 'QA', emoji: '🛡️' }
  return { name: fallback ?? slot, role: 'Agent', emoji: '🤖' }
}

function homeStatus(status: string) {
  return status === 'active' ? 'working' : 'sleeping'
}

const PINNED_SLOTS: Array<{ slot: string; name: string; role: string; emoji: string }> = [
  { slot: 'pm', name: 'TARS', role: 'Project Manager', emoji: '🧠' },
  { slot: 'architect', name: 'Blueprint', role: 'Architect', emoji: '🏗️' },
  { slot: 'qa', name: 'Sentinel', role: 'QA', emoji: '🛡️' },
  { slot: 'dev-1', name: 'Forge', role: 'Developer', emoji: '🛠️' },
  { slot: 'dev-2', name: 'Patch', role: 'Developer', emoji: '🧩' },
]

function unknownSystemStatus(now: string): SystemStatus {
  return {
    updatedAt: now,
    gateway: { health: 'unknown', summary: 'not supported by adapter' },
    nodes: { health: 'unknown', pairedCount: 0, pendingCount: 0 },
    browserRelay: { health: 'unknown', attachedTabs: 0 },
  }
}

function taskLaneFromWorker(w: WorkerHeartbeat): BoardLane {
  if (w.status === 'active') return 'development'
  if (w.status === 'waiting') return 'queued'
  if (w.status === 'stale') return 'blocked'
  return 'queued'
}

function activityActor(e: ActivityEvent): string | null {
  const meta = e.meta ?? {}
  const slot = typeof meta.slot === 'string' ? meta.slot : typeof meta.workerSlot === 'string' ? meta.workerSlot : null
  const human = typeof meta.user === 'string' ? meta.user : typeof meta.human === 'string' ? meta.human : null
  if (slot) {
    const profile = agentProfile(slot)
    return `${profile.emoji} ${profile.name}`
  }
  if (human) return human
  return null
}

export function MissionControl({
  adapter,
  cfg,
}: {
  adapter: Adapter
  cfg: AdapterConfig
  onCfg: (cfg: AdapterConfig) => void
}) {
  const liveFn = useCallback(async (): Promise<LiveSnapshot> => {
    if (adapter.getLiveSnapshot) return adapter.getLiveSnapshot()

    const now = new Date().toISOString()

    async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
      try {
        return await fn()
      } catch (e) {
        console.warn(`[home] ${label} failed`, e)
        return fallback
      }
    }

    const status = await safe('getSystemStatus', () => adapter.getSystemStatus(), unknownSystemStatus(now))
    const workers = await safe('listWorkers', () => adapter.listWorkers(), [])
    const blockers = await safe('listBlockers', () => adapter.listBlockers(), [])

    return {
      updatedAt: now,
      status,
      workers,
      blockers,
      watchdog: { health: 'unknown', summary: 'not supported by adapter' },
    }
  }, [adapter])

  const live = usePoll(liveFn, 5000)
  const activity = usePoll<ActivityEvent[]>(() => adapter.listActivity(40), 7000)
  const persisted = usePoll<Task[]>(() => adapter.listTasks(), 8000)

  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!openTask) return
    // Keep the open task in sync with the latest persisted copy when it refreshes.
    const latest = (persisted.data ?? []).find((t) => t.id === openTask.id)
    if (latest && latest.updatedAt !== openTask.updatedAt) setOpenTask(latest)
  }, [persisted.data, openTask])

  const agents = useMemo(() => {
    const workers = live.data?.workers ?? []
    const bySlot = new Map(workers.map((w) => [w.slot, w]))

    const pinned = PINNED_SLOTS.map((def) => {
      const w = bySlot.get(def.slot)
      return {
        id: def.slot,
        name: def.name,
        emoji: def.emoji,
        role: def.role,
        status: w ? homeStatus(w.status) : 'sleeping',
        rawStatus: w?.status ?? 'offline',
        online: !!w && w.status !== 'offline',
        task: w?.task ?? (w ? 'No active task' : 'Waiting for next task'),
        lastBeatAt: w?.lastBeatAt,
      }
    })

    const pinnedSet = new Set(PINNED_SLOTS.map((s) => s.slot))
    const extras = workers
      .filter((w) => !pinnedSet.has(w.slot))
      .map((w) => {
        const profile = agentProfile(w.slot, w.label)
        return {
          id: w.slot,
          name: profile.name,
          emoji: profile.emoji,
          role: profile.role,
          status: homeStatus(w.status),
          rawStatus: w.status,
          online: w.status !== 'offline',
          task: w.task ?? 'No active task',
          lastBeatAt: w.lastBeatAt,
        }
      })

    return [...pinned, ...extras]
  }, [live.data?.workers])

  const tasks = useMemo<HomeTask[]>(() => {
    const persistedTasks = persisted.data ?? []
    const byTitle = new Map(persistedTasks.map((t) => [t.title.trim(), t]))

    const usedPersistedIds = new Set<string>()

    const workerTasks: HomeTask[] = (live.data?.workers ?? [])
      .filter((w) => !!w.task)
      .map((w, idx) => {
        const profile = agentProfile(w.slot, w.label)
        const title = w.task ?? 'Untitled task'
        const matched = byTitle.get(title.trim())
        if (matched) usedPersistedIds.add(matched.id)
        return {
          id: matched?.id ?? `${w.slot}-${idx}`,
          title: matched?.title ?? title,
          priority: matched?.priority ?? inferPriority(title),
          lane: taskLaneFromWorker(w),
          agent: profile.name,
          agentEmoji: profile.emoji,
          details: matched,
          detailsMatch: matched ? 'title' : undefined,
        }
      })

    const seededTasks: HomeTask[] = persistedTasks
      .filter((t) => !usedPersistedIds.has(t.id))
      .map((t) => {
        const lane: BoardLane = t.lane
        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          lane,
          details: t,
          detailsMatch: 'id',
        }
      })

    const blockerTasks: HomeTask[] = (live.data?.blockers ?? []).map((b) => ({
      id: `blocker-${b.id}`,
      title: b.title,
      priority: inferPriority(b.title),
      lane: 'blocked',
    }))

    // Prefer showing live worker cards first, then seeded queued/proposed cards, then blockers.
    // (Blockers are also shown in their own row.)
    const merged = [...workerTasks, ...seededTasks, ...blockerTasks]

    return merged
  }, [live.data?.workers, live.data?.blockers, persisted.data])

  const boardColumns: Array<{ key: BoardLane; title: string }> = [
    { key: 'proposed', title: 'Proposed' },
    { key: 'queued', title: 'Queued' },
    { key: 'development', title: 'Development' },
    { key: 'review', title: 'Review' },
    { key: 'done', title: 'Done' },
  ]

  const blockedTasks = tasks.filter((t) => t.lane === 'blocked')

  return (
    <main className="main-grid">
      <section className="panel span-4 agent-top-panel">
        {live.error && (
          <div className="callout warn">
            <strong>Live snapshot error:</strong> {live.error.message}
            {cfg.kind === 'bridge' && (
              <div className="muted" style={{ marginTop: 6 }}>
                Bridge URL is {cfg.baseUrl}. If viewing from another device, use this host IP (not localhost).
              </div>
            )}
          </div>
        )}

        <div className="agent-strip compact">
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id}>
              <div className="agent-head">
                <div>
                  <div className="agent-name">
                    {agent.emoji} {agent.name}
                  </div>
                  <div className="agent-role muted">{agent.role}</div>
                </div>
                <Badge kind={agent.rawStatus} />
              </div>
              <div className="agent-online-row">
                <span className={`status-dot ${agent.online ? 'online' : 'offline'}`} />
                <span className={agent.online ? 'status-text-online' : 'status-text-offline'}>{agent.online ? 'Online' : 'Offline'}</span>
                <span className="muted">· {agent.status === 'working' ? '⚡ Working' : '💤 Sleeping'}</span>
              </div>
              <div className="muted">{agent.task}</div>
              <div className="muted">heartbeat: {fmtAgo(agent.lastBeatAt)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel span-3 taskboard-panel">
        <div className="panel-header">
          <div>
            <h3>Task Board</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              Click a card to open details (owner/problem/scope/acceptance/history). Persisted tasks poll: 8s.
            </p>
          </div>
          <div className="right stack-h">
            <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
              {persisted.refreshing
                ? 'refreshing…'
                : persisted.lastSuccessAt
                  ? `last ok: ${new Date(persisted.lastSuccessAt).toLocaleTimeString()}`
                  : ''}
            </div>
            <button
              className="btn"
              type="button"
              disabled={creating}
              onClick={async () => {
                const title = prompt('New task title')
                if (!title || !title.trim()) return
                setCreating(true)
                try {
                  const next = await adapter.createTask({ title: title.trim() })
                  setOpenTask(next)
                } finally {
                  setCreating(false)
                }
              }}
              title="Create a persisted task and open details"
            >
              {creating ? 'Creating…' : 'New task'}
            </button>
          </div>
        </div>

        <div className="blocked-row">
          <div className="blocked-row-title">Blocked</div>
          <div className="blocked-row-cards">
            {blockedTasks.length === 0 && <div className="muted">No blocked tasks</div>}
            {blockedTasks.map((task) => {
              const canOpen = !!task.details
              const inner = (
                <>
                  <div className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</div>
                  <div className="home-task-title">{task.title}</div>
                  <div className={`worker-chip ${task.agent ? 'assigned' : 'unassigned'}`}>
                    {task.agent ? `${task.agentEmoji ?? '🤖'} ${task.agent}` : 'Unassigned'}
                  </div>
                </>
              )

              return canOpen ? (
                <button
                  key={task.id}
                  type="button"
                  className="home-task blocked clickable"
                  onClick={() => setOpenTask(task.details ?? null)}
                  title="Open task details"
                >
                  {inner}
                </button>
              ) : (
                <div key={task.id} className="home-task blocked">
                  {inner}
                </div>
              )
            })}
          </div>
        </div>

        <div className="home-board single-row">
          {boardColumns.map((lane) => {
            const laneTasks = tasks.filter((t) => t.lane === lane.key)
            return (
              <div className="lane-group" key={lane.key}>
                <div className="home-lane-heading">{lane.title}</div>
                <div className="home-lane narrow">
                  <div className="stack">
                    {laneTasks.length === 0 && <div className="home-task empty">No tasks</div>}
                    {laneTasks.map((task) => {
                      const canOpen = !!task.details
                      const inner = (
                        <>
                          <div className={`priority-tag ${task.priority.toLowerCase()}`}>{task.priority}</div>
                          <div className="home-task-title">{task.title}</div>
                          <div className={`worker-chip ${task.agent ? 'assigned' : 'unassigned'}`}>
                            {task.agent ? `${task.agentEmoji ?? '🤖'} ${task.agent}` : 'Unassigned'}
                          </div>
                        </>
                      )

                      return canOpen ? (
                        <button
                          key={task.id}
                          type="button"
                          className="home-task clickable"
                          onClick={() => setOpenTask(task.details ?? null)}
                          title="Open task details"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className="home-task" key={task.id}>
                          {inner}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel span-1 activity-panel">
        <div className="panel-header">
          <h3>Activity Feed</h3>
        </div>

        {activity.error && (
          <div className="callout warn">
            <strong>Activity error:</strong> {activity.error.message}
          </div>
        )}

        <div className="stack activity-scroll">
          {(activity.data ?? []).slice(0, 80).map((item) => {
            const actor = activityActor(item)
            const corr = item.meta && typeof item.meta.correlationId === 'string' ? String(item.meta.correlationId) : null
            return (
              <article className={`feed-item clean ${item.level}`} key={item.id}>
                <div className="feed-head clean" style={{ gap: 8 }}>
                  {actor && <span className="feed-actor">{actor}</span>}
                  {corr && <span className="pill">{corr}</span>}
                  <span className="muted right">{fmtAgo(item.at)}</span>
                </div>
                <div className="feed-msg">{item.message}</div>
              </article>
            )
          })}
          {!activity.loading && (activity.data?.length ?? 0) === 0 && <div className="muted">No activity yet.</div>}
        </div>
      </section>

      {openTask && (
        <TaskModal
          adapter={adapter}
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSaved={(t) => setOpenTask(t)}
        />
      )}
    </main>
  )
}
