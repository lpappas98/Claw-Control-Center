import type { Agent, AgentTask } from '../types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AgentTileProps {
  agent: Agent
  currentTask?: AgentTask | null
  onClick?: () => void
  isSelected?: boolean
}

function getStatusVariant(status: Agent['status']): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'online':
      return 'default' // green
    case 'busy':
      return 'secondary' // amber
    case 'offline':
      return 'destructive' // gray
    default:
      return 'secondary'
  }
}

function getStatusLabel(status: Agent['status']): string {
  switch (status) {
    case 'online':
      return 'Online'
    case 'busy':
      return 'Busy'
    case 'offline':
      return 'Offline'
    default:
      return 'Unknown'
  }
}

export function AgentTile({ agent, currentTask, onClick, isSelected = false }: AgentTileProps) {
  const statusVariant = getStatusVariant(agent.status)
  const statusLabel = getStatusLabel(agent.status)

  return (
    <Card
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      title={`Agent: ${agent.name} (${statusLabel})`}
    >
      {/* Avatar */}
      <div className="text-4xl mb-3 text-center">
        {agent.emoji}
      </div>

      {/* Name and role */}
      <div className="mb-2">
        <div className="font-semibold text-base">{agent.name}</div>
        <div className="text-xs text-slate-500">{agent.role}</div>
      </div>

      {/* Status badge */}
      <div className="mb-3">
        <Badge variant={statusVariant}>
          {statusLabel}
        </Badge>
      </div>

      {/* Current task */}
      <div className="bg-slate-100 rounded p-2 mb-3 text-sm">
        {currentTask ? (
          <>
            <div className="text-xs text-slate-500 mb-1">Current task:</div>
            <div className="font-medium text-slate-900 line-clamp-2">{currentTask.title}</div>
          </>
        ) : (
          <div className="text-xs text-slate-500">
            No active task
          </div>
        )}
      </div>

      {/* Workload */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-600">Workload:</span>
        <Badge variant="outline">
          {agent.workload} task{agent.workload !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div className="mt-3 flex gap-1 flex-wrap">
          {agent.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  )
}
