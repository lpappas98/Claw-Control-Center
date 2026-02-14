import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type NotificationEventType =
  | 'task_assigned'
  | 'task_commented'
  | 'task_blocked'
  | 'task_completed'
  | 'status_change'

interface NotificationSettingsProps {
  chatIds?: Record<string, string>
  eventMappings?: Record<string, NotificationEventType[]>
  onSave?: (settings: { chatIds: Record<string, string>; eventMappings: Record<string, NotificationEventType[]> }) => Promise<void>
  isLoading?: boolean
}

const EVENT_TYPES: { value: NotificationEventType; label: string }[] = [
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'task_commented', label: 'Task Commented' },
  { value: 'task_blocked', label: 'Task Blocked' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'status_change', label: 'Status Changed' },
]

export function NotificationSettings({
  chatIds = {},
  eventMappings = {},
  onSave,
  isLoading = false,
}: NotificationSettingsProps) {
  const [localChatIds, setLocalChatIds] = useState(chatIds)
  const [localMappings, setLocalMappings] = useState(eventMappings)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelId, setNewChannelId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAddChannel = () => {
    if (!newChannelName.trim() || !newChannelId.trim()) {
      setError('Channel name and ID are required')
      return
    }

    setLocalChatIds((prev) => ({
      ...prev,
      [newChannelName]: newChannelId,
    }))

    // Initialize with all events for new channel
    setLocalMappings((prev) => ({
      ...prev,
      [newChannelName]: EVENT_TYPES.map((e) => e.value),
    }))

    setNewChannelName('')
    setNewChannelId('')
    setError(null)
  }

  const handleRemoveChannel = (channelName: string) => {
    setLocalChatIds((prev) => {
      const next = { ...prev }
      delete next[channelName]
      return next
    })

    setLocalMappings((prev) => {
      const next = { ...prev }
      delete next[channelName]
      return next
    })
  }

  const handleToggleEvent = (channelName: string, eventType: NotificationEventType) => {
    setLocalMappings((prev) => {
      const current = prev[channelName] || []
      const updated = current.includes(eventType)
        ? current.filter((e) => e !== eventType)
        : [...current, eventType]

      return {
        ...prev,
        [channelName]: updated,
      }
    })
  }

  const handleSave = async () => {
    try {
      setError(null)
      setSuccess(null)

      if (Object.keys(localChatIds).length === 0) {
        setError('At least one notification channel is required')
        return
      }

      await onSave?.({
        chatIds: localChatIds,
        eventMappings: localMappings,
      })

      setSuccess('Notification settings saved!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification settings')
    }
  }

  const handleTestNotification = async (channelName: string) => {
    try {
      // Simulated test notification
      const chatId = localChatIds[channelName]
      if (!chatId) return

      setSuccess(`Test notification sent to ${channelName}!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test notification')
    }
  }

  const previewNotification = (eventType: NotificationEventType): string => {
    const previews: Record<NotificationEventType, string> = {
      task_assigned: '📌 You have been assigned a new task: "Update API documentation"',
      task_commented: '💬 New comment on task: "Code review completed, please address feedback"',
      task_blocked: '🚫 Task blocked by: "Backend database migration" - waiting for completion',
      task_completed: '✅ Task completed: "Implement user authentication"',
      status_change: '📊 Task status changed to: development',
    }
    return previews[eventType]
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-green-50 text-green-800 text-sm">
          {success}
        </div>
      )}

      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Add Notification Channel</h3>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Channel Name
            </label>
            <Input
              placeholder="e.g., Development Team, Alerts, etc."
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Telegram Chat ID
            </label>
            <Input
              placeholder="-1234567890"
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500 mt-1">
              Get your chat ID from Telegram with /id command
            </p>
          </div>

          <Button
            onClick={handleAddChannel}
            disabled={isLoading || !newChannelName.trim() || !newChannelId.trim()}
            className="w-full"
          >
            Add Channel
          </Button>
        </div>
      </Card>

      {Object.keys(localChatIds).length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Configure Event Notifications</h3>

          {Object.entries(localChatIds).map(([channelName, chatId]) => (
            <Card key={channelName} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{channelName}</h4>
                  <p className="text-xs text-slate-500 font-mono">{chatId}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveChannel(channelName)}
                  disabled={isLoading}
                >
                  Remove
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  Select which events to notify about:
                </p>

                <div className="space-y-2">
                  {EVENT_TYPES.map((event) => {
                    const isActive = (localMappings[channelName] || []).includes(event.value)
                    return (
                      <div key={event.value} className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`${channelName}-${event.value}`}
                          checked={isActive}
                          onChange={() => handleToggleEvent(channelName, event.value)}
                          disabled={isLoading}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`${channelName}-${event.value}`}
                            className="text-sm font-medium text-slate-900 block cursor-pointer"
                          >
                            {event.label}
                          </label>
                          <p className="text-xs text-slate-500 mt-1">
                            {previewNotification(event.value)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestNotification(channelName)}
                disabled={isLoading}
                className="w-full"
              >
                📤 Send Test Notification
              </Button>
            </Card>
          ))}
        </div>
      )}

      {Object.keys(localChatIds).length > 0 && (
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Saving...' : 'Save Notification Settings'}
        </Button>
      )}
    </div>
  )
}
