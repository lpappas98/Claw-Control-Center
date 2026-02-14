import { useState } from 'react'
import type { AgentTask } from '../types'

interface DependencyGraphProps {
  task: AgentTask
  allTasks: AgentTask[]
  onTaskClick?: (task: AgentTask) => void
}

interface GraphNode {
  task: AgentTask
  x: number
  y: number
  depth: number
}

export function DependencyGraph({ task, allTasks, onTaskClick }: DependencyGraphProps) {
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)

  // Build dependency graph
  const getBlockingTasks = (taskId: string): AgentTask[] => {
    const blocking = allTasks.filter((t) => task.blockedBy?.includes(t.id) && t.id === taskId)
    return blocking
  }

  const getBlockedByTasks = (taskId: string): AgentTask[] => {
    const blocked = allTasks.filter((t) => t.blockedBy?.includes(taskId))
    return blocked
  }

  // Get all related tasks
  const relatedTaskIds = new Set<string>()
  relatedTaskIds.add(task.id)

  // Add blocking tasks
  if (task.blockedBy) {
    task.blockedBy.forEach((id) => relatedTaskIds.add(id))
  }

  // Add blocked tasks
  const blockedTasks = getBlockedByTasks(task.id)
  blockedTasks.forEach((t) => relatedTaskIds.add(t.id))

  const relatedTasks = allTasks.filter((t) => relatedTaskIds.has(t.id))

  if (relatedTasks.length === 0) {
    return (
      <div className="panel" style={{ padding: 12, marginTop: 12, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Dependency Graph</h4>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>No task dependencies</div>
      </div>
    )
  }

  // SVG rendering
  const svgWidth = 400
  const svgHeight = 300
  const nodeWidth = 120
  const nodeHeight = 60
  const xSpacing = 200
  const ySpacing = 100

  const nodes: GraphNode[] = []

  // Position main task in center
  nodes.push({
    task,
    x: svgWidth / 2 - nodeWidth / 2,
    y: svgHeight / 2 - nodeHeight / 2,
    depth: 0,
  })

  // Position blocking tasks above
  if (task.blockedBy && task.blockedBy.length > 0) {
    task.blockedBy.forEach((blockingId, index) => {
      const blockingTask = allTasks.find((t) => t.id === blockingId)
      if (blockingTask) {
        const offset = (index - (task.blockedBy!.length - 1) / 2) * xSpacing
        nodes.push({
          task: blockingTask,
          x: svgWidth / 2 - nodeWidth / 2 + offset,
          y: Math.max(0, svgHeight / 2 - nodeHeight / 2 - ySpacing),
          depth: -1,
        })
      }
    })
  }

  // Position blocked tasks below
  blockedTasks.slice(0, 3).forEach((blockingTask, index) => {
    const offset = (index - (Math.min(3, blockedTasks.length) - 1) / 2) * xSpacing
    nodes.push({
      task: blockingTask,
      x: svgWidth / 2 - nodeWidth / 2 + offset,
      y: svgHeight / 2 - nodeHeight / 2 + ySpacing,
      depth: 1,
    })
  })

  // Draw connections
  const connections: Array<{ from: GraphNode; to: GraphNode }> = []
  nodes.forEach((node) => {
    if (node.task.id !== task.id) {
      const mainNode = nodes.find((n) => n.task.id === task.id)
      if (mainNode) {
        connections.push({ from: node, to: mainNode })
      }
    }
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0':
        return '#ef4444'
      case 'P1':
        return '#f97316'
      case 'P2':
        return '#eab308'
      case 'P3':
        return '#06b6d4'
      default:
        return '#cbd5e1'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return '#8dffc2'
      case 'blocked':
        return '#ff8c8c'
      case 'review':
        return '#9ac3ff'
      case 'development':
        return '#ffa1e2'
      case 'queued':
      default:
        return '#cbd5e1'
    }
  }

  return (
    <div className="panel" style={{ padding: 12, marginTop: 12, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}>
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>Dependency Graph</h4>

      <svg
        width="100%"
        height={svgHeight}
        style={{ border: '1px solid #242b45', borderRadius: 8, marginBottom: 12 }}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      >
        {/* Draw connections */}
        {connections.map((conn, idx) => (
          <line
            key={`line-${idx}`}
            x1={conn.from.x + nodeWidth / 2}
            y1={conn.from.y + nodeHeight}
            x2={conn.to.x + nodeWidth / 2}
            y2={conn.to.y}
            stroke={task.blockedBy?.includes(conn.from.task.id) ? '#9ac3ff' : '#ffa1e2'}
            strokeWidth="2"
            markerEnd={task.blockedBy?.includes(conn.from.task.id) ? 'url(#arrowBlocking)' : 'url(#arrowBlocked)'}
            opacity="0.6"
          />
        ))}

        {/* Define arrow markers */}
        <defs>
          <marker id="arrowBlocking" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#9ac3ff" />
          </marker>
          <marker id="arrowBlocked" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#ffa1e2" />
          </marker>
        </defs>

        {/* Draw nodes */}
        {nodes.map((node) => (
          <g
            key={node.task.id}
            onClick={() => onTaskClick?.(node.task)}
            onMouseEnter={() => setHoveredTaskId(node.task.id)}
            onMouseLeave={() => setHoveredTaskId(null)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={nodeHeight}
              rx="6"
              fill={node.task.id === task.id ? '#1d2350' : '#0b0f1f'}
              stroke={
                hoveredTaskId === node.task.id
                  ? '#5f6dff'
                  : node.task.id === task.id
                    ? getStatusColor(node.task.status)
                    : '#242b45'
              }
              strokeWidth="2"
              opacity={hoveredTaskId === null || hoveredTaskId === node.task.id ? 1 : 0.5}
            />
            <text
              x={node.x + nodeWidth / 2}
              y={node.y + 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill={getPriorityColor(node.task.priority)}
              opacity={hoveredTaskId === null || hoveredTaskId === node.task.id ? 1 : 0.5}
            >
              {node.task.priority}
            </text>
            <text
              x={node.x + nodeWidth / 2}
              y={node.y + 36}
              textAnchor="middle"
              fontSize="9"
              fill="#cbd5e1"
              opacity={hoveredTaskId === null || hoveredTaskId === node.task.id ? 1 : 0.5}
              style={{ pointerEvents: 'none' }}
            >
              <tspan x={node.x + nodeWidth / 2} dy="0">
                {node.task.title.substring(0, 12)}
              </tspan>
              <tspan x={node.x + nodeWidth / 2} dy="12">
                {node.task.title.length > 12 ? '...' : ''}
              </tspan>
            </text>
          </g>
        ))}
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        <div>
          <div style={{ color: '#94a3b8', marginBottom: 6 }}>Blocking Tasks (Needs to finish first):</div>
          {task.blockedBy && task.blockedBy.length > 0 ? (
            <div className="stack" style={{ gap: 4 }}>
              {task.blockedBy.map((id) => {
                const blockingTask = allTasks.find((t) => t.id === id)
                if (!blockingTask) return null
                return (
                  <div
                    key={id}
                    onClick={() => onTaskClick?.(blockingTask)}
                    style={{
                      padding: 6,
                      backgroundColor: 'rgba(154, 195, 255, 0.1)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#9ac3ff',
                      border: '1px solid #2a4a7f',
                    }}
                  >
                    {blockingTask.title} ({blockingTask.status})
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>None</div>
          )}
        </div>

        <div>
          <div style={{ color: '#94a3b8', marginBottom: 6 }}>Blocked Tasks (Waits for this):</div>
          {blockedTasks.length > 0 ? (
            <div className="stack" style={{ gap: 4 }}>
              {blockedTasks.slice(0, 3).map((blocked) => (
                <div
                  key={blocked.id}
                  onClick={() => onTaskClick?.(blocked)}
                  style={{
                    padding: 6,
                    backgroundColor: 'rgba(255, 161, 226, 0.1)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#ffa1e2',
                    border: '1px solid #6b2d5a',
                  }}
                >
                  {blocked.title} ({blocked.status})
                </div>
              ))}
              {blockedTasks.length > 3 && (
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  +{blockedTasks.length - 3} more blocked
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>None</div>
          )}
        </div>
      </div>
    </div>
  )
}
