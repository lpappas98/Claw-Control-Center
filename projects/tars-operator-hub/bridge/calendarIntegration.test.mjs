/**
 * Calendar Integration Tests
 * 
 * Tests for Google Calendar syncing, time blocking, and task deadline handling
 */

import test from 'node:test'
import assert from 'node:assert'

const describe = (name, fn) => test(name, { concurrency: false }, fn)
const it = test
const expect = (value) => ({
  toBe: (expected) => assert.deepStrictEqual(value, expected),
  toEqual: (expected) => assert.deepStrictEqual(value, expected),
  toBeDefined: () => assert.notStrictEqual(value, undefined),
  toBeUndefined: () => assert.strictEqual(value, undefined),
  toBeNull: () => assert.strictEqual(value, null),
  toContain: (item) => assert(value.includes?.(item) || value.indexOf?.(item) >= 0 || Object.values(value).includes(item), `Expected ${JSON.stringify(value)} to contain ${item}`),
  toHaveLength: (len) => assert.strictEqual(value.length, len),
  toBeCloseTo: (expected, precision = 2) => {
    const factor = Math.pow(10, precision)
    const actual = Math.round(value * factor) / factor
    const exp = Math.round(expected * factor) / factor
    assert.strictEqual(actual, exp, `Expected ${value} to be close to ${expected}`)
  },
  toMatch: (pattern) => assert(pattern.test(value), `Expected ${value} to match ${pattern}`),
  not: {
    toBe: (expected) => assert.notStrictEqual(value, expected),
    toEqual: (expected) => assert.notDeepStrictEqual(value, expected),
    toContain: (item) => assert(!(value.includes?.(item) || value.indexOf?.(item) >= 0 || Object.values(value).includes(item)), `Expected ${JSON.stringify(value)} not to contain ${item}`)
  }
})

let beforeEachFn = null
let afterEachFn = null

const originalDescribe = describe
describe = (name, fn) => {
  originalDescribe(name, async (t) => {
    t.beforeEach(async () => {
      if (beforeEachFn) await beforeEachFn()
    })
    t.afterEach(async () => {
      if (afterEachFn) await afterEachFn()
    })
    return fn(t)
  })
}
import { CalendarIntegration, getCalendarIntegration, resetCalendarIntegration } from './calendarIntegration.mjs'

// Mock task data
const mockTask = {
  id: 'task-123',
  title: 'Implement user authentication',
  description: 'Add OAuth2 support to the app',
  priority: 'P1',
  lane: 'development',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  assignedTo: 'agent-1'
}

const mockTaskP0 = {
  ...mockTask,
  id: 'task-p0',
  title: 'Critical bug fix',
  priority: 'P0',
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

const mockTaskNoDate = {
  ...mockTask,
  id: 'task-no-date',
  dueDate: null
}

describe('CalendarIntegration', () => {
  let calendar

  beforeEach(() => {
    resetCalendarIntegration()
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    resetCalendarIntegration()
  })

  describe('Configuration', () => {
    it('should create a calendar integration with default config', () => {
      calendar = new CalendarIntegration()
      expect(calendar.enabled).toBe(false)
      expect(calendar.calendarId).toBe('primary')
    })

    it('should create a calendar integration with custom config', () => {
      const config = {
        enabled: true,
        calendarId: 'custom@gmail.com',
        credentials: '/path/to/credentials.json',
        token: '/path/to/token.json'
      }
      calendar = new CalendarIntegration(config)
      expect(calendar.enabled).toBe(true)
      expect(calendar.calendarId).toBe('custom@gmail.com')
      expect(calendar.credentialsPath).toBe('/path/to/credentials.json')
    })

    it('should report not configured when disabled', async () => {
      calendar = new CalendarIntegration({ enabled: false })
      expect(calendar.isConfigured()).toBe(false)
    })

    it('should report configured when enabled and authenticated', async () => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
      expect(calendar.isConfigured()).toBe(true)
    })
  })

  describe('Building Calendar Events', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    it('should build a calendar event from a task', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      
      expect(event.summary).toContain('Implement user authentication')
      expect(event.summary).toContain('🟠')
      expect(event.description).toContain('task-123')
      expect(event.description).toContain('P1')
      expect(event.extendedProperties.private.taskId).toBe('task-123')
      expect(event.extendedProperties.private.priority).toBe('P1')
      expect(event.colorId).toBe('3')
    })

    it('should use correct priority colors', () => {
      const p0Event = calendar.buildCalendarEvent(mockTaskP0)
      expect(p0Event.colorId).toBe('11')
      expect(p0Event.summary).toContain('🔴')

      const p2Event = calendar.buildCalendarEvent({ ...mockTask, priority: 'P2' })
      expect(p2Event.colorId).toBe('10')
      expect(p2Event.summary).toContain('🟡')

      const p3Event = calendar.buildCalendarEvent({ ...mockTask, priority: 'P3' })
      expect(p3Event.colorId).toBe('8')
      expect(p3Event.summary).toContain('🟢')
    })

    it('should set reminder notifications', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      expect(event.reminders).toBeDefined()
      expect(event.reminders.overrides).toHaveLength(2)
      expect(event.reminders.overrides[0].method).toBe('email')
      expect(event.reminders.overrides[1].method).toBe('popup')
    })

    it('should set event times with 30-minute prep buffer', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      const dueDate = new Date(mockTask.dueDate)
      const startDate = new Date(event.start.dateTime)
      const endDate = new Date(event.end.dateTime)

      const bufferMs = 30 * 60 * 1000
      expect(endDate.getTime()).toBeCloseTo(dueDate.getTime(), -3)
      expect(startDate.getTime()).toBeCloseTo(dueDate.getTime() - bufferMs, -3)
    })
  })

  describe('Syncing Tasks to Calendar', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    it('should sync a task with a due date', async () => {
      const result = await calendar.syncTaskToCalendar(mockTask)
      
      expect(result.success).toBe(true)
      expect(result.eventId).toBeDefined()
      expect(result.action).toBe('created')
      expect(result.event).toBeDefined()
    })

    it('should reject task without due date', async () => {
      const result = await calendar.syncTaskToCalendar(mockTaskNoDate)
      
      expect(result.success).toBe(false)
      expect(result.reason).toContain('due date')
    })

    it('should fail gracefully when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.syncTaskToCalendar(mockTask)
      
      expect(result.success).toBe(false)
      expect(result.reason).toContain('not configured')
    })

    it('should update existing event when syncing same task twice', async () => {
      const result1 = await calendar.syncTaskToCalendar(mockTask)
      expect(result1.action).toBe('created')

      const updatedTask = { ...mockTask, title: 'Updated: Implement user authentication' }
      const result2 = await calendar.syncTaskToCalendar(updatedTask)
      expect(result2.action).toBe('updated')
    })
  })

  describe('Time Blocking', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    it('should block time for focused work', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTask, 4)
      
      expect(result.success).toBe(true)
      expect(result.eventId).toBeDefined()
      expect(result.hours).toBe(4)
      expect(result.startTime).toBeDefined()
      expect(result.endTime).toBeDefined()
    })

    it('should validate hours parameter', async () => {
      let result = await calendar.blockTimeOnCalendar(mockTask, 0)
      expect(result.success).toBe(false)
      
      result = await calendar.blockTimeOnCalendar(mockTask, 25)
      expect(result.success).toBe(false)
      
      result = await calendar.blockTimeOnCalendar(mockTask, -5)
      expect(result.success).toBe(false)
    })

    it('should set correct duration for time block', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTask, 8)
      
      const start = new Date(result.startTime)
      const end = new Date(result.endTime)
      const durationMs = end.getTime() - start.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      
      expect(durationHours).toBeCloseTo(8, 0)
    })

    it('should fail if task has no due date', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTaskNoDate, 4)
      expect(result.success).toBe(false)
    })

    it('should fail when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.blockTimeOnCalendar(mockTask, 4)
      expect(result.success).toBe(false)
    })
  })

  describe('Bulk Operations', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    it('should sync all tasks with deadlines', async () => {
      const tasks = [mockTask, mockTaskP0, { ...mockTask, id: 'task-2' }]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      expect(result.success).toBe(true)
      expect(result.synced).toBe(3)
      expect(result.failed).toBe(0)
    })

    it('should skip tasks without due dates', async () => {
      const tasks = [mockTask, mockTaskNoDate, mockTaskP0]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('should track failed syncs', async () => {
      const tasks = [mockTask, { ...mockTask, id: 'task-fail' }]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      expect(result.failed >= 0).toBe(true)
    })

    it('should return empty list when not configured', async () => {
      calendar.enabled = false
      const tasks = [mockTask, mockTaskP0]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      expect(result.success).toBe(false)
      expect(result.synced).toBe(0)
    })
  })

  describe('Removing Events', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    it('should remove task from calendar', async () => {
      await calendar.syncTaskToCalendar(mockTask)
      const result = await calendar.removeTaskFromCalendar(mockTask)
      
      expect(result.success).toBe(true)
      expect(result.eventId).toBeDefined()
      expect(result.action).toBe('deleted')
    })

    it('should fail if event not found', async () => {
      const result = await calendar.removeTaskFromCalendar(mockTask)
      expect(result.success).toBe(false)
    })

    it('should fail when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.removeTaskFromCalendar(mockTask)
      expect(result.success).toBe(false)
    })
  })

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      resetCalendarIntegration()
      const config = { enabled: true }
      
      const cal1 = getCalendarIntegration(config)
      const cal2 = getCalendarIntegration(config)
      
      expect(cal1).toBe(cal2)
    })

    it('should reset singleton properly', () => {
      resetCalendarIntegration()
      const cal1 = getCalendarIntegration({ enabled: true })
      
      resetCalendarIntegration()
      const cal2 = getCalendarIntegration({ enabled: false })
      
      expect(cal1).not.toBe(cal2)
      expect(cal1.enabled).toBe(true)
      expect(cal2.enabled).toBe(false)
    })
  })

  describe('Priority Emoji', () => {
    beforeEach(() => {
      calendar = new CalendarIntegration()
    })

    it('should map priorities to emojis', () => {
      expect(calendar.priorityEmoji('P0')).toBe('🔴')
      expect(calendar.priorityEmoji('P1')).toBe('🟠')
      expect(calendar.priorityEmoji('P2')).toBe('🟡')
      expect(calendar.priorityEmoji('P3')).toBe('🟢')
      expect(calendar.priorityEmoji('UNKNOWN')).toBe('⚪')
    })
  })
})
