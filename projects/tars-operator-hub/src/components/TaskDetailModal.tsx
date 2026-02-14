import { useState } from 'react'
import type { AgentTask, Agent, TaskStatus, TaskPriority } from '../types'
import * as api from '../services/api'

interface TaskDetailModalProps {
  task: AgentTask
  agents: Agent[]
  onClose: () => void
  onTaskUpdated?: (task: AgentTask) => void
  onTaskDeleted?: () => void
}

const STATUSES: TaskStatus[] = ['queued', 'development', 'review', 'blocked', 'done']
const PRIORITIES: TaskPriority[] = ['P0', 'P1', 'P2', 'P3']

export function TaskDetailModal({
  task,
  agents,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignee = agents.find((a) => a.id === task.assigneeId)

  const handleStatusChange = async (status: TaskStatus) => {
    try {
      setLoading(true)
      setError(null)
      const updated = await api.updateTaskStatus(task.id, status)
      onTaskUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handlePriorityChange = async (priority: TaskPriority) => {
    try {
      setLoading(true)
      setError(null)
      const updated = await api.updateTask(task.id, { priority })
      onTaskUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (agentId: string) => {
    try {
      setLoading(true)
      setError(null)
      const updated = await api.assignTask(task.id, agentId)
      onTaskUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !assignee) return
    try {
      setLoading(true)
      setError(null)
      const updated = await api.addComment(task.id, assignee.id, newComment)
      setNewComment('')
      onTaskUpdated?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setLoading(true)
      setError(null)
      await api.deleteTask(task.id)
      onTaskDeleted?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => (e.target === e.currentTarget && !showDeleteConfirm ? onClose() : null)}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Task details: ${task.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            {editingTitle ? (
              <input
                type="text"
                value={task.title}
                onChange={() => {
                  // In a real app, would debounce and save
                }}
                autoFocus
                onBlur={() => setEditingTitle(false)}
                className="input"
                style={{ fontSize: 18, fontWeight: 600 }}
              />
            ) : (
              <h3 style={{ margin: '6px 0 0' }}>{task.title}</h3>
            )}
            {error && <div style={{ color: '#ef4444', marginTop: 8, fontSize: 12 }}>{error}</div>}
          </div>
          <div className="stack-h">
            <button
              className="btn ghost"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ padding: 16 }}>
          <div className="stack" style={{ gap: 16 }}>
            {/* Status and Priority Row */}
            <div className="grid-2">
              <div className="field">
                <label className="muted">Status</label>
                <select
                  className="input"
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  disabled={loading}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="muted">Priority</label>
                <select
                  className="input"
                  value={task.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                  disabled={loading}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="field">
              <label className="muted">Description</label>
              {editingDesc ? (
                <textarea
                  className="input"
                  value={task.description || ''}
                  onChange={() => {
                    // In a real app, would debounce and save
                  }}
                  rows={4}
                  autoFocus
                  onBlur={() => setEditingDesc(false)}
                />
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  style={{
                    padding: 10,
                    minHeight: 60,
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: 4,
                    cursor: 'text',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    color: task.description ? '#e2e8f0' : '#94a3b8',
                  }}
                >
                  {task.description || 'Click to add description...'}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div className="field">
              <label className="muted">Assigned to</label>
              <select
                className="input"
                value={task.assigneeId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleAssign(e.target.value)
                  }
                }}
                disabled={loading}
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Tracking */}
            <div className="grid-2">
              <div className="field">
                <label className="muted">Estimated hours</label>
                <div style={{ color: '#cbd5e1' }}>
                  {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
                </div>
              </div>
              <div className="field">
                <label className="muted">Actual hours</label>
                <div style={{ color: '#cbd5e1' }}>
                  {task.actualHours ? `${task.actualHours}h` : '—'}
                </div>
              </div>
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="field">
                <label className="muted">Tags</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'rgba(100, 116, 139, 0.3)',
                        borderRadius: 4,
                        fontSize: 12,
                        color: '#cbd5e1',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="panel" style={{ padding: 12, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
              <h4 style={{ marginTop: 0, marginBottom: 12 }}>Comments</h4>

              {task.comments && task.comments.length > 0 ? (
                <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
                  {task.comments.map((comment) => (
                    <div
                      key={comment.id}
                      style={{
                        padding: 10,
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                        {comment.agentId} • {new Date(comment.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ color: '#e2e8f0' }}>{comment.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12 }}>
                  No comments yet
                </div>
              )}

              {assignee && (
                <div className="stack" style={{ gap: 8 }}>
                  <textarea
                    className="input"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    disabled={loading}
                    style={{ fontSize: 12 }}
                  />
                  <button
                    className="btn"
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    type="button"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Add comment
                  </button>
                </div>
              )}
            </div>

            {/* Dependencies */}
            {(task.blockedBy && task.blockedBy.length > 0) || (task.blocks && task.blocks.length > 0) ? (
              <div className="panel" style={{ padding: 12, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Dependencies</h4>
                {task.blockedBy && task.blockedBy.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Blocked by:</div>
                    <div style={{ color: '#cbd5e1', fontSize: 12 }}>
                      {task.blockedBy.join(', ')}
                    </div>
                  </div>
                )}
                {task.blocks && task.blocks.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Blocks:</div>
                    <div style={{ color: '#cbd5e1', fontSize: 12 }}>
                      {task.blocks.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Delete Button */}
            <div className="stack-h" style={{ justifyContent: 'flex-end', gap: 8 }}>
              {showDeleteConfirm ? (
                <>
                  <button
                    className="btn ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    type="button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handleDelete}
                    type="button"
                    disabled={loading}
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    Confirm delete
                  </button>
                </>
              ) : (
                <button
                  className="btn ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                  disabled={loading}
                  style={{ color: '#ef4444' }}
                >
                  Delete task
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
