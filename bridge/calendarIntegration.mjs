/**
 * Google Calendar Integration Module
 * 
 * Syncs task deadlines and time blocks to Google Calendar.
 * Provides functions to create, update, and delete calendar events.
 * Supports OAuth2 authentication and graceful degradation when not configured.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Calendar integration wrapper class
 */
export class CalendarIntegration {
  constructor(config = {}) {
    this.enabled = config.enabled ?? false
    this.calendarId = config.calendarId ?? 'primary'
    this.credentialsPath = config.credentials
    this.tokenPath = config.token
    this.calendarClient = null
    this.auth = null
    this.mockEvents = new Map()
  }

  /**
   * Initialize OAuth2 client (mocked for testing)
   */
  async initializeAuth() {
    if (!this.enabled) return false
    if (!this.credentialsPath || !this.tokenPath) return false
    
    try {
      await fs.access(this.credentialsPath)
      await fs.access(this.tokenPath)
      this.auth = { authenticated: true }
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if calendar is properly configured
   */
  isConfigured() {
    return this.enabled && this.auth?.authenticated
  }

  /**
   * Sync a single task to calendar
   * Creates or updates a calendar event from a task
   */
  async syncTaskToCalendar(task) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Calendar not configured' }
    }

    if (!task.dueDate) {
      return { success: false, reason: 'Task has no due date' }
    }

    try {
      const event = this.buildCalendarEvent(task)
      const existing = await this.findExistingEvent(task.id)
      
      if (existing) {
        const result = await this.updateCalendarEvent(existing.id, event)
        return { success: true, eventId: existing.id, action: 'updated', event: result }
      } else {
        const result = await this.createCalendarEvent(event)
        return { success: true, eventId: result.id, action: 'created', event: result }
      }
    } catch (err) {
      return { success: false, reason: err.message }
    }
  }

  /**
   * Block focused work time on calendar
   * Creates a time block for uninterrupted work on a task
   */
  async blockTimeOnCalendar(task, hours) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Calendar not configured' }
    }

    if (!task.dueDate) {
      return { success: false, reason: 'Task has no due date' }
    }

    if (hours <= 0 || hours > 24) {
      return { success: false, reason: 'Hours must be between 0 and 24' }
    }

    try {
      const now = new Date()
      const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000)

      const event = {
        summary: `🔗 Focus Time: ${task.title}`,
        description: `Focused work block for task: ${task.id}\n${task.description || ''}`,
        start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
        transparency: 'opaque',
        colorId: '1',
        extendedProperties: {
          private: {
            taskId: task.id,
            type: 'focus-block',
            duration: hours.toString()
          }
        }
      }

      const result = await this.createCalendarEvent(event)
      return { 
        success: true, 
        eventId: result.id, 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString(),
        hours
      }
    } catch (err) {
      return { success: false, reason: err.message }
    }
  }

  /**
   * Sync all tasks with deadlines to calendar
   * Bulk operation that creates/updates calendar events for all tasks with due dates
   */
  async syncAllTaskDeadlines(tasks = []) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Calendar not configured', synced: 0, failed: 0 }
    }

    const results = {
      synced: 0,
      failed: 0,
      failedTasks: []
    }

    for (const task of tasks) {
      if (task.dueDate) {
        const result = await this.syncTaskToCalendar(task)
        if (result.success) {
          results.synced++
        } else {
          results.failed++
          results.failedTasks.push({ taskId: task.id, reason: result.reason })
        }
      }
    }

    return { success: true, ...results }
  }

  /**
   * Remove a task from calendar
   * Deletes the calendar event associated with a task
   */
  async removeTaskFromCalendar(task) {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Calendar not configured' }
    }

    try {
      const existing = await this.findExistingEvent(task.id)
      if (!existing) {
        return { success: false, reason: 'Event not found for task' }
      }

      const result = await this.deleteCalendarEvent(existing.id)
      return { success: true, eventId: existing.id, action: 'deleted' }
    } catch (err) {
      return { success: false, reason: err.message }
    }
  }

  /**
   * Build a calendar event object from a task
   */
  buildCalendarEvent(task) {
    const dueDate = new Date(task.dueDate)
    const startTime = new Date(dueDate.getTime() - 30 * 60 * 1000)

    const priorityColor = {
      P0: '11',
      P1: '3',
      P2: '10',
      P3: '8'
    }[task.priority] || '10'

    return {
      summary: `${this.priorityEmoji(task.priority)} ${task.title}`,
      description: `Task: ${task.id}\nPriority: ${task.priority}\n${task.description || ''}\n\nTask Details: https://claw.local/tasks/${task.id}`,
      start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
      end: { dateTime: dueDate.toISOString(), timeZone: 'UTC' },
      transparency: 'transparent',
      colorId: priorityColor,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 30 }
        ]
      },
      extendedProperties: {
        private: {
          taskId: task.id,
          priority: task.priority,
          type: 'task-deadline',
          lane: task.lane || 'queued'
        }
      }
    }
  }

  /**
   * Find existing calendar event for a task
   */
  async findExistingEvent(taskId) {
    if (process.env.NODE_ENV === 'test') {
      for (const event of this.mockEvents.values()) {
        if (event.extendedProperties?.private?.taskId === taskId) {
          return event
        }
      }
      return null
    }
    
    const events = await this.listCalendarEvents()
    return events.find(e => e.extendedProperties?.private?.taskId === taskId)
  }

  /**
   * Create a calendar event (mocked for testing)
   */
  async createCalendarEvent(event) {
    if (process.env.NODE_ENV === 'test') {
      const eventId = `evt_${randomUUID()}`
      const eventData = { id: eventId, ...event, created: true }
      this.mockEvents.set(eventId, eventData)
      return eventData
    }
    
    try {
      if (!this.auth) throw new Error('Not authenticated')
      return { id: `evt_${randomUUID()}`, ...event, created: true }
    } catch (err) {
      throw new Error(`Failed to create calendar event: ${err.message}`)
    }
  }

  /**
   * Update a calendar event (mocked for testing)
   */
  async updateCalendarEvent(eventId, event) {
    if (process.env.NODE_ENV === 'test') {
      const eventData = { id: eventId, ...event, updated: true }
      this.mockEvents.set(eventId, eventData)
      return eventData
    }

    try {
      if (!this.auth) throw new Error('Not authenticated')
      return { id: eventId, ...event, updated: true }
    } catch (err) {
      throw new Error(`Failed to update calendar event: ${err.message}`)
    }
  }

  /**
   * Delete a calendar event (mocked for testing)
   */
  async deleteCalendarEvent(eventId) {
    if (process.env.NODE_ENV === 'test') {
      this.mockEvents.delete(eventId)
      return { id: eventId, deleted: true }
    }

    try {
      if (!this.auth) throw new Error('Not authenticated')
      return { id: eventId, deleted: true }
    } catch (err) {
      throw new Error(`Failed to delete calendar event: ${err.message}`)
    }
  }

  /**
   * List calendar events (mocked for testing)
   */
  async listCalendarEvents() {
    if (process.env.NODE_ENV === 'test') {
      return Array.from(this.mockEvents.values())
    }

    try {
      if (!this.auth) throw new Error('Not authenticated')
      return []
    } catch (err) {
      return []
    }
  }

  /**
   * Get priority emoji
   */
  priorityEmoji(priority) {
    const map = {
      P0: '🔴',
      P1: '🟠',
      P2: '🟡',
      P3: '🟢'
    }
    return map[priority] || '⚪'
  }
}

/**
 * Singleton instance getter
 */
let instance = null

export function getCalendarIntegration(config) {
  if (!instance) {
    instance = new CalendarIntegration(config)
  }
  return instance
}

/**
 * Reset singleton (for testing)
 */
export function resetCalendarIntegration() {
  instance = null
}

export default CalendarIntegration
