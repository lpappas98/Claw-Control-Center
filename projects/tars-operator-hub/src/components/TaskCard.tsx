import type { AgentTask, TaskPriority } from '../types'

interface TaskCardProps {
  task: AgentTask
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'P0':
      return '#ef4444' // red
    case 'P1':
      return '#f97316' // orange
    case 'P2':
      return '#eab308' // yellow
    case 'P3':
      return '#9ca3af' // gray
    default:
      return '#6b7280'
  }
}

export function TaskCard({ task, onClick, draggable = true, onDragStart }: TaskCardProps) {
  const priorityColor = getPriorityColor(task.priority)

  return (
    <div
      className="kanban-card"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      style={{ cursor: draggable ? 'grab' : 'pointer' }}
      title="Click to view details, drag to move"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <strong style={{ lineHeight: 1.2, flex: 1 }}>{task.title}</strong>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: priorityColor,
            flexShrink: 0,
          }}
          title={`Priority: ${task.priority}`}
        />
      </div>

      {task.description && (
        <div
          className="muted"
          style={{
            marginTop: 6,
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {task.description}
        </div>
      )}

      {task.assignee && (
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          <span>{task.assignee.emoji}</span> {task.assignee.name}
        </div>
      )}

      {(task.tags && task.tags.length > 0) && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                backgroundColor: 'rgba(100, 116, 139, 0.3)',
                borderRadius: 3,
                color: '#cbd5e1',
              }}
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {(task.estimatedHours || task.actualHours || task.commentCount || task.subtaskCount) && (
        <div
          className="muted"
          style={{
            marginTop: 8,
            fontSize: 11,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
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
    </div>
  )
}
