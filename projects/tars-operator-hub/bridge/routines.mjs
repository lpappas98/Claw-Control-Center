import fs from 'node:fs/promises'
import path from 'node:path'
import { CronParser } from './cronParser.mjs'

/**
 * Routine (Recurring Task) Data Model
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   schedule: string,           // cron expression
 *   taskTemplate: {
 *     title: string,
 *     description: string,
 *     assignedTo: string,       // agent id or role
 *     tags: string[],
 *     estimatedHours: number
 *   },
 *   enabled: boolean,
 *   lastRun: number,             // timestamp of last execution
 *   nextRun: number,             // timestamp of next scheduled execution
 *   createdAt: number,
 *   updatedAt: number
 * }
 */

export class RoutinesStore {
  constructor(filePath = '.clawhub/routines.json') {
    this.filePath = filePath
    this.routines = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.routines = Array.isArray(data) ? data : data?.routines || []
      this.loaded = true
    } catch {
      this.routines = []
      this.loaded = true
    }
    return this.routines
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.routines, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  makeId() {
    return `routine-${Math.random().toString(16).slice(2)}-${Date.now()}`
  }

  /**
   * Validate cron expression
   * @throws {Error} if invalid
   */
  validateSchedule(schedule) {
    CronParser.parse(schedule)
  }

  /**
   * Calculate nextRun from cron schedule
   * @returns {number} timestamp
   */
  calculateNextRun(schedule, fromTime = null) {
    const nextDate = CronParser.nextRun(schedule, fromTime)
    return nextDate.getTime()
  }

  /**
   * Create a new routine
   */
  async createRoutine(data) {
    await this.ensureLoaded()

    this.validateSchedule(data.schedule)

    const now = Date.now()
    const routine = {
      id: this.makeId(),
      name: data.name || '',
      description: data.description || '',
      schedule: data.schedule,
      taskTemplate: {
        title: data.taskTemplate?.title || '',
        description: data.taskTemplate?.description || '',
        assignedTo: data.taskTemplate?.assignedTo || null,
        tags: Array.isArray(data.taskTemplate?.tags) ? data.taskTemplate.tags : [],
        estimatedHours: data.taskTemplate?.estimatedHours || null
      },
      enabled: data.enabled !== false,
      lastRun: null,
      nextRun: this.calculateNextRun(data.schedule),
      createdAt: now,
      updatedAt: now
    }

    this.routines.push(routine)
    await this.save()
    return routine
  }

  /**
   * Get a routine by ID
   */
  async getRoutine(id) {
    await this.ensureLoaded()
    return this.routines.find(r => r.id === id) || null
  }

  /**
   * Get all routines
   */
  async getAll(enabledOnly = false) {
    await this.ensureLoaded()
    if (enabledOnly) {
      return this.routines.filter(r => r.enabled)
    }
    return [...this.routines]
  }

  /**
   * Get routines that are due to run (nextRun <= now)
   */
  async getDueRoutines() {
    const now = Date.now()
    const enabled = await this.getAll(true)
    return enabled.filter(r => r.nextRun <= now)
  }

  /**
   * Update a routine
   */
  async updateRoutine(id, updates) {
    await this.ensureLoaded()

    const routine = this.routines.find(r => r.id === id)
    if (!routine) return null

    if (updates.schedule) {
      this.validateSchedule(updates.schedule)
      routine.schedule = updates.schedule
    }

    if (updates.name !== undefined) routine.name = updates.name
    if (updates.description !== undefined) routine.description = updates.description
    if (updates.enabled !== undefined) routine.enabled = updates.enabled

    if (updates.taskTemplate) {
      routine.taskTemplate = {
        title: updates.taskTemplate.title !== undefined ? updates.taskTemplate.title : routine.taskTemplate.title,
        description: updates.taskTemplate.description !== undefined ? updates.taskTemplate.description : routine.taskTemplate.description,
        assignedTo: updates.taskTemplate.assignedTo !== undefined ? updates.taskTemplate.assignedTo : routine.taskTemplate.assignedTo,
        tags: Array.isArray(updates.taskTemplate.tags) ? updates.taskTemplate.tags : routine.taskTemplate.tags,
        estimatedHours: updates.taskTemplate.estimatedHours !== undefined ? updates.taskTemplate.estimatedHours : routine.taskTemplate.estimatedHours
      }
    }

    routine.updatedAt = Date.now()
    await this.save()
    return routine
  }

  /**
   * Update lastRun and calculate next nextRun
   * Used by routine executor after running a routine
   */
  async recordExecution(id) {
    await this.ensureLoaded()

    const routine = this.routines.find(r => r.id === id)
    if (!routine) return null

    routine.lastRun = Date.now()
    routine.nextRun = this.calculateNextRun(routine.schedule, routine.lastRun)
    routine.updatedAt = Date.now()

    await this.save()
    return routine
  }

  /**
   * Delete a routine
   */
  async deleteRoutine(id) {
    await this.ensureLoaded()

    const before = this.routines.length
    this.routines = this.routines.filter(r => r.id !== id)

    if (this.routines.length !== before) {
      await this.save()
      return true
    }
    return false
  }

  /**
   * Load routines from file
   */
  async loadRoutines() {
    return this.load()
  }

  /**
   * Save routines to file
   */
  async saveRoutines() {
    return this.save()
  }
}

let store = null
export function getRoutinesStore(filePath) {
  if (!store) {
    store = new RoutinesStore(filePath)
  }
  return store
}
