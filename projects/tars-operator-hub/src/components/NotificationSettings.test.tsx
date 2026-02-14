import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationSettings } from './NotificationSettings'

describe('NotificationSettings', () => {
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Add Notification Channel section', () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    expect(screen.getByText('Add Notification Channel')).toBeDefined()
    expect(screen.getByPlaceholderText(/Development Team/)).toBeDefined()
    expect(screen.getByPlaceholderText('-1234567890')).toBeDefined()
  })

  it('renders Add Channel button', () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    expect(screen.getByText('Add Channel')).toBeDefined()
  })

  it('disables Add Channel button when fields are empty', () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const button = screen.getByText('Add Channel')
    expect(button).toHaveAttribute('disabled')
  })

  it('enables Add Channel button when both fields are filled', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    await waitFor(() => {
      const button = screen.getByText('Add Channel')
      expect(button).not.toHaveAttribute('disabled')
    })
  })

  it('adds a new channel when Add Channel is clicked', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    const addButton = screen.getByText('Add Channel')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeDefined()
      expect(screen.getByText('-123456')).toBeDefined()
    })
  })

  it('displays Configure Event Notifications after adding a channel', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    const addButton = screen.getByText('Add Channel')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Configure Event Notifications')).toBeDefined()
    })
  })

  it('shows all event types for a new channel', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    const addButton = screen.getByText('Add Channel')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Task Assigned')).toBeDefined()
      expect(screen.getByText('Task Commented')).toBeDefined()
      expect(screen.getByText('Task Blocked')).toBeDefined()
      expect(screen.getByText('Task Completed')).toBeDefined()
      expect(screen.getByText('Status Changed')).toBeDefined()
    })
  })

  it('can toggle event types on/off', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0]) // Toggle first checkbox
      expect(checkboxes[0]).toBeChecked()
    })
  })

  it('displays Send Test Notification button for each channel', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('📤 Send Test Notification')).toBeDefined()
    })
  })

  it('shows success message when test notification is sent', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const testButton = screen.getByText('📤 Send Test Notification')
      fireEvent.click(testButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/Test notification sent to Team A/)).toBeDefined()
    })
  })

  it('displays Remove button for each channel', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeDefined()
    })
  })

  it('removes channel when Remove button is clicked', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const removeButton = screen.getByText('Remove')
      fireEvent.click(removeButton)
    })

    await waitFor(() => {
      expect(screen.queryByText('Team A')).toBeNull()
    })
  })

  it('displays Save Notification Settings button when channels exist', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('Save Notification Settings')).toBeDefined()
    })
  })

  it('calls onSave with correct parameters', async () => {
    mockOnSave.mockResolvedValue(undefined)

    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const saveButton = screen.getByText('Save Notification Settings')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
      const call = mockOnSave.mock.calls[0][0]
      expect(call.chatIds['Team A']).toBe('-123456')
    })
  })

  it('shows success message after saving', async () => {
    mockOnSave.mockResolvedValue(undefined)

    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const saveButton = screen.getByText('Save Notification Settings')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Notification settings saved!')).toBeDefined()
    })
  })

  it('shows error message when save fails', async () => {
    mockOnSave.mockRejectedValue(new Error('Save failed'))

    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      const saveButton = screen.getByText('Save Notification Settings')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeDefined()
    })
  })

  it('can add multiple channels', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    // Add first channel
    let nameInput = screen.getByPlaceholderText(/Development Team/)
    let idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-111111' } })
    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('Team A')).toBeDefined()
    })

    // Add second channel
    nameInput = screen.getByPlaceholderText(/Development Team/)
    idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team B' } })
    fireEvent.change(idInput, { target: { value: '-222222' } })
    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText('Team B')).toBeDefined()
    })
  })

  it('displays preview messages for each event type', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/)
    const idInput = screen.getByPlaceholderText('-1234567890')

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })

    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(screen.getByText(/You have been assigned/)).toBeDefined()
      expect(screen.getByText(/New comment on task/)).toBeDefined()
    })
  })

  it('clears input fields after adding channel', async () => {
    render(<NotificationSettings onSave={mockOnSave} />)

    const nameInput = screen.getByPlaceholderText(/Development Team/) as HTMLInputElement
    const idInput = screen.getByPlaceholderText('-1234567890') as HTMLInputElement

    fireEvent.change(nameInput, { target: { value: 'Team A' } })
    fireEvent.change(idInput, { target: { value: '-123456' } })
    fireEvent.click(screen.getByText('Add Channel'))

    await waitFor(() => {
      expect(nameInput.value).toBe('')
      expect(idInput.value).toBe('')
    })
  })
})
