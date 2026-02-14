import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Task Template Data Model
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   tasks: [{
 *     title: string,
 *     description?: string,
 *     role: string,           // auto-assign pattern (e.g., "designer", "backend-dev")
 *     estimatedHours?: number,
 *     dependsOn?: string[]    // task titles this depends on
 *   }],
 *   createdAt: number,
 *   updatedAt: number
 * }
 */

export function makeTemplateId(prefix = 'template') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export class TaskTemplatesStore {
  constructor(filePath = '.clawhub/taskTemplates.json') {
    this.filePath = filePath
    this.templates = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.templates = Array.isArray(data) ? data : data?.templates || []
      this.loaded = true
    } catch {
      this.templates = []
      this.loaded = true
    }
    return this.templates
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.templates, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  /**
   * Get all templates
   */
  async getAll() {
    await this.ensureLoaded()
    return this.templates
  }

  /**
   * Get template by ID
   */
  async getTemplate(id) {
    await this.ensureLoaded()
    return this.templates.find(t => t.id === id) || null
  }

  /**
   * Create new template
   */
  async createTemplate(data) {
    await this.ensureLoaded()

    if (!data.name || !data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('Template must have name and tasks array')
    }

    const now = Date.now()
    const template = {
      id: makeTemplateId(),
      name: data.name,
      description: data.description || '',
      tasks: data.tasks.map(t => ({
        title: t.title,
        description: t.description || '',
        role: t.role || 'general',
        estimatedHours: t.estimatedHours || null,
        dependsOn: t.dependsOn || []
      })),
      createdAt: now,
      updatedAt: now
    }

    this.templates.push(template)
    await this.save()
    return template
  }

  /**
   * Update template
   */
  async updateTemplate(id, updates) {
    await this.ensureLoaded()
    const template = this.templates.find(t => t.id === id)
    if (!template) return null

    Object.assign(template, updates, { updatedAt: Date.now() })
    await this.save()
    return template
  }

  /**
   * Delete template
   */
  async deleteTemplate(id) {
    await this.ensureLoaded()
    const before = this.templates.length
    this.templates = this.templates.filter(t => t.id !== id)

    if (this.templates.length !== before) {
      await this.save()
      return true
    }
    return false
  }

  /**
   * Validate template structure
   */
  validateTemplate(template) {
    if (!template.id || !template.name || !template.tasks) {
      return false
    }

    if (!Array.isArray(template.tasks)) {
      return false
    }

    return template.tasks.every(t => t.title && t.role)
  }
}

// Singleton instance
let store = null
export function getTaskTemplatesStore(filePath) {
  if (!store) {
    store = new TaskTemplatesStore(filePath)
  }
  return store
}

// Export legacy functions for backward compatibility
export async function loadTemplates(filePath) {
  const store = new TaskTemplatesStore(filePath)
  return store.load()
}

export async function saveTemplates(filePath, templates) {
  const store = new TaskTemplatesStore(filePath)
  store.templates = templates
  await store.save()
}
