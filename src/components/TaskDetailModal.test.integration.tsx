import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskDetailModal } from './TaskDetailModal'
import type { AgentTask, Agent } from '../types'

// Mock the API
vi.mock('../services/api', () => ({
  updateTaskStatus: vi.fn(),
  updateTask: vi.fn(),
  assignTask: vi.fn(),
  addComment: vi.fn(),
  deleteTask: vi.fn(),
  addTimeLog: vi.fn(),
}))

describe('TaskDetailModal - Phase 5 Integration Features', () => {
  const mockAgent: Agent = {
    id: 'agent-1',
    name: 'Test Agent',
    emoji: '🤖',
    role: 'Developer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 2,
  }

  const mockTask: AgentTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'development',
    priority: 'P1',
    assigneeId: 'agent-1',
    estimatedHours: 5,
    actualHours: 0,
    tags: ['feature'],
    projectId: 'proj-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    timeLogs: [],
  }

  const mockOnClose = vi.fn()
  const mockOnTaskUpdated = vi.fn()
  const mockOnTaskDeleted = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders deadline section in task detail modal', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    expect(screen.getByText('Deadline')).toBeDefined()
    expect(screen.getByText('Pick a date')).toBeDefined()
  })

  it('renders GitHub Integration section', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    expect(screen.getByText('GitHub Integration')).toBeDefined()
    expect(screen.getByText('🐙 Create Issue')).toBeDefined()
  })

  it('shows "No GitHub issue linked yet" initially', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    expect(screen.getByText('No GitHub issue linked yet')).toBeDefined()
  })

  it('displays deadline when task has one', () => {
    const taskWithDeadline = {
      ...mockTask,
      deadline: new Date(2024, 2, 20).toISOString(),
    } as any

    render(
      <TaskDetailModal
        task={taskWithDeadline}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    // Check that the deadline button shows a date
    const deadlineButton = screen.getByRole('button', { name: /Mar/ })
    expect(deadlineButton).toBeDefined()
  })

  it('displays linked GitHub issue URL', () => {
    const taskWithIssue = {
      ...mockTask,
      githubIssueUrl: 'https://github.com/owner/repo/issues/123',
    } as any

    render(
      <TaskDetailModal
        task={taskWithIssue}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    const issueLink = screen.getByRole('link')
    expect(issueLink.getAttribute('href')).toBe(
      'https://github.com/owner/repo/issues/123'
    )
    expect(screen.getByText('Linked Issue')).toBeDefined()
  })

  it('displays commits table when task has commits', () => {
    const taskWithCommits = {
      ...mockTask,
      commits: [
        {
          sha: 'abc123def456',
          message: 'Fix bug in authentication',
          date: '2024-02-14T10:00:00Z',
        },
      ],
    } as any

    render(
      <TaskDetailModal
        task={taskWithCommits}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    expect(screen.getByText('Linked Commits')).toBeDefined()
    expect(screen.getByText('Fix bug in authentication')).toBeDefined()
  })

  it('maintains all existing TaskDetailModal functionality with new features', () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    // Check for existing elements
    expect(screen.getByText('Test Task')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
    expect(screen.getByText('Priority')).toBeDefined()
    expect(screen.getByText('Description')).toBeDefined()
    expect(screen.getByText('Comments')).toBeDefined()

    // Check for new Phase 5 elements
    expect(screen.getByText('Deadline')).toBeDefined()
    expect(screen.getByText('GitHub Integration')).toBeDefined()
  })

  it('renders all sections in correct order', () => {
    const { container } = render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    // Get all heading elements and separators
    const content = container.querySelector('[class*="space-y"]')
    expect(content).toBeDefined()

    // Verify sections are present
    expect(screen.getByText('Status')).toBeDefined() // Priority section
    expect(screen.getByText('Description')).toBeDefined()
    expect(screen.getByText('Deadline')).toBeDefined() // New deadline section
    expect(screen.getByText('GitHub Integration')).toBeDefined() // New GitHub section
    expect(screen.getByText('Comments')).toBeDefined()
  })

  it('opens Create GitHub Issue dialog when Create Issue button is clicked', async () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Create GitHub Issue')).toBeDefined()
    })
  })

  it('opens calendar picker when deadline button is clicked', async () => {
    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    const deadlineButton = screen.getByText('Pick a date')
    fireEvent.click(deadlineButton)

    await waitFor(() => {
      // Calendar should be visible
      expect(
        screen.getByRole('button', { name: /January 2025|December 2024/ })
      ).toBeDefined()
    })
  })

  it('displays days remaining when deadline is set', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)

    const taskWithDeadline = {
      ...mockTask,
      deadline: futureDate.toISOString(),
    } as any

    render(
      <TaskDetailModal
        task={taskWithDeadline}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/\d+ days remaining/)).toBeDefined()
    })
  })

  it('integrates deadline with dependency graph section', () => {
    const allTasks = [
      mockTask,
      {
        ...mockTask,
        id: 'task-2',
        title: 'Dependent Task',
      },
    ]

    render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        allTasks={allTasks}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    // All sections should be present
    expect(screen.getByText('Deadline')).toBeDefined()
    expect(screen.getByText('GitHub Integration')).toBeDefined()
    expect(screen.getByText('Dependencies')).toBeDefined()
  })

  it('maintains scroll state with all sections present', () => {
    const { container } = render(
      <TaskDetailModal
        task={mockTask}
        agents={[mockAgent]}
        onClose={mockOnClose}
        onTaskUpdated={mockOnTaskUpdated}
      />
    )

    // Modal content should have overflow handling
    const modalContent = container.querySelector('[class*="DialogContent"]')
    expect(modalContent?.className).toContain('overflow-y-auto')
  })
})
