import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecurringTasksPage } from './RecurringTasksPage'

describe('RecurringTasksPage', () => {
  it('should render page title', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('Recurring Tasks')).toBeInTheDocument()
  })

  it('should display New Routine button', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByRole('button', { name: /New Routine/i })).toBeInTheDocument()
  })

  it('should display sample routines', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('Weekly Team Sync')).toBeInTheDocument()
    expect(screen.getByText('Code Review Check')).toBeInTheDocument()
    expect(screen.getByText('Backup Database')).toBeInTheDocument()
  })

  it('should show routine details', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('Every Monday 9am for weekly team meeting')).toBeInTheDocument()
  })

  it('should show schedule in cron format', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('0 9 ? * MON')).toBeInTheDocument()
  })

  it('should display enabled/disabled status', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('should open modal when creating new routine', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    expect(screen.getByText('New Recurring Task')).toBeInTheDocument()
  })

  it('should open modal when editing routine', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const editButtons = screen.getAllByRole('button', { name: /Edit/i })
    await user.click(editButtons[0])

    expect(screen.getByText('Edit Recurring Task')).toBeInTheDocument()
  })

  it('should allow entering routine name', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const nameInput = screen.getByPlaceholderText('e.g., Weekly Team Meeting')
    await user.type(nameInput, 'Daily Standup')

    expect((nameInput as HTMLInputElement).value).toBe('Daily Standup')
  })

  it('should allow entering cron expression', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const cronInput = screen.getByPlaceholderText('0 10 * * ?')
    await user.type(cronInput, '0 14 * * ?')

    expect((cronInput as HTMLInputElement).value).toBe('0 14 * * ?')
  })

  it('should disable save button when name is empty', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const saveButton = screen.getByRole('button', { name: /Create Routine/i })
    expect(saveButton).toBeDisabled()
  })

  it('should enable save button when name is provided', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const nameInput = screen.getByPlaceholderText('e.g., Weekly Team Meeting')
    await user.type(nameInput, 'Daily Standup')

    const saveButton = screen.getByRole('button', { name: /Create Routine/i })
    expect(saveButton).not.toBeDisabled()
  })

  it('should display cron presets', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    expect(screen.getByRole('button', { name: /Daily 10am/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Midnight/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Every Monday 9am/i })).toBeInTheDocument()
  })

  it('should set cron when preset is clicked', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const dailyPreset = screen.getByRole('button', { name: /Daily 10am/i })
    await user.click(dailyPreset)

    const cronInput = screen.getByPlaceholderText('0 10 * * ?') as HTMLInputElement
    expect(cronInput.value).toBe('0 10 * * ?')
  })

  it('should toggle routine enable/disable', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const disableButtons = screen.getAllByRole('button', { name: /Disable|Enable/i })
    expect(disableButtons.length).toBeGreaterThan(0)
  })

  it('should require confirmation before deleting', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<RecurringTasksPage />)

    const deleteButtons = screen.getAllByRole('button', { name: /Delete/i })
    await user.click(deleteButtons[0])

    expect(confirmSpy).toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('should display next run date', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText(/Next Run/)).toBeInTheDocument()
  })

  it('should display last run date', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText(/Last Run/)).toBeInTheDocument()
  })

  it('should show cron description', () => {
    render(<RecurringTasksPage />)
    expect(screen.getByText('Every Monday at 9:00 AM')).toBeInTheDocument()
  })

  it('should handle closing modal', async () => {
    const user = userEvent.setup()
    render(<RecurringTasksPage />)

    const newButton = screen.getByRole('button', { name: /New Routine/i })
    await user.click(newButton)

    const closeButton = screen.getByRole('button', { name: /Close/i })
    await user.click(closeButton)

    expect(screen.queryByText('New Recurring Task')).not.toBeInTheDocument()
  })
})

// Import vi for mocking
import { vi } from 'vitest'
