import { useState } from 'react'
import type { Agent, AgentTask } from '../types'
import { AgentTile } from '../components/AgentTile'
import * as api from '../services/api'
import { usePoll } from '../lib/usePoll'

interface AgentsPageProps {
  onSelectAgent?: (agentId: string | null) => void
  selectedAgentId?: string | null
}

export function AgentsPage({ onSelectAgent, selectedAgentId }: AgentsPageProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAgents = async () => {
    try {
      setError(null)
      const data = await api.fetchAgents()
      setAgents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    }
  }

  const loadTasks = async () => {
    try {
      const data = await api.fetchTasks()
      setTasks(data)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Poll agents every 10s
  usePoll(loadAgents, 10000)

  // Poll tasks every 5s
  usePoll(loadTasks, 5000)

  const getAgentCurrentTask = (agentId: string): AgentTask | undefined => {
    return tasks.find((t) => t.assigneeId === agentId && t.status !== 'done')
  }

  return (
    <main className="main-grid">
      <section className="panel span-4" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Agent Dashboard</h2>
            <div className="muted" style={{ marginTop: 4 }}>
              Monitor agent status and workload
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {agents.filter((a) => a.status === 'online').length} online •{' '}
            {agents.length} total
          </div>
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: 12, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
            No agents found. Create one via the API or CLI.
          </div>
        ) : (
          <>
            {/* "All Agents" tile */}
            <div style={{ marginBottom: 16 }}>
              <Button
                type="button"
                onClick={() => onSelectAgent?.(null)}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor:
                    selectedAgentId === null
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(51, 65, 85, 0.5)',
                  border:
                    selectedAgentId === null
                      ? '2px solid #3b82f6'
                      : '1px solid #475569',
                  borderRadius: 8,
                  color: '#e2e8f0',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                All Agents ({agents.length})
              </button>
            </div>

            {/* Agent tiles grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {agents.map((agent) => (
                <Button
                  key={agent.id}
                  type="button"
                  onClick={() => onSelectAgent?.(agent.id)}
                  style={{ all: 'unset', cursor: 'pointer' }}
                >
                  <AgentTile
                    agent={agent}
                    currentTask={getAgentCurrentTask(agent.id)}
                    isSelected={selectedAgentId === agent.id}
                  />
                </button>
              ))}
            </div>

            {/* Agent Details (if selected) */}
            {selectedAgentId && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #475569' }}>
                {(() => {
                  const selected = agents.find((a) => a.id === selectedAgentId)
                  const agentTasks = tasks.filter((t) => t.assigneeId === selectedAgentId)

                  return (
                    <div className="stack" style={{ gap: 16 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>
                          {selected?.emoji} {selected?.name}
                        </h3>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {selected?.role}
                        </div>
                      </div>

                      <div className="grid-3">
                        <div className="stat-card">
                          <div className="stat-title">Status</div>
                          <div className="stat-value" style={{ textTransform: 'capitalize' }}>
                            <strong>{selected?.status}</strong>
                          </div>
                          <div className="muted">online status</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-title">Active tasks</div>
                          <div className="stat-value">
                            <strong>
                              {agentTasks.filter((t) => t.status !== 'done').length}
                            </strong>
                          </div>
                          <div className="muted">in progress</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-title">Completed</div>
                          <div className="stat-value">
                            <strong>
                              {agentTasks.filter((t) => t.status === 'done').length}
                            </strong>
                          </div>
                          <div className="muted">this cycle</div>
                        </div>
                      </div>

                      {agentTasks.length > 0 && (
                        <div className="panel" style={{ padding: 14 }}>
                          <h4 style={{ marginTop: 0, marginBottom: 12 }}>
                            Assigned Tasks
                          </h4>
                          <div className="table-like">
                            {agentTasks.map((task) => (
                              <div
                                key={task.id}
                                className="row"
                                style={{ margin: 0, padding: '8px 0', borderBottom: '1px solid #475569' }}
                              >
                                <div className="row-main">
                                  <div className="row-title">{task.title}</div>
                                  <div className="muted" style={{ fontSize: 12 }}>
                                    {task.status} • {task.priority}
                                  </div>
                                </div>
                                <div className="row-side" style={{ fontSize: 12 }}>
                                  {task.estimatedHours && (
                                    <span className="muted">
                                      {task.estimatedHours}h
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
