import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { AgentTask, TaskStatus } from '../types'
import { TaskCard } from './TaskCard'
import * as api from '../services/api'

interface KanbanBoardProps {
  tasks: AgentTask[]
  onTaskClick?: (task: AgentTask) => void
  onTaskUpdated?: (task: AgentTask) => void
  filteredByAgentId?: string | null
}

const COLUMNS: { id: TaskStatus; title: string; hint: string }[] = [
  { id: 'queued', title: 'Queued', hint: 'Not started' },
  { id: 'development', title: 'Development', hint: 'In progress' },
  { id: 'review', title: 'Review', hint: 'Under review' },
  { id: 'blocked', title: 'Blocked', hint: 'Waiting' },
  { id: 'done', title: 'Done', hint: 'Completed' },
]

export function KanbanBoard({
  tasks,
  onTaskClick,
  onTaskUpdated,
  filteredByAgentId,
}: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<AgentTask[]>(tasks)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Update localTasks when props change
  useMemo(() => {
    setLocalTasks(tasks)
  }, [tasks])

  // Get all unique tags for filter
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    localTasks.forEach((t) => {
      t.tags?.forEach((tag) => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [localTasks])

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return localTasks.filter((task) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          task.title.toLowerCase().includes(q) ||
          task.description?.toLowerCase().includes(q)
        if (!matches) return false
      }

      // Agent filter
      if (filteredByAgentId && task.assigneeId !== filteredByAgentId) {
        return false
      }

      // Priority filter
      if (filterPriority && task.priority !== filterPriority) {
        return false
      }

      // Tags filter
      if (filterTags.length > 0) {
        const hasTags = filterTags.some((tag) => task.tags?.includes(tag))
        if (!hasTags) return false
      }

      return true
    })
  }, [localTasks, searchQuery, filteredByAgentId, filterPriority, filterTags])

  // Group by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<TaskStatus, AgentTask[]> = {
      queued: [],
      development: [],
      review: [],
      blocked: [],
      done: [],
    }
    filteredTasks.forEach((task) => {
      grouped[task.status].push(task)
    })
    return grouped
  }, [filteredTasks])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event

      if (!over) return

      const activeTask = localTasks.find((t) => t.id === active.id)
      const targetStatus = over.id as TaskStatus

      if (!activeTask || !COLUMNS.find((c) => c.id === targetStatus)) return

      if (activeTask.status === targetStatus) return

      try {
        setError(null)
        const updated = await api.updateTaskStatus(activeTask.id, targetStatus)
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t)),
        )
        onTaskUpdated?.(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update task')
      }
    },
    [localTasks, onTaskUpdated],
  )

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* Filters and Search */}
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px', margin: 0 }}>
            <label className="muted" style={{ fontSize: 12 }}>Search</label>
            <input
              className="input"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          <div className="field" style={{ flex: '0 1 150px', margin: 0 }}>
            <label className="muted" style={{ fontSize: 12 }}>Priority</label>
            <select
              className="input"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{ fontSize: 13 }}
            >
              <option value="">All priorities</option>
              <option value="P0">P0 - Critical</option>
              <option value="P1">P1 - High</option>
              <option value="P2">P2 - Medium</option>
              <option value="P3">P3 - Low</option>
            </select>
          </div>

          {allTags.length > 0 && (
            <div className="field" style={{ flex: '0 1 auto', margin: 0 }}>
              <label className="muted" style={{ fontSize: 12 }}>Tags</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setFilterTags((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag],
                      )
                    }
                    style={{
                      padding: '4px 8px',
                      fontSize: 11,
                      backgroundColor: filterTags.includes(tag)
                        ? '#3b82f6'
                        : 'rgba(100, 116, 139, 0.2)',
                      color: filterTags.includes(tag) ? '#fff' : '#cbd5e1',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setFilterPriority('')
              setFilterTags([])
            }}
            className="btn ghost"
            style={{ padding: '6px 12px' }}
          >
            Clear
          </button>
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginTop: 10, fontSize: 12 }}>
            {error}
          </div>
        )}

        {filteredByAgentId && (
          <div style={{ color: '#60a5fa', marginTop: 10, fontSize: 12 }}>
            Filtering by selected agent
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="panel" style={{ padding: 14 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-grid">
            {COLUMNS.map((col) => (
              <div key={col.id} className="kanban-col">
                <div className="kanban-col-head">
                  <div>
                    <strong>{col.title}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {col.hint}
                    </div>
                  </div>
                  <span className="muted">{tasksByColumn[col.id].length}</span>
                </div>

                <div className="kanban-cards">
                  <SortableContext
                    items={tasksByColumn[col.id].map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tasksByColumn[col.id].map((task) => (
                      <div key={task.id} draggable={false}>
                        <TaskCard
                          task={task}
                          onClick={() => onTaskClick?.(task)}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', task.id)
                          }}
                        />
                      </div>
                    ))}
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>
        </DndContext>

        {filteredTasks.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 20,
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            No tasks match your filters
          </div>
        )}
      </div>
    </div>
  )
}
