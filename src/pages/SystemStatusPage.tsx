import { useState } from 'react'
import type { HealthStatus, Agent } from '../types'
import { usePoll } from '../lib/usePoll'
import * as api from '../services/api'

interface HealthResponse {
  status: string
  timestamp: string
  uptime: number
  version: string
  service: string
  stats: {
    tasks: {
      total: number
      byStatus: Record<string, number>
    }
    agents: {
      total: number
      online: number
      offline: number
    }
    errors: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  system: {
    platform: string
    nodeVersion: string
    cpuCount: number
    totalMemory: number
    freeMemory: number
    loadAverage: number[]
  }
  integrations: {
    github: boolean
    telegram: boolean
    googleCalendar: boolean
  }
  readiness: {
    ready: boolean
    checks: Record<string, boolean>
  }
}

export function SystemStatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = async () => {
    try {
      setError(null)
      const response = await fetch('/health')
      if (!response.ok) throw new Error('Failed to fetch health')
      const data = (await response.json()) as HealthResponse
      setHealth(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system status')
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  const loadAgents = async () => {
    try {
      const data = await api.fetchAgents()
      setAgents(data)
    } catch (err) {
      console.error('Failed to load agents:', err)
    }
  }

  // Poll health every 10s
  usePoll(loadHealth, 10000)

  // Poll agents every 10s
  usePoll(loadAgents, 10000)

  const uptime = health?.uptime ?? 0
  const uptimeStr = Math.floor(uptime / 3600)
    + 'h ' + Math.floor((uptime % 3600) / 60)
    + 'm ' + (uptime % 60)
    + 's'

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">System Status</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading && !health && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-gray-600 mt-4">Loading system status...</p>
          </div>
        )}

        {health && (
          <>
            {/* Overall Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Bridge Health */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Bridge Status</h2>
                  <span className="inline-block w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Service</dt>
                    <dd className="text-gray-900 font-mono">{health.service}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Version</dt>
                    <dd className="text-gray-900 font-mono">{health.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Uptime</dt>
                    <dd className="text-gray-900">{uptimeStr}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Last Update</dt>
                    <dd className="text-gray-900 text-xs">{new Date(health.timestamp).toLocaleTimeString()}</dd>
                  </div>
                </dl>
              </div>

              {/* Agent Health */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Agents</h2>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total</dt>
                    <dd className="text-2xl font-bold text-gray-900">{health.stats.agents.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Online</dt>
                    <dd className="text-xl font-bold text-green-600">{health.stats.agents.online}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Offline</dt>
                    <dd className="text-xl font-bold text-gray-400">{health.stats.agents.offline}</dd>
                  </div>
                </dl>
              </div>

              {/* Integration Status */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-600">GitHub</dt>
                    <dd>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          health.integrations.github
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {health.integrations.github ? 'Connected' : 'Disabled'}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-600">Telegram</dt>
                    <dd>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          health.integrations.telegram
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {health.integrations.telegram ? 'Connected' : 'Disabled'}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-600">Google Calendar</dt>
                    <dd>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          health.integrations.googleCalendar
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {health.integrations.googleCalendar ? 'Connected' : 'Disabled'}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Task Stats */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Tasks</p>
                  <p className="text-2xl font-bold text-gray-900">{health.stats.tasks.total}</p>
                </div>
                {Object.entries(health.stats.tasks.byStatus).map(([status, count]) => (
                  <div key={status}>
                    <p className="text-sm text-gray-600 capitalize">{status}</p>
                    <p className="text-2xl font-bold text-blue-600">{count}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Memory & System */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Memory Usage */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Heap Used</dt>
                    <dd className="text-gray-900">{health.memory.heapUsed} MB</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Heap Total</dt>
                    <dd className="text-gray-900">{health.memory.heapTotal} MB</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">External</dt>
                    <dd className="text-gray-900">{health.memory.external} MB</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">RSS</dt>
                    <dd className="text-gray-900">{health.memory.rss} MB</dd>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div
                      className="h-2 bg-blue-200 rounded overflow-hidden"
                      style={{
                        width: '100%',
                      }}
                    >
                      <div
                        className="h-full bg-blue-600"
                        style={{
                          width: `${(health.memory.heapUsed / health.memory.heapTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100)}% of heap used
                    </p>
                  </div>
                </dl>
              </div>

              {/* System Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">System Info</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Platform</dt>
                    <dd className="text-gray-900">{health.system.platform}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Node Version</dt>
                    <dd className="text-gray-900 font-mono text-xs">{health.system.nodeVersion}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">CPU Cores</dt>
                    <dd className="text-gray-900">{health.system.cpuCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total Memory</dt>
                    <dd className="text-gray-900">{health.system.totalMemory} MB</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Free Memory</dt>
                    <dd className="text-gray-900">{health.system.freeMemory} MB</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Load Avg (1m)</dt>
                    <dd className="text-gray-900">{health.system.loadAverage[0].toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Readiness Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Readiness Checks</h2>
              <div className="space-y-2">
                {Object.entries(health.readiness.checks).map(([check, passed]) => (
                  <div key={check} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <dt className="text-gray-600 capitalize">{check}</dt>
                    <dd>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {passed ? 'OK' : 'FAILED'}
                      </span>
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
