import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { IntegrationStatus } from '../types'

interface IntegrationCardProps {
  title: string
  icon: string
  status: IntegrationStatus
  enabled: boolean
  onToggle: (enabled: boolean) => void
  onSave: () => void
  onTest: () => void
  isLoading: boolean
  children: React.ReactNode
}

function IntegrationCard({
  title,
  icon,
  status,
  enabled,
  onToggle,
  onSave,
  onTest,
  isLoading,
  children,
}: IntegrationCardProps) {
  const statusColors: Record<IntegrationStatus, string> = {
    connected: 'bg-green-100 text-green-800',
    not_configured: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  }

  const statusLabels: Record<IntegrationStatus, string> = {
    connected: 'Connected',
    not_configured: 'Not Configured',
    error: 'Error',
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Enable</span>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isLoading}
          />
        </div>
      </div>

      {enabled && (
        <>
          <div className="space-y-4 pt-4">{children}</div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={onTest}
              variant="outline"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              onClick={onSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

export function IntegrationsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // GitHub Integration State
  const [githubEnabled, setGithubEnabled] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [githubStatus, setGithubStatus] = useState<IntegrationStatus>('not_configured')

  // Telegram Integration State
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramStatus, setTelegramStatus] = useState<IntegrationStatus>('not_configured')

  // Calendar Integration State
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarToken, setCalendarToken] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [calendarStatus, setCalendarStatus] = useState<IntegrationStatus>('not_configured')

  const handleGithubTest = async () => {
    setLoading(true)
    try {
      // Simulated test - in real app would call API
      if (githubToken && githubUsername) {
        setGithubStatus('connected')
        setMessage({ type: 'success', text: 'GitHub connection successful!' })
      } else {
        setGithubStatus('error')
        setMessage({ type: 'error', text: 'GitHub token and username required' })
      }
    } catch (err) {
      setGithubStatus('error')
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to test GitHub' })
    } finally {
      setLoading(false)
    }
  }

  const handleGithubSave = async () => {
    setLoading(true)
    try {
      // Simulated save - in real app would call API
      if (githubToken) {
        setMessage({ type: 'success', text: 'GitHub configuration saved!' })
      } else {
        throw new Error('GitHub token is required')
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save GitHub config' })
    } finally {
      setLoading(false)
    }
  }

  const handleTelegramTest = async () => {
    setLoading(true)
    try {
      // Simulated test
      if (telegramToken && telegramChatId) {
        setTelegramStatus('connected')
        setMessage({ type: 'success', text: 'Telegram connection successful!' })
      } else {
        setTelegramStatus('error')
        setMessage({ type: 'error', text: 'Telegram token and chat ID required' })
      }
    } catch (err) {
      setTelegramStatus('error')
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to test Telegram' })
    } finally {
      setLoading(false)
    }
  }

  const handleTelegramSave = async () => {
    setLoading(true)
    try {
      // Simulated save
      if (telegramToken && telegramChatId) {
        setMessage({ type: 'success', text: 'Telegram configuration saved!' })
      } else {
        throw new Error('Telegram token and chat ID are required')
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save Telegram config' })
    } finally {
      setLoading(false)
    }
  }

  const handleCalendarTest = async () => {
    setLoading(true)
    try {
      // Simulated test
      if (calendarToken && calendarId) {
        setCalendarStatus('connected')
        setMessage({ type: 'success', text: 'Google Calendar connection successful!' })
      } else {
        setCalendarStatus('error')
        setMessage({ type: 'error', text: 'Calendar token and calendar ID required' })
      }
    } catch (err) {
      setCalendarStatus('error')
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to test Calendar' })
    } finally {
      setLoading(false)
    }
  }

  const handleCalendarSave = async () => {
    setLoading(true)
    try {
      // Simulated save
      if (calendarToken && calendarId) {
        setMessage({ type: 'success', text: 'Google Calendar configuration saved!' })
      } else {
        throw new Error('Calendar token and calendar ID are required')
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save Calendar config' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <h2>Integration Settings</h2>
        <p className="text-sm text-slate-600 mb-6">
          Configure external integrations for GitHub, Telegram notifications, and Google Calendar sync.
        </p>

        {message && (
          <div
            className={`p-3 rounded-md mb-6 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* GitHub Integration */}
          <IntegrationCard
            title="GitHub Integration"
            icon="🐙"
            status={githubStatus}
            enabled={githubEnabled}
            onToggle={setGithubEnabled}
            onSave={handleGithubSave}
            onTest={handleGithubTest}
            isLoading={loading}
          >
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Personal Access Token
                </label>
                <Input
                  type="password"
                  placeholder="ghp_..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Create a token with repo and issue scopes on GitHub
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  GitHub Username
                </label>
                <Input
                  type="text"
                  placeholder="your-github-username"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          </IntegrationCard>

          {/* Telegram Integration */}
          <IntegrationCard
            title="Telegram Notifications"
            icon="✈️"
            status={telegramStatus}
            enabled={telegramEnabled}
            onToggle={setTelegramEnabled}
            onSave={handleTelegramSave}
            onTest={handleTelegramTest}
            isLoading={loading}
          >
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Bot Token
                </label>
                <Input
                  type="password"
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Create a bot with @BotFather on Telegram
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Chat ID
                </label>
                <Input
                  type="text"
                  placeholder="-1234567890"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Your Telegram chat ID (can be found with /id command)
                </p>
              </div>
            </div>
          </IntegrationCard>

          {/* Google Calendar Integration */}
          <IntegrationCard
            title="Google Calendar Sync"
            icon="📅"
            status={calendarStatus}
            enabled={calendarEnabled}
            onToggle={setCalendarEnabled}
            onSave={handleCalendarSave}
            onTest={handleCalendarTest}
            isLoading={loading}
          >
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  API Key / Token
                </label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={calendarToken}
                  onChange={(e) => setCalendarToken(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Create a service account key from Google Cloud Console
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Calendar ID
                </label>
                <Input
                  type="text"
                  placeholder="your-calendar-id@gmail.com"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Find this in Google Calendar settings
                </p>
              </div>
            </div>
          </IntegrationCard>
        </div>
      </section>
    </main>
  )
}
