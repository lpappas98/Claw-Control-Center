import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Projects Store - Manages epic-level feature containers
 * 
 * Schema: {
 *   id: string,
 *   name: string,
 *   tagline: string,
 *   status: "active" | "paused" | "archived" | "planning",
 *   owner: string,
 *   tags: string[],
 *   description: string,
 *   links: { title: string, url: string }[],
 *   stats: { open: number, blocked: number, done: number, total: number },
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO)
 * }
 */

export class ProjectsStore {
  constructor(filePath = '.clawhub/projects.json') {
    this.filePath = filePath
    this.projects = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.projects = Array.isArray(data) ? data : data?.projects ?? []
      this.loaded = true
    } catch {
      this.projects = []
      this.loaded = true
    }
    return this.projects
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.projects, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  makeId(name) {
    return `proj-${Math.random().toString(16).slice(2)}-${Date.now()}`
  }

  async getAll() {
    await this.ensureLoaded()
    return this.projects.slice().sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }

  async get(id) {
    await this.ensureLoaded()
    return this.projects.find(p => p.id === id)
  }

  async create(data) {
    await this.ensureLoaded()

    const now = new Date().toISOString()
    const project = {
      id: this.makeId(data.name),
      name: String(data.name ?? 'Untitled Project').trim(),
      tagline: String(data.tagline ?? '').trim(),
      status: ['active', 'paused', 'archived', 'planning'].includes(data.status) ? data.status : 'active',
      owner: String(data.owner ?? '').trim(),
      tags: Array.isArray(data.tags) ? data.tags.filter(t => typeof t === 'string') : [],
      description: String(data.description ?? '').trim(),
      links: Array.isArray(data.links) ? data.links.filter(l => l?.title && l?.url) : [],
      stats: data.stats || { open: 0, blocked: 0, done: 0, total: 0 },
      createdAt: now,
      updatedAt: now,
    }

    this.projects.push(project)
    await this.save()
    return project
  }

  async update(id, data) {
    await this.ensureLoaded()
    const idx = this.projects.findIndex(p => p.id === id)
    if (idx < 0) return null

    const before = this.projects[idx]
    const now = new Date().toISOString()

    const updated = {
      ...before,
      name: data.name !== undefined ? String(data.name).trim() : before.name,
      tagline: data.tagline !== undefined ? String(data.tagline).trim() : before.tagline,
      status: data.status !== undefined && ['active', 'paused', 'archived', 'planning'].includes(data.status) ? data.status : before.status,
      owner: data.owner !== undefined ? String(data.owner).trim() : before.owner,
      tags: Array.isArray(data.tags) ? data.tags.filter(t => typeof t === 'string') : before.tags,
      description: data.description !== undefined ? String(data.description).trim() : before.description,
      links: Array.isArray(data.links) ? data.links.filter(l => l?.title && l?.url) : before.links,
      stats: data.stats || before.stats,
      updatedAt: now,
    }

    this.projects[idx] = updated
    await this.save()
    return updated
  }

  async delete(id) {
    await this.ensureLoaded()
    const before = this.projects.length
    this.projects = this.projects.filter(p => p.id !== id)
    
    if (this.projects.length !== before) {
      await this.save()
      return true
    }
    return false
  }
}

let store = null
export function getProjectsStore(filePath) {
  if (!store) {
    store = new ProjectsStore(filePath)
  }
  return store
}

export async function loadProjects(filePath) {
  const store = new ProjectsStore(filePath)
  return store.load()
}

export async function saveProjects(filePath, projects) {
  const store = new ProjectsStore(filePath)
  store.projects = projects
  await store.save()
}
