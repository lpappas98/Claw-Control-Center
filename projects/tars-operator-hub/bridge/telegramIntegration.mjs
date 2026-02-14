/**
 * Telegram Integration Module
 * 
 * Provides functions to send notifications via Telegram Bot API
 * Supports multiple notification types with emoji formatting
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

/**
 * Configuration for notification type emojis and labels
 */
const NOTIFICATION_TYPES = {
  'task-assigned': {
    emoji: '📋',
    label: 'New task assigned'
  },
  'task-completed': {
    emoji: '✅',
    label: 'Task completed'
  },
  'task-blocked': {
    emoji: '🚫',
    label: 'Task blocked'
  },
  'task-overdue': {
    emoji: '⚠️',
    label: 'Task overdue'
  },
  'task-comment': {
    emoji: '💬',
    label: 'New comment on task'
  },
  'info': {
    emoji: 'ℹ️',
    label: 'Information'
  }
}

/**
 * Send a notification via Telegram
 * 
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text (supports markdown)
 * @param {string} type - Notification type (see NOTIFICATION_TYPES)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendTelegramNotification(botToken, chatId, message, type = 'info') {
  if (!botToken || !chatId) {
    return {
      success: false,
      error: 'Missing bot token or chat ID'
    }
  }

  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'MarkdownV2'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData?.description || `HTTP ${response.status}`
      }
    }

    const data = await response.json()
    if (data.ok) {
      return {
        success: true,
        messageId: data.result.message_id
      }
    } else {
      return {
        success: false,
        error: data.description || 'Unknown error'
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    }
  }
}

/**
 * Escape special characters for Telegram MarkdownV2
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeMarkdown(text) {
  if (!text) return ''
  
  // Characters that need escaping in MarkdownV2
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
  
  let escaped = text
  for (const char of specialChars) {
    escaped = escaped.split(char).join(`\\${char}`)
  }
  
  return escaped
}

/**
 * Format a task notification message for Telegram
 * 
 * Supports different notification types with appropriate emoji and formatting
 * 
 * @param {Object} task - Task object containing id, title, description, priority, etc.
 * @param {string} eventType - Type of event (task-assigned, task-completed, task-blocked, task-overdue)
 * @param {string} details - Additional details or context
 * @returns {string} Formatted markdown message for Telegram
 */
export function formatTaskNotification(task, eventType = 'task-assigned', details = '') {
  const typeConfig = NOTIFICATION_TYPES[eventType] || NOTIFICATION_TYPES.info
  const emoji = typeConfig.emoji
  const label = typeConfig.label

  if (!task || !task.title) {
    return `${emoji} ${label}`
  }

  const taskTitle = escapeMarkdown(task.title)
  const taskId = escapeMarkdown(task.id || 'unknown')
  const priority = task.priority ? escapeMarkdown(task.priority) : 'P2'
  
  let message = `${emoji} *${label}*\n\n`
  message += `*Task:* \`${taskId}\`\n`
  message += `*Title:* ${taskTitle}\n`
  message += `*Priority:* ${priority}\n`

  if (task.description) {
    const desc = escapeMarkdown(task.description.substring(0, 100))
    message += `*Description:* ${desc}`
    if (task.description.length > 100) {
      message += '\\.\\.\\.'
    }
    message += '\n'
  }

  if (task.assignee) {
    message += `*Assigned to:* ${escapeMarkdown(task.assignee)}\n`
  }

  if (task.dueDate) {
    const dueDate = escapeMarkdown(task.dueDate)
    message += `*Due:* ${dueDate}\n`
  }

  if (task.lane) {
    const status = escapeMarkdown(task.lane)
    message += `*Status:* ${status}\n`
  }

  if (details) {
    message += `\n*Details:* ${escapeMarkdown(details)}\n`
  }

  if (task.id) {
    message += `\n[View Task](https://tars\\.example\\.com/tasks/${taskId})`
  }

  return message.trim()
}

/**
 * Load Telegram configuration from config object
 * 
 * @param {Object} config - Configuration object containing integrations.telegram
 * @returns {Object|null} Telegram config or null if not configured
 */
export function loadTelegramConfig(config) {
  if (!config || !config.integrations || !config.integrations.telegram) {
    return null
  }

  const telegramConfig = config.integrations.telegram

  if (!telegramConfig.enabled) {
    return null
  }

  if (!telegramConfig.botToken) {
    console.warn('[Telegram] Bot token not configured')
    return null
  }

  return telegramConfig
}

/**
 * Get target chat ID for a notification type
 * 
 * Routes notifications to appropriate Telegram channels based on type
 * 
 * @param {Object} telegramConfig - Telegram configuration
 * @param {string} notificationType - Type of notification (task-assigned, etc.)
 * @returns {string|null} Chat ID or null if not configured
 */
export function getTargetChatId(telegramConfig, notificationType) {
  if (!telegramConfig || !telegramConfig.channels) {
    return null
  }

  // Try to get channel for specific type
  if (telegramConfig.channels[notificationType]) {
    return telegramConfig.channels[notificationType]
  }

  // Fall back to default channel
  return telegramConfig.channels.default || null
}

/**
 * Send test notification to Telegram
 * 
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} Send result
 */
export async function sendTestNotification(botToken, chatId) {
  const timestamp = new Date().toISOString()
  const message = '*🤖 Claw Control Center Test Notification*\n\n' +
    'Telegram integration is working\\!\n\n' +
    'Time: `' + escapeMarkdown(timestamp) + '`\n\n' +
    'If you received this message, the Telegram bot is properly configured\\.'

  return sendTelegramNotification(botToken, chatId, message, 'info')
}

/**
 * Format and send a Telegram notification for a task event
 * 
 * @param {Object} config - App configuration
 * @param {Object} task - Task object
 * @param {string} eventType - Type of event
 * @param {string} details - Additional details
 * @returns {Promise<Object>} Send result
 */
export async function sendTaskNotificationToTelegram(config, task, eventType, details = '') {
  const telegramConfig = loadTelegramConfig(config)
  
  if (!telegramConfig) {
    return {
      success: false,
      error: 'Telegram not configured'
    }
  }

  const chatId = getTargetChatId(telegramConfig, eventType)
  
  if (!chatId) {
    return {
      success: false,
      error: `No chat ID configured for event type: ${eventType}`
    }
  }

  const message = formatTaskNotification(task, eventType, details)

  return sendTelegramNotification(
    telegramConfig.botToken,
    chatId,
    message,
    eventType
  )
}
