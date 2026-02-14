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

function getSeverity(e: ActivityEvent): Severity {
  const m = getMeta(e)
  const raw = safeString(m.severity)
  if (raw === 'High' || raw === 'Medium' || raw === 'Low') return raw
  // Fallback: treat event level as a coarse severity.
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

  // 1) explicit timeline array
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

  // 2) common timestamp keys (meta-driven)
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
    // avoid duplicating if timeline already has this timestamp
    if (items.some((it) => it.at === at)) continue
    items.push({ label, at })
  }

  // 3) ensure base event time is present
  if (!items.some((it) => it.at === e.at)) items.unshift({ label: 'at', at: e.at })

  // Sort ascending when possible.
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

export function Activity({ adapter }: { adapter: Adapter }) {
  const [level, setLevel] = useState<ActivityLevel | 'all'>('all')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [actor, setActor] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fn = useCallback(() => adapter.listActivity(250), [adapter])
  const { data, error, loading, refreshing, lastSuccessAt } = usePoll(fn, 5000)

  const { actors, types } = useMemo(() => {
    const list = data ?? []
    const a = new Set<string>()
    const t = new Set<string>()
    for (const e of list) {
      const actor = getActor(e)
      const type = getType(e)
      if (actor) a.add(actor)
      if (type) t.add(type)
    }
    return {
      actors: Array.from(a).sort((x, y) => x.localeCompare(y)),
      types: Array.from(t).sort((x, y) => x.localeCompare(y)),
    }
  }, [data])

  const filtered = useMemo(() => {
    const list = data ?? []
    const needle = normalizeNeedle(q)
    return list.filter((e) => {
      if (level !== 'all' && e.level !== level) return false
      if (severity !== 'all' && getSeverity(e) !== severity) return false
      if (actor !== 'all' && getActor(e) !== actor) return false
      if (type !== 'all' && getType(e) !== type) return false
      if (!needle) return true

      const metaText = metaToPrettyText(e.meta)
      const hay = `${e.source} ${getActor(e)} ${getType(e)} ${getSeverity(e)} ${e.message} ${metaText}`
      return includesNeedle(hay, needle)
    })
  }, [data, level, severity, actor, type, q])

  const effectiveSelectedId = useMemo(() => {
    if (selectedId && (data ?? []).some((e) => e.id === selectedId)) return selectedId
    return filtered[0]?.id ?? null
  }, [data, filtered, selectedId])

  const selected = useMemo(() => {
    if (!effectiveSelectedId) return null
    return (data ?? []).find((e) => e.id === effectiveSelectedId) ?? null
  }, [data, effectiveSelectedId])

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Activity</h2>
            <p className="muted">
              Click an event for drill-down. Filters support actor/type/severity. (poll: 5s)
            </p>
          </div>
          <div className="right">
            <div className="muted" style={{ textAlign: 'right', marginBottom: 6 }}>
              {refreshing ? 'refreshing…' : lastSuccessAt ? `last ok: ${new Date(lastSuccessAt).toLocaleTimeString()}` : ''}
            </div>
            <div className="stack-h">
              <label className="field inline">
                <span className="muted">level</span>
                <select value={level} onChange={(e) => setLevel(e.target.value as ActivityLevel | 'all')}>
                  <option value="all">all</option>
                  {levels.map((l) => (
                    <option value={l} key={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="muted">severity</span>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | 'all')}>
                  <option value="all">all</option>
                  {severities.map((s) => (
                    <option value={s} key={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="muted">actor</span>
                <select value={actor} onChange={(e) => setActor(e.target.value)}>
                  <option value="all">all</option>
                  {actors.map((a) => (
                    <option value={a} key={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="muted">type</span>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="all">all</option>
                  {types.map((t) => (
                    <option value={t} key={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <span className="muted">search</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="source, message, meta…" />
              </label>
            </div>
          </div>
        </div>

        {error && <Alert variant="destructive">{error.message}</Alert>}

        <div className="activity-split">
          <div className="activity-list">
            <div className="muted" style={{ marginBottom: 8 }}>
              showing {filtered.length} / {(data ?? []).length}
            </div>

            <div className="feed-grid feed-grid-single">
              {filtered.map((e) => {
                const metaText = e.meta ? JSON.stringify(e.meta, null, 2) : ''
                const actor = getActor(e)
                const type = getType(e)
                const sev = getSeverity(e)
                const selected = e.id === effectiveSelectedId
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    className={`feed-item feed-tile ${e.level}${selected ? ' selected' : ''}`}
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') setSelectedId(e.id)
                    }}
                  >
                    <div className="feed-head">
                      <Badge kind={e.level} />
                      <span className="feed-source">{e.source}</span>
                      {type ? <span className="pill tiny">{type}</span> : null}
                      {actor ? <span className="pill tiny">{actor}</span> : null}
                      <span className={`pill tiny sev-${sev.toLowerCase()}`}>{sev}</span>
                      <span className="muted">· {new Date(e.at).toLocaleString()}</span>
                      <span className="right">
                        <CopyButton
                          text={`${e.at} ${e.source} ${e.level}\n${e.message}${metaText ? `\n\n${metaText}` : ''}`}
                          label="Copy"
                        />
                      </span>
                    </div>
                    <div className="feed-msg">{e.message}</div>
                  </div>
                )
              })}
              {!loading && filtered.length === 0 && <div className="muted">No events match filters.</div>}
            </div>
          </div>

          <aside className="activity-detail">
            {!selected && <div className="muted">Select an event to view details.</div>}
            {selected && (
              <div className="activity-detail-inner">
                <div className="activity-detail-head">
                  <div>
                    <div className="stack-h" style={{ alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <Badge kind={selected.level} />
                      <h3 style={{ margin: 0 }}>{selected.source}</h3>
                    </div>
                    <div className="muted">{new Date(selected.at).toLocaleString()}</div>
                  </div>
                  <div className="right">
                    <CopyButton
                      label="Copy full"
                      text={`${selected.at} ${selected.source} ${selected.level}\n${selected.message}${selected.meta ? `\n\n${metaToPrettyText(selected.meta)}` : ''}`}
                    />
                  </div>
                </div>

                <div className="activity-detail-msg">{selected.message}</div>

                <div className="activity-kv">
                  <div className="kv">
                    <div className="muted">actor</div>
                    <div>{getActor(selected) || <span className="muted">—</span>}</div>
                  </div>
                  <div className="kv">
                    <div className="muted">type</div>
                    <div>{getType(selected) || <span className="muted">—</span>}</div>
                  </div>
                  <div className="kv">
                    <div className="muted">severity</div>
                    <div>{getSeverity(selected)}</div>
                  </div>
                  <div className="kv">
                    <div className="muted">id</div>
                    <div className="mono">{selected.id}</div>
                  </div>
                </div>

                <details className="activity-timeline" open>
                  <summary className="muted">timeline</summary>
                  <div className="timeline">
                    {extractTimeline(selected).map((it) => (
                      <div className="timeline-row" key={`${it.label}-${it.at}`}>
                        <div className="timeline-label">{it.label}</div>
                        <div className="timeline-at">{new Date(it.at).toLocaleString()}</div>
                        <div className="timeline-note muted">{it.note ?? ''}</div>
                      </div>
                    ))}
                  </div>
                </details>

                <details className="activity-meta" open={!!selected.meta}>
                  <summary className="muted">meta / details</summary>
                  {selected.meta ? <pre className="code">{metaToPrettyText(selected.meta)}</pre> : <div className="muted">—</div>}
                </details>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}
