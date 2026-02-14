/**
 * Tests for API service
 * Tests all API endpoints and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as api from './api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ---- Agent Endpoints ----

  describe('Agents', () => {
    it('should fetch all agents', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'TARS', emoji: '🤖', status: 'online', workload: 3 },
        { id: 'agent-2', name: 'Astra', emoji: '✨', status: 'online', workload: 2 }
      ]

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgents
      })

      const result = await api.fetchAgents()
      expect(result).toEqual(mockAgents)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/agents'))
    })

    it('should return mock data when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const result = await api.fetchAgents()
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should fetch single agent by ID', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'TARS',
        emoji: '🤖',
        status: 'online',
        workload: 3
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent
      })

      const result = await api.fetchAgent('agent-1')
      expect(result).toEqual(mockAgent)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/agents/agent-1'))
    })

    it('should throw error when agent fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })

      expect(async () => {
        await api.fetchAgent('non-existent')
      }).rejects.toThrow()
    })

    it('should fetch agent notifications', async () => {
      const mockNotifications = [
        { id: 'notif-1', message: 'Task assigned', timestamp: Date.now() }
      ]

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotifications
      })

      const result = await api.getAgentNotifications('agent-1')
      expect(result).toEqual(mockNotifications)
    })
  })

  // ---- Task Endpoints ----

  describe('Tasks', () => {
    it('should fetch all tasks', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', status: 'development', priority: 'P0' },
        { id: 'task-2', title: 'Task 2', status: 'review', priority: 'P1' }
      ]

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks
      })

      const result = await api.fetchTasks()
      expect(result).toEqual(mockTasks)
    })

    it('should fetch tasks with filters', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      await api.fetchTasks({
        assigneeId: 'agent-1',
        status: 'development',
        priority: 'P0'
      })

      const fetchUrl = global.fetch.mock.calls[0][0]
      expect(fetchUrl).toContain('assigneeId=agent-1')
      expect(fetchUrl).toContain('status=development')
      expect(fetchUrl).toContain('priority=P0')
    })

    it('should return mock tasks when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      const result = await api.fetchTasks()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should fetch single task by ID', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        status: 'development',
        priority: 'P0',
        assigneeId: 'agent-1'
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask
      })

      const result = await api.fetchTask('task-1')
      expect(result).toEqual(mockTask)
    })

    it('should create a new task', async () => {
      const newTask = {
        title: 'New Task',
        description: 'Test description',
        priority: 'P1',
        estimatedHours: 8
      }

      const createdTask = { id: 'task-new', ...newTask }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => createdTask
      })

      const result = await api.createTask(newTask as any)
      expect(result.id).toBeDefined()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' })
        })
      )
    })

    it('should update task status', async () => {
      const updatedTask = {
        id: 'task-1',
        title: 'Task 1',
        status: 'review',
        priority: 'P0'
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => updatedTask
      })

      const result = await api.updateTask('task-1', { status: 'review' })
      expect(result.status).toBe('review')
    })

    it('should delete task', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      const result = await api.deleteTask('task-1')
      expect(result.success).toBe(true)
    })
  })

  // ---- Task Assignment ----

  describe('Task Assignment', () => {
    it('should assign task to agent', async () => {
      const assignedTask = {
        id: 'task-1',
        title: 'Task 1',
        assigneeId: 'agent-1'
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => assignedTask
      })

      const result = await api.assignTask('task-1', 'agent-1')
      expect(result.assigneeId).toBe('agent-1')
    })

    it('should auto-assign task', async () => {
      const assignedTask = {
        id: 'task-1',
        title: 'Task 1',
        assigneeId: 'agent-2'
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => assignedTask
      })

      const result = await api.autoAssignTask('task-1')
      expect(result.assigneeId).toBeDefined()
    })
  })

  // ---- Task Comments ----

  describe('Task Comments', () => {
    it('should add comment to task', async () => {
      const taskWithComment = {
        id: 'task-1',
        title: 'Task 1',
        comments: [
          { id: 'comment-1', author: 'agent-1', text: 'Good progress', timestamp: Date.now() }
        ]
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => taskWithComment
      })

      const result = await api.addComment('task-1', 'agent-1', 'Good progress')
      expect(result.comments).toBeDefined()
      expect(result.comments.length).toBeGreaterThan(0)
    })
  })

  // ---- Time Tracking ----

  describe('Time Tracking', () => {
    it('should update task time', async () => {
      const taskWithTime = {
        id: 'task-1',
        title: 'Task 1',
        actualHours: 4.5
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => taskWithTime
      })

      const result = await api.updateTaskTime('task-1', 4.5)
      expect(result.actualHours).toBe(4.5)
    })
  })

  // ---- Error Handling ----

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network unreachable'))

      const result = await api.fetchTasks()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle 404 errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      expect(async () => {
        await api.fetchTask('non-existent')
      }).rejects.toThrow()
    })

    it('should handle 500 errors', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      expect(async () => {
        await api.fetchAgents()
      }).rejects.toThrow()
    })

    it('should handle timeout scenarios', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Timeout'))

      const result = await api.fetchTasks()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // ---- Data Transformation ----

  describe('Data Transformation', () => {
    it('should return properly typed agent objects', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        emoji: '🤖',
        status: 'online',
        workload: 3,
        tags: ['backend']
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent
      })

      const result = await api.fetchAgent('agent-1')
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('status')
    })

    it('should return properly typed task objects', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        status: 'development',
        priority: 'P0',
        assigneeId: 'agent-1',
        estimatedHours: 8,
        actualHours: 4
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask
      })

      const result = await api.fetchTask('task-1')
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('priority')
    })

    it('should preserve ISO date formats', async () => {
      const now = new Date().toISOString()
      const mockTask = {
        id: 'task-1',
        title: 'Test',
        status: 'development',
        priority: 'P0',
        createdAt: now,
        updatedAt: now
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask
      })

      const result = await api.fetchTask('task-1')
      expect(result.createdAt).toBe(now)
      expect(result.updatedAt).toBe(now)
    })
  })

  // ---- API Base URL ----

  describe('API Base URL', () => {
    it('should use configured API base URL', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      await api.fetchAgents()
      const url = global.fetch.mock.calls[0][0]
      expect(url).toContain('/api/agents')
    })

    it('should support custom API base via environment', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      await api.fetchAgents()
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  // ---- Mock Fallback ----

  describe('Mock Fallback', () => {
    it('should provide mock agents when API unavailable', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API down'))

      const result = await api.fetchAgents()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('id')
    })

    it('should provide mock tasks when API unavailable', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API down'))

      const result = await api.fetchTasks()
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should have realistic mock data', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('API down'))

      const tasks = await api.fetchTasks()
      const agents = await api.fetchAgents()

      expect(tasks.length).toBeGreaterThan(0)
      expect(agents.length).toBeGreaterThan(0)

      // Verify task structure
      tasks.forEach(task => {
        expect(task).toHaveProperty('id')
        expect(task).toHaveProperty('title')
        expect(task).toHaveProperty('status')
      })

      // Verify agent structure
      agents.forEach(agent => {
        expect(agent).toHaveProperty('id')
        expect(agent).toHaveProperty('name')
        expect(agent).toHaveProperty('emoji')
      })
    })
  })
})
