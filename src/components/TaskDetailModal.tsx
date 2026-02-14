import { useState } from 'react'
import type { AgentTask, Agent, TaskStatus, TaskPriority } from '../types'
import * as api from '../services/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { DependencyGraph } from './DependencyGraph'
import { TimeTrackingPanel } from './TimeTrackingPanel'
import { GitHubPanel } from './GitHubPanel'

interface TaskDetailModalProps {
  task: AgentTask
  agents: Agent[]
  allTasks?: AgentTask[]
  onClose: () => void
  onTaskUpdated?: (task: AgentTask) => void
  onTaskDeleted?: () => void
}

const STATUSES: TaskStatus[] = ['queued', 'development', 'review', 'blocked', 'done']
const PRIORITIES: TaskPriority[] = ['P0', 'P1', 'P2', 'P3']

export function TaskDetailModal({
  task,
  agents,
  allTasks = [],
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
  const [deadline, setDeadline] = useState<Date | undefined>(
    task.deadline ? new Date(task.deadline) : undefined
  )
  const [showCalendar, setShowCalendar] = useState(false)

  const assignee = agents.find((a) => a.id === task.assigneeId)

  const handleDeadlineChange = async (date: Date | undefined) => {
    try {
      setDeadline(date)
      setShowCalendar(false)
      if (date) {
        const updated = await api.updateTask(task.id, {
          deadline: date.toISOString(),
        } as any)
        onTaskUpdated?.(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deadline')
    }
  }

  const handleCreateGitHubIssue = async (
    _taskId: string,
    title: string,
    description: string
  ): Promise<string> => {
    try {
      setLoading(true)
      // Simulated API call - will be implemented by integration agent
      const issueUrl = `https://github.com/issues/${Math.random().toString(36).substring(7)}`
      const updated = await api.updateTask(task.id, {
        githubIssueUrl: issueUrl,
      } as any)
      onTaskUpdated?.(updated)
      return issueUrl
    } catch (err) {
      throw err
    } finally {
      setLoading(false)
    }
  }

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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div>
            {editingTitle ? (
              <Input
                type="text"
                value={task.title}
                onChange={() => {
                  // In a real app, would debounce and save
                }}
                autoFocus
                onBlur={() => setEditingTitle(false)}
                className="text-lg font-semibold"
              />
            ) : (
              <DialogTitle>{task.title}</DialogTitle>
            )}
            <DialogDescription className="sr-only">
              Task details and management
            </DialogDescription>
            {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status and Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                className="h-10 w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select
                className="h-10 w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
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

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Description</label>
            {editingDesc ? (
              <Textarea
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
                className="p-3 min-h-[60px] bg-slate-50 rounded cursor-text whitespace-pre-wrap break-words border border-slate-200"
              >
                {task.description || 'Click to add description...'}
              </div>
            )}
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Assigned to</label>
            <select
              className="h-10 w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Estimated hours</label>
              <div className="text-slate-600">
                {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Actual hours</label>
              <div className="text-slate-600">
                {task.actualHours ? `${task.actualHours}h` : '—'}
              </div>
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tags</label>
              <div className="flex gap-2 flex-wrap">
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Comments</h4>

            {task.comments && task.comments.length > 0 ? (
              <div className="space-y-2 mb-3">
                {task.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200"
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      {comment.agentId} • {new Date(comment.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-slate-900 text-sm">{comment.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-3">
                No comments yet
              </div>
            )}

            {assignee && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  disabled={loading}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={loading || !newComment.trim()}
                  type="button"
                  size="sm"
                  variant="default"
                >
                  Add comment
                </Button>
              </div>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Deadline</label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  {deadline
                    ? deadline.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={handleDeadlineChange}
                  disabled={loading}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {deadline && (
              <div className="text-xs text-slate-500">
                {Math.ceil(
                  (deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                )}{' '}
                days remaining
              </div>
            )}
          </div>

          {/* Dependencies */}
          {(task.blockedBy && task.blockedBy.length > 0) || (task.blocks && task.blocks.length > 0) ? (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Dependencies</h4>
                {task.blockedBy && task.blockedBy.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Blocked by:</div>
                    <div className="text-sm text-slate-900">
                      {task.blockedBy.join(', ')}
                    </div>
                  </div>
                )}
                {task.blocks && task.blocks.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Blocks:</div>
                    <div className="text-sm text-slate-900">
                      {task.blocks.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* GitHub Integration */}
          <>
            <Separator />
            <GitHubPanel
              taskId={task.id}
              githubIssueUrl={(task as any).githubIssueUrl}
              commits={(task as any).commits}
              onCreateIssue={handleCreateGitHubIssue}
              isLoading={loading}
            />
          </>

          {/* Dependency Graph */}
          {allTasks.length > 0 && (
            <>
              <Separator />
              <DependencyGraph
                task={task}
                allTasks={allTasks}
              />
            </>
          )}

          {/* Time Tracking */}
          <>
            <Separator />
            <TimeTrackingPanel
              taskId={task.id}
              estimatedHours={task.estimatedHours}
              actualHours={task.actualHours}
              timeLogs={task.timeLogs}
              onAddTimeLog={async (hours, note) => {
                const updated = await api.addTimeLog(task.id, hours, note)
                onTaskUpdated?.(updated)
              }}
            />
          </>
        </div>

        <DialogFooter>
          <div className="w-full">
            {showDeleteConfirm ? (
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  type="button"
                  disabled={loading}
                >
                  Confirm delete
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                type="button"
                disabled={loading}
                className="text-red-600"
              >
                Delete task
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
