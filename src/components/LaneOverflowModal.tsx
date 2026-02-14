import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Task, BoardLane } from '../types'

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

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  const laneTitle = lane.charAt(0).toUpperCase() + lane.slice(1)

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-[#0a0f1e] border-[#2a3a5a]">
        <DialogHeader className="border-b border-[#2a3a5a] pb-4">
          <DialogTitle className="text-xl font-semibold text-white">
            {laneTitle} • {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
            {filtered.length === 0 && (
              <div className="text-slate-400 text-center py-12 text-sm">
                No tasks match your search
              </div>
            )}
            {filtered.map((task) => (
              <button
                key={task.id}
                className="w-full text-left p-4 rounded-lg bg-[#141927] hover:bg-[#1a2132] border border-[#2a3a5a] hover:border-[#3a4a6a] transition-all group"
                onClick={() => {
                  onTaskClick(task)
                  onClose()
                }}
              >
                <div className="flex items-start gap-3">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded mt-0.5 ${
                    task.priority === 'P0' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    task.priority === 'P1' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    task.priority === 'P2' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}>
                    {task.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium group-hover:text-blue-300 transition-colors">
                      {task.title}
                    </div>
                    {task.owner && (
                      <div className="text-xs text-slate-400 mt-1">
                        Assigned to {task.owner}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
