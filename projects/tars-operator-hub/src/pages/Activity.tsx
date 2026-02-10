import { useCallback, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { ActivityLevel } from '../types'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'

const levels: ActivityLevel[] = ['info', 'warn', 'error']

export function Activity({ adapter }: { adapter: Adapter }) {
  const [level, setLevel] = useState<ActivityLevel | 'all'>('all')
  const [q, setQ] = useState('')

  const fn = useCallback(() => adapter.listActivity(200), [adapter])
  const { data, error, loading } = usePoll(fn, 5000)

  const filtered = useMemo(() => {
    const list = data ?? []
    const needle = q.trim().toLowerCase()
    return list.filter((e) => {
      if (level !== 'all' && e.level !== level) return false
      if (!needle) return true
      return `${e.source} ${e.message}`.toLowerCase().includes(needle)
    })
  }, [data, level, q])

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Activity</h2>
            <p className="muted">Clear feed of recent events (poll: 5s). Use filters to isolate issues.</p>
          </div>
          <div className="right">
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
                <span className="muted">search</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="source or message" />
              </label>
            </div>
          </div>
        </div>

        {error && <div className="callout warn">{error.message}</div>}

        <div className="feed-grid">
          {filtered.map((e) => {
            const metaText = e.meta ? JSON.stringify(e.meta, null, 2) : ''
            return (
              <div className={`feed-item ${e.level}`} key={e.id}>
                <div className="feed-head">
                  <Badge kind={e.level} />
                  <span className="feed-source">{e.source}</span>
                  <span className="muted">· {new Date(e.at).toLocaleString()}</span>
                  <span className="right">
                    <CopyButton text={`${e.at} ${e.source} ${e.level}\n${e.message}${metaText ? `\n\n${metaText}` : ''}`} label="Copy" />
                  </span>
                </div>
                <div className="feed-msg">{e.message}</div>
                {e.meta && (
                  <details className="feed-meta">
                    <summary className="muted">details</summary>
                    <pre className="code">{metaText}</pre>
                  </details>
                )}
              </div>
            )
          })}
          {!loading && filtered.length === 0 && <div className="muted">No events match filters.</div>}
        </div>
      </section>
    </main>
  )
}
