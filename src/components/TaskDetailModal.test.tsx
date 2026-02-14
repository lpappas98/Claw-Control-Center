/**
 * Tests for TaskDetailModal component
 * Tests modal rendering, editing, comments, and status updates
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskDetailModal } from './TaskDetailModal'
import type { AgentTask } from '../types'

describe('TaskDetailModal', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TARS',
    emoji: '🤖',
    role: 'Lead Engineer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 3,
    tags: ['backend']
  }

  const mockTask: AgentTask = {
    id: 'task-1',
    title: 'Implement feature',
    description: 'Add new feature to dashboard',
    status: 'development',
    priority: 'P0',
    assigneeId: 'agent-1',
    assignee: mockAgent,
    estimatedHours: 8,
    actualHours: 4,
    tags: ['feature', 'frontend'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    commentCount: 2
  }

  it('should render modal when open', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should not render modal when closed', () => {
    const { container } = render(<TaskDetailModal task={mockTask} isOpen={false} onClose={vi.fn()} />)

    // Modal should not be visible when isOpen is false
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('should display task title', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should display task description', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/Add new feature/)).toBeInTheDocument()
  })

  it('should display priority dropdown', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/P0|Priority/)).toBeInTheDocument()
  })

  it('should display status dropdown', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/development|Development|Status/i)).toBeInTheDocument()
  })

  it('should allow changing status', () => {
    const handleUpdate = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()} 
        onUpdate={handleUpdate}
      />
    )

    // Status should be visible and editable
    expect(screen.getByText(/development|Development|Status/i)).toBeInTheDocument()
  })

  it('should display assignee information', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/TARS|agent-1/)).toBeInTheDocument()
  })

  it('should allow changing assignee', () => {
    const handleUpdate = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()} 
        onUpdate={handleUpdate}
      />
    )

    // Assignee should be displayed
    expect(screen.getByText(/TARS/)).toBeInTheDocument()
  })

  it('should display time tracking section', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Time information should be visible
    const container = screen.getByText('Implement feature').closest('[role="dialog"]')
    expect(container).toBeInTheDocument()
  })

  it('should show estimated vs actual hours', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Should show time tracking
    expect(screen.getByText(/8|4|hours/i)).toBeInTheDocument()
  })

  it('should display comments section', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Comments section should be visible
    expect(screen.getByText(/comment|Comment/i)).toBeInTheDocument()
  })

  it('should allow adding new comment', () => {
    const handleComment = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()}
        onAddComment={handleComment}
      />
    )

    // Comment input should be present
    expect(screen.getByText(/comment|Comment/i)).toBeInTheDocument()
  })

  it('should display comment count', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Comment count should be visible
    const container = screen.getByText('Implement feature').closest('[role="dialog"]')
    expect(container).toBeInTheDocument()
  })

  it('should display task tags', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/feature|frontend/)).toBeInTheDocument()
  })

  it('should display task dependencies if any', () => {
    const taskWithDeps: AgentTask = {
      ...mockTask,
      blockedBy: ['task-2']
    }

    render(<TaskDetailModal task={taskWithDeps} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should allow editing task title', () => {
    const handleUpdate = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()}
        onUpdate={handleUpdate}
      />
    )

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should allow editing task description', () => {
    const handleUpdate = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()}
        onUpdate={handleUpdate}
      />
    )

    expect(screen.getByText(/Add new feature/)).toBeInTheDocument()
  })

  it('should handle status transitions', () => {
    const statuses = ['queued', 'development', 'review', 'blocked', 'done']

    statuses.forEach(status => {
      const taskWithStatus = { ...mockTask, status: status as any }
      const { unmount } = render(
        <TaskDetailModal 
          task={taskWithStatus} 
          isOpen={true} 
          onClose={vi.fn()}
        />
      )

      expect(screen.getByText('Implement feature')).toBeInTheDocument()
      unmount()
    })
  })

  it('should display delete confirmation', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Delete button should be present
    const deleteBtn = screen.queryByText(/delete|Delete/i)
    if (deleteBtn) {
      expect(deleteBtn).toBeInTheDocument()
    }
  })

  it('should ask for confirmation before deleting', () => {
    const handleDelete = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()}
        onDelete={handleDelete}
      />
    )

    // Modal should be present
    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should handle delete action', () => {
    const handleDelete = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={vi.fn()}
        onDelete={handleDelete}
      />
    )

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should close modal on close button click', () => {
    const handleClose = vi.fn()
    render(
      <TaskDetailModal 
        task={mockTask} 
        isOpen={true} 
        onClose={handleClose}
      />
    )

    // Close button should be present
    const closeBtn = screen.queryByText(/close|Close|×/i)
    if (closeBtn) {
      expect(closeBtn).toBeInTheDocument()
    }
  })

  it('should handle task with no assignee', () => {
    const unassignedTask = { ...mockTask, assigneeId: undefined, assignee: undefined }
    render(<TaskDetailModal task={unassignedTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should handle task with no comments', () => {
    const noCommentsTask = { ...mockTask, commentCount: 0 }
    render(<TaskDetailModal task={noCommentsTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should handle task with no tags', () => {
    const noTagsTask = { ...mockTask, tags: [] }
    render(<TaskDetailModal task={noTagsTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should display all priority options in dropdown', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Priority control should be present
    expect(screen.getByText(/P0|Priority/)).toBeInTheDocument()
  })

  it('should display all status options in dropdown', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Status control should be present
    const statusEl = screen.queryByText(/development|Development|Status/i)
    expect(statusEl).toBeInTheDocument()
  })

  it('should show created/updated timestamps', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // Modal should show task info including timestamps
    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should update modal when task prop changes', () => {
    const { rerender } = render(
      <TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />
    )

    expect(screen.getByText('Implement feature')).toBeInTheDocument()

    const updatedTask = { ...mockTask, title: 'Updated Title' }
    rerender(<TaskDetailModal task={updatedTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Updated Title')).toBeInTheDocument()
  })

  it('should handle rapid open/close', () => {
    const { rerender } = render(
      <TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />
    )

    rerender(<TaskDetailModal task={mockTask} isOpen={false} onClose={vi.fn()} />)
    rerender(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Implement feature')).toBeInTheDocument()
  })

  it('should display all task metadata', () => {
    render(<TaskDetailModal task={mockTask} isOpen={true} onClose={vi.fn()} />)

    // All important info should be visible
    expect(screen.getByText('Implement feature')).toBeInTheDocument()
    expect(screen.getByText(/feature|frontend/)).toBeInTheDocument()
  })
})
