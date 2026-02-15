import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { BoardLane, Priority, Task, TaskWork, TaskWorkSummary } from '../types'
import { deleteTask } from '../services/api'

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

interface Project {
  id: string
  name: string
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return timestamp
  }
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

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ margin: '0 auto 12px', opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, color: '#64748b' }}>{message}</div>
    </div>
  )
}

/* ── Tab Content Components ──────────────────────────── */

function DetailsTab({
  task,
  agents,
  projects,
  draftLane,
  draftPriority,
  draftOwner,
  draftProject,
  draftProblem,
  draftScope,
  draftAcceptanceRaw,
  draftNote,
  setDraftLane,
  setDraftPriority,
  setDraftOwner,
  setDraftProject,
  setDraftProblem,
  setDraftScope,
  setDraftAcceptanceRaw,
  setDraftNote,
  laneChanging,
}: {
  task: Task
  agents: Agent[]
  projects: Project[]
  draftLane: BoardLane
  draftPriority: Priority
  draftOwner: string
  draftProject: string
  draftProblem: string
  draftScope: string
  draftAcceptanceRaw: string
  draftNote: string
  setDraftLane: (v: BoardLane) => void
  setDraftPriority: (v: Priority) => void
  setDraftOwner: (v: string) => void
  setDraftProject: (v: string) => void
  setDraftProblem: (v: string) => void
  setDraftScope: (v: string) => void
  setDraftAcceptanceRaw: (v: string) => void
  setDraftNote: (v: string) => void
  laneChanging: boolean
}) {
  return (
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
                <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ${a.name}` : a.name}</option>
              ))}
            </select>
            <SelectArrow />
          </div>
        </div>
      </div>

      {/* Project dropdown */}
      <div>
        <FieldLabel>Project</FieldLabel>
        <div style={{ position: 'relative' }}>
          <select
            value={draftProject}
            onChange={(e) => setDraftProject(e.target.value)}
            style={selectStyle}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <SelectArrow />
        </div>
      </div>

      {laneChanging && (
        <div>
          <FieldLabel>Reason for lane change (optional)</FieldLabel>
          <textarea
            placeholder="Why is this task moving? (e.g., 'Failed QA: API routes use wrong path')"
            rows={2}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            style={textareaStyle}
          />
        </div>
      )}

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
  )
}

function WorkDoneTab({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(true)
  const [workData, setWorkData] = useState<(TaskWork & TaskWorkSummary) | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/tasks/${taskId}/work`)
      .then((res) => res.json())
      .then((data) => setWorkData(data))
      .catch((err) => console.error('Failed to load work data:', err))
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748b' }}>
        Loading work data...
      </div>
    )
  }

  if (!workData) {
    return (
      <EmptyState
        icon={<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        message="No work data available yet"
      />
    )
  }

  const hasCommits = workData.commits && workData.commits.length > 0
  const hasFiles = workData.files && workData.files.length > 0
  const hasArtifacts = workData.artifacts && workData.artifacts.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{
          background: 'rgba(30,41,59,0.5)',
          border: '1px solid rgba(51,65,85,0.4)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Commits</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#60a5fa' }}>{workData.commitCount || 0}</div>
        </div>
        <div style={{
          background: 'rgba(30,41,59,0.5)',
          border: '1px solid rgba(51,65,85,0.4)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Files Changed</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#a78bfa' }}>{workData.fileCount || 0}</div>
        </div>
        <div style={{
          background: 'rgba(30,41,59,0.5)',
          border: '1px solid rgba(51,65,85,0.4)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Artifacts</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#34d399' }}>{workData.artifacts?.length || 0}</div>
        </div>
      </div>

      {/* Commits */}
      {hasCommits && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Commits ({workData.commits.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workData.commits.map((commit, idx) => (
              <div key={idx} style={{
                background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: 8,
                padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    flexShrink: 0,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#60a5fa',
                    marginTop: 6,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4, wordBreak: 'break-word' }}>
                      {commit.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748b' }}>
                      <code style={{ fontFamily: 'monospace', background: 'rgba(51,65,85,0.5)', padding: '2px 6px', borderRadius: 4 }}>
                        {commit.hash.substring(0, 7)}
                      </code>
                      <span>{formatTimestamp(commit.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Changed */}
      {hasFiles && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Files Changed ({workData.files.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {workData.files.map((file, idx) => (
              <div key={idx} style={{
                background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#e2e8f0', wordBreak: 'break-all' }}>
                  {file.path}
                </code>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{ color: '#34d399' }}>+{file.additions}</span>
                  <span style={{ color: '#f87171' }}>-{file.deletions}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artifacts */}
      {hasArtifacts && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Build Artifacts ({workData.artifacts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {workData.artifacts.map((artifact, idx) => (
              <div key={idx} style={{
                background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{artifact.name}</div>
                  <code style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{artifact.path}</code>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 16 }}>
                  {formatFileSize(artifact.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasCommits && !hasFiles && !hasArtifacts && (
        <EmptyState
          icon={<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          message="No commits, files, or artifacts logged yet"
        />
      )}
    </div>
  )
}

function TestsTab({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(true)
  const [workData, setWorkData] = useState<(TaskWork & TaskWorkSummary) | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/tasks/${taskId}/work`)
      .then((res) => res.json())
      .then((data) => setWorkData(data))
      .catch((err) => console.error('Failed to load work data:', err))
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748b' }}>
        Loading test results...
      </div>
    )
  }

  if (!workData || !workData.testSummary || workData.testSummary.total === 0) {
    return (
      <EmptyState
        icon={<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
        message="No test results available yet"
      />
    )
  }

  const { testSummary } = workData
  const passRate = testSummary.total > 0 ? Math.round((testSummary.passed / testSummary.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Test Summary Card */}
      <div style={{
        background: 'rgba(30,41,59,0.5)',
        border: '1px solid rgba(51,65,85,0.4)',
        borderRadius: 12,
        padding: 24,
      }}>
        <div style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Test Suite Summary
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: testSummary.failed === 0 ? '#34d399' : '#f87171' }}>
              {passRate}%
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Pass Rate</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: '#e2e8f0' }}>
              {testSummary.total}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Total Tests</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 8, background: 'rgba(51,65,85,0.5)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{
            width: `${passRate}%`,
            height: '100%',
            background: testSummary.failed === 0 ? '#34d399' : '#f87171',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Test Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Passed
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#34d399' }}>{testSummary.passed}</div>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Failed
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#f87171' }}>{testSummary.failed}</div>
        </div>

        <div style={{
          background: 'rgba(234,179,8,0.1)',
          border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#fef08a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Skipped
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#facc15' }}>{testSummary.skipped}</div>
        </div>
      </div>

      {/* Status Message */}
      {testSummary.failed === 0 && testSummary.passed > 0 && (
        <div style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <svg width="20" height="20" fill="none" stroke="#34d399" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: 14, color: '#6ee7b7', fontWeight: 500 }}>
            All tests passed! 🎉
          </span>
        </div>
      )}

      {testSummary.failed > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <svg width="20" height="20" fill="none" stroke="#f87171" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ fontSize: 14, color: '#fca5a5', fontWeight: 500 }}>
            {testSummary.failed} test{testSummary.failed !== 1 ? 's' : ''} failed
          </span>
        </div>
      )}
    </div>
  )
}

function HistoryTab({ task }: { task: Task }) {
  const getEventIcon = (to: BoardLane) => {
    switch (to) {
      case 'proposed':
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      case 'queued':
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'development':
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        )
      case 'review':
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
      case 'done':
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  if (!task.statusHistory || task.statusHistory.length === 0) {
    return (
      <EmptyState
        icon={<svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        message="No history yet"
      />
    )
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      {/* Timeline line */}
      <div style={{
        position: 'absolute',
        left: 7,
        top: 16,
        bottom: 16,
        width: 2,
        background: 'rgba(51,65,85,0.4)',
      }} />

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {task.statusHistory.map((h, idx) => (
          <div key={`${h.at}-${idx}`} style={{ position: 'relative', paddingLeft: 16 }}>
            {/* Icon */}
            <div style={{
              position: 'absolute',
              left: -24,
              top: 2,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#0f172a',
              border: '2px solid rgba(96,165,250,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
            }}>
              {getEventIcon(h.to)}
            </div>

            {/* Content */}
            <div style={{
              background: 'rgba(30,41,59,0.5)',
              border: '1px solid rgba(51,65,85,0.4)',
              borderRadius: 8,
              padding: 12,
            }}>
              <div style={{ fontWeight: 500, color: '#fff', fontSize: 14 }}>
                Moved to <span style={{ color: '#60a5fa' }}>{LANE_DISPLAY[h.to]}</span>
                {h.from && <span style={{ color: '#94a3b8', fontWeight: 400 }}> from {LANE_DISPLAY[h.from as BoardLane]}</span>}
              </div>
              {h.note && h.note !== 'created' && h.note !== 'updated' && (
                <div style={{ color: '#94a3b8', marginTop: 6, fontSize: 13 }}>{h.note}</div>
              )}
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                {fmtWhen(h.at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  const [activeTab, setActiveTab] = useState<'details' | 'workDone' | 'tests' | 'history'>('details')
  const [agents, setAgents] = useState<Agent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [draftTitle, setDraftTitle] = useState(String(task.title ?? ''))
  const [draftLane, setDraftLane] = useState<BoardLane>(task.lane)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftOwner, setDraftOwner] = useState(String(task.owner ?? ''))
  const [draftProject, setDraftProject] = useState(String(task.project ?? ''))
  const [draftProblem, setDraftProblem] = useState(String(task.problem ?? ''))
  const [draftScope, setDraftScope] = useState(String(task.scope ?? ''))
  const [draftAcceptanceRaw, setDraftAcceptanceRaw] = useState((task.acceptanceCriteria ?? []).join('\n'))
  const [draftNote, setDraftNote] = useState('')

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => console.error('Failed to fetch agents:', err))

    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch((err) => console.error('Failed to fetch projects:', err))
  }, [])

  useEffect(() => {
    setDraftTitle(String(task.title ?? ''))
    setDraftLane(task.lane)
    setDraftPriority(task.priority)
    setDraftOwner(String(task.owner ?? ''))
    setDraftProject(String(task.project ?? ''))
    setDraftProblem(String(task.problem ?? ''))
    setDraftScope(String(task.scope ?? ''))
    setDraftAcceptanceRaw((task.acceptanceCriteria ?? []).join('\n'))
    setDraftNote('')
  }, [task])

  const laneChanging = draftLane !== task.lane
  const dirty =
    draftTitle !== task.title ||
    draftLane !== task.lane ||
    draftPriority !== task.priority ||
    draftOwner !== (task.owner ?? '') ||
    draftProject !== (task.project ?? '') ||
    draftProblem !== (task.problem ?? '') ||
    draftScope !== (task.scope ?? '') ||
    draftAcceptanceRaw.trim() !== (task.acceptanceCriteria ?? []).join('\n').trim() ||
    (laneChanging && draftNote.trim() !== '')

  const acceptanceCriteria = useMemo(() => normalizeLines(draftAcceptanceRaw), [draftAcceptanceRaw])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updatePayload: any = {
        id: task.id,
        title: draftTitle.trim() || task.title,
        lane: draftLane,
        priority: draftPriority,
        owner: draftOwner.trim() || undefined,
        project: draftProject.trim() || undefined,
        problem: draftProblem.trim() || undefined,
        scope: draftScope.trim() || undefined,
        acceptanceCriteria,
      }
      // Include note if lane is changing
      if (draftLane !== task.lane && draftNote.trim()) {
        updatePayload.note = draftNote.trim()
      }
      const updated = await adapter.updateTask(updatePayload)
      onSaved(updated)
      setDraftNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteTask(task.id)
      onClose()
      // Trigger a page refresh to update the task list
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
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
        maxWidth: 800,
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
          {(['details', 'workDone', 'tests', 'history'] as const).map((tab) => {
            const tabLabels = {
              details: 'Details',
              workDone: 'Work Done',
              tests: 'Tests',
              history: 'History',
            }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: activeTab === tab ? '#60a5fa' : '#94a3b8',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  position: 'relative',
                }}
                onMouseEnter={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#cbd5e1' }}
                onMouseLeave={(e) => { if (activeTab !== tab) e.currentTarget.style.color = '#94a3b8' }}
              >
                {tabLabels[tab]}
              </button>
            )
          })}
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
            <DetailsTab
              task={task}
              agents={agents}
              projects={projects}
              draftLane={draftLane}
              draftPriority={draftPriority}
              draftOwner={draftOwner}
              draftProject={draftProject}
              draftProblem={draftProblem}
              draftScope={draftScope}
              draftAcceptanceRaw={draftAcceptanceRaw}
              draftNote={draftNote}
              setDraftLane={setDraftLane}
              setDraftPriority={setDraftPriority}
              setDraftOwner={setDraftOwner}
              setDraftProject={setDraftProject}
              setDraftProblem={setDraftProblem}
              setDraftScope={setDraftScope}
              setDraftAcceptanceRaw={setDraftAcceptanceRaw}
              setDraftNote={setDraftNote}
              laneChanging={laneChanging}
            />
          )}

          {activeTab === 'workDone' && <WorkDoneTab taskId={task.id} />}
          {activeTab === 'tests' && <TestsTab taskId={task.id} />}
          {activeTab === 'history' && <HistoryTab task={task} />}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid rgba(51,65,85,0.4)',
          background: 'rgba(15,23,42,0.8)',
          flexShrink: 0,
        }}>
          {/* Delete button (bottom-left) */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: deleting ? '#94a3b8' : '#ef4444',
              background: 'transparent',
              border: 'none',
              cursor: deleting ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'color 0.15s',
              opacity: deleting ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.color = '#dc2626' }}
            onMouseLeave={(e) => { if (!deleting) e.currentTarget.style.color = '#ef4444' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>

          {/* Right side buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `}</style>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div
            onClick={() => setShowDeleteConfirm(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 400,
            background: '#0f172a',
            border: '1px solid rgba(51,65,85,0.5)',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <div style={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
                  Delete Task
                </h3>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                  Are you sure you want to delete this task? This action cannot be undone.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  color: '#cbd5e1',
                  background: 'transparent',
                  border: 'none',
                  cursor: deleting ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'color 0.15s',
                  opacity: deleting ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.color = '#f1f5f9' }}
                onMouseLeave={(e) => { if (!deleting) e.currentTarget.style.color = '#cbd5e1' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#fff',
                  background: deleting ? '#991b1b' : '#dc2626',
                  border: 'none',
                  borderRadius: 8,
                  cursor: deleting ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                  opacity: deleting ? 0.7 : 1,
                }}
                onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.background = '#b91c1c' }}
                onMouseLeave={(e) => { if (!deleting) e.currentTarget.style.background = '#dc2626' }}
              >
                {deleting ? 'Deleting…' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
