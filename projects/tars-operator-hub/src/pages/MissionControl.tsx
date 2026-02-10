import { useCallback, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AdapterConfig } from '../lib/adapterState'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'
import { Sparkline } from '../components/Sparkline'
import type { ControlAction, ControlResult, LiveSnapshot } from '../types'

function fmtAgo(iso?: string) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}

function fmtAgeMs(ms?: number) {
  if (ms === undefined || ms === null) return '—'
  if (!Number.isFinite(ms)) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
}

export function MissionControl({
  adapter,
  cfg,
  onCfg,
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
  const status = live.data?.status
  const workers = live.data?.workers
  const blockers = live.data?.blockers
  // watchdog reserved for future integration

  const [controlBusy, setControlBusy] = useState<string | null>(null)
  const [controlResult, setControlResult] = useState<(ControlResult & { kind: string }) | null>(null)

  const controlsEnabled = cfg.kind === 'bridge'

  const workerSummary = useMemo(() => {
    const list = workers ?? []
    const counts = { active: 0, waiting: 0, stale: 0, offline: 0 }
    for (const w of list) counts[w.status] = (counts[w.status] ?? 0) + 1
    return counts
  }, [workers])

  async function run(action: ControlAction) {
    setControlResult(null)
    setControlBusy(action.kind)
    try {
      const res = await adapter.runControl(action)
      setControlResult({ ...res, kind: action.kind })
    } catch (e) {
      setControlResult({ ok: false, message: e instanceof Error ? e.message : String(e), kind: action.kind })
    } finally {
      setControlBusy(null)
    }
  }

  return (
    <main className="main-grid">
      <section className="panel span-3">
        <div className="panel-header">
          <div>
            <h2>Mission Control</h2>
            <p className="muted">Live operator visibility (local mode). Polling every few seconds.</p>
          </div>
          <div className="right" style={{ textAlign: 'right' }}>
            <div className="muted">updated: {status?.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : '—'}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {live.refreshing ? 'refreshing…' : live.lastSuccessAt ? `last ok: ${new Date(live.lastSuccessAt).toLocaleTimeString()}` : ''}
            </div>
          </div>
        </div>

        {live.error && (
          <div className="callout warn">
            <strong>Status adapter error:</strong> {live.error.message}
            {cfg.kind === 'bridge' && (
              <div className="stack-h">
                <CopyButton text={`cd ~/.openclaw/workspace/projects/tars-operator-hub && npm run bridge`} label="Copy bridge start" />
                <button className="btn ghost" type="button" onClick={() => onCfg({ kind: 'mock' })}>
                  Switch to mock
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid-3">
          <div className="stat-card">
            <div className="stat-title">Gateway</div>
            <div className="stat-value">
              <Badge kind={status?.gateway.health ?? 'unknown'} />
            </div>
            <div className="muted">{status?.gateway.summary ?? '—'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Nodes</div>
            <div className="stat-value">
              <Badge kind={status?.nodes.health ?? 'unknown'} />
            </div>
            <div className="muted">
              paired: {status?.nodes.pairedCount ?? 0} · pending: {status?.nodes.pendingCount ?? 0}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Browser Relay</div>
            <div className="stat-value">
              <Badge kind={status?.browserRelay.health ?? 'unknown'} />
            </div>
            <div className="muted">attached tabs: {status?.browserRelay.attachedTabs ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Controls (scaffold)</h3>
        <p className="muted">Bridge-backed controls only. Mock adapter is read-only.</p>
        {!controlsEnabled && <div className="callout warn">Controls disabled: switch Adapter to Bridge.</div>}
        <div className="stack">
          <button className="btn" disabled={!controlsEnabled || !!controlBusy} onClick={() => run({ kind: 'gateway.restart' })} type="button">
            {controlBusy === 'gateway.restart' ? 'Restarting…' : 'Restart gateway'}
          </button>
          <div className="stack-h">
            <button className="btn ghost" disabled={!controlsEnabled || !!controlBusy} onClick={() => run({ kind: 'gateway.start' })} type="button">
              Start
            </button>
            <button className="btn ghost" disabled={!controlsEnabled || !!controlBusy} onClick={() => run({ kind: 'gateway.stop' })} type="button">
              Stop
            </button>
          </div>
          <button className="btn ghost" disabled={!controlsEnabled || !!controlBusy} onClick={() => run({ kind: 'nodes.refresh' })} type="button">
            Refresh nodes
          </button>
          {controlResult && (
            <div className={`callout ${controlResult.ok ? '' : 'warn'}`}>
              <div className="stack-h">
                <strong>{controlResult.ok ? 'OK' : 'FAILED'}:</strong>
                <span>{controlResult.kind}</span>
                <span className="muted">· {controlResult.message}</span>
              </div>
              {controlResult.output && (
                <details>
                  <summary className="muted">output</summary>
                  <pre className="code">{controlResult.output}</pre>
                  <CopyButton text={controlResult.output} label="Copy output" />
                </details>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <h3>Workers</h3>
            <div className="muted">
              active {workerSummary.active} · waiting {workerSummary.waiting} · stale {workerSummary.stale} · offline {workerSummary.offline}
            </div>
          </div>
          <div className="right muted">heartbeat poll: 5s</div>
        </div>

        <div className="table-like">
          {(workers ?? []).map((w) => (
            <div className="row" key={w.slot}>
              <div className="row-main">
                <div className="row-title">
                  <strong>{w.slot}</strong> <Badge kind={w.status} />
                </div>
                <div className="muted">{w.task ?? '—'}</div>
              </div>
              <div className="row-side">
                <div className="muted">last: {fmtAgo(w.lastBeatAt)}</div>
                <Sparkline points={w.beats.slice(0, 24)} />
              </div>
            </div>
          ))}
          {!live.loading && (workers?.length ?? 0) === 0 && <div className="muted">No workers reported.</div>}
        </div>
      </section>

      <section className="panel span-2">
        <div className="panel-header">
          <div>
            <h3>Blockers & Remediation</h3>
            <p className="muted">Detected issues + one-click copy commands.</p>
          </div>
        </div>
        <div className="stack">
          {(blockers ?? []).map((b) => (
            <div className="callout" key={b.id}>
              <div className="stack-h">
                <strong>{b.title}</strong>
                <span className={`pill sev-${b.severity.toLowerCase()}`}>{b.severity}</span>
                <span className="muted">· {new Date(b.detectedAt).toLocaleString()}</span>
              </div>
              {b.details && <div className="muted">{b.details}</div>}
              <div className="stack">
                {b.remediation.map((r) => (
                  <div className="cmd" key={r.label}>
                    <div className="cmd-label">{r.label}</div>
                    <pre className="code">{r.command}</pre>
                    <div className="stack-h">
                      <CopyButton text={r.command} />
                      {r.action && cfg.kind === 'bridge' && (
                        <button className="btn" disabled={!!controlBusy} onClick={() => run(r.action as ControlAction)} type="button">
                          {controlBusy === r.action.kind ? 'Running…' : 'Run'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!live.loading && (blockers?.length ?? 0) === 0 && <div className="muted">No blockers detected.</div>}
        </div>
      </section>

      <section className="panel span-2">
        <h3>Adapter</h3>
        <p className="muted">Switch between local bridge and offline mock data.</p>
        <div className="stack">
          <div className="stack-h">
            <button className={`btn ${cfg.kind === 'bridge' ? '' : 'ghost'}`} type="button" onClick={() => onCfg({ kind: 'bridge', baseUrl: cfg.kind === 'bridge' ? cfg.baseUrl : 'http://localhost:8787' })}>
              Bridge
            </button>
            <button className={`btn ${cfg.kind === 'mock' ? '' : 'ghost'}`} type="button" onClick={() => onCfg({ kind: 'mock' })}>
              Mock
            </button>
          </div>
          {cfg.kind === 'bridge' && (
            <label className="field">
              <div className="muted">Bridge base URL</div>
              <input
                value={cfg.baseUrl}
                onChange={(e) => onCfg({ kind: 'bridge', baseUrl: e.target.value })}
                placeholder="http://localhost:8787"
              />
            </label>
          )}
        </div>
      </section>

      <section className="panel span-2">
        <h3>Quick commands</h3>
        <p className="muted">Copy/paste runbooks.</p>
        <div className="stack">
          <div className="cmd">
            <div className="cmd-label">Restart gateway</div>
            <pre className="code">openclaw gateway restart</pre>
            <CopyButton text="openclaw gateway restart" />
          </div>
          <div className="cmd">
            <div className="cmd-label">Gateway status</div>
            <pre className="code">openclaw gateway status</pre>
            <CopyButton text="openclaw gateway status" />
          </div>
        </div>
      </section>
    </main>
  )
}
