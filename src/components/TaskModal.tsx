import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { AgentProfile, BoardLane, Priority, Task } from '../types'
import { CopyButton } from './CopyButton'
import { usePoll } from '../lib/usePoll'
import { getAgentName } from '../lib/agentUtils'

const LANES: BoardLane[] = ['proposed', 'queued', 'development', 'review', 'blocked', 'done']
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

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

  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftLane, setDraftLane] = useState<BoardLane>(task.lane)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftOwner, setDraftOwner] = useState(task.owner ?? '')
  const [draftProblem, setDraftProblem] = useState(task.problem ?? '')
  const [draftScope, setDraftScope] = useState(task.scope ?? '')
  const [draftAcceptanceRaw, setDraftAcceptanceRaw] = useState((task.acceptanceCriteria ?? []).join('\n'))
  const [draftProjectId, setDraftProjectId] = useState(task.projectId ?? '')
  const [draftAssignedProfileId, setDraftAssignedProfileId] = useState(task.assignedProfileId ?? '')

  // Load PM projects and agent profiles for dropdowns
  const pmProjects = usePoll<{ id: string; name: string }[]>(
    async () => {
      try {
        const projects = await adapter.listPMProjects()
        return projects.map(p => ({ id: p.id, name: p.name }))
      } catch (e) {
        console.warn('[TaskModal] listPMProjects failed', e)
        return []
      }
    },
    15000
  )

  const agentProfiles = usePoll<AgentProfile[]>(
    async () => {
      try {
        return await adapter.listAgentProfiles()
      } catch (e) {
        console.warn('[TaskModal] listAgentProfiles failed', e)
        return []
      }
    },
    10000
  )

  useEffect(() => {
    setDraftTitle(task.title)
    setDraftLane(task.lane)
    setDraftPriority(task.priority)
    setDraftOwner(task.owner ?? '')
    setDraftProblem(task.problem ?? '')
    setDraftScope(task.scope ?? '')
    setDraftAcceptanceRaw((task.acceptanceCriteria ?? []).join('\n'))
    setDraftProjectId(task.projectId ?? '')
    setDraftAssignedProfileId(task.assignedProfileId ?? '')
  }, [task])

  const isCreateMode = !task.id
  
  const dirty = isCreateMode
    ? draftTitle.trim().length > 0 // In create mode, just need a title
    : (
        draftTitle !== task.title ||
        draftLane !== task.lane ||
        draftPriority !== task.priority ||
        draftOwner !== (task.owner ?? '') ||
        draftProblem !== (task.problem ?? '') ||
        draftScope !== (task.scope ?? '') ||
        draftAcceptanceRaw.trim() !== (task.acceptanceCriteria ?? []).join('\n').trim() ||
        draftProjectId !== (task.projectId ?? '') ||
        draftAssignedProfileId !== (task.assignedProfileId ?? '')
      )

  const acceptanceCriteria = useMemo(() => normalizeLines(draftAcceptanceRaw), [draftAcceptanceRaw])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (isCreateMode) {
        // Create new task
        const created = await adapter.createTask({
          title: draftTitle.trim(),
          lane: draftLane,
          priority: draftPriority,
          owner: draftOwner.trim() || undefined,
          problem: draftProblem.trim() || undefined,
          scope: draftScope.trim() || undefined,
          acceptanceCriteria,
          projectId: draftProjectId || undefined,
          assignedProfileId: draftAssignedProfileId || undefined,
        })
        onSaved(created)
      } else {
        // Update existing task
        const updated = await adapter.updateTask({
          id: task.id,
          title: draftTitle.trim() || task.title,
          lane: draftLane,
          priority: draftPriority,
          owner: draftOwner.trim() || undefined,
          problem: draftProblem.trim() || undefined,
          scope: draftScope.trim() || undefined,
          acceptanceCriteria,
          projectId: draftProjectId || undefined,
          assignedProfileId: draftAssignedProfileId || undefined,
        })
        onSaved(updated)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Task details ${task.title}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            {isCreateMode ? (
              <h3 style={{ margin: 0 }}>New Task</h3>
            ) : (
              <>
                <div className="muted" style={{ fontSize: 12 }}>
                  task <code>{task.id}</code>
                </div>
                <h3 style={{ margin: '6px 0 0' }}>{task.title}</h3>
              </>
            )}
          </div>
          <div className="stack-h">
            {!isCreateMode && <CopyButton label="Copy JSON" text={JSON.stringify(task, null, 2)} />}
            <button className="btn ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="callout warn" style={{ marginBottom: 10 }}>
            <strong>Task error:</strong> {error}
          </div>
        )}

        <div className="modal-body">
          <div className="task-grid">
            <label className="field">
              <div className="muted">Title</div>
              <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </label>

            <label className="field">
              <div className="muted">Lane</div>
              <select value={draftLane} onChange={(e) => setDraftLane(e.target.value as BoardLane)}>
                {LANES.map((l) => (
                  <option value={l} key={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <div className="muted">Priority</div>
              <select value={draftPriority} onChange={(e) => setDraftPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (
                  <option value={p} key={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <div className="muted">Owner</div>
              <input 
                value={draftOwner} 
                onChange={(e) => setDraftOwner(e.target.value)} 
                placeholder="optional (e.g., dev-1, pm, architect)" 
              />
              {draftOwner && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  → {getAgentName(draftOwner)}
                </div>
              )}
            </label>

            <label className="field">
              <div className="muted">Project</div>
              <select value={draftProjectId} onChange={(e) => setDraftProjectId(e.target.value)}>
                <option value="">None</option>
                {(pmProjects.data ?? []).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <div className="muted">Assigned Agent</div>
              <select value={draftAssignedProfileId} onChange={(e) => setDraftAssignedProfileId(e.target.value)}>
                <option value="">None</option>
                {(agentProfiles.data ?? []).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.emoji ?? '🤖'} {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="muted">Problem</div>
              <textarea value={draftProblem} onChange={(e) => setDraftProblem(e.target.value)} rows={3} placeholder="why does this task exist?" />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="muted">Scope</div>
              <textarea value={draftScope} onChange={(e) => setDraftScope(e.target.value)} rows={4} placeholder="what is in/out?" />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <div className="muted">Acceptance criteria (one per line)</div>
              <textarea value={draftAcceptanceRaw} onChange={(e) => setDraftAcceptanceRaw(e.target.value)} rows={6} />
            </label>

            <div className="task-meta" style={{ gridColumn: '1 / -1' }}>
              <div className="muted" style={{ fontSize: 12 }}>
                created: {fmtWhen(task.createdAt)} · updated: {fmtWhen(task.updatedAt)} · history: {task.statusHistory?.length ?? 0} events
              </div>
            </div>

            <details className="task-history" style={{ gridColumn: '1 / -1' }} open>
              <summary className="muted">Status history</summary>
              <div className="table-like" style={{ marginTop: 8 }}>
                {(task.statusHistory ?? []).map((h, idx) => (
                  <div className="row" key={`${h.at}-${idx}`}>
                    <div className="row-main">
                      <div className="row-title">
                        <strong>{h.to}</strong>
                        {h.from ? <span className="muted">(from {h.from})</span> : null}
                      </div>
                      <div className="muted">{h.note ?? '—'}</div>
                    </div>
                    <div className="row-side">
                      <div className="muted">{fmtWhen(h.at)}</div>
                    </div>
                  </div>
                ))}
                {(task.statusHistory?.length ?? 0) === 0 && <div className="muted">No history recorded.</div>}
              </div>
            </details>
          </div>
        </div>

        <div className="modal-footer">
          {!isCreateMode && (
            <div className="muted" style={{ fontSize: 12 }}>
              Saving lane changes will append a history entry.
            </div>
          )}
          <div className="stack-h">
            <button className="btn" type="button" onClick={save} disabled={busy || !dirty}>
              {busy ? (isCreateMode ? 'Creating…' : 'Saving…') : isCreateMode ? 'Create Task' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
