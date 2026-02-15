import type { AgentTask, TaskPriority } from '../types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TaskCardProps {
  task: AgentTask
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

function getPriorityVariant(priority: TaskPriority): 'default' | 'secondary' | 'destructive' {
  switch (priority) {
    case 'P0':
      return 'destructive' // red
    case 'P1':
      return 'secondary' // orange/amber
    case 'P2':
      return 'secondary' // yellow
    case 'P3':
      return 'outline' // gray
    default:
      return 'outline'
  }
}

export function TaskCard({ task, onClick, draggable = true, onDragStart }: TaskCardProps) {
  const priorityVariant = getPriorityVariant(task.priority)

  return (
    <Card
      data-testid="task-card"
      className="kanban-card p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      style={{ cursor: draggable ? 'grab' : 'pointer' }}
      title="Click to view details, drag to move"
    >
      <div className="flex justify-between gap-2 items-start mb-2">
        <strong className="line-clamp-2 flex-1">{task.title}</strong>
        <Badge variant={priorityVariant} className="shrink-0">
          {task.priority}
        </Badge>
      </div>

      {task.description && (
        <div
          className="text-sm text-slate-500 mb-2 line-clamp-2"
        >
          {task.description}
        </div>
      )}

      {task.assignee && (
        <div className="text-sm text-slate-500 mb-2">
          <span>{task.assignee.emoji}</span> {task.assignee.name}
        </div>
      )}

      {(task.tags && task.tags.length > 0) && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {task.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-slate-500">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {(task.estimatedHours || task.actualHours || task.commentCount || task.subtaskCount) && (
        <div
          className="text-xs text-slate-500 mt-2 flex gap-2 flex-wrap"
        >
          {task.estimatedHours && (
            <span title="Estimated hours">⏱ {task.estimatedHours}h est</span>
          )}
          {task.actualHours && (
            <span title="Actual hours logged">📊 {task.actualHours}h</span>
          )}
          {task.commentCount ? (
            <span title="Comments">💬 {task.commentCount}</span>
          ) : null}
          {task.subtaskCount ? (
            <span title="Subtasks">✓ {task.subtaskCount}</span>
          ) : null}
        </div>
      )}
    </Card>
  )
}
