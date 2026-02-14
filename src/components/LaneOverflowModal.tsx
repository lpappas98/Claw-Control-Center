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
import type { Task, BoardLane, Priority } from '../types'

type SortOption = 'priority' | 'type' | 'name'

interface PrioritySummary {
  P0: number
  P1: number
  P2: number
  P3: number
}

const getPrioritySummary = (tasks: Task[]): PrioritySummary => {
  return {
    P0: tasks.filter(t => t.priority === 'P0').length,
    P1: tasks.filter(t => t.priority === 'P1').length,
    P2: tasks.filter(t => t.priority === 'P2').length,
    P3: tasks.filter(t => t.priority === 'P3').length,
  }
}

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case 'P0':
      return 'bg-red-500/20 text-red-400 border-red-500/30 ring-red-500/20'
    case 'P1':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30 ring-orange-500/20'
    case 'P2':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30 ring-blue-500/20'
    case 'P3':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30 ring-slate-500/20'
  }
}

const getPriorityDotColor = (priority: Priority) => {
  switch (priority) {
    case 'P0':
      return 'bg-red-500'
    case 'P1':
      return 'bg-orange-500'
    case 'P2':
      return 'bg-blue-500'
    case 'P3':
      return 'bg-slate-500'
  }
}

const getTagColor = (tag?: string) => {
  switch (tag) {
    case 'Epic':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'UI':
      return 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    case 'Backend':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'QA':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    case 'Arch':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    case 'Frontend':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    case 'Docs':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

const getInitials = (owner: string): string => {
  return owner
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function LaneOverflowModal({
  lane,
  tasks,
  onTaskClick,
  onClose,
}: {
  lane: BoardLane
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Filter tasks by search term (title, prefix, id)
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const searchLower = search.toLowerCase()
      return (
        t.title.toLowerCase().includes(searchLower) ||
        t.id.toLowerCase().includes(searchLower) ||
        (t.tag?.toLowerCase().includes(searchLower) ?? false)
      )
    })
  }, [tasks, search])

  // Sort tasks based on selected option
  const sorted = useMemo(() => {
    const copy = [...filtered]
    switch (sortBy) {
      case 'priority':
        const priorityOrder: Record<Priority, number> = {
          P0: 0,
          P1: 1,
          P2: 2,
          P3: 3,
        }
        return copy.sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        )
      case 'type':
        return copy.sort((a, b) => (a.tag || '').localeCompare(b.tag || ''))
      case 'name':
        return copy.sort((a, b) => a.title.localeCompare(b.title))
      default:
        return copy
    }
  }, [filtered, sortBy])

  const summary = getPrioritySummary(sorted)
  const laneTitle = lane.charAt(0).toUpperCase() + lane.slice(1)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-[#0a0f1e] border-[#2a3a5a] p-0 overflow-hidden flex flex-col animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
        <DialogHeader className="border-b border-[#2a3a5a] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-white">
                {laneTitle}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-400 mt-1">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} in this lane
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Priority Summary Bar */}
        <div className="px-6 py-3 bg-[#0f1520] border-b border-[#2a3a5a] flex gap-4 items-center overflow-x-auto">
          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
            Summary:
          </span>
          <div className="flex gap-3 min-w-min">
            {(
              [
                { label: 'P0', count: summary.P0, color: 'text-red-400' },
                { label: 'P1', count: summary.P1, color: 'text-orange-400' },
                { label: 'P2', count: summary.P2, color: 'text-blue-400' },
                { label: 'P3', count: summary.P3, color: 'text-slate-400' },
              ] as const
            ).map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color.replace('text-', 'bg-')}`} />
                <span className={`text-sm font-medium ${color}`}>
                  {label}: {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="px-6 py-4 bg-[#0f1520] border-b border-[#2a3a5a] flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Search by title, ID, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm h-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="bg-[#161b2f] border-[#3a4a6a] text-slate-300 hover:bg-[#1a2132] hover:text-white transition-all whitespace-nowrap h-9"
            >
              <span className="text-xs">Sort by {sortBy}</span>
            </Button>

            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-[#161b2f] border border-[#3a4a6a] rounded-lg shadow-lg z-50 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                {(
                  [
                    { value: 'priority' as const, label: 'Priority' },
                    { value: 'type' as const, label: 'Type' },
                    { value: 'name' as const, label: 'Name' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSortBy(value)
                      setShowSortMenu(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-[#2a3a5a] last:border-b-0 ${
                      sortBy === value
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-slate-300 hover:bg-[#1a2132]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto pr-2">
          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-slate-400 text-sm mb-2">
                  {search
                    ? 'No tasks match your search'
                    : 'No tasks in this lane'}
                </div>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 px-6 py-4">
              {sorted.map((task, index) => (
                <button
                  key={task.id}
                  className="w-full text-left p-4 rounded-lg bg-[#141927] hover:bg-[#1a2132] border border-[#2a3a5a] hover:border-[#3a4a6a] transition-all duration-200 group animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                  onClick={() => {
                    onTaskClick(task)
                    onClose()
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority Dot */}
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPriorityDotColor(
                        task.priority
                      )}`}
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium group-hover:text-blue-300 transition-colors truncate">
                            {task.title}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {task.id}
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Priority Badge */}
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded border ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>

                        {/* Type Badge */}
                        {task.tag && (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded border ${getTagColor(
                              task.tag
                            )}`}
                          >
                            {task.tag}
                          </span>
                        )}

                        {/* Owner Indicator */}
                        <div className="ml-auto">
                          {task.owner ? (
                            <div
                              className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title={`Assigned to ${task.owner}`}
                            >
                              {getInitials(task.owner)}
                            </div>
                          ) : (
                            <div
                              className="w-6 h-6 rounded-full border-2 border-dashed border-slate-500/30 flex items-center justify-center text-xs text-slate-500"
                              title="Unassigned"
                            >
                              ○
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
