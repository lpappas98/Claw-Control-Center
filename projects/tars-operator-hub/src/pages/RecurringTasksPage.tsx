import { useState, useEffect } from 'react'

interface RecurringTask {
  id: string
  name: string
  description?: string
  schedule: string // cron expression
  nextRun?: string
  lastRun?: string
  enabled: boolean
  createdAt: string
}

interface EditingRoutine extends Partial<RecurringTask> {
  id?: string
}

export function RecurringTasksPage() {
  const [routines, setRoutines] = useState<RecurringTask[]>([
    {
      id: 'routine-1',
      name: 'Weekly Team Sync',
      description: 'Every Monday 9am for weekly team meeting',
      schedule: '0 9 ? * MON',
      nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'routine-2',
      name: 'Code Review Check',
      description: 'Check for pending code reviews daily',
      schedule: '0 10 * * ?',
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'routine-3',
      name: 'Backup Database',
      description: 'Automated daily backup at midnight',
      schedule: '0 0 * * ?',
      nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      enabled: false,
      createdAt: new Date().toISOString(),
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRoutine, setEditingRoutine] = useState<EditingRoutine>({})
  const [error, setError] = useState<string | null>(null)
  const [cronHelper, setCronHelper] = useState('')
  const [saving, setSaving] = useState(false)

  const handleOpenNew = () => {
    setEditingId(null)
    setEditingRoutine({
      name: '',
      description: '',
      schedule: '0 10 * * ?',
      enabled: true,
    })
    setError(null)
    setShowModal(true)
  }

  const handleOpenEdit = (routine: RecurringTask) => {
    setEditingId(routine.id)
    setEditingRoutine(routine)
    setError(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!editingRoutine.name?.trim()) {
      setError('Please enter a routine name')
      return
    }
    if (!editingRoutine.schedule?.trim()) {
      setError('Please enter a cron expression')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 300))

      if (editingId) {
        // Update existing
        setRoutines((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? { ...r, ...editingRoutine, id: editingId, createdAt: r.createdAt }
              : r,
          ),
        )
      } else {
        // Create new
        const newRoutine: RecurringTask = {
          id: `routine-${Date.now()}`,
          name: editingRoutine.name || '',
          description: editingRoutine.description,
          schedule: editingRoutine.schedule || '0 10 * * ?',
          enabled: editingRoutine.enabled !== undefined ? editingRoutine.enabled : true,
          createdAt: new Date().toISOString(),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }
        setRoutines((prev) => [newRoutine, ...prev])
      }

      setShowModal(false)
      setEditingRoutine({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save routine')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return

    try {
      setRoutines((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete routine')
    }
  }

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update routine')
    }
  }

  const getCronDescription = (cron: string) => {
    // Simple cron descriptions
    if (cron === '0 10 * * ?') return 'Every day at 10:00 AM'
    if (cron === '0 0 * * ?') return 'Every day at midnight'
    if (cron === '0 9 ? * MON') return 'Every Monday at 9:00 AM'
    if (cron === '0 10 ? * MON-FRI') return 'Every weekday at 10:00 AM'
    return cron
  }

  return (
    <main className="main-grid">
      <div className="panel span-4" style={{ padding: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Recurring Tasks</h2>
            <div className="muted" style={{ marginTop: 4 }}>
              Manage automated task routines and schedules
            </div>
          </div>
          <button className="btn" type="button" onClick={handleOpenNew}>
            + New Routine
          </button>
        </div>

        {error && (
          <div
            style={{
              color: '#ef4444',
              marginBottom: 12,
              padding: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 4,
              fontSize: 12,
              border: '1px solid #7b2f2f',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {routines.length > 0 ? (
            routines.map((routine) => (
              <div
                key={routine.id}
                className="panel"
                style={{
                  padding: 14,
                  border: routine.enabled ? '1px solid #242b45' : '1px solid #3a4160',
                  opacity: routine.enabled ? 1 : 0.6,
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                      {routine.name}
                    </h3>
                    {routine.description && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                        {routine.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn ghost"
                      onClick={() => handleOpenEdit(routine)}
                      type="button"
                      style={{ fontSize: 12, padding: '4px 8px' }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => handleDelete(routine.id)}
                      type="button"
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        color: '#ef4444',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="stack" style={{ gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Schedule</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#cbd5e1',
                        padding: 8,
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                      }}
                    >
                      {routine.schedule}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                      {getCronDescription(routine.schedule)}
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Next Run</div>
                      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                        {routine.nextRun ? new Date(routine.nextRun).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Last Run</div>
                      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                        {routine.lastRun ? new Date(routine.lastRun).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {routine.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      className="btn ghost"
                      onClick={() => handleToggleEnabled(routine.id, routine.enabled)}
                      type="button"
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        backgroundColor: routine.enabled ? 'rgba(45, 212, 191, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        borderColor: routine.enabled ? '#2dd4bf' : '#64748b',
                        color: routine.enabled ? '#2dd4bf' : '#cbd5e1',
                      }}
                    >
                      {routine.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 20,
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              No recurring tasks yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => (e.target === e.currentTarget ? setShowModal(false) : null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit recurring task' : 'Create recurring task'}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h3 style={{ margin: '6px 0 0' }}>
                {editingId ? 'Edit Recurring Task' : 'New Recurring Task'}
              </h3>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Close
              </button>
            </div>

            <div className="modal-body" style={{ padding: 16 }}>
              <div className="stack" style={{ gap: 14 }}>
                {error && (
                  <div
                    style={{
                      padding: 10,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: 6,
                      color: '#ef4444',
                      fontSize: 12,
                      border: '1px solid #7b2f2f',
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="field">
                  <label className="muted">Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Weekly Team Meeting"
                    value={editingRoutine.name || ''}
                    onChange={(e) =>
                      setEditingRoutine((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="input"
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label className="muted">Description (optional)</label>
                  <textarea
                    placeholder="What does this task do?"
                    value={editingRoutine.description || ''}
                    onChange={(e) =>
                      setEditingRoutine((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="input"
                    rows={3}
                    disabled={saving}
                  />
                </div>

                <div className="field">
                  <label className="muted">Cron Expression</label>
                  <input
                    type="text"
                    placeholder="0 10 * * ?"
                    value={editingRoutine.schedule || ''}
                    onChange={(e) =>
                      setEditingRoutine((prev) => ({ ...prev, schedule: e.target.value }))
                    }
                    className="input"
                    disabled={saving}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                    Use standard cron format: minute hour day month weekday
                  </div>

                  {/* Cron Presets */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Quick presets:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { label: 'Daily 10am', cron: '0 10 * * ?' },
                        { label: 'Midnight', cron: '0 0 * * ?' },
                        { label: 'Every Monday 9am', cron: '0 9 ? * MON' },
                        { label: 'Weekdays 10am', cron: '0 10 ? * MON-FRI' },
                      ].map((preset) => (
                        <button
                          key={preset.cron}
                          className="btn ghost"
                          onClick={() =>
                            setEditingRoutine((prev) => ({ ...prev, schedule: preset.cron }))
                          }
                          type="button"
                          style={{ fontSize: 10, padding: '4px 8px' }}
                          disabled={saving}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label className="muted">Status</label>
                  <select
                    value={editingRoutine.enabled ? 'enabled' : 'disabled'}
                    onChange={(e) =>
                      setEditingRoutine((prev) => ({
                        ...prev,
                        enabled: e.target.value === 'enabled',
                      }))
                    }
                    className="input"
                    disabled={saving}
                  >
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    className="btn ghost"
                    onClick={() => setShowModal(false)}
                    type="button"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleSave}
                    type="button"
                    disabled={saving || !editingRoutine.name?.trim()}
                  >
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Routine'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
