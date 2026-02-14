import { useCallback, useMemo, useState } from 'react'
import { Alert } from "@/components/ui/alert"
import type { Adapter } from '../adapters/adapter'
import type { ActivityEvent, ActivityLevel } from '../types'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'

const levels: ActivityLevel[] = ['info', 'warn', 'error']
type Severity = 'Low' | 'Medium' | 'High'
const severities: Severity[] = ['Low', 'Medium', 'High']

function safeString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined
  return v as Record<string, unknown>
}

function getMeta(e: ActivityEvent): Record<string, unknown> {
  return (e.meta ?? {}) as Record<string, unknown>
}

function getActor(e: ActivityEvent): string {
  const m = getMeta(e)
  return (
    safeString(m.actor) ||
    safeString(m.user) ||
    safeString(m.agent) ||
    safeString(m.worker) ||
    safeString(m.owner) ||
    ''
  )
}

function getType(e: ActivityEvent): string {
  const m = getMeta(e)
  return safeString(m.type) || safeString(m.eventType) || safeString(m.kind) || safeString(m.action) || ''
}

function getSource(e: ActivityEvent): string {
  return e.source || ''
}

function getSeverity(e: ActivityEvent): Severity {
  const m = getMeta(e)
  const raw = safeString(m.severity)
  if (raw === 'High' || raw === 'Medium' || raw === 'Low') return raw
  if (e.level === 'error') return 'High'
  if (e.level === 'warn') return 'Medium'
  return 'Low'
}

function metaToPrettyText(meta?: Record<string, unknown>) {
  if (!meta) return ''
  try {
    return JSON.stringify(meta, null, 2)
  } catch {
    return String(meta)
  }
}

function normalizeNeedle(s: string) {
  return s.trim().toLowerCase()
}

function includesNeedle(haystack: string, needle: string) {
  if (!needle) return true
  return haystack.toLowerCase().includes(needle)
}

type TimelineItem = { label: string; at: string; note?: string }

function extractTimeline(e: ActivityEvent): TimelineItem[] {
  const meta = getMeta(e)
  const items: TimelineItem[] = []

  const tl = meta.timeline
  if (Array.isArray(tl)) {
    for (const raw of tl) {
      const r = asRecord(raw)
      if (!r) continue
      const label = safeString(r.label) || safeString(r.name) || 'event'
      const at = safeString(r.at) || safeString(r.time) || safeString(r.timestamp)
      if (!at) continue
      const note = safeString(r.note) || safeString(r.details) || ''
      items.push({ label, at, note: note || undefined })
    }
  }

  const knownKeys: Array<[string, string]> = [
    ['createdAt', 'created'],
    ['queuedAt', 'queued'],
    ['receivedAt', 'received'],
    ['startedAt', 'started'],
    ['finishedAt', 'finished'],
    ['endedAt', 'ended'],
    ['completedAt', 'completed'],
    ['resolvedAt', 'resolved'],
  ]
  for (const [key, label] of knownKeys) {
    const at = safeString(meta[key])
    if (!at) continue
    if (items.some((it) => it.at === at)) continue
    items.push({ label, at })
  }

  if (!items.some((it) => it.at === e.at)) items.unshift({ label: 'at', at: e.at })

  const parse = (s: string) => {
    const n = Date.parse(s)
    return Number.isFinite(n) ? n : null
  }
  items.sort((a, b) => {
    const pa = parse(a.at)
    const pb = parse(b.at)
    if (pa == null && pb == null) return a.label.localeCompare(b.label)
    if (pa == null) return 1
    if (pb == null) return -1
    return pa - pb
  })

  return items
}

// Event grouping: consecutive identical events are grouped
interface GroupedEvent {
  id: string
  events: ActivityEvent[]
  count: number
  first: ActivityEvent
  expanded: boolean
}

function groupConsecutiveEvents(events: ActivityEvent[]): GroupedEvent[] {
  if (events.length === 0) return []

  const groups: GroupedEvent[] = []
  let currentGroup: ActivityEvent[] = [events[0]]

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1]
    const curr = events[i]

    const prevKey = `${getSource(prev)}|${getActor(prev)}|${getType(prev)}|${curr.message}`
    const currKey = `${getSource(curr)}|${getActor(curr)}|${getType(curr)}|${curr.message}`

    if (prevKey === currKey) {
      currentGroup.push(curr)
    } else {
      groups.push({
        id: currentGroup[0].id,
        events: currentGroup,
        count: currentGroup.length,
        first: currentGroup[0],
        expanded: false,
      })
      currentGroup = [curr]
    }
  }

  if (currentGroup.length > 0) {
    groups.push({
      id: currentGroup[0].id,
      events: currentGroup,
      count: currentGroup.length,
      first: currentGroup[0],
      expanded: false,
    })
  }

  return groups
}

// Type-based color coding
function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'task.created': '#3b82f6',
    'task.assigned': '#10b981',
    'task.completed': '#8b5cf6',
    'task.updated': '#f59e0b',
    'error': '#ef4444',
    'warn': '#f59e0b',
    'info': '#3b82f6',
  }
  return colorMap[type] || '#6b7280'
}

function getLevelIcon(level: string): string {
  switch (level) {
    case 'error': return '⚠️'
    case 'warn': return '⚡'
    case 'info': return 'ℹ️'
    default: return '•'
  }
}

export function Activity({ adapter }: { adapter: Adapter }) {
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [groupDuplicates, setGroupDuplicates] = useState(true)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  const fn = useCallback(() => adapter.listActivity(250), [adapter])
  const { data, error, loading, refreshing, lastSuccessAt } = usePoll(fn, 5000)

  // Extract unique sources, actors, types
  const { sources, actors, types, typeStats } = useMemo(() => {
    const list = data ?? []
    const s = new Set<string>()
    const a = new Set<string>()
    const t = new Set<string>()
    const stats: Record<string, number> = {}

    for (const e of list) {
      const source = getSource(e)
      const actor = getActor(e)
      const type = getType(e)

      if (source) s.add(source)
      if (actor) a.add(actor)
      if (type) {
        t.add(type)
        stats[type] = (stats[type] || 0) + 1
      }
    }

    return {
      sources: Array.from(s).sort(),
      actors: Array.from(a).sort(),
      types: Array.from(t).sort(),
      typeStats: stats,
    }
  }, [data])

  // Filter events
  const filtered = useMemo(() => {
    const list = data ?? []
    const needle = normalizeNeedle(q)

    return list.filter((e) => {
      if (sourceFilter !== 'all' && getSource(e) !== sourceFilter) return false
      if (actorFilter !== 'all' && getActor(e) !== actorFilter) return false
      if (typeFilter !== 'all' && getType(e) !== typeFilter) return false

      if (!needle) return true

      const metaText = metaToPrettyText(e.meta)
      const hay = `${e.source} ${getActor(e)} ${getType(e)} ${e.message} ${metaText}`
      return includesNeedle(hay, needle)
    })
  }, [data, sourceFilter, actorFilter, typeFilter, q])

  // Group or flatten
  const grouped = useMemo(() => {
    if (groupDuplicates) {
      return groupConsecutiveEvents(filtered)
    }
    return filtered.map((e) => ({
      id: e.id,
      events: [e],
      count: 1,
      first: e,
      expanded: false,
    }))
  }, [filtered, groupDuplicates])

  // Calculate stats
  const stats = useMemo(() => {
    const totalEvents = data?.length ?? 0
    const filteredCount = filtered.length
    const groupCount = grouped.length
    const typeBreakdown = typeStats

    return {
      totalEvents,
      filteredCount,
      groupCount,
      typeBreakdown,
    }
  }, [data, filtered, grouped, typeStats])

  // Toggle group expansion
  const toggleExpanded = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Activity</h2>
            <p className="muted">Real-time event stream with intelligent filtering and grouping (poll: 5s)</p>
          </div>

          {/* Filter Bar */}
          <div className="activity-filter-bar">
            <div className="filter-row">
              <label className="filter-field">
                <span className="filter-label">Source</span>
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                  <option value="all">All</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span className="filter-label">Actor</span>
                <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
                  <option value="all">All</option>
                  {actors.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span className="filter-label">Type</span>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span className="filter-label">Search</span>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="message, meta, source…"
                />
              </label>

              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={groupDuplicates}
                  onChange={(e) => setGroupDuplicates(e.target.checked)}
                />
                <span>Group Duplicates</span>
              </label>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="activity-stats-bar">
            <div className="stat-item">
              <span className="stat-label">Groups</span>
              <span className="stat-value">{stats.groupCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Events</span>
              <span className="stat-value">{stats.filteredCount}/{stats.totalEvents}</span>
            </div>

            {/* Type breakdown with colored dots */}
            {Object.entries(stats.typeBreakdown).length > 0 && (
              <div className="stat-breakdown">
                <span className="stat-label">Types:</span>
                <div className="type-dots">
                  {Object.entries(stats.typeBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([type, count]) => (
                      <div key={type} className="type-dot" title={`${type}: ${count}`}>
                        <span
                          className="dot"
                          style={{ backgroundColor: getTypeColor(type) }}
                        />
                        <span className="count">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Status indicator */}
            <div className="stat-status">
              {refreshing ? (
                <span className="muted">refreshing…</span>
              ) : lastSuccessAt ? (
                <span className="muted">
                  last: {new Date(lastSuccessAt).toLocaleTimeString()}
                </span>
              ) : null}
            </div>
          </div>

          {error && <Alert variant="destructive">{error.message}</Alert>}
        </div>

        {/* Activity Feed */}
        <div className="activity-feed">
          {grouped.length === 0 && !loading && (
            <div className="activity-empty">
              <div className="muted">No events match your filters.</div>
            </div>
          )}

          {grouped.map((group) => {
            const isExpanded = expandedGroupIds.has(group.id)
            const showRepeatBadge = group.count > 1

            return (
              <div
                key={group.id}
                className={`activity-group ${isExpanded ? 'expanded' : ''}`}
                style={{
                  animation: 'fadeIn 0.2s ease-in',
                }}
              >
                {/* Group Header / Event Row */}
                <div
                  className="activity-event-row"
                  onClick={() => showRepeatBadge && toggleExpanded(group.id)}
                  style={{ cursor: showRepeatBadge ? 'pointer' : 'default' }}
                >
                  <div className="event-icon">
                    <span>{getLevelIcon(group.first.level)}</span>
                  </div>

                  <div className="event-content">
                    <div className="event-header">
                      <span className="event-type">{getType(group.first) || 'event'}</span>
                      {getActor(group.first) && (
                        <span className="event-actor">{getActor(group.first)}</span>
                      )}
                      <span className="event-time">
                        {new Date(group.first.at).toLocaleTimeString()}
                      </span>
                      {showRepeatBadge && (
                        <span className="repeat-badge">{group.count}×</span>
                      )}
                    </div>
                    <div className="event-message">{group.first.message}</div>
                  </div>

                  <div className="event-actions">
                    {showRepeatBadge && (
                      <button
                        className="expand-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(group.id)
                        }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                    <CopyButton
                      label="Copy"
                      text={`${group.first.at} ${group.first.source} ${group.first.level}\n${group.first.message}${
                        group.first.meta ? `\n\n${metaToPrettyText(group.first.meta)}` : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    className="activity-expanded"
                    style={{
                      animation: 'fadeIn 0.2s ease-in',
                    }}
                  >
                    <div className="expanded-header">
                      <h4>Occurrences ({group.count})</h4>
                    </div>

                    {group.events.map((e, idx) => (
                      <div key={`${e.id}-${idx}`} className="expanded-event">
                        <div className="exp-time">{new Date(e.at).toLocaleTimeString()}</div>
                        <div className="exp-meta">
                          <span>Source: {e.source}</span>
                          <span>Type: {getType(e) || '—'}</span>
                          <span>Severity: {getSeverity(e)}</span>
                        </div>
                        <div className="exp-message">{e.message}</div>

                        {e.meta && Object.keys(e.meta).length > 0 && (
                          <details className="exp-details">
                            <summary className="muted">Meta</summary>
                            <pre className="code">{metaToPrettyText(e.meta)}</pre>
                          </details>
                        )}

                        <div className="exp-actions">
                          <CopyButton
                            label="Copy JSON"
                            text={JSON.stringify({ ...e, meta: e.meta ?? {} }, null, 2)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
