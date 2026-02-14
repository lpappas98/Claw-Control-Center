import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntegrationsPage } from './IntegrationsPage'

describe('IntegrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders integration page title and description', () => {
    render(<IntegrationsPage />)

    expect(screen.getByText('Integration Settings')).toBeDefined()
    expect(
      screen.getByText(/Configure external integrations/)
    ).toBeDefined()
  })

  it('renders three integration cards: GitHub, Telegram, and Calendar', () => {
    render(<IntegrationsPage />)

    expect(screen.getByText('GitHub Integration')).toBeDefined()
    expect(screen.getByText('Telegram Notifications')).toBeDefined()
    expect(screen.getByText('Google Calendar Sync')).toBeDefined()
  })

  it('shows integration status badges as not_configured by default', () => {
    render(<IntegrationsPage />)

    const badges = screen.getAllByText('Not Configured')
    expect(badges.length).toBeGreaterThanOrEqual(3)
  })

  it('enables GitHub section when toggle is turned on', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // First switch is GitHub

    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_...')).toBeDefined()
      expect(
        screen.getByPlaceholderText('your-github-username')
      ).toBeDefined()
    })
  })

  it('enables Telegram section when toggle is turned on', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[1]) // Second switch is Telegram

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/123456:ABC-DEF/)
      ).toBeDefined()
      expect(screen.getByPlaceholderText('-1234567890')).toBeDefined()
    })
  })

  it('enables Calendar section when toggle is turned on', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[2]) // Third switch is Calendar

    await waitFor(() => {
      expect(screen.getByPlaceholderText('AIza...')).toBeDefined()
      expect(
        screen.getByPlaceholderText(/your-calendar-id@gmail.com/)
      ).toBeDefined()
    })
  })

  it('displays help text for each integration', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    await waitFor(() => {
      expect(
        screen.getByText(/Create a token with repo and issue scopes/)
      ).toBeDefined()
    })
  })

  it('shows Test Connection and Save Configuration buttons when enabled', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    await waitFor(() => {
      expect(screen.getByText('Test Connection')).toBeDefined()
      expect(screen.getByText('Save Configuration')).toBeDefined()
    })
  })

  it('shows success message when GitHub is tested with valid input', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    const inputs = screen.getAllByPlaceholderText(/^(ghp_|your-github)/)
    fireEvent.change(inputs[0], { target: { value: 'ghp_test' } })
    fireEvent.change(inputs[1], { target: { value: 'testuser' } })

    const testButton = screen.getByText('Test Connection')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(
        screen.getByText('GitHub connection successful!')
      ).toBeDefined()
    })
  })

  it('shows error message when test fails without required fields', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    const testButton = screen.getByText('Test Connection')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(
        screen.getByText(/GitHub token and username required/)
      ).toBeDefined()
    })
  })

  it('can save configuration when required fields are filled', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    const inputs = screen.getAllByPlaceholderText(/^(ghp_|your-github)/)
    fireEvent.change(inputs[0], { target: { value: 'ghp_test' } })

    const saveButton = screen.getByText('Save Configuration')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(
        screen.getByText('GitHub configuration saved!')
      ).toBeDefined()
    })
  })

  it('can handle multiple integrations enabled simultaneously', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // GitHub
    fireEvent.click(switches[1]) // Telegram
    fireEvent.click(switches[2]) // Calendar

    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_...')).toBeDefined()
      expect(
        screen.getByPlaceholderText(/123456:ABC-DEF/)
      ).toBeDefined()
      expect(screen.getByPlaceholderText('AIza...')).toBeDefined()
    })
  })

  it('displays integration icons', () => {
    render(<IntegrationsPage />)

    expect(screen.getByText('🐙')).toBeDefined() // GitHub icon
    expect(screen.getByText('✈️')).toBeDefined() // Telegram icon
    expect(screen.getByText('📅')).toBeDefined() // Calendar icon
  })

  it('disables form inputs while loading', async () => {
    render(<IntegrationsPage />)

    const switches = screen.getAllByRole('checkbox')
    fireEvent.click(switches[0]) // Enable GitHub

    const inputs = screen.getAllByPlaceholderText(/^(ghp_|your-github)/)
    fireEvent.change(inputs[0], { target: { value: 'ghp_test' } })
    fireEvent.change(inputs[1], { target: { value: 'testuser' } })

    const testButton = screen.getByText('Test Connection')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(testButton).toHaveAttribute('disabled')
    })
  })
})
