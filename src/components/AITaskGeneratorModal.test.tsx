import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AITaskGeneratorModal } from './AITaskGeneratorModal'

describe('AITaskGeneratorModal', () => {
  const mockOnCreateTasks = vi.fn().mockResolvedValue(undefined)
  const mockOnClose = vi.fn()

  it('should render modal with title', () => {
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )
    expect(screen.getByText('Generate Tasks with AI')).toBeInTheDocument()
  })

  it('should display prompt textarea', () => {
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )
    expect(screen.getByPlaceholderText(/Describe what you want to build/)).toBeInTheDocument()
  })

  it('should show Generate Tasks button', () => {
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )
    expect(screen.getByRole('button', { name: /Generate Tasks/i })).toBeInTheDocument()
  })

  it('should generate tasks on button click', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build a user authentication system')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    // Should show generated tasks section
    expect(screen.getByText('Generated Tasks')).toBeInTheDocument()
  })

  it('should disable Generate button when prompt is empty', () => {
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )
    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    expect(generateButton).toBeDisabled()
  })

  it('should show Create All Tasks button after generation', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build authentication')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    expect(screen.getByRole('button', { name: /Create All Tasks/i })).toBeInTheDocument()
  })

  it('should allow editing generated tasks', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build authentication')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    expect(editButtons.length).toBeGreaterThan(0)
  })

  it('should allow removing generated tasks', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build authentication')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
    expect(removeButtons.length).toBeGreaterThan(0)
  })

  it('should call onCreateTasks when creating all', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build authentication')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    const createButton = screen.getByRole('button', { name: /Create All Tasks/i })
    await user.click(createButton)

    expect(mockOnCreateTasks).toHaveBeenCalled()
  })

  it('should close modal after creating tasks', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/)
    await user.type(textarea, 'Build authentication')

    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    await user.click(generateButton)

    const createButton = screen.getByRole('button', { name: /Create All Tasks/i })
    await user.click(createButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onClose when canceling', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    const closeButton = screen.getByRole('button', { name: /Cancel/i })
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show error if prompt is empty on generate', async () => {
    const user = userEvent.setup()
    render(
      <AITaskGeneratorModal onCreateTasks={mockOnCreateTasks} onClose={mockOnClose} />,
    )

    // Try to generate without typing anything
    const generateButton = screen.getByRole('button', { name: /Generate Tasks/i })
    expect(generateButton).toBeDisabled()
  })
})
