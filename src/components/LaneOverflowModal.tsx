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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d1426] border border-[#33406a]">
        <DialogHeader>
          <DialogTitle className="text-[#f2f4f8]">{laneTitle} Tasks ({tasks.length})</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#161b2f] border-[#33406a] text-[#f2f4f8] placeholder:text-slate-500"
          />

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-slate-400 text-center py-8">No tasks match your search</div>
            )}
            {filtered.map((task) => (
              <Button
                key={task.id}
                variant="ghost"
                className="w-full justify-start text-left p-4 h-auto bg-[#161b2f] hover:bg-[#1f2740] border border-[#33406a]"
                onClick={() => {
                  onTaskClick(task)
                  onClose()
                }}
              >
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                      task.priority === 'P0' ? 'bg-red-900/20 text-red-300' :
                      task.priority === 'P1' ? 'bg-orange-900/20 text-orange-300' :
                      task.priority === 'P2' ? 'bg-blue-900/20 text-blue-300' :
                      'bg-slate-900/20 text-slate-300'
                    }`}>
                      {task.priority}
                    </span>
                    <span className="text-[#f2f4f8] font-semibold flex-1">{task.title}</span>
                  </div>
                  {task.owner && (
                    <div className="text-sm text-slate-400">
                      Assigned: {task.owner}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
