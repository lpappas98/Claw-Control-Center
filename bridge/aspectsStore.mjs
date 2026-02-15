import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Aspects Store - Manages epic-level sub-features within projects
 * 
 * Schema: {
 *   id: string,
 *   projectId: string,
 *   name: string,
 *   desc: string,
 *   priority: "P0" | "P1" | "P2" | "P3",
 *   status: "proposed" | "queued" | "development" | "review" | "blocked" | "done",
 *   progress: number (0-100),
 *   order: number,
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO)
 * }
 */

export class AspectsStore {
  constructor(filePath = '.clawhub/aspects.json') {
    this.filePath = filePath
    this.aspects = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.aspects = Array.isArray(data) ? data : data?.aspects ?? []
      this.loaded = true
    } catch {
      this.aspects = []
      this.loaded = true
    }
    return this.aspects
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.aspects, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  makeId(name) {
    return `aspect-${Math.random().toString(16).slice(2)}-${Date.now()}`
  }

  normalizePriority(p) {
    const v = String(p ?? '').toUpperCase()
    if (['P0', 'P1', 'P2', 'P3'].includes(v)) return v
    return 'P2'
  }

  normalizeStatus(status) {
    const v = String(status ?? '').toLowerCase()
    if (['proposed', 'queued', 'development', 'review', 'blocked', 'done'].includes(v)) return v
    return 'queued'
  }

  async getAll(filters = {}) {
    await this.ensureLoaded()
    let result = this.aspects

    if (filters.projectId) {
      result = result.filter(a => a.projectId === filters.projectId)
    }
    if (filters.status) {
      result = result.filter(a => a.status === filters.status)
    }
    if (filters.priority) {
      result = result.filter(a => a.priority === filters.priority)
    }

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  async get(id) {
    await this.ensureLoaded()
    return this.aspects.find(a => a.id === id)
  }

  async getByProject(projectId) {
    return this.getAll({ projectId })
  }

  async create(data) {
    await this.ensureLoaded()

    const now = new Date().toISOString()
    const nextOrder = Math.max(0, ...this.aspects.map(a => a.order ?? 0)) + 1

    const aspect = {
      id: this.makeId(data.name),
      projectId: String(data.projectId ?? '').trim(),
      name: String(data.name ?? 'Untitled Aspect').trim(),
      desc: String(data.desc ?? '').trim(),
      priority: this.normalizePriority(data.priority),
      status: this.normalizeStatus(data.status),
      progress: typeof data.progress === 'number' ? Math.max(0, Math.min(100, data.progress)) : 0,
      order: typeof data.order === 'number' ? data.order : nextOrder,
      createdAt: now,
      updatedAt: now,
    }

    this.aspects.push(aspect)
    await this.save()
    return aspect
  }

  async update(id, data) {
    await this.ensureLoaded()
    const idx = this.aspects.findIndex(a => a.id === id)
    if (idx < 0) return null

    const before = this.aspects[idx]
    const now = new Date().toISOString()

    const updated = {
      ...before,
      name: data.name !== undefined ? String(data.name).trim() : before.name,
      desc: data.desc !== undefined ? String(data.desc).trim() : before.desc,
      priority: data.priority !== undefined ? this.normalizePriority(data.priority) : before.priority,
      status: data.status !== undefined ? this.normalizeStatus(data.status) : before.status,
      progress: data.progress !== undefined ? Math.max(0, Math.min(100, data.progress)) : before.progress,
      order: data.order !== undefined ? data.order : before.order,
      updatedAt: now,
    }

    this.aspects[idx] = updated
    await this.save()
    return updated
  }

  async delete(id) {
    await this.ensureLoaded()
    const before = this.aspects.length
    this.aspects = this.aspects.filter(a => a.id !== id)
    
    if (this.aspects.length !== before) {
      await this.save()
      return true
    }
    return false
  }

  async deleteByProject(projectId) {
    await this.ensureLoaded()
    const before = this.aspects.length
    this.aspects = this.aspects.filter(a => a.projectId !== projectId)
    
    if (this.aspects.length !== before) {
      await this.save()
      return true
    }
    return false
  }
}

let store = null
export function getAspectsStore(filePath) {
  if (!store) {
    store = new AspectsStore(filePath)
  }
  return store
}

export async function loadAspects(filePath) {
  const store = new AspectsStore(filePath)
  return store.load()
}

export async function saveAspects(filePath, aspects) {
  const store = new AspectsStore(filePath)
  store.aspects = aspects
  await store.save()
}
