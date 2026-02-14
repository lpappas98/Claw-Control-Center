import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { BoardLane, Priority, Task } from '../types'

const LANES: BoardLane[] = ['proposed', 'queued', 'development', 'review', 'done']
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']
const LANE_DISPLAY: { [key in BoardLane]: string } = {
  proposed: 'Proposed',
  queued: 'Queued',
  development: 'Development',
  review: 'Review',
  done: 'Done',
}

interface Agent {
  id: string
  name: string
  emoji?: string
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function normalizeLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ── Style constants ─────────────────────────────────── */

const TAG_STYLES: { [key: string]: { bg: string; text: string; border: string } } = {
  Epic: { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd', border: 'rgba(139,92,246,0.2)' },
  UI: { bg: 'rgba(14,165,233,0.15)', text: '#7dd3fc', border: 'rgba(14,165,233,0.2)' },
  Backend: { bg: 'rgba(168,85,247,0.15)', text: '#d8b4fe', border: 'rgba(168,85,247,0.2)' },
  QA: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.2)' },
  Arch: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.2)' },
  Frontend: { bg: 'rgba(6,182,212,0.15)', text: '#67e8f9', border: 'rgba(6,182,212,0.2)' },
  Docs: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
}

const P_STYLES: { [key: string]: { bg: string; text: string; border: string } } = {
  P0: { bg: 'rgba(239,68,68,0.15)', text: '#fca5a5', border: 'rgba(239,68,68,0.2)' },
  P1: { bg: 'rgba(245,158,11,0.15)', text: '#fde68a', border: 'rgba(245,158,11,0.2)' },
  P2: { bg: 'rgba(234,179,8,0.15)', text: '#fef08a', border: 'rgba(234,179,8,0.2)' },
  P3: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
}

const DEFAULT_BADGE = { bg: 'rgba(51,65,85,0.5)', text: '#cbd5e1', border: 'rgba(51,65,85,0.3)' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(30,41,59,0.5)',
  border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#e2e8f0',
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as const,
  cursor: 'pointer',
  paddingRight: 32,
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'none' as const,
}

/* ── Sub-components ──────────────────────────────────── */

function Badge({ children, style: badgeStyle }: { children: React.ReactNode; style?: { bg: string; text: string; border: string } }) {
  const s = badgeStyle || DEFAULT_BADGE
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 11,
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: 6,
    }}>
      {children}
    </label>
  )
}

function SelectArrow() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/* ── Main component ──────────────────────────────────── */

export function TaskModal({
  adapter,
  task,
  onClose,
  onSaved,
}: {
  adapter: Adapter
  task: Task
  onClose: () => void
  onSaved: (t: Task) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')
  const [agents, setAgents] = useState<Agent[]>([])

  const [draftTitle, setDraftTitle] = useState(String(task.title ?? ''))
  const [draftLane, setDraftLane] = useState<BoardLane>(task.lane)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftOwner, setDraftOwner] = useState(String(task.owner ?? ''))
  const [draftProblem, setDraftProblem] = useState(String(task.problem ?? ''))
  const [draftScope, setDraftScope] = useState(String(task.scope ?? ''))
  const [draftAcceptanceRaw, setDraftAcceptanceRaw] = useState((task.acceptanceCriteria ?? []).join('\n'))

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error('Failed to fetch agents:', err))
  }, [])

  useEffect(() => {
    setDraftTitle(String(task.title ?? ''))
    setDraftLane(task.lane)
    setDraftPriority(task.priority)
    setDraftOwner(String(task.owner ?? ''))
    setDraftProblem(String(task.problem ?? ''))
    setDraftScope(String(task.scope ?? ''))
    setDraftAcceptanceRaw((task.acceptanceCriteria ?? []).join('\n'))
  }, [task])

  const dirty =
    draftTitle !== task.title ||
    draftLane !== task.lane ||
    draftPriority !== task.priority ||
    draftOwner !== (task.owner ?? '') ||
    draftProblem !== (task.problem ?? '') ||
    draftScope !== (task.scope ?? '') ||
    draftAcceptanceRaw.trim() !== (task.acceptanceCriteria ?? []).join('\n').trim()

  const acceptanceCriteria = useMemo(() => normalizeLines(draftAcceptanceRaw), [draftAcceptanceRaw])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await adapter.updateTask({
        id: task.id,
        title: draftTitle.trim() || task.title,
        lane: draftLane,
        priority: draftPriority,
        owner: draftOwner.trim() || undefined,
        problem: draftProblem.trim() || undefined,
        scope: draftScope.trim() || undefined,
        acceptanceCriteria,
      })
      onSaved(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const tagStyle = task.tag ? TAG_STYLES[task.tag] : undefined
  const pStyle = P_STYLES[task.priority] || DEFAULT_BADGE

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 50,
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          cursor: 'pointer',
          animation: 'fadeIn 0.15s ease-out',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 672,
        maxHeight: '90vh',
        background: '#0f172a',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.2s ease-out',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(51,65,85,0.4)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {tagStyle && <Badge style={tagStyle}>{task.tag}</Badge>}
              <Badge style={pStyle}>{task.priority}</Badge>
              <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{task.id}</span>
            </div>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Enter title..."
              style={{
                width: '100%',
                fontSize: 18,
                fontWeight: 600,
                color: '#f1f5f9',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: 0,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(30,41,59,0.8)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          padding: '0 24px',
          borderBottom: '1px solid rgba(51,65,85,0.4)',
          flexShrink: 0,
        }}>
          {(['details', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                textTransform: 'capitalize',
                color: activeTab === tab ? '#60a5fa' : '#94a3b8',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {error && (
            <div style={{
              background: 'rgba(127,29,29,0.2)',
              border: '1px solid rgba(185,28,28,0.5)',
              borderRadius: 8,
              padding: 16,
              fontSize: 14,
              color: '#fca5a5',
              marginBottom: 20,
            }}>
              <strong style={{ fontWeight: 600 }}>Error:</strong> {error}
            </div>
          )}

          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Status / Priority / Owner row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={LANE_DISPLAY[draftLane]}
                      onChange={(e) => {
                        const laneKey = Object.entries(LANE_DISPLAY).find(([, display]) => display === e.target.value)?.[0] as BoardLane
                        if (laneKey) setDraftLane(laneKey)
                      }}
                      style={selectStyle}
                    >
                      {LANES.map((l) => (
                        <option key={l} value={LANE_DISPLAY[l]}>{LANE_DISPLAY[l]}</option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                </div>

                <div>
                  <FieldLabel>Priority</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={draftPriority}
                      onChange={(e) => setDraftPriority(e.target.value as Priority)}
                      style={selectStyle}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                </div>

                <div>
                  <FieldLabel>Owner</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={draftOwner}
                      onChange={(e) => setDraftOwner(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="">—</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <SelectArrow />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(51,65,85,0.3)' }} />

              {/* Problem */}
              <div>
                <FieldLabel>Problem</FieldLabel>
                <textarea
                  placeholder="Why does this task exist?"
                  rows={3}
                  value={draftProblem}
                  onChange={(e) => setDraftProblem(e.target.value)}
                  style={textareaStyle}
                />
              </div>

              {/* Scope */}
              <div>
                <FieldLabel>Scope</FieldLabel>
                <textarea
                  placeholder="What is in/out of scope?"
                  rows={3}
                  value={draftScope}
                  onChange={(e) => setDraftScope(e.target.value)}
                  style={textareaStyle}
                />
              </div>

              {/* Acceptance Criteria */}
              <div>
                <FieldLabel>Acceptance Criteria</FieldLabel>
                <textarea
                  placeholder="One criterion per line"
                  rows={4}
                  value={draftAcceptanceRaw}
                  onChange={(e) => setDraftAcceptanceRaw(e.target.value)}
                  style={textareaStyle}
                />
              </div>

              <div style={{ borderTop: '1px solid rgba(51,65,85,0.3)' }} />

              {/* Metadata */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 12, color: '#64748b' }}>
                <span>Created <span style={{ color: '#94a3b8' }}>{fmtWhen(task.createdAt)}</span></span>
                <span>Updated <span style={{ color: '#94a3b8' }}>{fmtWhen(task.updatedAt)}</span></span>
                <span><span style={{ color: '#94a3b8' }}>{task.statusHistory?.length ?? 0}</span> event{(task.statusHistory?.length ?? 0) !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {(task.statusHistory?.length ?? 0) > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(task.statusHistory ?? []).map((h, idx) => (
                    <div key={`${h.at}-${idx}`} style={{
                      background: 'rgba(30,41,59,0.5)',
                      border: '1px solid rgba(51,65,85,0.4)',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 14,
                    }}>
                      <div style={{ fontWeight: 500, color: '#fff' }}>
                        {h.to}
                        {h.from && <span style={{ color: '#94a3b8', fontWeight: 400 }}> ← {h.from}</span>}
                      </div>
                      {h.note && <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>{h.note}</div>}
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{fmtWhen(h.at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#64748b' }}>
                  <svg width="32" height="32" fill="none" stroke="#475569" viewBox="0 0 24 24" style={{ margin: '0 auto 8px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No history yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '16px 24px',
          borderTop: '1px solid rgba(51,65,85,0.4)',
          background: 'rgba(15,23,42,0.8)',
          flexShrink: 0,
          gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              color: '#cbd5e1',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1' }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !dirty}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#fff',
              background: busy || !dirty ? '#334155' : '#2563eb',
              border: 'none',
              borderRadius: 8,
              cursor: busy || !dirty ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              boxShadow: busy || !dirty ? 'none' : '0 10px 15px -3px rgba(37,99,235,0.2)',
              opacity: busy || !dirty ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!busy && dirty) e.currentTarget.style.background = '#3b82f6' }}
            onMouseLeave={(e) => { if (!busy && dirty) e.currentTarget.style.background = '#2563eb' }}
          >
            {busy ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `}</style>
      </div>
    </div>
  )
}
