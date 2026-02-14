import type { Agent, AgentTask, Notification } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787/api'

// Mock data for development
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'TARS',
    emoji: '🤖',
    role: 'Lead Engineer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 3,
    tags: ['backend', 'devops'],
  },
  {
    id: 'agent-2',
    name: 'Astra',
    emoji: '✨',
    role: 'Frontend Engineer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 2,
    tags: ['frontend', 'ui/ux'],
  },
  {
    id: 'agent-3',
    name: 'Luna',
    emoji: '🌙',
    role: 'QA Engineer',
    status: 'busy',
    lastSeenAt: new Date().toISOString(),
    workload: 5,
    tags: ['testing', 'qa'],
  },
]

const getMockTasks = (): AgentTask[] => [
  {
    id: 'task-1',
    title: 'Implement Kanban board UI',
    description: 'Build drag-and-drop Kanban board with 5 columns',
    status: 'development',
    priority: 'P0',
    assigneeId: 'agent-1',
    assignee: mockAgents[0],
    estimatedHours: 8,
    actualHours: 4,
    tags: ['frontend', 'ui'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    commentCount: 2,
  },
  {
    id: 'task-2',
    title: 'Set up API endpoints',
    description: 'Create REST API for task management',
    status: 'review',
    priority: 'P0',
    assigneeId: 'agent-1',
    assignee: mockAgents[0],
    estimatedHours: 6,
    actualHours: 5.5,
    tags: ['backend', 'api'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    commentCount: 1,
  },
  {
    id: 'task-3',
    title: 'Style component library',
    description: 'Update Tailwind config and create reusable components',
    status: 'queued',
    priority: 'P1',
    estimatedHours: 12,
    tags: ['frontend', 'design'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    title: 'Write integration tests',
    description: 'Add tests for task assignment and status updates',
    status: 'blocked',
    priority: 'P1',
    assigneeId: 'agent-3',
    assignee: mockAgents[2],
    estimatedHours: 10,
    actualHours: 2,
    tags: ['testing', 'qa'],
    blockedBy: ['task-2'],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    commentCount: 0,
  },
  {
    id: 'task-5',
    title: 'Deploy to staging',
    description: 'Build and deploy UI to staging environment',
    status: 'done',
    priority: 'P2',
    assigneeId: 'agent-2',
    assignee: mockAgents[1],
    estimatedHours: 4,
    actualHours: 3.5,
    tags: ['devops', 'deployment'],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    commentCount: 1,
  },
]

// ---- Agents ----
export async function fetchAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(`${API_BASE}/agents`)
    if (!res.ok) throw new Error('Failed to fetch agents')
    return res.json()
  } catch (_err) {
    // Return mock data if API is unavailable
    return mockAgents
  }
}

export async function fetchAgent(id: string): Promise<Agent> {
  const res = await fetch(`${API_BASE}/agents/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch agent ${id}: ${res.statusText}`)
  return res.json()
}

export async function getAgentNotifications(agentId: string): Promise<Notification[]> {
  const res = await fetch(`${API_BASE}/agents/${agentId}/notifications`)
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`)
  return res.json()
}

// ---- Tasks ----
export async function fetchTasks(params?: { assigneeId?: string; status?: string; priority?: string }): Promise<AgentTask[]> {
  try {
    const url = new URL(`${API_BASE}/tasks`)
    if (params?.assigneeId) url.searchParams.set('assigneeId', params.assigneeId)
    if (params?.status) url.searchParams.set('status', params.status)
    if (params?.priority) url.searchParams.set('priority', params.priority)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error('Failed to fetch tasks')
    return res.json()
  } catch (_err) {
    // Return mock data if API is unavailable
    let tasks = getMockTasks()
    if (params?.assigneeId) {
      tasks = tasks.filter((t) => t.assigneeId === params.assigneeId)
    }
    if (params?.status) {
      tasks = tasks.filter((t) => t.status === params.status)
    }
    if (params?.priority) {
      tasks = tasks.filter((t) => t.priority === params.priority)
    }
    return tasks
  }
}

export async function fetchTask(id: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch task ${id}: ${res.statusText}`)
  return res.json()
}

export async function createTask(data: Partial<AgentTask>): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to create task: ${res.statusText}`)
  return res.json()
}

export async function updateTask(id: string, data: Partial<AgentTask>): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to update task: ${res.statusText}`)
  return res.json()
}

export async function updateTaskStatus(id: string, status: AgentTask['status']): Promise<AgentTask> {
  return updateTask(id, { status })
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete task: ${res.statusText}`)
  return res.json()
}

export async function assignTask(id: string, agentId: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${id}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  })
  if (!res.ok) throw new Error(`Failed to assign task: ${res.statusText}`)
  return res.json()
}

export async function autoAssignTask(id: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${id}/auto-assign`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to auto-assign task: ${res.statusText}`)
  return res.json()
}

// ---- Comments ----
export async function addComment(taskId: string, agentId: string, text: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, text }),
  })
  if (!res.ok) throw new Error(`Failed to add comment: ${res.statusText}`)
  return res.json()
}

// ---- Time Tracking ----
export async function logTime(taskId: string, agentId: string, hours: number, note?: string): Promise<AgentTask> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, hours, note }),
  })
  if (!res.ok) throw new Error(`Failed to log time: ${res.statusText}`)
  return res.json()
}

export async function addTimeLog(taskId: string, hours: number, note: string): Promise<AgentTask> {
  // Use current user's agent ID (in a real app, would get from auth context)
  const agentId = localStorage.getItem('currentAgentId') || 'agent-1'
  return logTime(taskId, agentId, hours, note)
}
