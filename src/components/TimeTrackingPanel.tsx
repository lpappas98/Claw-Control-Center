import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import type { TimeLog } from '../types'

interface TimeTrackingPanelProps {
  taskId: string
  estimatedHours?: number
  actualHours?: number
  timeLogs?: TimeLog[]
  onAddTimeLog: (hours: number, note: string) => Promise<void>
}

export function TimeTrackingPanel({
  taskId,
  estimatedHours = 0,
  actualHours = 0,
  timeLogs = [],
  onAddTimeLog,
}: TimeTrackingPanelProps) {
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [manualHours, setManualHours] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Timer effect
  useEffect(() => {
    if (!timerRunning) return

    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [timerRunning])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleAddManualLog = async () => {
    const hours = parseFloat(manualHours)
    if (!manualHours.trim() || isNaN(hours) || hours <= 0) {
      setError('Please enter valid hours')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onAddTimeLog(hours, manualNote)
      setManualHours('')
      setManualNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log time')
    } finally {
      setLoading(false)
    }
  }

  const handleStopTimer = async () => {
    if (timerSeconds <= 0) {
      setTimerRunning(false)
      return
    }

    const hours = timerSeconds / 3600
    setLoading(true)
    setError(null)

    try {
      await onAddTimeLog(hours, `Timer: ${formatTime(timerSeconds)}`)
      setTimerRunning(false)
      setTimerSeconds(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log time')
    } finally {
      setLoading(false)
    }
  }

  const burndownPercent = estimatedHours > 0 ? (actualHours / estimatedHours) * 100 : 0
  const remainingHours = Math.max(0, estimatedHours - actualHours)
  const isOverBudget = actualHours > estimatedHours && estimatedHours > 0

  return (
    <div className="panel" style={{ padding: 12, marginTop: 12, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>Time Tracking</h4>

      {error && (
        <div
          style={{
            padding: 8,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: 12,
            marginBottom: 12,
            border: '1px solid #7b2f2f',
          }}
        >
          {error}
        </div>
      )}

      <div className="stack" style={{ gap: 12 }}>
        {/* Timer Section */}
        <div
          style={{
            padding: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 8,
            border: '1px solid #242b45',
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Stopwatch Timer</div>
            <div
              style={{
                fontSize: 32,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: timerRunning ? '#ffa1e2' : '#cbd5e1',
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              {formatTime(timerSeconds)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!timerRunning ? (
              <>
                <Button
                  variant="default"
                  onClick={() => setTimerRunning(true)}
                  disabled={loading}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Start
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setTimerSeconds(0)}
                  disabled={timerSeconds === 0}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Reset
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  onClick={() => setTimerRunning(false)}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Pause
                </Button>
                <Button
                  variant="default"
                  onClick={handleStopTimer}
                  disabled={loading || timerSeconds === 0}
                  type="button"
                  style={{ flex: 1, backgroundColor: '#2a7049' }}
                >
                  {loading ? 'Logging...' : 'Log Time'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Manual Time Entry */}
        <div
          style={{
            padding: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: 8,
            border: '1px solid #242b45',
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Manual Time Entry</div>
          <div className="stack" style={{ gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="field">
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Hours</label>
                <input
                  type="number"
                  placeholder="e.g., 2.5"
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="input"
                  min="0"
                  step="0.25"
                  disabled={loading}
                />
              </div>
              <div className="field">
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Code review"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="input"
                  disabled={loading}
                />
              </div>
            </div>
            <Button
              variant="default"
              onClick={handleAddManualLog}
              disabled={loading || !manualHours.trim()}
              type="button"
              style={{ alignSelf: 'flex-start' }}
            >
              {loading ? 'Adding...' : 'Add Time'}
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="stack" style={{ gap: 8 }}>
          <div className="grid-2" style={{ gap: 8 }}>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Estimated</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#cbd5e1' }}>
                {estimatedHours}
                <span style={{ fontSize: 12, color: '#64748b' }}>h</span>
              </div>
            </div>
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Actual</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: isOverBudget ? '#ef4444' : '#8dffc2' }}>
                {actualHours}
                <span style={{ fontSize: 12, color: '#64748b' }}>h</span>
              </div>
            </div>
          </div>

          {estimatedHours > 0 && (
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: 10, borderRadius: 6 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: '#94a3b8',
                  marginBottom: 6,
                }}
              >
                <span>Progress</span>
                <span>
                  {actualHours} / {estimatedHours}h {isOverBudget && ' (Over)'}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: 'rgba(100, 116, 139, 0.2)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(burndownPercent, 100)}%`,
                    backgroundColor: isOverBudget ? '#ef4444' : '#8dffc2',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              {remainingHours > 0 && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  {remainingHours}h remaining
                </div>
              )}
            </div>
          )}
        </div>

        {/* Time Logs Table */}
        {timeLogs && timeLogs.length > 0 && (
          <div className="panel" style={{ padding: 8, backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 12 }}>Time Logs ({timeLogs.length})</h4>
            <div className="stack" style={{ gap: 6 }}>
              {timeLogs.slice(-5).map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 6,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  <div>
                    <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{log.hours}h</span>
                    {log.note && <span style={{ color: '#94a3b8', marginLeft: 6 }}>— {log.note}</span>}
                  </div>
                  <div style={{ color: '#64748b' }}>
                    {new Date(log.loggedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {timeLogs.length > 5 && (
                <div style={{ color: '#64748b', fontSize: 10, textAlign: 'center', paddingTop: 4 }}>
                  +{timeLogs.length - 5} more entries
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
