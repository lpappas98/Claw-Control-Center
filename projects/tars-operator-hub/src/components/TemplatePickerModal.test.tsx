import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplatePickerModal } from './TemplatePickerModal'

describe('TemplatePickerModal', () => {
  const mockOnSelect = vi.fn()
  const mockOnClose = vi.fn()

  it('should render modal with title', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)
    expect(screen.getByText('Choose Task Template')).toBeInTheDocument()
  })

  it('should display search input', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)
    expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument()
  })

  it('should display template list', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    expect(screen.getByText('Feature Development')).toBeInTheDocument()
    expect(screen.getByText('Bug Fix')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Release Cycle')).toBeInTheDocument()
  })

  it('should filter templates by search', async () => {
    const user = userEvent.setup()
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const searchInput = screen.getByPlaceholderText('Search templates...')
    await user.type(searchInput, 'bug')

    expect(screen.getByText('Bug Fix')).toBeInTheDocument()
    expect(screen.queryByText('Feature Development')).not.toBeInTheDocument()
  })

  it('should display template details when selected', async () => {
    const user = userEvent.setup()
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const featureTemplate = screen.getByText('Feature Development')
    await user.click(featureTemplate)

    expect(screen.getByText('Tasks in this template:')).toBeInTheDocument()
  })

  it('should call onSelect when using template', async () => {
    const user = userEvent.setup()
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const featureTemplate = screen.getByText('Feature Development')
    await user.click(featureTemplate)

    const useButton = screen.getByRole('button', { name: /Use Template/i })
    await user.click(useButton)

    expect(mockOnSelect).toHaveBeenCalled()
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onClose when closing modal', async () => {
    const user = userEvent.setup()
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const closeButton = screen.getByRole('button', { name: /Close/i })
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should disable Use Template button when no template selected', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const useButton = screen.getByRole('button', { name: /Use Template/i })
    expect(useButton).toBeDisabled()
  })

  it('should display task counts for templates', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    expect(screen.getByText(/5 tasks/)).toBeInTheDocument()
    expect(screen.getByText(/4 tasks/)).toBeInTheDocument()
  })

  it('should show estimated hours for templates', () => {
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    expect(screen.getByText(/34h estimated/)).toBeInTheDocument() // Feature dev total
  })

  it('should handle empty search results', async () => {
    const user = userEvent.setup()
    render(<TemplatePickerModal onSelect={mockOnSelect} onClose={mockOnClose} />)

    const searchInput = screen.getByPlaceholderText('Search templates...')
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText('No templates found matching your search')).toBeInTheDocument()
  })
})
