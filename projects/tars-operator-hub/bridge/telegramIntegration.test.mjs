import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  sendTelegramNotification,
  escapeMarkdown,
  formatTaskNotification,
  loadTelegramConfig,
  getTargetChatId,
  sendTestNotification,
  sendTaskNotificationToTelegram
} from './telegramIntegration.mjs'

describe('Telegram Integration', () => {
  describe('escapeMarkdown', () => {
    it('should escape special MarkdownV2 characters', () => {
      const text = 'Hello_world*test[link](url)'
      const escaped = escapeMarkdown(text)
      
      assert.equal(escaped, 'Hello\\_world\\*test\\[link\\]\\(url\\)')
    })

    it('should handle empty strings', () => {
      assert.equal(escapeMarkdown(''), '')
      assert.equal(escapeMarkdown(null), '')
      assert.equal(escapeMarkdown(undefined), '')
    })

    it('should escape all special characters', () => {
      const text = '_*[]()~`>#+-=|{}.'
      const escaped = escapeMarkdown(text)
      
      // Should contain backslashes before each special char
      assert.ok(escaped.includes('\\_'))
      assert.ok(escaped.includes('\\*'))
      assert.ok(escaped.includes('\\['))
      assert.ok(escaped.includes('\\('))
    })
  })

  describe('formatTaskNotification', () => {
    it('should format task-assigned notification', () => {
      const task = {
        id: 'task-001',
        title: 'Implement user auth',
        description: 'Add JWT-based authentication system',
        priority: 'P1',
        assignee: 'John Doe',
        dueDate: '2026-02-20',
        lane: 'development'
      }

      const message = formatTaskNotification(task, 'task-assigned')

      assert.ok(message.includes('📋'))
      assert.ok(message.includes('New task assigned'))
      assert.ok(message.includes('Implement user auth'))
      assert.ok(message.includes('task\\-001'))
      assert.ok(message.includes('P1'))
      assert.ok(message.includes('John Doe'))
    })

    it('should format task-completed notification', () => {
      const task = {
        id: 'task-002',
        title: 'Fix login bug',
        priority: 'P0'
      }

      const message = formatTaskNotification(task, 'task-completed')

      assert.ok(message.includes('✅'))
      assert.ok(message.includes('Task completed'))
      assert.ok(message.includes('Fix login bug'))
    })

    it('should format task-blocked notification', () => {
      const task = {
        id: 'task-003',
        title: 'API integration',
        priority: 'P2'
      }

      const message = formatTaskNotification(task, 'task-blocked')

      assert.ok(message.includes('🚫'))
      assert.ok(message.includes('Task blocked'))
    })

    it('should format task-overdue notification', () => {
      const task = {
        id: 'task-004',
        title: 'Complete documentation',
        priority: 'P3',
        dueDate: '2026-02-10'
      }

      const message = formatTaskNotification(task, 'task-overdue')

      assert.ok(message.includes('⚠️'))
      assert.ok(message.includes('Task overdue'))
    })

    it('should include details if provided', () => {
      const task = {
        id: 'task-005',
        title: 'Review PR',
        priority: 'P1'
      }

      const message = formatTaskNotification(task, 'task-assigned', 'Waiting for team review')

      assert.ok(message.includes('Details'))
      assert.ok(message.includes('Waiting for team review'))
    })

    it('should handle missing task fields gracefully', () => {
      const task = {
        id: 'task-006',
        title: 'Simple task'
      }

      const message = formatTaskNotification(task, 'task-assigned')

      assert.ok(message.includes('Simple task'))
      assert.ok(message.includes('P2')) // default priority
    })

    it('should handle null/undefined task', () => {
      const message1 = formatTaskNotification(null, 'task-assigned')
      const message2 = formatTaskNotification(undefined, 'task-completed')

      assert.ok(message1.includes('📋'))
      assert.ok(message2.includes('✅'))
    })

    it('should truncate long descriptions', () => {
      const task = {
        id: 'task-007',
        title: 'Long task',
        description: 'A'.repeat(150)
      }

      const message = formatTaskNotification(task, 'task-assigned')

      assert.ok(message.includes('\\.\\.\\.')); // escaped dots
      assert.ok(!message.includes('A'.repeat(101)))
    })

    it('should format task link correctly', () => {
      const task = {
        id: 'task-008',
        title: 'Test task'
      }

      const message = formatTaskNotification(task, 'task-assigned')

      assert.ok(message.includes('[View Task]'))
      assert.ok(message.includes('task\\-008'))
    })
  })

  describe('loadTelegramConfig', () => {
    it('should load valid telegram config', () => {
      const config = {
        integrations: {
          telegram: {
            enabled: true,
            botToken: '123456:ABC-DEF',
            channels: {
              'task-assigned': 'chat-123',
              'task-completed': 'chat-456',
              'default': 'chat-789'
            }
          }
        }
      }

      const result = loadTelegramConfig(config)

      assert.ok(result)
      assert.equal(result.botToken, '123456:ABC-DEF')
      assert.ok(result.channels['task-assigned'])
    })

    it('should return null if telegram not enabled', () => {
      const config = {
        integrations: {
          telegram: {
            enabled: false,
            botToken: '123456:ABC-DEF'
          }
        }
      }

      const result = loadTelegramConfig(config)

      assert.equal(result, null)
    })

    it('should return null if no bot token', () => {
      const config = {
        integrations: {
          telegram: {
            enabled: true,
            channels: { default: 'chat-123' }
          }
        }
      }

      const result = loadTelegramConfig(config)

      assert.equal(result, null)
    })

    it('should return null if no integrations', () => {
      const config = {}
      const result = loadTelegramConfig(config)

      assert.equal(result, null)
    })

    it('should return null if config is null', () => {
      const result = loadTelegramConfig(null)

      assert.equal(result, null)
    })
  })

  describe('getTargetChatId', () => {
    it('should get chat id for specific notification type', () => {
      const config = {
        channels: {
          'task-assigned': 'chat-111',
          'task-completed': 'chat-222',
          'default': 'chat-999'
        }
      }

      assert.equal(getTargetChatId(config, 'task-assigned'), 'chat-111')
      assert.equal(getTargetChatId(config, 'task-completed'), 'chat-222')
    })

    it('should fall back to default channel', () => {
      const config = {
        channels: {
          'task-assigned': 'chat-111',
          'default': 'chat-999'
        }
      }

      assert.equal(getTargetChatId(config, 'task-blocked'), 'chat-999')
    })

    it('should return null if no default channel', () => {
      const config = {
        channels: {
          'task-assigned': 'chat-111'
        }
      }

      assert.equal(getTargetChatId(config, 'task-blocked'), null)
    })

    it('should return null if config is null', () => {
      assert.equal(getTargetChatId(null, 'task-assigned'), null)
    })
  })

  describe('sendTelegramNotification', () => {
    it('should fail if botToken is missing', async () => {
      const result = await sendTelegramNotification('', '123456', 'test message')

      assert.equal(result.success, false)
      assert.ok(result.error)
    })

    it('should fail if chatId is missing', async () => {
      const result = await sendTelegramNotification('bot-token', '', 'test message')

      assert.equal(result.success, false)
      assert.ok(result.error)
    })

    it('should handle network errors gracefully', async () => {
      const originalFetch = global.fetch
      
      // Mock fetch to throw error
      global.fetch = async () => {
        throw new Error('Network error')
      }

      const result = await sendTelegramNotification('token-123', 'chat-456', 'test')

      assert.equal(result.success, false)
      assert.equal(result.error, 'Network error')

      global.fetch = originalFetch
    })

    it('should handle API error responses', async () => {
      const originalFetch = global.fetch
      
      // Mock fetch to return error response
      global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ description: 'Unauthorized' })
      })

      const result = await sendTelegramNotification('invalid-token', 'chat-456', 'test')

      assert.equal(result.success, false)
      assert.ok(result.error.includes('401') || result.error.includes('Unauthorized'))

      global.fetch = originalFetch
    })

    it('should work with mock successful response', async () => {
      const originalFetch = global.fetch
      
      // Mock fetch to return success
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 12345 }
        })
      })

      const result = await sendTelegramNotification('token-123', 'chat-456', 'test message')

      assert.equal(result.success, true)
      assert.equal(result.messageId, 12345)

      global.fetch = originalFetch
    })
  })

  describe('sendTestNotification', () => {
    it('should send test notification with proper format', async () => {
      const originalFetch = global.fetch
      let capturedUrl = ''
      let capturedBody = {}
      
      global.fetch = async (url, options) => {
        capturedUrl = url
        capturedBody = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { message_id: 99999 }
          })
        }
      }

      const result = await sendTestNotification('token-123', 'chat-456')

      assert.equal(result.success, true)
      assert.ok(capturedUrl.includes('sendMessage'))
      assert.equal(capturedBody.chat_id, 'chat-456')
      assert.ok(capturedBody.text.includes('Test Notification'))

      global.fetch = originalFetch
    })
  })

  describe('sendTaskNotificationToTelegram', () => {
    it('should send notification with valid config', async () => {
      const originalFetch = global.fetch
      let sentMessage = ''

      global.fetch = async (url, options) => {
        sentMessage = JSON.parse(options.body).text
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { message_id: 11111 }
          })
        }
      }

      const config = {
        integrations: {
          telegram: {
            enabled: true,
            botToken: 'token-123',
            channels: {
              'task-assigned': 'chat-123',
              'default': 'chat-999'
            }
          }
        }
      }

      const task = {
        id: 'task-100',
        title: 'Integration test',
        priority: 'P1'
      }

      const result = await sendTaskNotificationToTelegram(config, task, 'task-assigned')

      assert.equal(result.success, true)
      assert.ok(sentMessage.includes('📋'))
      assert.ok(sentMessage.includes('Integration test'))

      global.fetch = originalFetch
    })

    it('should fail gracefully if telegram not configured', async () => {
      const config = {}

      const task = {
        id: 'task-101',
        title: 'Test'
      }

      const result = await sendTaskNotificationToTelegram(config, task, 'task-assigned')

      assert.equal(result.success, false)
      assert.ok(result.error)
    })

    it('should fail if chat id not configured for type', async () => {
      const config = {
        integrations: {
          telegram: {
            enabled: true,
            botToken: 'token-123',
            channels: {
              'task-completed': 'chat-123'
              // no task-assigned or default
            }
          }
        }
      }

      const task = {
        id: 'task-102',
        title: 'Test'
      }

      const result = await sendTaskNotificationToTelegram(config, task, 'task-assigned')

      assert.equal(result.success, false)
      assert.ok(result.error.includes('No chat ID'))
    })
  })
})
