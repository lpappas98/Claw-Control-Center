import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Task, Priority } from '../types'
import { ChevronDown, Search, X } from 'lucide-react'

type SortOption = 'priority' | 'name' | 'type'

const PRIORITY_ORDER: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

const PRIORITY_COLORS: Record<Priority, string> = {
  P0: 'bg-red-600 text-white',
  P1: 'bg-orange-600 text-white',
  P2: 'bg-yellow-600 text-white',
  P3: 'bg-slate-600 text-white',
}

const TYPE_COLORS: Record<string, string> = {
  UI: 'bg-sky-500/20 text-sky-200 border border-sky-500/30',
  QA: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30',
  Backend: 'bg-purple-500/20 text-purple-200 border border-purple-500/30',
  Frontend: 'bg-blue-500/20 text-blue-200 border border-blue-500/30',
  Arch: 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30',
  Epic: 'bg-pink-500/20 text-pink-200 border border-pink-500/30',
  Docs: 'bg-gray-500/20 text-gray-200 border border-gray-500/30',
}

interface TaskListModalProps {
  title?: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onClose: () => void
  highlightLane?: string
}

export function TaskListModal({
  title = 'Tasks',
  tasks,
  onTaskClick,
  onClose,
  highlightLane,
}: TaskListModalProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('priority')

  // Filter tasks by search
  const filtered = useMemo(() => {
    return tasks.filter(t =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase())
    )
  }, [tasks, search])

  // Sort tasks
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'priority') {
      arr.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    } else if (sortBy === 'name') {
      arr.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'type') {
      arr.sort((a, b) => (a.tag || 'Other').localeCompare(b.tag || 'Other'))
    }
    return arr
  }, [filtered, sortBy])

  // Count by priority
  const priorityCount = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<Priority, number>)
  }, [tasks])

  // Get initials for owner avatar
  const getInitials = (owner?: string): string => {
    if (!owner) return '?'
    return owner
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] bg-slate-950 border border-slate-800 shadow-2xl">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-xs font-normal text-slate-400">
                  {filtered.length} / {tasks.length}
                </span>
              </DialogTitle>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <DialogDescription className="sr-only">
            {title} - search and review tasks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Priority Summary Bar */}
          <div className="flex gap-2 px-4">
            {(['P0', 'P1', 'P2', 'P3'] as const).map(priority => (
              <div
                key={priority}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${PRIORITY_COLORS[priority]}`}
              >
                <span className="text-xs font-bold">{priority}</span>
                <span className="text-sm font-semibold">{priorityCount[priority] || 0}</span>
              </div>
            ))}
          </div>

          {/* Search and Sort Controls */}
          <div className="flex gap-2 px-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search tasks by title or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
                <span className="text-sm">Sort: {sortBy}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {/* Dropdown menu */}
              <div className="absolute right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
                {(['priority', 'name', 'type'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      sortBy === opt
                        ? 'bg-blue-600/30 text-blue-200'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {opt === 'priority' && 'By Priority'}
                    {opt === 'name' && 'By Name'}
                    {opt === 'type' && 'By Type'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto px-4 pr-2">
            {sorted.length === 0 && (
              <div className="text-slate-400 text-center py-12 text-sm">
                {search ? 'No tasks match your search' : 'No tasks to display'}
              </div>
            )}

            {sorted.map((task) => (
              <button
                key={task.id}
                className={`w-full text-left p-3 rounded-xl border transition-all group ${
                  highlightLane && task.lane === highlightLane
                    ? 'bg-slate-800/60 border-slate-600 ring-1 ring-blue-500/30'
                    : 'bg-slate-900 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
                onClick={() => {
                  onTaskClick(task)
                  onClose()
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Priority Dot */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        task.priority === 'P0'
                          ? 'bg-red-600'
                          : task.priority === 'P1'
                            ? 'bg-orange-600'
                            : task.priority === 'P2'
                              ? 'bg-yellow-600'
                              : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500">
                        {task.id.slice(0, 12)}...
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                      </span>
                      {task.tag && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[task.tag] || 'bg-slate-700 text-slate-300'}`}>
                          {task.tag}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-200 font-medium group-hover:text-blue-300 transition-colors line-clamp-2">
                      {task.title}
                    </div>

                    {/* Footer with owner */}
                    <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                      <span>{task.lane}</span>
                      {task.owner ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white">
                            {getInitials(task.owner)}
                          </div>
                          <span className="text-slate-400">{task.owner}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <div className="w-5 h-5 rounded-full border border-dashed border-slate-600 flex items-center justify-center">
                            <span className="text-xs">•</span>
                          </div>
                          <span>unassigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <span>{sorted.length} of {tasks.length} tasks</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-300 hover:text-slate-100"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
