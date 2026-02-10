import { useCallback } from 'react'
import type { Adapter } from '../adapters/adapter'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'

export function Projects({ adapter }: { adapter: Adapter }) {
  const fn = useCallback(() => adapter.listProjects(), [adapter])
  const { data, error, loading } = usePoll(fn, 10_000)

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Projects</h2>
            <p className="muted">Detected projects in the local OpenClaw workspace (bridge) or mock list.</p>
          </div>
          <div className="right muted">poll: 10s</div>
        </div>

        {error && <div className="callout warn">{error.message}</div>}

        <div className="table-like">
          {(data ?? []).map((p) => (
            <div className="row" key={p.id}>
              <div className="row-main">
                <div className="row-title">
                  <strong>{p.name}</strong> <Badge kind={p.status} />
                </div>
                <div className="muted">{p.path}</div>
                {p.notes && <div className="muted">{p.notes}</div>}
              </div>
              <div className="row-side">
                <div className="muted">{p.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleString() : '—'}</div>
              </div>
            </div>
          ))}
          {!loading && (data?.length ?? 0) === 0 && <div className="muted">No projects reported.</div>}
        </div>
      </section>
    </main>
  )
}
