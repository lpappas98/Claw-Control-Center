import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Adapter } from '../adapters/adapter'
import { usePoll } from '../lib/usePoll'
import { useWebSocket } from '../lib/useWebSocket'
import { Badge } from '../components/Badge'
import { TaskModal } from '../components/TaskModal'
import { TaskListModal } from '../components/TaskListModal'
import { CreateTaskModal } from '../components/CreateTaskModal'
import type { ActivityEvent, BoardLane, LiveSnapshot, Priority, SystemStatus, Task, WorkerHeartbeat } from '../types'

const MAX_TASKS_PER_LANE = 5

type HomeTask = {
  id: string
  title: string
  lane: BoardLane
  priority: Priority
  agent?: string
  agentEmoji?: string
  tag?: Task['tag']
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
  const m = String(title ?? '').match(/\b(P[0-3])\b/i)
  const v = m?.[1]?.toUpperCase()
  if (v === 'P0' || v === 'P1' || v === 'P2' || v === 'P3') return v
  return 'P2'
}

function agentProfile(slot: string, fallback?: string) {
  if (slot === 'tars' || slot === 'pm') return { name: 'TARS', role: 'Project Manager', emoji: '🧠' }
  if (slot === 'dev-1') return { name: 'Forge', role: 'Developer', emoji: '🛠️' }
  if (slot === 'dev-2') return { name: 'Patch', role: 'Developer', emoji: '🧩' }
  if (slot === 'architect') return { name: 'Blueprint', role: 'Architect', emoji: '🏗️' }
  if (slot === 'qa') return { name: 'Sentinel', role: 'QA', emoji: '🛡️' }
  return { name: fallback ?? slot, role: 'Agent', emoji: '🤖' }
}

function homeStatus(status: string, hasTask?: boolean) {
  // If worker has an actual task, it's working. Otherwise it's idle/sleeping.
  if (hasTask === true) return 'working'
  if (hasTask === false) return 'idle'
  // Fallback to status field
  return status === 'active' ? 'working' : 'sleeping'
}

const PINNED_SLOTS: Array<{ slot: string; name: string; role: string; emoji: string }> = [
  { slot: 'tars', name: 'TARS', role: 'Project Manager', emoji: '🧠' },
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
}: {
  adapter: Adapter
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

  const activityFn = useCallback(() => adapter.listActivity(40), [adapter])
  const persistedFn = useCallback(() => adapter.listTasks(), [adapter])

  const live = usePoll(liveFn, 5000)
  const activity = usePoll<ActivityEvent[]>(activityFn, 7000)
  const persisted = usePoll<Task[]>(persistedFn, 8000)

  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [overflowLane, setOverflowLane] = useState<{ lane: BoardLane; tasks: Task[] } | null>(null)

  // WebSocket for real-time updates - TEMPORARILY DISABLED due to connection storm
  // TODO: Re-enable after fixing reconnect logic
  // const wsUrl = `ws://${window.location.hostname}:8787/ws`
  // useWebSocket({
  //   url: wsUrl,
  //   onMessage: (msg) => {
  //     if (msg.type === 'task-updated' || msg.type === 'task-created') {
  //       persisted.refetch()
  //     }
  //     if (msg.type === 'agent-updated') {
  //       live.refetch()
  //     }
  //   },
  //   enabled: false
  // })

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
      const hasTask = w ? typeof w.task === 'object' && w.task !== null : undefined
      return {
        id: def.slot,
        name: def.name,
        emoji: def.emoji,
        role: def.role,
        status: w ? homeStatus(w.status, hasTask) : 'sleeping',
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
        const hasTask = typeof w.task === 'object' && w.task !== null
        return {
          id: w.slot,
          name: profile.name,
          emoji: profile.emoji,
          role: profile.role,
          status: homeStatus(w.status, hasTask),
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
    const byTitle = new Map(persistedTasks.map((t) => [String(t.title ?? '').trim(), t]))

    const usedPersistedIds = new Set<string>()

    const workerTasks: HomeTask[] = (live.data?.workers ?? [])
      .filter((w) => !!w.task)
      .map((w, idx) => {
        const profile = agentProfile(w.slot, w.label)
        const title = w.task ?? 'Untitled task'
        const matched = byTitle.get(String(title).trim())
        if (matched) usedPersistedIds.add(matched.id)
        return {
          id: matched?.id ?? `${w.slot}-${idx}`,
          title: matched?.title ?? title,
          priority: matched?.priority ?? inferPriority(title),
          lane: matched?.lane ?? taskLaneFromWorker(w),
          tag: matched?.tag,
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
          tag: t.tag,
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

  const workingAgents = useMemo(() => agents.filter(a => a.status === 'working'), [agents])
  const idleAgents = useMemo(() => agents.filter(a => a.status !== 'working'), [agents])
  const useCompactMode = workingAgents.length >= 4
  
  const totalTasks = tasks.length
  const totalP0 = tasks.filter(t => t.priority === 'P0').length
  const blockedCount = blockedTasks.length

  const priorityColors = {
    P0: { dot: '#f87171', border: '#ef4444', text: '#fca5a5' },
    P1: { dot: '#fbbf24', border: '#f59e0b', text: '#fde68a' },
    P2: { dot: '#facc15', border: '#eab308', text: '#fef08a' },
    P3: { dot: '#64748b', border: '#475569', text: '#94a3b8' },
  }

  const tagColors: Record<string, { bg: string; text: string }> = {
    Epic: { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd' },
    UI: { bg: 'rgba(14,165,233,0.15)', text: '#7dd3fc' },
    Backend: { bg: 'rgba(168,85,247,0.15)', text: '#d8b4fe' },
    QA: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7' },
    Arch: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
    Frontend: { bg: 'rgba(6,182,212,0.15)', text: '#67e8f9' },
    Docs: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
  }

  const columnAccents = {
    proposed: '#64748b',
    queued: '#3b82f6',
    development: '#8b5cf6',
    review: '#f59e0b',
    done: '#10b981',
  }

  return (
    <main className="main-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
      {live.error && (
        <Alert variant="destructive">
          <strong>Live snapshot error:</strong> {live.error.message}
          <div className="muted" style={{ marginTop: 6 }}>
            Bridge URL: http://{window.location.hostname}:8787. If viewing from another device, use the server's IP (not localhost).
          </div>
        </Alert>
      )}

      {/* Agent Strip - Adaptive layout */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '10px', alignItems: 'stretch', flexWrap: useCompactMode ? 'wrap' : 'nowrap', overflowX: 'auto' }}>
          {useCompactMode ? (
            // Compact mode: all agents equal-width
            agents.map((agent) => (
              <div
                key={agent.id}
                style={{
                  flex: useCompactMode ? 1 : undefined,
                  minWidth: useCompactMode ? 0 : '300px',
                  flexShrink: 0,
                  background: agent.status === 'working' 
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(15,23,42,0.5) 100%)'
                    : 'rgba(30,41,59,0.4)',
                  border: agent.status === 'working'
                    ? '1px solid rgba(16,185,129,0.18)'
                    : '1px solid rgba(51,65,85,0.35)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{agent.emoji}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>{agent.name}</span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>{agent.role}</span>
                    <div style={{
                      marginLeft: 'auto',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: agent.status === 'working' ? '#34d399' : '#475569',
                      boxShadow: agent.status === 'working' ? '0 0 6px rgba(52,211,153,0.5)' : 'none',
                    }} />
                  </div>
                  {agent.status === 'working' ? (
                    <p style={{ fontSize: '11px', color: 'rgba(110,231,183,0.6)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof agent.task === 'object' && agent.task?.title ? agent.task.title : agent.task}
                    </p>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#334155', margin: 0 }}>Idle · {fmtAgo(agent.lastBeatAt)}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Expanded mode: large cards for working agents */}
              {workingAgents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    width: '300px',
                    flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(15,23,42,0.5) 100%)',
                    border: '1px solid rgba(16,185,129,0.18)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{agent.emoji}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{agent.name}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{agent.role}</span>
                      <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(110,231,183,0.65)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof agent.task === 'object' && agent.task?.title ? agent.task.title : agent.task}
                    </p>
                  </div>
                </div>
              ))}
              {/* Idle cluster */}
              {idleAgents.length > 0 && (
                <div style={{
                  background: 'rgba(30,41,59,0.4)',
                  border: '1px solid rgba(51,65,85,0.35)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {idleAgents.map(a => (
                      <div
                        key={a.id}
                        title={`${a.name} · ${a.role}`}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: 'rgba(51,65,85,0.5)',
                          border: '1px solid rgba(71,85,105,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          cursor: 'default',
                        }}
                      >
                        {a.emoji}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{idleAgents.length}</span> idle
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Board + Activity */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Task Board */}
        <div style={{
          flex: 1,
          minWidth: 0,
          background: 'rgba(15,23,42,0.45)',
          border: '1px solid rgba(30,41,59,0.55)',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Board header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid rgba(30,41,59,0.55)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>Task Board</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748b' }}>
                <span>{totalTasks} tasks</span>
                <span style={{ color: '#1e293b' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
                  <span style={{ color: '#fca5a5' }}>{totalP0} critical</span>
                </span>
                <span style={{ color: '#1e293b' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ color: '#fca5a5' }}>{blockedCount} blocked</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#334155' }}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              <Button
                variant="default"
                type="button"
                onClick={() => setShowCreateModal(true)}
                title="Create a new task with full details"
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                + New task
              </Button>
            </div>
          </div>

          {/* Columns */}
          <div style={{ display: 'flex', gap: '10px', padding: '14px 16px', overflowX: 'auto', flex: 1 }}>
            {boardColumns.map((lane) => {
              const laneTasks = tasks.filter((t) => t.lane === lane.key)
              const visibleTasks = laneTasks.slice(0, MAX_TASKS_PER_LANE)
              const overflowCount = laneTasks.length - MAX_TASKS_PER_LANE
              const accent = columnAccents[lane.key as keyof typeof columnAccents] || '#64748b'
              const p0Count = laneTasks.filter(t => t.priority === 'P0').length

              return (
                <div key={lane.key} style={{ minWidth: '185px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Column header */}
                  <div style={{ padding: '8px 10px 8px', borderBottom: `2px solid ${accent}35`, marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {lane.title}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#64748b',
                          background: 'rgba(30,41,59,0.7)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}>
                          {laneTasks.length}
                        </span>
                      </div>
                      {p0Count > 0 && lane.key !== 'done' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171' }} />
                          <span style={{ fontSize: '10px', color: '#fca5a5', fontWeight: 500 }}>{p0Count}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {laneTasks.length === 0 && (
                      <div style={{ color: '#64748b', fontSize: '12px', padding: '16px 8px', textAlign: 'center' }}>
                        No tasks
                      </div>
                    )}
                    {visibleTasks.map((task) => {
                      const canOpen = !!task.details
                      const colors = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.P3
                      const Inner = (
                        <div style={{
                          background: 'rgba(30,41,59,0.45)',
                          border: `1px solid rgba(51,65,85,0.35)`,
                          borderLeft: `3px solid ${colors.border}`,
                          borderRadius: '8px',
                          padding: '10px 12px',
                          cursor: canOpen ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                        }}>
                          <p style={{
                            fontSize: '12.5px',
                            lineHeight: 1.45,
                            color: '#e2e8f0',
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden',
                          }}>
                            {task.title}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '7px', flexWrap: 'wrap' }}>
                            {task.tag && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: tagColors[task.tag]?.bg || 'rgba(100,116,139,0.15)',
                                color: tagColors[task.tag]?.text || '#94a3b8',
                                letterSpacing: '0.01em',
                              }}>
                                {task.tag}
                              </span>
                            )}
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: colors.text,
                            }}>
                              {task.priority}
                            </span>
                            {task.agent && (
                              <span style={{ fontSize: '10px', color: '#60a5fa' }}>
                                → {task.agent}
                              </span>
                            )}
                          </div>
                        </div>
                      )

                      return canOpen ? (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setOpenTask(task.details ?? null)}
                          title="Open task details"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                          }}
                        >
                          {Inner}
                        </button>
                      ) : (
                        <div key={task.id}>{Inner}</div>
                      )
                    })}
                    {overflowCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setOverflowLane({ lane: lane.key, tasks: laneTasks })}
                        title={`View all ${laneTasks.length} tasks`}
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#94a3b8',
                          background: 'transparent',
                          border: '1px dashed rgba(71,85,105,0.4)',
                          borderRadius: '8px',
                          padding: '8px 0',
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                      >
                        +{overflowCount} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Sidebar */}
        <div style={{
          width: '270px',
          flexShrink: 0,
          background: 'rgba(15,23,42,0.45)',
          border: '1px solid rgba(30,41,59,0.55)',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 150px)',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(30,41,59,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Activity
            </span>
            <span style={{ fontSize: '11px', color: '#334155' }}>
              {(activity.data?.length ?? 0)} events
            </span>
          </div>

          {activity.error && (
            <Alert variant="destructive" style={{ margin: '8px' }}>
              <strong>Activity error:</strong> {activity.error.message}
            </Alert>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(activity.data ?? []).slice(0, 80).map((item) => {
              const actor = activityActor(item)
              const corr = item.meta && typeof item.meta.correlationId === 'string' ? String(item.meta.correlationId) : null
              const iconMap: Record<string, string> = { info: 'ℹ', warn: '⚠', success: '✓', error: '✕' }
              const colorMap: Record<string, string> = { info: '#64748b', warn: '#fbbf24', success: '#34d399', error: '#f87171' }
              const icon = iconMap[item.level] || 'ℹ'
              const color = colorMap[item.level] || '#64748b'

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '10px 16px',
                    borderLeft: item.level === 'warn' ? '2px solid rgba(245,158,11,0.35)' : '2px solid transparent',
                    background: item.level === 'warn' ? 'rgba(245,158,11,0.04)' : 'transparent',
                  }}
                >
                  <span style={{ color, fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: '12px',
                      lineHeight: 1.5,
                      margin: 0,
                      wordBreak: 'break-word',
                      color: item.level === 'warn' ? '#fde68a' : '#cbd5e1',
                    }}>
                      {item.message}
                    </p>
                    <span style={{ fontSize: '11px', color: '#475569' }}>{fmtAgo(item.at)}</span>
                  </div>
                </div>
              )
            })}
            {!activity.loading && (activity.data?.length ?? 0) === 0 && (
              <div style={{ color: '#64748b', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>

      {openTask && (
        <TaskModal
          adapter={adapter}
          task={openTask}
          onClose={() => setOpenTask(null)}
          onSaved={(t) => setOpenTask(t)}
        />
      )}

      {showCreateModal && (
        <CreateTaskModal
          adapter={adapter}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            persisted.refetch()
          }}
        />
      )}

      {overflowLane && (
        <TaskListModal
          title={`${overflowLane.lane.charAt(0).toUpperCase() + overflowLane.lane.slice(1)} (${overflowLane.tasks.length})`}
          tasks={overflowLane.tasks}
          onTaskClick={(task) => setOpenTask(task)}
          onClose={() => setOverflowLane(null)}
          highlightLane={overflowLane.lane}
        />
      )}
    </main>
  )
}
