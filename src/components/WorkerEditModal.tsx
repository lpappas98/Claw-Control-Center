import { useEffect, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { WorkerMetadata } from '../types'

export function WorkerEditModal({
  adapter,
  slot,
  initialMetadata,
  onClose,
  onSaved,
}: {
  adapter: Adapter
  slot: string
  initialMetadata?: WorkerMetadata | null
  onClose: () => void
  onSaved: (metadata: WorkerMetadata) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftName, setDraftName] = useState(initialMetadata?.name ?? '')
  const [draftRole, setDraftRole] = useState(initialMetadata?.role ?? '')
  const [draftEmoji, setDraftEmoji] = useState(initialMetadata?.emoji ?? '')
  const [draftModel, setDraftModel] = useState(initialMetadata?.model ?? '')

  useEffect(() => {
    setDraftName(initialMetadata?.name ?? '')
    setDraftRole(initialMetadata?.role ?? '')
    setDraftEmoji(initialMetadata?.emoji ?? '')
    setDraftModel(initialMetadata?.model ?? '')
  }, [initialMetadata])

  const dirty =
    draftName !== (initialMetadata?.name ?? '') ||
    draftRole !== (initialMetadata?.role ?? '') ||
    draftEmoji !== (initialMetadata?.emoji ?? '') ||
    draftModel !== (initialMetadata?.model ?? '')

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await adapter.updateWorkerMetadata({
        slot,
        name: draftName.trim() || undefined,
        role: draftRole.trim() || undefined,
        emoji: draftEmoji.trim() || undefined,
        model: draftModel.trim() || undefined,
      })
      onSaved(updated)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div 
      className="modal-backdrop" 
      role="presentation" 
      onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}
    >
      <div 
        className="modal" 
        role="dialog" 
        aria-modal="true" 
        aria-label={`Edit worker ${slot}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Edit Worker: {slot}</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Customize how this worker appears in Operator Hub
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && (
          <div className="callout warn" style={{ marginBottom: 10 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="modal-body">
          <div className="task-grid">
            <label className="field">
              <div className="muted">Name</div>
              <input 
                value={draftName} 
                onChange={(e) => setDraftName(e.target.value)} 
                placeholder={`Default: ${slot}`}
                autoFocus
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                Leave empty to use default slot name
              </div>
            </label>

            <label className="field">
              <div className="muted">Role</div>
              <input 
                value={draftRole} 
                onChange={(e) => setDraftRole(e.target.value)}
                placeholder="e.g., Developer, QA, Architect"
              />
            </label>

            <label className="field">
              <div className="muted">Emoji</div>
              <input 
                value={draftEmoji} 
                onChange={(e) => setDraftEmoji(e.target.value)}
                placeholder="🤖"
                maxLength={4}
              />
            </label>

            <label className="field">
              <div className="muted">Model</div>
              <input 
                value={draftModel} 
                onChange={(e) => setDraftModel(e.target.value)}
                placeholder="e.g., gpt-4, claude-3-opus"
              />
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <div className="muted" style={{ fontSize: 12 }}>
            All fields are optional
          </div>
          <div className="stack-h">
            <button 
              className="btn ghost" 
              type="button" 
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button 
              className="btn" 
              type="button" 
              onClick={save} 
              disabled={busy || !dirty}
            >
              {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
