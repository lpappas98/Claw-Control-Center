import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AdapterConfig } from '../lib/adapterState'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import type { ActivityEvent, LiveSnapshot } from '../types'

type BoardLane = 'proposed' | 'queued' | 'development' | 'review' | 'blocked' | 'done'

type HomeTask = {
  id: string
  title: string
  lane: BoardLane
  /** Human-friendly agent name if assigned. */
  agent?: string
}

type RoleSlot = {
  slot: string
  name: string
  role: string
  /** If true, show even when offline/unknown. */
  pinned?: boolean
}

const ROLE_SLOTS_KEY = 'tars.operatorHub.roleSlots.v1'

function fmtAgo(iso?: string) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

function agentProfile(slot: string, fallback?: string) {
  if (slot === 'pm') return { name: 'TARS', role: 'Project Manager' }
  if (slot === 'dev-1') return { name: 'Forge', role: 'Developer' }
  if (slot === 'dev-2') return { name: 'Patch', role: 'Developer' }
  if (slot === 'architect') return { name: 'Blueprint', role: 'Architect' }
  if (slot === 'qa') return { name: 'Sentinel', role: 'QA' }
  return { name: fallback ?? slot, role: 'Agent' }
}

function homeStatus(status: string) {
  return status === 'active' ? 'working' : 'sleeping'
}

function loadRoleSlots(): RoleSlot[] {
  try {
    const raw = localStorage.getItem(ROLE_SLOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.slot === 'string' && typeof x.name === 'string' && typeof x.role === 'string')
      .map((x) => ({ slot: String(x.slot), name: String(x.name), role: String(x.role), pinned: Boolean(x.pinned) }))
  } catch {
    return []
  }
}

function saveRoleSlots(slots: RoleSlot[]) {
  try {
    localStorage.setItem(ROLE_SLOTS_KEY, JSON.stringify(slots))
  } catch {
    // ignore
  }
}

function activityActor(e: ActivityEvent): string | null {
  const meta = e.meta ?? {}
  const slot = typeof meta.slot === 'string' ? meta.slot : typeof meta.workerSlot === 'string' ? meta.workerSlot : null
  const human = typeof meta.user === 'string' ? meta.user : typeof meta.human === 'string' ? meta.human : null
  if (slot) return slot
  if (human) return human
  return null
}

export function MissionControl({
  adapter,
  cfg,
  onOpenTab,
}: {
  adapter: Adapter
  cfg: AdapterConfig
  onCfg: (cfg: AdapterConfig) => void
  onOpenTab?: (tab: string) => void
}) {
  const liveFn = useCallback(async (): Promise<LiveSnapshot> => {
    if (adapter.getLiveSnapshot) return adapter.getLiveSnapshot()

    const now = new Date().toISOString()
    const unknownStatus = {
      updatedAt: now,
      gateway: { health: 'unknown', summary: 'not supported by adapter' },
      nodes: { health: 'unknown', pairedCount: 0, pendingCount: 0 },
      browserRelay: { health: 'unknown', attachedTabs: 0 },
    } as const

    async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
      try {
        return await fn()
      } catch (e) {
        // Keep home usable even if one endpoint is missing/unstable.
        console.warn(`[home] ${label} failed`, e)
        return fallback
      }
    }

    const status = await safe('getSystemStatus', () => adapter.getSystemStatus(), { ...unknownStatus })
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
  const rules = usePoll(() => adapter.listRules(), 15_000)
  const ruleHistory = usePoll(() => adapter.listRuleHistory(30), 20_000)

  const [editingSlots, setEditingSlots] = useState(false)
  const [roleSlots, setRoleSlots] = useState<RoleSlot[]>(() => loadRoleSlots())

  useEffect(() => {
    saveRoleSlots(roleSlots)
  }, [roleSlots])

  const slotDefs = useMemo(() => {
    const defaults: RoleSlot[] = [
      { slot: 'pm', name: 'TARS', role: 'Project Manager', pinned: true },
      { slot: 'architect', name: 'Blueprint', role: 'Architect', pinned: true },
      { slot: 'qa', name: 'Sentinel', role: 'QA', pinned: true },
      { slot: 'dev-1', name: 'Forge', role: 'Developer', pinned: true },
      { slot: 'dev-2', name: 'Patch', role: 'Developer', pinned: true },
    ]

    const bySlot = new Map<string, RoleSlot>()
    for (const d of defaults) bySlot.set(d.slot, d)
    for (const s of roleSlots) {
      bySlot.set(s.slot, { ...bySlot.get(s.slot), ...s })
    }

    return {
      list: Array.from(bySlot.values()),
      map: bySlot,
      defaultOrder: defaults.map((d) => d.slot),
    }
  }, [roleSlots])

  const ruleStats = {
    total: (rules.data ?? []).length,
    enabled: (rules.data ?? []).filter((r) => r.enabled).length,
    lastChangeAt: ruleHistory.data?.[0]?.at,
  }

  const agents = useMemo(() => {
    const workers = live.data?.workers ?? []
    const bySlot = new Map(workers.map((w) => [w.slot, w]))

    const baseOrder = slotDefs.defaultOrder
    const pinnedExtras = slotDefs.list
      .filter((s) => !baseOrder.includes(s.slot) && s.pinned)
      .map((s) => s.slot)

    const orderedSlots = [...baseOrder, ...pinnedExtras]
    const orderedSet = new Set(orderedSlots)

    const ordered = orderedSlots.map((slot) => {
      const w = bySlot.get(slot)
      const def = slotDefs.map.get(slot)
      const profile = def ? { name: def.name, role: def.role } : agentProfile(slot, w?.label)
      return {
        id: slot,
        name: profile.name,
        role: profile.role,
        status: w ? homeStatus(w.status) : 'sleeping',
        rawStatus: w?.status ?? 'offline',
        task: w?.task ?? (w ? 'No active task' : 'Waiting for next task'),
        lastBeatAt: w?.lastBeatAt,
      }
    })

    const extras = workers
      .filter((w) => !orderedSet.has(w.slot))
      .map((w) => {
        const def = slotDefs.map.get(w.slot)
        const profile = def ? { name: def.name, role: def.role } : agentProfile(w.slot, w.label)
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

    return [...ordered, ...extras]
  }, [live.data?.workers, slotDefs.defaultOrder, slotDefs.list, slotDefs.map])

  const tasks = useMemo<HomeTask[]>(() => {
    const workerTasks: HomeTask[] = (live.data?.workers ?? [])
      .filter((w) => !!w.task)
      .map((w, idx) => {
        const def = slotDefs.map.get(w.slot)
        const profile = def ? { name: def.name, role: def.role } : agentProfile(w.slot, w.label)
        const lane: BoardLane =
          w.status === 'active' ? 'development' : w.status === 'waiting' ? 'queued' : w.status === 'stale' ? 'blocked' : 'queued'

        return {
          id: `${w.slot}-${idx}`,
          title: w.task ?? 'Untitled task',
          lane,
          agent: profile.name,
        }
      })

    const blockerTasks: HomeTask[] = (live.data?.blockers ?? []).map((b) => ({
      id: `blocker-${b.id}`,
      title: b.title,
      lane: 'blocked',
    }))

    return [...workerTasks, ...blockerTasks]
  }, [live.data?.workers, live.data?.blockers, slotDefs.map])

  const laneOrder: Array<{ key: BoardLane; title: string }> = [
    { key: 'proposed', title: 'Proposed' },
    { key: 'queued', title: 'Queued' },
    { key: 'development', title: 'Development' },
    { key: 'review', title: 'Review' },
    { key: 'blocked', title: 'Blocked' },
    { key: 'done', title: 'Done' },
  ]


  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Home</h2>
          </div>
          <div className="right" style={{ textAlign: 'right' }}>
            <div className="stack-h" style={{ justifyContent: 'flex-end', marginBottom: 6 }}>
              <button className="btn ghost" type="button" onClick={() => setEditingSlots((v) => !v)}>
                {editingSlots ? 'Close slots' : 'Role slots'}
              </button>
              <button className="btn ghost" type="button" onClick={() => onOpenTab?.('Rules')} disabled={!onOpenTab} title="Open Rules tab">
                Rules
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => onOpenTab?.('Activity')}
                disabled={!onOpenTab}
                title="Open Activity tab"
              >
                Activity
              </button>
            </div>

            <div className="muted">updated: {live.data?.updatedAt ? new Date(live.data.updatedAt).toLocaleTimeString() : '—'}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {live.refreshing ? 'refreshing…' : live.lastSuccessAt ? `last ok: ${new Date(live.lastSuccessAt).toLocaleTimeString()}` : ''}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              rules: {ruleStats.enabled}/{ruleStats.total} enabled · last change: {fmtAgo(ruleStats.lastChangeAt)}
            </div>
          </div>
        </div>

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

        {editingSlots && (
          <div className="callout" style={{ marginBottom: 12 }}>
            <div className="stack">
              <div>
                <strong>Persistent role slots</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  Customize slot names/roles shown on Mission Control. Saved locally in this browser (localStorage).
                </div>
              </div>

              <div className="table-like">
                {slotDefs.list.map((s) => {
                  const locked = slotDefs.defaultOrder.includes(s.slot)
                  return (
                    <div className="row" key={s.slot}>
                      <div className="row-main">
                        <div className="row-title">
                          <strong>{s.slot}</strong>
                          {locked && <span className="pill sev-low">core</span>}
                        </div>
                        <div className="stack-h">
                          <label className="field inline">
                            <span className="muted">name</span>
                            <input
                              value={s.name}
                              onChange={(e) =>
                                setRoleSlots((prev) => {
                                  const next = [...prev]
                                  const idx = next.findIndex((x) => x.slot === s.slot)
                                  const patch: RoleSlot = { slot: s.slot, name: e.target.value, role: s.role, pinned: s.pinned }
                                  if (idx >= 0) next[idx] = { ...next[idx], ...patch }
                                  else next.push(patch)
                                  return next
                                })
                              }
                            />
                          </label>
                          <label className="field inline">
                            <span className="muted">role</span>
                            <input
                              value={s.role}
                              onChange={(e) =>
                                setRoleSlots((prev) => {
                                  const next = [...prev]
                                  const idx = next.findIndex((x) => x.slot === s.slot)
                                  const patch: RoleSlot = { slot: s.slot, name: s.name, role: e.target.value, pinned: s.pinned }
                                  if (idx >= 0) next[idx] = { ...next[idx], ...patch }
                                  else next.push(patch)
                                  return next
                                })
                              }
                            />
                          </label>
                          <label className="field inline">
                            <span className="muted">pin</span>
                            <input
                              type="checkbox"
                              checked={Boolean(s.pinned)}
                              onChange={(e) =>
                                setRoleSlots((prev) => {
                                  const next = [...prev]
                                  const idx = next.findIndex((x) => x.slot === s.slot)
                                  const patch: RoleSlot = { slot: s.slot, name: s.name, role: s.role, pinned: e.target.checked }
                                  if (idx >= 0) next[idx] = { ...next[idx], ...patch }
                                  else next.push(patch)
                                  return next
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <div className="row-side">
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={locked}
                          title={locked ? 'Core slots cannot be removed (edit name/role instead).' : 'Remove slot override'}
                          onClick={() => setRoleSlots((prev) => prev.filter((x) => x.slot !== s.slot))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="row">
                  <div className="row-main">
                    <div className="row-title">
                      <strong>Add pinned slot</strong>
                      <span className="muted">· placeholder card even when offline</span>
                    </div>
                    <div className="stack-h">
                      <button
                        className="btn"
                        type="button"
                        onClick={() =>
                          setRoleSlots((prev) => {
                            const slot = `slot-${prev.length + 1}`
                            if (slotDefs.map.has(slot)) return prev
                            return [...prev, { slot, name: 'New', role: 'Agent', pinned: true }]
                          })
                        }
                      >
                        Add
                      </button>
                      <button className="btn ghost" type="button" onClick={() => setRoleSlots([])} title="Clear overrides (restore defaults)">
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

      <section className="panel span-3">
        <div className="panel-header">
          <div>
            <h3>Task Board</h3>
          </div>
        </div>

        <div className="home-board">
          {laneOrder.map((lane) => {
            const laneTasks = tasks.filter((t) => t.lane === lane.key)
            return (
              <div className="home-lane" key={lane.key}>
                <div className="home-lane-title">{lane.title}</div>
                <div className="stack">
                  {laneTasks.length === 0 && <div className="muted">No tasks</div>}
                  {laneTasks.map((task) => (
                    <div className="home-task" key={task.id}>
                      <div className="home-task-title">{task.title}</div>
                      <div className={`home-task-tag ${task.agent ? 'assigned' : 'unassigned'}`}>{task.agent ?? 'Unassigned'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel span-1">
        <div className="panel-header">
          <div>
            <h3>Activity Feed</h3>
          </div>
        </div>

        {activity.error && (
          <div className="callout warn">
            <strong>Activity error:</strong> {activity.error.message}
          </div>
        )}

        <div className="stack">
          {(activity.data ?? []).slice(0, 20).map((item) => {
            const actor = activityActor(item)
            const corr = item.meta && typeof item.meta.correlationId === 'string' ? String(item.meta.correlationId) : null
            return (
              <article className={`feed-item ${item.level}`} key={item.id}>
                <div className="feed-head" style={{ gap: 8 }}>
                  <Badge kind={item.level} />
                  <span className="feed-source">{item.source}</span>
                  {actor && (
                    <span className="pill sev-low" title="actor">
                      {actor}
                    </span>
                  )}
                  {corr && (
                    <span className="pill" title="correlation id">
                      {corr}
                    </span>
                  )}
                  <span className="muted right">{fmtAgo(item.at)}</span>
                </div>
                <div className="feed-msg">{item.message}</div>
                {item.meta && (
                  <details className="feed-meta">
                    <summary className="muted">details</summary>
                    <pre className="code">{JSON.stringify(item.meta, null, 2)}</pre>
                  </details>
                )}
              </article>
            )
          })}
          {!activity.loading && (activity.data?.length ?? 0) === 0 && <div className="muted">No activity yet.</div>}
        </div>
      </section>
    </main>
  )
}
