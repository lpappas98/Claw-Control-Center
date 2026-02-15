import { useState, useEffect } from 'react'
import { usePoll } from '../lib/usePoll'

interface ServiceStatus {
  name: string
  status: 'online' | 'offline' | 'unknown'
  uptime?: string
  version?: string
  lastDeployed?: string
  port?: number
  details?: Record<string, string | number>
}

const panel: React.CSSProperties = {
  background: 'rgba(15,23,42,0.45)',
  border: '1px solid rgba(30,41,59,0.55)',
  borderRadius: 14,
  padding: '20px 24px',
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  online: { bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7', dot: '#10b981' },
  offline: { bg: 'rgba(239,68,68,0.12)', text: '#fca5a5', dot: '#ef4444' },
  unknown: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', dot: '#64748b' },
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function SystemStatusPage() {
  const [bridge, setBridge] = useState<ServiceStatus>({ name: 'Bridge API', status: 'unknown', port: 8787 })
  const [ui, setUi] = useState<ServiceStatus>({ name: 'UI Dashboard', status: 'unknown', port: 5173 })
  const [diskInfo, setDiskInfo] = useState<{ used: string; total: string; pct: number } | null>(null)
  const [taskStats, setTaskStats] = useState<Record<string, number>>({})

  const checkBridge = async () => {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) throw new Error('Bridge unreachable')
      const data = await res.json()
      setBridge({
        name: 'Bridge API',
        status: 'online',
        port: 8787,
        uptime: data.uptime ? formatUptime(data.uptime) : undefined,
        version: data.version || '1.0.0',
        lastDeployed: data.startedAt || data.timestamp,
        details: {
          tasks: data.stats?.tasks?.total ?? 0,
          agents: data.stats?.agents?.total ?? 0,
          ...(data.memory ? { heapMB: Math.round(data.memory.heapUsed) } : {}),
        },
      })
    } catch {
      setBridge(prev => ({ ...prev, status: 'offline' }))
    }
  }

  const checkHealth = async () => {
    try {
      const res = await fetch('/health')
      if (res.ok) {
        const data = await res.json()
        if (data.uptime) {
          setBridge(prev => ({
            ...prev,
            status: 'online',
            uptime: formatUptime(data.uptime),
            version: data.version,
            lastDeployed: data.timestamp,
            details: {
              tasks: data.stats?.tasks?.total ?? 0,
              agentsOnline: data.stats?.agents?.online ?? 0,
              agentsTotal: data.stats?.agents?.total ?? 0,
              ...(data.memory ? { heapMB: Math.round(data.memory.heapUsed) } : {}),
              ...(data.system ? { cpus: data.system.cpuCount, freeMemMB: data.system.freeMemory } : {}),
            },
          }))
          if (data.system) {
            const totalGB = (data.system.totalMemory / 1024).toFixed(1)
            const freeGB = (data.system.freeMemory / 1024).toFixed(1)
            const usedGB = ((data.system.totalMemory - data.system.freeMemory) / 1024).toFixed(1)
            setDiskInfo({ used: usedGB, total: totalGB, pct: Math.round(((data.system.totalMemory - data.system.freeMemory) / data.system.totalMemory) * 100) })
          }
        }
      }
    } catch { /* ignore */ }
  }

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) return
      const tasks = await res.json()
      const stats: Record<string, number> = {}
      for (const t of tasks) {
        const lane = t.lane || 'unknown'
        stats[lane] = (stats[lane] || 0) + 1
      }
      setTaskStats(stats)
    } catch { /* ignore */ }
  }

  // UI is always online if this page loads
  useEffect(() => {
    setUi({
      name: 'UI Dashboard',
      status: 'online',
      port: 5173,
      lastDeployed: document.querySelector('meta[name="build-time"]')?.getAttribute('content') || undefined,
    })
  }, [])

  usePoll(checkBridge, 10000)
  usePoll(checkHealth, 10000)
  usePoll(fetchTasks, 15000)

  const services = [bridge, ui]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>System Status</h1>

      {/* Service cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {services.map(svc => {
          const sc = statusColors[svc.status]
          return (
            <div key={svc.name} style={panel}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc.dot, boxShadow: `0 0 8px ${sc.dot}60` }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{svc.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{svc.status}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Port</span>
                  <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{svc.port}</span>
                </div>
                {svc.uptime && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Uptime</span>
                    <span style={{ color: '#94a3b8' }}>{svc.uptime}</span>
                  </div>
                )}
                {svc.version && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#64748b' }}>Version</span>
                    <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{svc.version}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>Last Deployed</span>
                  <span style={{ color: '#94a3b8' }}>
                    {svc.lastDeployed ? timeAgo(svc.lastDeployed) : '—'}
                  </span>
                </div>
                {svc.lastDeployed && (
                  <div style={{ fontSize: 10, color: '#334155', textAlign: 'right' }}>
                    {new Date(svc.lastDeployed).toLocaleString()}
                  </div>
                )}

                {/* Extra details */}
                {svc.details && Object.keys(svc.details).length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(30,41,59,0.4)', paddingTop: 10, marginTop: 4 }}>
                    {Object.entries(svc.details).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                        <span style={{ color: '#475569' }}>{k}</span>
                        <span style={{ color: '#94a3b8' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task overview */}
      {Object.keys(taskStats).length > 0 && (
        <div style={panel}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 14 }}>Task Overview</h2>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {Object.entries(taskStats).sort().map(([lane, count]) => {
              const colors: Record<string, string> = {
                queued: '#64748b', proposed: '#94a3b8', development: '#3b82f6',
                review: '#c084fc', done: '#10b981', blocked: '#f87171',
              }
              return (
                <div key={lane} style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: colors[lane] || '#94a3b8' }}>{count}</div>
                  <div style={{ fontSize: 11, color: '#475569', textTransform: 'capitalize', marginTop: 2 }}>{lane}</div>
                </div>
              )
            })}
            <div style={{ textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>
                {Object.values(taskStats).reduce((a, b) => a + b, 0)}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Memory info */}
      {diskInfo && (
        <div style={{ ...panel, marginTop: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>System Memory</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(30,41,59,0.6)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: diskInfo.pct > 85 ? '#ef4444' : '#3b82f6', width: `${diskInfo.pct}%` }} />
            </div>
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {diskInfo.used} / {diskInfo.total} GB ({diskInfo.pct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
