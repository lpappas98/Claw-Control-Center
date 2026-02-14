import { useState, useEffect } from 'react'
import type { AgentTask, Agent } from '../types'
import { KanbanBoard } from '../components/KanbanBoard'
import { TaskDetailModal } from '../components/TaskDetailModal'
import * as api from '../services/api'
import { usePoll } from '../lib/usePoll'

interface KanbanPageProps {
  selectedAgentId?: string | null
}

export function KanbanPage({ selectedAgentId }: KanbanPageProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch agents
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await api.fetchAgents()
        setAgents(data)
      } catch (err) {
        console.error('Failed to load agents:', err)
      }
    }
    loadAgents()
  }, [])

  // Fetch tasks with polling
  const loadTasks = async () => {
    try {
      setError(null)
      const data = await api.fetchTasks()
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  // Poll tasks every 5 seconds
  usePoll(loadTasks, 5000)

  const handleTaskUpdated = (updated: AgentTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    )
    setSelectedTask(updated)
  }

  const handleTaskDeleted = () => {
    setSelectedTask(null)
  }

  return (
    <main className="main-grid">
      <div className="panel span-4" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Kanban Board</h2>
            <div className="muted" style={{ marginTop: 4 }}>Manage tasks across workflow stages</div>
          </div>
          <button className="btn" type="button" onClick={() => alert('(wireframe) Create new task')}>
            + New Task
          </button>
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: 12, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
            Loading tasks...
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks}
            onTaskClick={setSelectedTask}
            onTaskUpdated={handleTaskUpdated}
            filteredByAgentId={selectedAgentId}
          />
        )}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          agents={agents}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </main>
  )
}
