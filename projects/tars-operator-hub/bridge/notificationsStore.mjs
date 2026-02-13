import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Notification Data Model
 * {
 *   id: string,
 *   agentId: string,            // target agent
 *   type: string,               // "task-assigned" | "task-comment" | "task-blocked" | "task-completed" | "mention"
 *   title: string,
 *   text: string,
 *   taskId: string?,
 *   projectId: string?,
 *   from: string?,              // who/what triggered notification
 *   read: boolean,
 *   delivered: boolean,
 *   deliveredAt: number?,
 *   createdAt: number,
 *   metadata: object
 * }
 */

export class NotificationsStore {
  constructor(filePath = '.clawhub/notifications.json') {
    this.filePath = filePath
    this.notifications = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.notifications = Array.isArray(data) ? data : data?.notifications || []
      this.loaded = true
    } catch {
      this.notifications = []
      this.loaded = true
    }
    return this.notifications
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.notifications, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  makeId() {
    return `notif-${Math.random().toString(16).slice(2)}-${Date.now()}`
  }

  /**
   * Create notification
   */
  async create(notifData) {
    await this.ensureLoaded()
    
    const notification = {
      id: this.makeId(),
      agentId: notifData.agentId,
      type: notifData.type || 'info',
      title: notifData.title || '',
      text: notifData.text || '',
      taskId: notifData.taskId || null,
      projectId: notifData.projectId || null,
      from: notifData.from || null,
      read: false,
      delivered: false,
      deliveredAt: null,
      createdAt: Date.now(),
      metadata: notifData.metadata || {}
    }

    this.notifications.push(notification)
    await this.save()
    return notification
  }

  /**
   * Get all notifications for an agent
   */
  async getForAgent(agentId, filters = {}) {
    await this.ensureLoaded()
    let result = this.notifications.filter(n => n.agentId === agentId)

    if (filters.unread) {
      result = result.filter(n => !n.read)
    }
    if (filters.undelivered) {
      result = result.filter(n => !n.delivered)
    }
    if (filters.type) {
      result = result.filter(n => n.type === filters.type)
    }

    // Sort by newest first
    result.sort((a, b) => b.createdAt - a.createdAt)

    return result
  }

  /**
   * Get undelivered notifications (for delivery worker)
   */
  async getUndelivered() {
    await this.ensureLoaded()
    return this.notifications.filter(n => !n.delivered)
  }

  /**
   * Mark notification as delivered
   */
  async markDelivered(id) {
    await this.ensureLoaded()
    const notif = this.notifications.find(n => n.id === id)
    if (!notif) return null

    notif.delivered = true
    notif.deliveredAt = Date.now()

    await this.save()
    return notif
  }

  /**
   * Mark notification as read
   */
  async markRead(id) {
    await this.ensureLoaded()
    const notif = this.notifications.find(n => n.id === id)
    if (!notif) return null

    notif.read = true

    await this.save()
    return notif
  }

  /**
   * Mark all notifications as read for an agent
   */
  async markAllRead(agentId) {
    await this.ensureLoaded()
    let count = 0

    for (const notif of this.notifications) {
      if (notif.agentId === agentId && !notif.read) {
        notif.read = true
        count++
      }
    }

    if (count > 0) {
      await this.save()
    }

    return count
  }

  /**
   * Delete notification
   */
  async delete(id) {
    await this.ensureLoaded()
    const before = this.notifications.length
    this.notifications = this.notifications.filter(n => n.id !== id)
    
    if (this.notifications.length !== before) {
      await this.save()
      return true
    }
    return false
  }

  /**
   * Clean old delivered notifications (older than 7 days)
   */
  async pruneOld(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    await this.ensureLoaded()
    const now = Date.now()
    const before = this.notifications.length

    this.notifications = this.notifications.filter(n => {
      if (!n.delivered) return true // Keep undelivered
      if (!n.deliveredAt) return true // Keep if no delivery timestamp
      return (now - n.deliveredAt) < maxAgeMs
    })

    if (this.notifications.length !== before) {
      await this.save()
    }

    return before - this.notifications.length // number removed
  }
}

// Singleton instance
let store = null
export function getNotificationsStore(filePath) {
  if (!store) {
    store = new NotificationsStore(filePath)
  }
  return store
}
