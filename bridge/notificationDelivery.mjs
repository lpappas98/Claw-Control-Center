/**
 * Notification Delivery Worker
 * 
 * Polls for undelivered notifications and sends them to OpenClaw agents
 * Also sends notifications to Telegram if configured
 */

import { getNotificationsStore } from './notificationsStore.mjs'
import { getAgentsStore } from './agentsStore.mjs'
import { sendTelegramNotification, formatTaskNotification, loadTelegramConfig, getTargetChatId } from './telegramIntegration.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'

const POLL_INTERVAL_MS = 5000 // Poll every 5 seconds
const DELIVERY_TIMEOUT_MS = 10000 // 10 second timeout for delivery

export class NotificationDeliveryWorker {
  constructor(configPath = null) {
    this.running = false
    this.intervalId = null
    this.notificationsStore = getNotificationsStore()
    this.agentsStore = getAgentsStore()
    this.configPath = configPath
    this.telegramConfig = null
  }

  /**
   * Load Telegram configuration
   */
  async loadTelegramConfig() {
    if (!this.configPath) {
      return
    }

    try {
      const raw = await fs.readFile(this.configPath, 'utf8')
      const config = JSON.parse(raw)
      this.telegramConfig = loadTelegramConfig(config)
      
      if (this.telegramConfig) {
        console.log('[NotificationDelivery] Telegram integration enabled')
      }
    } catch (err) {
      console.warn('[NotificationDelivery] Failed to load Telegram config:', err.message)
    }
  }

  /**
   * Start the delivery worker
   */
  async start() {
    if (this.running) {
      console.log('[NotificationDelivery] Already running')
      return
    }

    this.running = true
    console.log('[NotificationDelivery] Starting delivery worker')

    // Load Telegram config
    await this.loadTelegramConfig()

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

    // Send notification to agent
    let agentDelivered = false
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
        agentDelivered = true
      } else {
        console.warn(`[NotificationDelivery] Delivery failed (${response.status}): ${agent.name}`)
      }
    } catch (err) {
      console.error(`[NotificationDelivery] Network error delivering to ${agent.name}:`, err.message)
    }

    // Also send to Telegram if configured
    if (this.telegramConfig && notif.type) {
      try {
        await this.sendToTelegram(notif)
      } catch (err) {
        console.error(`[NotificationDelivery] Telegram send error:`, err.message)
        // Don't fail the notification delivery if Telegram fails
      }
    }

    // Mark as delivered only if at least one delivery method succeeded
    if (agentDelivered || this.telegramConfig) {
      await this.notificationsStore.markDelivered(notif.id)
    }
  }

  /**
   * Send notification to Telegram
   */
  async sendToTelegram(notif) {
    const chatId = getTargetChatId(this.telegramConfig, notif.type)
    if (!chatId) {
      console.log(`[NotificationDelivery] No Telegram chat configured for type: ${notif.type}`)
      return
    }

    // Format message based on notification type
    let message = notif.text

    if (notif.type && notif.type.startsWith('task-')) {
      // For task notifications, try to format nicely
      const task = {
        id: notif.taskId,
        title: notif.title,
        ...notif.metadata
      }
      message = formatTaskNotification(task, notif.type, notif.text)
    }

    const result = await sendTelegramNotification(
      this.telegramConfig.botToken,
      chatId,
      message,
      notif.type
    )

    if (!result.success) {
      console.warn(`[NotificationDelivery] Telegram delivery failed: ${result.error}`)
    } else {
      console.log(`[NotificationDelivery] Sent to Telegram (${chatId}): ${notif.title}`)
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
