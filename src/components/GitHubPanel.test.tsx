import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GitHubPanel } from './GitHubPanel'

describe('GitHubPanel', () => {
  const mockOnCreateIssue = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders GitHub Integration section title', () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    expect(screen.getByText('GitHub Integration')).toBeDefined()
  })

  it('renders Create Issue button', () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    expect(screen.getByText('🐙 Create Issue')).toBeDefined()
  })

  it('shows "No GitHub issue linked yet" when no issue URL is provided', () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    expect(screen.getByText('No GitHub issue linked yet')).toBeDefined()
  })

  it('displays linked GitHub issue URL when provided', () => {
    const issueUrl = 'https://github.com/owner/repo/issues/123'
    render(
      <GitHubPanel
        taskId="task-1"
        githubIssueUrl={issueUrl}
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe(issueUrl)
    expect(screen.getByText('Linked Issue')).toBeDefined()
  })

  it('displays commits table when commits are provided', () => {
    const commits = [
      {
        sha: 'abc123def456',
        message: 'Fix bug in authentication',
        date: '2024-02-14T10:00:00Z',
      },
    ]

    render(
      <GitHubPanel
        taskId="task-1"
        commits={commits}
        onCreateIssue={mockOnCreateIssue}
      />
    )

    expect(screen.getByText('Linked Commits')).toBeDefined()
    expect(screen.getByText('Fix bug in authentication')).toBeDefined()
  })

  it('opens create issue dialog when Create Issue button is clicked', async () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Create GitHub Issue')).toBeDefined()
      expect(screen.getByPlaceholderText('Describe the issue...')).toBeDefined()
    })
  })

  it('requires issue title before creating issue', async () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    await waitFor(() => {
      const submitButton = screen.getByText('Create Issue')
      expect(submitButton).toHaveAttribute('disabled')
    })
  })

  it('enables Create Issue button when title is filled', async () => {
    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    const titleInput = await screen.findByPlaceholderText('Describe the issue...')
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } })

    await waitFor(() => {
      const submitButton = screen.getByText('Create Issue')
      expect(submitButton).not.toHaveAttribute('disabled')
    })
  })

  it('calls onCreateIssue with correct parameters', async () => {
    mockOnCreateIssue.mockResolvedValue(
      'https://github.com/owner/repo/issues/999'
    )

    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    const titleInput = await screen.findByPlaceholderText('Describe the issue...')
    const descInput = screen.getByPlaceholderText('Optional issue details...')

    fireEvent.change(titleInput, { target: { value: 'Test Issue' } })
    fireEvent.change(descInput, { target: { value: 'Test Description' } })

    const submitButton = screen.getByText('Create Issue')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockOnCreateIssue).toHaveBeenCalledWith(
        'task-1',
        'Test Issue',
        'Test Description'
      )
    })
  })

  it('closes dialog after successful issue creation', async () => {
    mockOnCreateIssue.mockResolvedValue(
      'https://github.com/owner/repo/issues/999'
    )

    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    const titleInput = await screen.findByPlaceholderText('Describe the issue...')
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } })

    const submitButton = screen.getByText('Create Issue')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.queryByText('Create GitHub Issue')).toBeNull()
    })
  })

  it('displays commit SHA as truncated link', () => {
    const commits = [
      {
        sha: 'abc123def456789',
        message: 'Test commit',
        date: '2024-02-14T10:00:00Z',
      },
    ]

    render(
      <GitHubPanel
        taskId="task-1"
        commits={commits}
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const link = screen.getByText('abc123d')
    expect(link.getAttribute('href')).toContain('abc123def456789')
  })

  it('formats commit date correctly', () => {
    const commits = [
      {
        sha: 'abc123',
        message: 'Test commit',
        date: '2024-02-14T10:00:00Z',
      },
    ]

    render(
      <GitHubPanel
        taskId="task-1"
        commits={commits}
        onCreateIssue={mockOnCreateIssue}
      />
    )

    // Date should be formatted as 2/14/2024
    expect(screen.getByText(/2\/14\/2024/)).toBeDefined()
  })

  it('disables Create Issue button while loading', async () => {
    render(
      <GitHubPanel
        taskId="task-1"
        isLoading={true}
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    expect(createButton).toHaveAttribute('disabled')
  })

  it('handles error when creating issue', async () => {
    mockOnCreateIssue.mockRejectedValue(new Error('Network error'))

    render(
      <GitHubPanel
        taskId="task-1"
        onCreateIssue={mockOnCreateIssue}
      />
    )

    const createButton = screen.getByText('🐙 Create Issue')
    fireEvent.click(createButton)

    const titleInput = await screen.findByPlaceholderText('Describe the issue...')
    fireEvent.change(titleInput, { target: { value: 'Test Issue' } })

    const submitButton = screen.getByText('Create Issue')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })
  })
})
