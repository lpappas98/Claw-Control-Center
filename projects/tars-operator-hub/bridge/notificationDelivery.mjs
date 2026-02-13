/**
 * Notification Delivery Worker
 * 
 * Polls for undelivered notifications and sends them to OpenClaw agents
 */

import { getNotificationsStore } from './notificationsStore.mjs'
import { getAgentsStore } from './agentsStore.mjs'

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const DELIVERY_TIMEOUT_MS = 10000 // 10 second timeout for delivery

export class NotificationDeliveryWorker {
  constructor() {
    this.running = false
    this.intervalId = null
    this.notificationsStore = getNotificationsStore()
    this.agentsStore = getAgentsStore()
  }

  /**
   * Start the delivery worker
   */
  start() {
    if (this.running) {
      console.log('[NotificationDelivery] Already running')
      return
    }

    this.running = true
    console.log('[NotificationDelivery] Starting delivery worker')

    // Initial delivery
    this.deliverPending().catch(err => {
      console.error('[NotificationDelivery] Initial delivery error:', err)
    })

    // Poll for new notifications
    this.intervalId = setInterval(() => {
      this.deliverPending().catch(err => {
        console.error('[NotificationDelivery] Delivery error:', err)
      })
    }, POLL_INTERVAL_MS)
  }

  /**
   * Stop the delivery worker
   */
  stop() {
    if (!this.running) return

    this.running = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    console.log('[NotificationDelivery] Stopped delivery worker')
  }

  /**
   * Deliver pending notifications
   */
  async deliverPending() {
    const pending = await this.notificationsStore.getUndelivered()
    
    if (pending.length === 0) return

    console.log(`[NotificationDelivery] Delivering ${pending.length} notifications`)

    for (const notif of pending) {
      try {
        await this.deliverNotification(notif)
      } catch (err) {
        console.error(`[NotificationDelivery] Failed to deliver ${notif.id}:`, err.message)
        // Continue with other notifications
      }
    }
  }

  /**
   * Deliver a single notification to an agent
   */
  async deliverNotification(notif) {
    // Get agent info
    const agent = await this.agentsStore.get(notif.agentId)
    if (!agent) {
      console.warn(`[NotificationDelivery] Agent ${notif.agentId} not found, skipping notification ${notif.id}`)
      await this.notificationsStore.markDelivered(notif.id)
      return
    }

    // Check if agent is online
    if (agent.status !== 'online') {
      console.log(`[NotificationDelivery] Agent ${agent.name} is ${agent.status}, deferring notification ${notif.id}`)
      return // Don't mark as delivered, try again later
    }

    // Determine delivery endpoint
    const endpoint = this.getAgentEndpoint(agent)
    if (!endpoint) {
      console.warn(`[NotificationDelivery] No endpoint for agent ${agent.name}, marking as delivered anyway`)
      await this.notificationsStore.markDelivered(notif.id)
      return
    }

    // Send notification
    try {
      const response = await fetch(`${endpoint}/api/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENCLAW_TOKEN || ''}`
        },
        body: JSON.stringify({
          title: notif.title,
          message: notif.text,
          type: notif.type,
          taskId: notif.taskId,
          projectId: notif.projectId,
          metadata: notif.metadata
        }),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
      })

      if (response.ok) {
        console.log(`[NotificationDelivery] Delivered to ${agent.name}: ${notif.title}`)
        await this.notificationsStore.markDelivered(notif.id)
      } else {
        console.warn(`[NotificationDelivery] Delivery failed (${response.status}): ${agent.name}`)
        // Don't mark as delivered, will retry
      }
    } catch (err) {
      console.error(`[NotificationDelivery] Network error delivering to ${agent.name}:`, err.message)
      // Don't mark as delivered, will retry
    }
  }

  /**
   * Get agent's notification endpoint
   */
  getAgentEndpoint(agent) {
    // If agent has Tailscale IP, use that
    if (agent.tailscaleIP) {
      return `http://${agent.tailscaleIP}:18789`
    }

    // If agent is on same instance (localhost)
    if (agent.instanceId === 'local' || !agent.instanceId) {
      return 'http://localhost:18789'
    }

    // No endpoint available
    return null
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      running: this.running,
      pollInterval: POLL_INTERVAL_MS
    }
  }
}

// Singleton instance
let worker = null

export function getNotificationDeliveryWorker() {
  if (!worker) {
    worker = new NotificationDeliveryWorker()
  }
  return worker
}

export function startNotificationDelivery() {
  const worker = getNotificationDeliveryWorker()
  worker.start()
  return worker
}

export function stopNotificationDelivery() {
  const worker = getNotificationDeliveryWorker()
  worker.stop()
}
