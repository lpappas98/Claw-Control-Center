import { useCallback } from 'react'
import type { Adapter } from '../adapters/adapter'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'

function fmtAgo(iso?: string) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const min = Math.round(ms / 60_000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 48) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

export function Projects({ adapter }: { adapter: Adapter }) {
  const fn = useCallback(() => adapter.listProjects(), [adapter])
  const { data, error, loading, refreshing, lastSuccessAt } = usePoll(fn, 10_000)

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Projects</h2>
            <p className="muted">Detected projects in the local OpenClaw workspace (bridge) or mock list.</p>
          </div>
          <div className="right muted">
            {refreshing ? 'refreshing…' : lastSuccessAt ? `last ok: ${new Date(lastSuccessAt).toLocaleTimeString()}` : ''}
            {' · '}poll: 10s
          </div>
        </div>

        {error && <div className="callout warn">{error.message}</div>}

        <div className="table-like">
          {(data ?? []).map((p) => {
            const cd = `cd ${p.path}`
            const gitBits = [p.git?.branch ? `on ${p.git.branch}` : null, p.git?.dirty ? 'dirty' : null]
              .filter(Boolean)
              .join(' • ')
            const sync =
              p.git && (typeof p.git.ahead === 'number' || typeof p.git.behind === 'number')
                ? `↑${p.git.ahead ?? 0} ↓${p.git.behind ?? 0}`
                : null

            return (
              <div className="row" key={p.id}>
                <div className="row-main">
                  <div className="row-title">
                    <strong>{p.name}</strong> <Badge kind={p.status} />
                  </div>

                  <div className="muted" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{p.path}</span>
                    <CopyButton text={cd} label="Copy cd" />
                  </div>

                  {(p.git || p.node?.hasPackageJson || p.notes) && (
                    <div className="muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {p.git && (
                        <span>
                          git: {gitBits || 'repo'}
                          {sync ? ` (${sync})` : ''}
                          {p.git.lastCommitAt ? ` • last commit ${fmtAgo(p.git.lastCommitAt)}` : ''}
                        </span>
                      )}
                      {p.node?.hasPackageJson && (
                        <span>
                          node: {p.node.packageName ? p.node.packageName : 'package.json'}
                          {p.node.scripts?.length ? ` • scripts: ${p.node.scripts.slice(0, 6).join(', ')}${p.node.scripts.length > 6 ? '…' : ''}` : ''}
                        </span>
                      )}
                      {p.notes && <span>note: {p.notes}</span>}
                    </div>
                  )}
                </div>

                <div className="row-side">
                  <div className="muted" title={p.lastUpdatedAt ?? ''}>
                    {p.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            )
          })}
          {!loading && (data?.length ?? 0) === 0 && <div className="muted">No projects reported.</div>}
        </div>
      </section>
    </main>
  )
}
