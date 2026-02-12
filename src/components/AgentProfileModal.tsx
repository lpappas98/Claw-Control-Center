import { useEffect, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AgentProfile } from '../types'

export function AgentProfileModal({
  adapter,
  profile,
  onClose,
  onSaved,
}: {
  adapter: Adapter
  profile?: AgentProfile | null
  onClose: () => void
  onSaved: (profile: AgentProfile) => void
}) {
  const isEdit = !!profile
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftName, setDraftName] = useState(profile?.name ?? '')
  const [draftRole, setDraftRole] = useState(profile?.role ?? '')
  const [draftEmoji, setDraftEmoji] = useState(profile?.emoji ?? '')
  const [draftModel, setDraftModel] = useState(profile?.model ?? '')

  useEffect(() => {
    setDraftName(profile?.name ?? '')
    setDraftRole(profile?.role ?? '')
    setDraftEmoji(profile?.emoji ?? '')
    setDraftModel(profile?.model ?? '')
  }, [profile])

  const dirty =
    draftName !== (profile?.name ?? '') ||
    draftRole !== (profile?.role ?? '') ||
    draftEmoji !== (profile?.emoji ?? '') ||
    draftModel !== (profile?.model ?? '')

  const canSave = draftName.trim() && draftRole.trim()

  async function save() {
    if (!canSave) return
    
    setBusy(true)
    setError(null)
    try {
      if (isEdit && profile) {
        const updated = await adapter.updateAgentProfile({
          id: profile.id,
          name: draftName.trim(),
          role: draftRole.trim(),
          emoji: draftEmoji.trim() || undefined,
          model: draftModel.trim() || undefined,
        })
        onSaved(updated)
      } else {
        const created = await adapter.createAgentProfile({
          name: draftName.trim(),
          role: draftRole.trim(),
          emoji: draftEmoji.trim() || undefined,
          model: draftModel.trim() || undefined,
        })
        onSaved(created)
      }
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
        aria-label={isEdit ? `Edit agent profile ${profile?.name}` : 'Create new agent profile'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>{isEdit ? 'Edit Agent Profile' : 'Create Agent Profile'}</h3>
            {isEdit && profile && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {profile.emoji} {profile.name}
              </div>
            )}
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
              <div className="muted">Name *</div>
              <input 
                value={draftName} 
                onChange={(e) => setDraftName(e.target.value)} 
                placeholder="e.g., Code Assistant"
                autoFocus
              />
            </label>

            <label className="field">
              <div className="muted">Role *</div>
              <input 
                value={draftRole} 
                onChange={(e) => setDraftRole(e.target.value)}
                placeholder="e.g., Developer, Designer, PM"
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
            * Required fields
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
              disabled={busy || !canSave || (isEdit && !dirty)}
            >
              {busy ? 'Saving…' : isEdit ? (dirty ? 'Save changes' : 'Saved') : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
