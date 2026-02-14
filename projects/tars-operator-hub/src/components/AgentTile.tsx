import type { Agent, AgentTask } from '../types'

interface AgentTileProps {
  agent: Agent
  currentTask?: AgentTask | null
  onClick?: () => void
  isSelected?: boolean
}

function getStatusColor(status: Agent['status']): string {
  switch (status) {
    case 'online':
      return '#22c55e' // green
    case 'busy':
      return '#f59e0b' // amber
    case 'offline':
      return '#9ca3af' // gray
    default:
      return '#9ca3af'
  }
}

export function AgentTile({ agent, currentTask, onClick, isSelected = false }: AgentTileProps) {
  const statusColor = getStatusColor(agent.status)

  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(51, 65, 85, 0.5)',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #475569',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      className="agent-tile"
      title={`Agent: ${agent.name} (${agent.status})`}
    >
      {/* Avatar */}
      <div
        style={{
          fontSize: 48,
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        {agent.emoji}
      </div>

      {/* Name and role */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{agent.role}</div>
      </div>

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
          }}
        />
        <span style={{ fontSize: 12, color: '#cbd5e1' }}>{agent.status}</span>
      </div>

      {/* Current task */}
      {currentTask ? (
        <div
          style={{
            padding: 8,
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>Current task:</div>
          <div style={{ color: '#e2e8f0', fontWeight: 500 }}>{currentTask.title}</div>
        </div>
      ) : (
        <div
          style={{
            padding: 8,
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            borderRadius: 4,
            marginBottom: 12,
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          No active task
        </div>
      )}

      {/* Workload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#cbd5e1' }}>Workload:</span>
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {agent.workload} task{agent.workload !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {agent.tags.map((tag) => (
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
        </div>
      )}
    </div>
  )
}
