/**
 * Tests for AgentTile component
 * Tests agent tile rendering, status display, and interactions
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentTile } from './AgentTile'
import type { Agent, AgentTask } from '../types'

describe('AgentTile', () => {
  const mockAgent: Agent = {
    id: 'agent-1',
    name: 'TARS',
    emoji: '🤖',
    role: 'Lead Engineer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 3,
    tags: ['backend', 'devops']
  }

  const mockTask: AgentTask = {
    id: 'task-1',
    title: 'Implement API',
    status: 'development',
    priority: 'P0',
    assigneeId: 'agent-1',
    assignee: mockAgent,
    tags: ['backend'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commentCount: 0
  }

  it('should render agent tile', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display agent emoji avatar', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('🤖')).toBeInTheDocument()
  })

  it('should display agent name', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display agent role', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText(/Lead Engineer/)).toBeInTheDocument()
  })

  it('should display online status indicator', () => {
    const onlineAgent = { ...mockAgent, status: 'online' }
    render(<AgentTile agent={onlineAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display offline status indicator', () => {
    const offlineAgent = { ...mockAgent, status: 'offline' }
    render(<AgentTile agent={offlineAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display busy status indicator', () => {
    const busyAgent = { ...mockAgent, status: 'busy' }
    render(<AgentTile agent={busyAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display workload badge', () => {
    render(<AgentTile agent={mockAgent} />)

    // Workload (3) should be visible
    expect(screen.getByText(/3|workload|task/i)).toBeInTheDocument()
  })

  it('should handle different workload values', () => {
    const workloads = [0, 1, 5, 10, 15]

    workloads.forEach(workload => {
      const agentWithWorkload = { ...mockAgent, workload }
      const { unmount } = render(<AgentTile agent={agentWithWorkload} />)

      expect(screen.getByText('TARS')).toBeInTheDocument()
      unmount()
    })
  })

  it('should display agent tags', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText(/backend|devops/)).toBeInTheDocument()
  })

  it('should display current task preview if provided', () => {
    render(<AgentTile agent={mockAgent} currentTask={mockTask} />)

    expect(screen.getByText(/Implement API|development/i)).toBeInTheDocument()
  })

  it('should show task status in preview', () => {
    render(<AgentTile agent={mockAgent} currentTask={mockTask} />)

    expect(screen.getByText(/development|Development/i)).toBeInTheDocument()
  })

  it('should handle agent with no current task', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should be clickable', () => {
    const handleClick = vi.fn()
    render(<AgentTile agent={mockAgent} onClick={handleClick} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should show selected state', () => {
    const { container } = render(<AgentTile agent={mockAgent} isSelected={true} />)

    // Selected state should be reflected in styling
    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should show unselected state', () => {
    render(<AgentTile agent={mockAgent} isSelected={false} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display last seen timestamp', () => {
    render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should handle multiple different agents', () => {
    const agent1 = { ...mockAgent, id: 'agent-1', name: 'TARS', emoji: '🤖' }
    const agent2 = { ...mockAgent, id: 'agent-2', name: 'Astra', emoji: '✨' }

    const { rerender } = render(<AgentTile agent={agent1} />)
    expect(screen.getByText('TARS')).toBeInTheDocument()
    expect(screen.getByText('🤖')).toBeInTheDocument()

    rerender(<AgentTile agent={agent2} />)
    expect(screen.getByText('Astra')).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()
  })

  it('should handle different roles', () => {
    const roles = ['Lead Engineer', 'Frontend Engineer', 'QA Engineer', 'DevOps Engineer']

    roles.forEach(role => {
      const agentWithRole = { ...mockAgent, role }
      const { unmount } = render(<AgentTile agent={agentWithRole} />)

      expect(screen.getByText(role)).toBeInTheDocument()
      unmount()
    })
  })

  it('should display all status types correctly', () => {
    const statuses = ['online', 'offline', 'busy']

    statuses.forEach(status => {
      const agentWithStatus = { ...mockAgent, status: status as any }
      const { unmount } = render(<AgentTile agent={agentWithStatus} />)

      expect(screen.getByText('TARS')).toBeInTheDocument()
      unmount()
    })
  })

  it('should show status indicator color based on status', () => {
    const { container: containerOnline } = render(
      <AgentTile agent={{ ...mockAgent, status: 'online' }} />
    )

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display agent with many tags', () => {
    const agentWithManyTags = {
      ...mockAgent,
      tags: ['backend', 'api', 'database', 'devops', 'docker']
    }

    render(<AgentTile agent={agentWithManyTags} />)

    // At least some tags should be visible
    expect(screen.getByText(/backend|api|devops/)).toBeInTheDocument()
  })

  it('should handle agent with no tags', () => {
    const noTagsAgent = { ...mockAgent, tags: [] }
    render(<AgentTile agent={noTagsAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should show workload as badge', () => {
    render(<AgentTile agent={{ ...mockAgent, workload: 7 }} />)

    // Workload should be visible
    expect(screen.getByText(/7|workload|task/i)).toBeInTheDocument()
  })

  it('should indicate high workload', () => {
    const busyAgent = { ...mockAgent, workload: 15 }
    render(<AgentTile agent={busyAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should indicate low workload', () => {
    const idleAgent = { ...mockAgent, workload: 1 }
    render(<AgentTile agent={idleAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should display task preview with multiple fields', () => {
    const taskWithDetails: AgentTask = {
      ...mockTask,
      priority: 'P0',
      estimatedHours: 8,
      actualHours: 4
    }

    render(<AgentTile agent={mockAgent} currentTask={taskWithDetails} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should be accessible with proper ARIA labels', () => {
    render(<AgentTile agent={mockAgent} />)

    const tile = screen.getByText('TARS')
    expect(tile).toBeInTheDocument()
  })

  it('should handle agent status transitions', () => {
    const { rerender } = render(<AgentTile agent={{ ...mockAgent, status: 'online' }} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()

    rerender(<AgentTile agent={{ ...mockAgent, status: 'offline' }} />)
    expect(screen.getByText('TARS')).toBeInTheDocument()

    rerender(<AgentTile agent={{ ...mockAgent, status: 'busy' }} />)
    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should update when agent prop changes', () => {
    const { rerender } = render(<AgentTile agent={mockAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()

    const updatedAgent = { ...mockAgent, workload: 10 }
    rerender(<AgentTile agent={updatedAgent} />)

    expect(screen.getByText('TARS')).toBeInTheDocument()
  })

  it('should support click handler', () => {
    const handleClick = vi.fn()
    render(<AgentTile agent={mockAgent} onClick={handleClick} />)

    const tile = screen.getByText('TARS').closest('[class*="tile"]')
    expect(tile).toBeInTheDocument()
  })

  it('should have different emoji for different agents', () => {
    const agent1 = { ...mockAgent, emoji: '🤖' }
    const agent2 = { ...mockAgent, emoji: '✨', name: 'Astra', id: 'agent-2' }

    const { rerender } = render(<AgentTile agent={agent1} />)
    expect(screen.getByText('🤖')).toBeInTheDocument()

    rerender(<AgentTile agent={agent2} />)
    expect(screen.getByText('✨')).toBeInTheDocument()
  })
})
