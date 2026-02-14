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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
    <div className="space-y-3">
      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 block mb-1">Search</label>
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-shrink-0">
            <label className="text-xs text-slate-500 block mb-1">Priority</label>
            <select
              className="h-10 px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="">All priorities</option>
              <option value="P0">P0 - Critical</option>
              <option value="P1">P1 - High</option>
              <option value="P2">P2 - Medium</option>
              <option value="P3">P3 - Low</option>
            </select>
          </div>

          {allTags.length > 0 && (
            <div className="flex-shrink-0">
              <label className="text-xs text-slate-500 block mb-1">Tags</label>
              <div className="flex gap-1 flex-wrap">
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setFilterTags((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag],
                      )
                    }
                    className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                      filterTags.includes(tag)
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchQuery('')
              setFilterPriority('')
              setFilterTags([])
            }}
          >
            Clear
          </Button>
        </div>

        {error && (
          <div className="text-red-600 text-xs mt-2">
            {error}
          </div>
        )}

        {filteredByAgentId && (
          <div className="text-blue-600 text-xs mt-2">
            Filtering by selected agent
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="flex flex-col bg-slate-50 rounded p-3 border border-slate-200">
                <div className="mb-4 pb-3 border-b border-slate-200">
                  <div>
                    <strong className="text-sm">{col.title}</strong>
                    <div className="text-xs text-slate-500">
                      {col.hint}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 inline-block mt-2">{tasksByColumn[col.id].length}</span>
                </div>

                <div className="space-y-2 flex-1">
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
            className="text-center py-8 text-slate-500 text-sm"
          >
            No tasks match your filters
          </div>
        )}
      </div>
    </div>
  )
}
