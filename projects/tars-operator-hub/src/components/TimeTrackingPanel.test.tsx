import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeTrackingPanel } from './TimeTrackingPanel'
import type { TimeLog } from '../types'

describe('TimeTrackingPanel', () => {
  const mockOnAddTimeLog = vi.fn().mockResolvedValue(undefined)

  const mockTimeLogs: TimeLog[] = [
    {
      id: 'log-1',
      agentId: 'agent-1',
      hours: 2,
      note: 'Development',
      loggedAt: new Date().toISOString(),
    },
    {
      id: 'log-2',
      agentId: 'agent-1',
      hours: 1.5,
      note: 'Testing',
      loggedAt: new Date(Date.now() - 60000).toISOString(),
    },
  ]

  it('should render time tracking panel title', () => {
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )
    expect(screen.getByText('Time Tracking')).toBeInTheDocument()
  })

  it('should display timer section', () => {
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )
    expect(screen.getByText('Stopwatch Timer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start/i })).toBeInTheDocument()
  })

  it('should display manual time entry section', () => {
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )
    expect(screen.getByText('Manual Time Entry')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., 2.5')).toBeInTheDocument()
  })

  it('should display estimated and actual hours', () => {
    render(
      <TimeTrackingPanel
        taskId="task-1"
        estimatedHours={8}
        actualHours={5}
        onAddTimeLog={mockOnAddTimeLog}
      />,
    )

    expect(screen.getByText('Estimated')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
  })

  it('should add manual time log', async () => {
    const user = userEvent.setup()
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    const hoursInput = screen.getByPlaceholderText('e.g., 2.5')
    await user.type(hoursInput, '2.5')

    const addButton = screen.getByRole('button', { name: /Add Time/i })
    await user.click(addButton)

    expect(mockOnAddTimeLog).toHaveBeenCalledWith(2.5, '')
  })

  it('should add manual time log with note', async () => {
    const user = userEvent.setup()
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    const hoursInput = screen.getByPlaceholderText('e.g., 2.5')
    const noteInput = screen.getByPlaceholderText('e.g., Code review')

    await user.type(hoursInput, '2')
    await user.type(noteInput, 'Code review and testing')

    const addButton = screen.getByRole('button', { name: /Add Time/i })
    await user.click(addButton)

    expect(mockOnAddTimeLog).toHaveBeenCalledWith(2, 'Code review and testing')
  })

  it('should display time logs', () => {
    render(
      <TimeTrackingPanel
        taskId="task-1"
        timeLogs={mockTimeLogs}
        onAddTimeLog={mockOnAddTimeLog}
      />,
    )

    expect(screen.getByText('Time Logs (2)')).toBeInTheDocument()
    expect(screen.getByText(/2h.*Development/)).toBeInTheDocument()
  })

  it('should calculate burndown when estimated hours provided', () => {
    render(
      <TimeTrackingPanel
        taskId="task-1"
        estimatedHours={10}
        actualHours={5}
        onAddTimeLog={mockOnAddTimeLog}
      />,
    )

    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('5h remaining')).toBeInTheDocument()
  })

  it('should show over budget warning', () => {
    render(
      <TimeTrackingPanel
        taskId="task-1"
        estimatedHours={8}
        actualHours={10}
        onAddTimeLog={mockOnAddTimeLog}
      />,
    )

    expect(screen.getByText(/(Over)/)).toBeInTheDocument()
  })

  it('should start and pause timer', async () => {
    const user = userEvent.setup()
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    const startButton = screen.getByRole('button', { name: /Start/i })
    await user.click(startButton)

    // After clicking start, should show Pause button
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
  })

  it('should reset timer', async () => {
    const user = userEvent.setup()
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    const resetButton = screen.getByRole('button', { name: /Reset/i })
    expect(resetButton).toBeDisabled() // Should be disabled initially
  })

  it('should disable Add Time button when hours input is empty', () => {
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    const addButton = screen.getByRole('button', { name: /Add Time/i })
    expect(addButton).toBeDisabled()
  })

  it('should show recent time logs only', () => {
    const manyLogs: TimeLog[] = Array.from({ length: 10 }, (_, i) => ({
      id: `log-${i}`,
      agentId: 'agent-1',
      hours: i + 1,
      note: `Entry ${i}`,
      loggedAt: new Date(Date.now() - i * 60000).toISOString(),
    }))

    render(
      <TimeTrackingPanel
        taskId="task-1"
        timeLogs={manyLogs}
        onAddTimeLog={mockOnAddTimeLog}
      />,
    )

    // Should show "more entries" message
    expect(screen.getByText(/\+5 more entries/)).toBeInTheDocument()
  })

  it('should display 00:00:00 timer initially', () => {
    render(
      <TimeTrackingPanel taskId="task-1" onAddTimeLog={mockOnAddTimeLog} />,
    )

    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })
})
