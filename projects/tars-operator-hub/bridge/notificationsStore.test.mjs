import { describe, it, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { NotificationsStore } from './notificationsStore.mjs'
import * as fs from 'node:fs/promises'

describe('NotificationsStore', () => {
  const testFile = '.test-notifications.json'

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
  })

  describe('notification creation', async () => {
    it('should create a notification', async () => {
      const store = new NotificationsStore(testFile)
      const notif = await store.create({
        agentId: 'agent-1',
        type: 'task-assigned',
        title: 'New task assigned',
        text: 'You have been assigned a new task',
        taskId: 'task-123',
      })

      assert.ok(notif.id)
      assert.ok(notif.id.startsWith('notif-'))
      assert.equal(notif.agentId, 'agent-1')
      assert.equal(notif.type, 'task-assigned')
      assert.equal(notif.read, false)
      assert.equal(notif.delivered, false)
      assert.ok(notif.createdAt)
    })

    it('should set defaults for missing fields', async () => {
      const store = new NotificationsStore(testFile)
      const notif = await store.create({ agentId: 'agent-1' })

      assert.equal(notif.type, 'info')
      assert.equal(notif.title, '')
      assert.equal(notif.text, '')
      assert.equal(notif.taskId, null)
      assert.deepEqual(notif.metadata, {})
    })
  })

  describe('filtering by agent', async () => {
    it('should get notifications for agent', async () => {
      const store = new NotificationsStore(testFile)
      await store.create({ agentId: 'agent-1', type: 'task-assigned' })
      await store.create({ agentId: 'agent-2', type: 'task-comment' })
      await store.create({ agentId: 'agent-1', type: 'task-blocked' })

      const notifs = await store.getForAgent('agent-1')

      assert.equal(notifs.length, 2)
      assert.ok(notifs.every(n => n.agentId === 'agent-1'))
    })

    it('should return empty for agent with no notifications', async () => {
      const store = new NotificationsStore(testFile)

      const notifs = await store.getForAgent('agent-999')

      assert.equal(notifs.length, 0)
    })

    it('should sort by newest first', async () => {
      const store = new NotificationsStore(testFile)
      const n1 = await store.create({ agentId: 'agent-1' })
      await new Promise(r => setTimeout(r, 10))
      const n2 = await store.create({ agentId: 'agent-1' })

      const notifs = await store.getForAgent('agent-1')

      assert.ok(notifs[0].createdAt >= notifs[1].createdAt)
    })
  })

  describe('unread filtering', async () => {
    it('should filter unread notifications', async () => {
      const store = new NotificationsStore(testFile)
      const n1 = await store.create({ agentId: 'agent-1' })
      const n2 = await store.create({ agentId: 'agent-1' })

      await store.markRead(n2.id)

      const unread = await store.getForAgent('agent-1', { unread: true })

      assert.equal(unread.length, 1)
      assert.equal(unread[0].id, n1.id)
    })
  })

  describe('type filtering', async () => {
    it('should filter by type', async () => {
      const store = new NotificationsStore(testFile)
      await store.create({ agentId: 'agent-1', type: 'task-assigned' })
      await store.create({ agentId: 'agent-1', type: 'task-comment' })
      await store.create({ agentId: 'agent-1', type: 'task-assigned' })

      const assigned = await store.getForAgent('agent-1', { type: 'task-assigned' })

      assert.equal(assigned.length, 2)
      assert.ok(assigned.every(n => n.type === 'task-assigned'))
    })
  })

  describe('mark as read', async () => {
    it('should mark notification as read', async () => {
      const store = new NotificationsStore(testFile)
      const notif = await store.create({ agentId: 'agent-1' })

      const marked = await store.markRead(notif.id)

      assert.equal(marked.read, true)
    })

    it('should mark all as read for agent', async () => {
      const store = new NotificationsStore(testFile)
      await store.create({ agentId: 'agent-1' })
      await store.create({ agentId: 'agent-1' })
      await store.create({ agentId: 'agent-2' })

      const count = await store.markAllRead('agent-1')

      assert.equal(count, 2)
      const unread = await store.getForAgent('agent-1', { unread: true })
      assert.equal(unread.length, 0)
    })
  })

  describe('mark as delivered', async () => {
    it('should mark notification as delivered', async () => {
      const store = new NotificationsStore(testFile)
      const notif = await store.create({ agentId: 'agent-1' })

      const marked = await store.markDelivered(notif.id)

      assert.equal(marked.delivered, true)
      assert.ok(marked.deliveredAt)
    })
  })

  describe('undelivered notifications', async () => {
    it('should get undelivered notifications', async () => {
      const store = new NotificationsStore(testFile)
      const n1 = await store.create({ agentId: 'agent-1' })
      const n2 = await store.create({ agentId: 'agent-2' })
      const n3 = await store.create({ agentId: 'agent-1' })

      await store.markDelivered(n2.id)

      const undelivered = await store.getUndelivered()

      assert.equal(undelivered.length, 2)
      assert.ok(undelivered.every(n => !n.delivered))
    })
  })

  describe('pruning old notifications', async () => {
    it('should prune old delivered notifications', async () => {
      const store = new NotificationsStore(testFile)
      const now = Date.now()
      const old = now - 8 * 24 * 60 * 60 * 1000 // 8 days ago

      const oldNotif = await store.create({ agentId: 'agent-1' })
      store.notifications[0].delivered = true
      store.notifications[0].deliveredAt = old
      await store.save()

      await store.create({ agentId: 'agent-1' })

      const removed = await store.pruneOld(7 * 24 * 60 * 60 * 1000)

      assert.ok(removed > 0)
    })

    it('should keep undelivered notifications', async () => {
      const store = new NotificationsStore(testFile)
      await store.create({ agentId: 'agent-1' })
      await store.create({ agentId: 'agent-2' })

      const undelivered = await store.getUndelivered()
      const count = undelivered.length

      await store.pruneOld(1000) // Very aggressive

      const stillUndelivered = await store.getUndelivered()
      assert.equal(stillUndelivered.length, count)
    })
  })

  describe('deletion', async () => {
    it('should delete notification', async () => {
      const store = new NotificationsStore(testFile)
      const notif = await store.create({ agentId: 'agent-1' })

      const deleted = await store.delete(notif.id)

      assert.equal(deleted, true)
      const notifs = await store.getForAgent('agent-1')
      assert.equal(notifs.length, 0)
    })

    it('should return false for non-existent', async () => {
      const store = new NotificationsStore(testFile)
      const deleted = await store.delete('non-existent')

      assert.equal(deleted, false)
    })
  })

  describe('persistence', async () => {
    it('should persist notifications to file', async () => {
      const store = new NotificationsStore(testFile)
      await store.create({ agentId: 'agent-1' })
      await store.create({ agentId: 'agent-2' })

      const store2 = new NotificationsStore(testFile)
      const notifs = await store2.load()

      assert.equal(notifs.length, 2)
    })

    it('should handle missing file gracefully', async () => {
      const store = new NotificationsStore('/nonexistent/path.json')
      const notifs = await store.load()

      assert.deepEqual(notifs, [])
      assert.equal(store.loaded, true)
    })

    it('should generate unique notification IDs', async () => {
      const store = new NotificationsStore(testFile)
      const n1 = await store.create({ agentId: 'agent-1' })
      const n2 = await store.create({ agentId: 'agent-2' })
      const n3 = await store.create({ agentId: 'agent-3' })

      assert.notEqual(n1.id, n2.id)
      assert.notEqual(n2.id, n3.id)
    })
  })
})
