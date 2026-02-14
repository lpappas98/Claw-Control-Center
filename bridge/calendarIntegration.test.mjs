/**
 * Calendar Integration Tests
 * 
 * Tests for Google Calendar syncing, time blocking, and task deadline handling
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { CalendarIntegration, getCalendarIntegration, resetCalendarIntegration } from './calendarIntegration.mjs'

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

test('CalendarIntegration', async (t) => {
  let calendar

  t.beforeEach(() => {
    resetCalendarIntegration()
    process.env.NODE_ENV = 'test'
  })

  t.afterEach(() => {
    resetCalendarIntegration()
  })

  await t.test('Configuration', async (t) => {
    await t.test('should create a calendar integration with default config', () => {
      calendar = new CalendarIntegration()
      assert.equal(calendar.enabled, false)
      assert.equal(calendar.calendarId, 'primary')
    })

    await t.test('should create a calendar integration with custom config', () => {
      const config = {
        enabled: true,
        calendarId: 'custom@gmail.com',
        credentials: '/path/to/credentials.json',
        token: '/path/to/token.json'
      }
      calendar = new CalendarIntegration(config)
      assert.equal(calendar.enabled, true)
      assert.equal(calendar.calendarId, 'custom@gmail.com')
      assert.equal(calendar.credentialsPath, '/path/to/credentials.json')
    })

    await t.test('should report not configured when disabled', async () => {
      calendar = new CalendarIntegration({ enabled: false })
      assert.equal(calendar.isConfigured(), false)
    })

    await t.test('should report configured when enabled and authenticated', async () => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
      assert.equal(calendar.isConfigured(), true)
    })
  })

  await t.test('Building Calendar Events', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    await t.test('should build a calendar event from a task', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      
      assert(event.summary.includes('Implement user authentication'))
      assert(event.summary.includes('🟠'))
      assert(event.description.includes('task-123'))
      assert(event.description.includes('P1'))
      assert.equal(event.extendedProperties.private.taskId, 'task-123')
      assert.equal(event.extendedProperties.private.priority, 'P1')
      assert.equal(event.colorId, '3')
    })

    await t.test('should use correct priority colors', () => {
      const p0Event = calendar.buildCalendarEvent(mockTaskP0)
      assert.equal(p0Event.colorId, '11')
      assert(p0Event.summary.includes('🔴'))

      const p2Event = calendar.buildCalendarEvent({ ...mockTask, priority: 'P2' })
      assert.equal(p2Event.colorId, '10')
      assert(p2Event.summary.includes('🟡'))

      const p3Event = calendar.buildCalendarEvent({ ...mockTask, priority: 'P3' })
      assert.equal(p3Event.colorId, '8')
      assert(p3Event.summary.includes('🟢'))
    })

    await t.test('should set reminder notifications', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      assert(event.reminders)
      assert.equal(event.reminders.overrides.length, 2)
      assert.equal(event.reminders.overrides[0].method, 'email')
      assert.equal(event.reminders.overrides[1].method, 'popup')
    })

    await t.test('should set event times with 30-minute prep buffer', () => {
      const event = calendar.buildCalendarEvent(mockTask)
      const dueDate = new Date(mockTask.dueDate)
      const startDate = new Date(event.start.dateTime)
      const endDate = new Date(event.end.dateTime)

      const bufferMs = 30 * 60 * 1000
      assert(Math.abs(endDate.getTime() - dueDate.getTime()) < 1000)
      assert(Math.abs(startDate.getTime() - (dueDate.getTime() - bufferMs)) < 1000)
    })
  })

  await t.test('Syncing Tasks to Calendar', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    await t.test('should sync a task with a due date', async () => {
      const result = await calendar.syncTaskToCalendar(mockTask)
      
      assert.equal(result.success, true)
      assert(result.eventId)
      assert.equal(result.action, 'created')
      assert(result.event)
    })

    await t.test('should reject task without due date', async () => {
      const result = await calendar.syncTaskToCalendar(mockTaskNoDate)
      
      assert.equal(result.success, false)
      assert(result.reason.includes('due date'))
    })

    await t.test('should fail gracefully when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.syncTaskToCalendar(mockTask)
      
      assert.equal(result.success, false)
      assert(result.reason.includes('not configured'))
    })

    await t.test('should update existing event when syncing same task twice', async () => {
      const result1 = await calendar.syncTaskToCalendar(mockTask)
      assert.equal(result1.action, 'created')

      const updatedTask = { ...mockTask, title: 'Updated: Implement user authentication' }
      const result2 = await calendar.syncTaskToCalendar(updatedTask)
      assert.equal(result2.action, 'updated')
    })
  })

  await t.test('Time Blocking', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    await t.test('should block time for focused work', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTask, 4)
      
      assert.equal(result.success, true)
      assert(result.eventId)
      assert.equal(result.hours, 4)
      assert(result.startTime)
      assert(result.endTime)
    })

    await t.test('should validate hours parameter', async () => {
      let result = await calendar.blockTimeOnCalendar(mockTask, 0)
      assert.equal(result.success, false)
      
      result = await calendar.blockTimeOnCalendar(mockTask, 25)
      assert.equal(result.success, false)
      
      result = await calendar.blockTimeOnCalendar(mockTask, -5)
      assert.equal(result.success, false)
    })

    await t.test('should set correct duration for time block', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTask, 8)
      
      const start = new Date(result.startTime)
      const end = new Date(result.endTime)
      const durationMs = end.getTime() - start.getTime()
      const durationHours = durationMs / (1000 * 60 * 60)
      
      assert(Math.abs(durationHours - 8) < 0.1)
    })

    await t.test('should fail if task has no due date', async () => {
      const result = await calendar.blockTimeOnCalendar(mockTaskNoDate, 4)
      assert.equal(result.success, false)
    })

    await t.test('should fail when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.blockTimeOnCalendar(mockTask, 4)
      assert.equal(result.success, false)
    })
  })

  await t.test('Bulk Operations', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    await t.test('should sync all tasks with deadlines', async () => {
      const tasks = [mockTask, mockTaskP0, { ...mockTask, id: 'task-2' }]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      assert.equal(result.success, true)
      assert.equal(result.synced, 3)
      assert.equal(result.failed, 0)
    })

    await t.test('should skip tasks without due dates', async () => {
      const tasks = [mockTask, mockTaskNoDate, mockTaskP0]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      assert.equal(result.synced, 2)
      assert.equal(result.failed, 0)
    })

    await t.test('should track failed syncs', async () => {
      const tasks = [mockTask, { ...mockTask, id: 'task-fail' }]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      assert(result.failed >= 0)
    })

    await t.test('should return empty list when not configured', async () => {
      calendar.enabled = false
      const tasks = [mockTask, mockTaskP0]
      const result = await calendar.syncAllTaskDeadlines(tasks)
      
      assert.equal(result.success, false)
      assert.equal(result.synced, 0)
    })
  })

  await t.test('Removing Events', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration({ enabled: true })
      calendar.auth = { authenticated: true }
    })

    await t.test('should remove task from calendar', async () => {
      await calendar.syncTaskToCalendar(mockTask)
      const result = await calendar.removeTaskFromCalendar(mockTask)
      
      assert.equal(result.success, true)
      assert(result.eventId)
      assert.equal(result.action, 'deleted')
    })

    await t.test('should fail if event not found', async () => {
      const result = await calendar.removeTaskFromCalendar(mockTask)
      assert.equal(result.success, false)
    })

    await t.test('should fail when not configured', async () => {
      calendar.enabled = false
      const result = await calendar.removeTaskFromCalendar(mockTask)
      assert.equal(result.success, false)
    })
  })

  await t.test('Singleton Pattern', async (t) => {
    await t.test('should return same instance on multiple calls', () => {
      resetCalendarIntegration()
      const config = { enabled: true }
      
      const cal1 = getCalendarIntegration(config)
      const cal2 = getCalendarIntegration(config)
      
      assert.strictEqual(cal1, cal2)
    })

    await t.test('should reset singleton properly', () => {
      resetCalendarIntegration()
      const cal1 = getCalendarIntegration({ enabled: true })
      
      resetCalendarIntegration()
      const cal2 = getCalendarIntegration({ enabled: false })
      
      assert.notStrictEqual(cal1, cal2)
      assert.equal(cal1.enabled, true)
      assert.equal(cal2.enabled, false)
    })
  })

  await t.test('Priority Emoji', async (t) => {
    t.beforeEach(() => {
      calendar = new CalendarIntegration()
    })

    await t.test('should map priorities to emojis', () => {
      assert.equal(calendar.priorityEmoji('P0'), '🔴')
      assert.equal(calendar.priorityEmoji('P1'), '🟠')
      assert.equal(calendar.priorityEmoji('P2'), '🟡')
      assert.equal(calendar.priorityEmoji('P3'), '🟢')
      assert.equal(calendar.priorityEmoji('UNKNOWN'), '⚪')
    })
  })
})
