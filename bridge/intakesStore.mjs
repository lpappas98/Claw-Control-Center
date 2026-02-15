import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Intake Data Model
 * {
 *   id: string,
 *   projectId: string,
 *   text: string,
 *   files: [{name, size, type, mimeType}],
 *   generatedTaskIds: string[],
 *   status: "pending" | "processed",
 *   createdAt: number (ISO timestamp string),
 *   updatedAt: number (ISO timestamp string)
 * }
 */

export function makeIntakeId(prefix = 'intake') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export class IntakesStore {
  constructor(filePath = '.clawhub/intakes.json') {
    this.filePath = filePath
    this.intakes = []
    this.loaded = false
  }

  async load() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8')
      this.intakes = JSON.parse(data)
    } catch (e) {
      // File doesn't exist or is invalid JSON - start fresh
      this.intakes = []
    }
    this.loaded = true
  }

  async save() {
    try {
      const dir = path.dirname(this.filePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(this.filePath, JSON.stringify(this.intakes, null, 2), 'utf-8')
    } catch (e) {
      console.error(`Failed to save intakes to ${this.filePath}:`, e.message)
      throw e
    }
  }

  /**
   * Get all intakes, optionally filtered by projectId
   */
  getAll(projectId = null) {
    if (!projectId) {
      return [...this.intakes]
    }
    return this.intakes.filter(intake => intake.projectId === projectId)
  }

  /**
   * Get a single intake by id
   */
  getById(id) {
    return this.intakes.find(intake => intake.id === id)
  }

  /**
   * Create a new intake
   */
  create(data) {
    const now = new Date().toISOString()
    const intake = {
      id: data.id || makeIntakeId('intake'),
      projectId: data.projectId || null,
      text: data.text || '',
      files: Array.isArray(data.files) ? data.files : [],
      generatedTaskIds: Array.isArray(data.generatedTaskIds) ? data.generatedTaskIds : [],
      status: data.status === 'processed' ? 'processed' : 'pending',
      createdAt: now,
      updatedAt: now,
    }
    this.intakes.unshift(intake) // Add to front
    return intake
  }

  /**
   * Update an intake
   */
  update(id, updates) {
    const intake = this.getById(id)
    if (!intake) {
      return null
    }

    const now = new Date().toISOString()
    const updated = {
      ...intake,
      ...updates,
      id: intake.id, // Prevent ID changes
      createdAt: intake.createdAt, // Prevent creation time changes
      updatedAt: now,
    }

    const index = this.intakes.findIndex(i => i.id === id)
    this.intakes[index] = updated
    return updated
  }

  /**
   * Delete an intake by id
   */
  delete(id) {
    const index = this.intakes.findIndex(i => i.id === id)
    if (index === -1) {
      return false
    }
    this.intakes.splice(index, 1)
    return true
  }

  /**
   * List intakes for a project with pagination
   */
  listByProject(projectId, options = {}) {
    const limit = Math.min(options.limit || 50, 500)
    const offset = options.offset || 0

    let filtered = this.intakes.filter(i => i.projectId === projectId)
    
    // Sort by createdAt descending (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const total = filtered.length
    const items = filtered.slice(offset, offset + limit)

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    }
  }
}

// Singleton
let intakesStore = null

export async function getIntakesStore(filePath = '.clawhub/intakes.json') {
  if (!intakesStore) {
    intakesStore = new IntakesStore(filePath)
    await intakesStore.load()
  }
  return intakesStore
}

export async function resetIntakesStore() {
  intakesStore = null
}
