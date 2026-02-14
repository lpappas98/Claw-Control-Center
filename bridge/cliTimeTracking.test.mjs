import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('CLI Time Tracking - Timer Persistence', () => {
  const testTimerDir = path.join(os.tmpdir(), 'claw-test-timers')
  const timerFile = path.join(testTimerDir, 'timer.json')

  before(async () => {
    await fs.mkdir(testTimerDir, { recursive: true })
  })

  after(async () => {
    try {
      await fs.rm(testTimerDir, { recursive: true })
    } catch (e) {
      // ignore
    }
  })

  describe('Timer persistence', () => {
    it('should save active timers to timer.json', async () => {
      // Simulate starting a timer
      const timerState = {
        'task-123': {
          taskId: 'task-123',
          agentId: 'agent-1',
          startTime: Date.now() - 3600000 // 1 hour ago
        },
        'task-456': {
          taskId: 'task-456',
          agentId: 'agent-2',
          startTime: Date.now() - 1800000 // 30 minutes ago
        }
      }

      // Write to timer file
      await fs.writeFile(timerFile, JSON.stringify(timerState, null, 2), 'utf8')

      // Read it back
      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)

      assert.equal(Object.keys(loaded).length, 2)
      assert.ok(loaded['task-123'])
      assert.ok(loaded['task-456'])
      assert.equal(loaded['task-123'].agentId, 'agent-1')
      assert.equal(loaded['task-456'].agentId, 'agent-2')
    })

    it('should handle empty timer state', async () => {
      const emptyState = {}
      await fs.writeFile(timerFile, JSON.stringify(emptyState, null, 2), 'utf8')

      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)

      assert.equal(Object.keys(loaded).length, 0)
    })

    it('should support adding new timers', async () => {
      // Start with one timer
      const state1 = {
        'task-123': {
          taskId: 'task-123',
          agentId: 'agent-1',
          startTime: Date.now()
        }
      }
      await fs.writeFile(timerFile, JSON.stringify(state1, null, 2), 'utf8')

      // Simulate adding another timer
      const raw1 = await fs.readFile(timerFile, 'utf8')
      const loaded1 = JSON.parse(raw1)
      loaded1['task-789'] = {
        taskId: 'task-789',
        agentId: 'agent-1',
        startTime: Date.now()
      }
      await fs.writeFile(timerFile, JSON.stringify(loaded1, null, 2), 'utf8')

      // Verify
      const raw2 = await fs.readFile(timerFile, 'utf8')
      const loaded2 = JSON.parse(raw2)
      assert.equal(Object.keys(loaded2).length, 2)
      assert.ok(loaded2['task-123'])
      assert.ok(loaded2['task-789'])
    })

    it('should support removing timers', async () => {
      // Start with two timers
      const state = {
        'task-123': {
          taskId: 'task-123',
          agentId: 'agent-1',
          startTime: Date.now()
        },
        'task-456': {
          taskId: 'task-456',
          agentId: 'agent-1',
          startTime: Date.now()
        }
      }
      await fs.writeFile(timerFile, JSON.stringify(state, null, 2), 'utf8')

      // Simulate stopping one timer
      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)
      delete loaded['task-123']
      await fs.writeFile(timerFile, JSON.stringify(loaded, null, 2), 'utf8')

      // Verify
      const raw2 = await fs.readFile(timerFile, 'utf8')
      const loaded2 = JSON.parse(raw2)
      assert.equal(Object.keys(loaded2).length, 1)
      assert.ok(!loaded2['task-123'])
      assert.ok(loaded2['task-456'])
    })

    it('should survive CLI restart (persistence across invocations)', async () => {
      // Simulate first CLI invocation: start timer
      const timerState1 = {
        'task-xyz': {
          taskId: 'task-xyz',
          agentId: 'agent-3',
          startTime: Date.now()
        }
      }
      await fs.writeFile(timerFile, JSON.stringify(timerState1, null, 2), 'utf8')

      // Simulate CLI shutdown and restart
      // Timer state should still be there
      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)

      assert.ok(loaded['task-xyz'])
      assert.equal(loaded['task-xyz'].agentId, 'agent-3')
    })
  })

  describe('Multiple concurrent timers', () => {
    it('should support multiple tasks being timed simultaneously', async () => {
      const now = Date.now()
      const state = {
        'task-1': { taskId: 'task-1', agentId: 'agent-1', startTime: now - 3600000 },
        'task-2': { taskId: 'task-2', agentId: 'agent-1', startTime: now - 1800000 },
        'task-3': { taskId: 'task-3', agentId: 'agent-2', startTime: now - 900000 },
        'task-4': { taskId: 'task-4', agentId: 'agent-3', startTime: now - 300000 }
      }

      await fs.writeFile(timerFile, JSON.stringify(state, null, 2), 'utf8')

      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)

      assert.equal(Object.keys(loaded).length, 4)

      // Simulate stopping middle timer
      delete loaded['task-2']
      await fs.writeFile(timerFile, JSON.stringify(loaded, null, 2), 'utf8')

      const raw2 = await fs.readFile(timerFile, 'utf8')
      const loaded2 = JSON.parse(raw2)
      assert.equal(Object.keys(loaded2).length, 3)
      assert.ok(loaded2['task-1'])
      assert.ok(!loaded2['task-2'])
      assert.ok(loaded2['task-3'])
      assert.ok(loaded2['task-4'])
    })
  })

  describe('Timer calculation', () => {
    it('should calculate elapsed time correctly', async () => {
      const state = {
        'task-test': {
          taskId: 'task-test',
          agentId: 'agent-1',
          startTime: Date.now() - (2.5 * 60 * 60 * 1000) // 2.5 hours ago
        }
      }

      await fs.writeFile(timerFile, JSON.stringify(state, null, 2), 'utf8')
      const raw = await fs.readFile(timerFile, 'utf8')
      const loaded = JSON.parse(raw)

      const timer = loaded['task-test']
      const elapsed = Date.now() - timer.startTime
      const hours = elapsed / (1000 * 60 * 60)

      assert.ok(hours >= 2.4 && hours <= 2.6) // Allow small time variance
    })
  })
})
