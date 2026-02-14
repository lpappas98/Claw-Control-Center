import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DependencyGraph } from './DependencyGraph'
import type { AgentTask } from '../types'

describe('DependencyGraph', () => {
  const mockAgent = {
    id: 'agent-1',
    name: 'TARS',
    emoji: '🤖',
    role: 'Lead Engineer',
    status: 'online',
    lastSeenAt: new Date().toISOString(),
    workload: 3,
    tags: ['backend'],
  }

  const createMockTask = (id: string, title: string, blockedBy?: string[]): AgentTask => ({
    id,
    title,
    status: 'development',
    priority: 'P0',
    assigneeId: 'agent-1',
    assignee: mockAgent,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockedBy,
  })

  it('should render dependency graph title', () => {
    const task = createMockTask('task-1', 'Main Task')
    render(<DependencyGraph task={task} allTasks={[task]} />)
    expect(screen.getByText('Dependency Graph')).toBeInTheDocument()
  })

  it('should show no dependencies message when task has no blockers', () => {
    const task = createMockTask('task-1', 'Main Task')
    render(<DependencyGraph task={task} allTasks={[task]} />)
    expect(screen.getByText('No task dependencies')).toBeInTheDocument()
  })

  it('should display blocking tasks', () => {
    const blockingTask = createMockTask('task-1', 'Blocking Task')
    const mainTask = createMockTask('task-2', 'Main Task', ['task-1'])
    const allTasks = [blockingTask, mainTask]

    render(<DependencyGraph task={mainTask} allTasks={allTasks} />)

    expect(screen.getByText('Blocking Tasks (Needs to finish first):')).toBeInTheDocument()
    expect(screen.getByText(/Blocking Task/)).toBeInTheDocument()
  })

  it('should display blocked tasks', () => {
    const mainTask = createMockTask('task-1', 'Main Task')
    const blockedTask = createMockTask('task-2', 'Blocked Task', ['task-1'])
    const allTasks = [mainTask, blockedTask]

    render(<DependencyGraph task={mainTask} allTasks={allTasks} />)

    expect(screen.getByText('Blocked Tasks (Waits for this):')).toBeInTheDocument()
    expect(screen.getByText(/Blocked Task/)).toBeInTheDocument()
  })

  it('should handle multiple blocking and blocked tasks', () => {
    const blockingTask1 = createMockTask('task-1', 'Blocker 1')
    const blockingTask2 = createMockTask('task-2', 'Blocker 2')
    const mainTask = createMockTask('task-3', 'Main Task', ['task-1', 'task-2'])
    const blockedTask = createMockTask('task-4', 'Blocked Task', ['task-3'])

    const allTasks = [blockingTask1, blockingTask2, mainTask, blockedTask]

    render(<DependencyGraph task={mainTask} allTasks={allTasks} />)

    expect(screen.getByText('Blocking Tasks (Needs to finish first):')).toBeInTheDocument()
    expect(screen.getByText('Blocked Tasks (Waits for this):')).toBeInTheDocument()
  })

  it('should call onTaskClick when task is clicked', () => {
    const onTaskClick = vi.fn()
    const blockingTask = createMockTask('task-1', 'Blocking Task')
    const mainTask = createMockTask('task-2', 'Main Task', ['task-1'])
    const allTasks = [blockingTask, mainTask]

    render(
      <DependencyGraph task={mainTask} allTasks={allTasks} onTaskClick={onTaskClick} />,
    )

    // Find and click on blocking task
    const blockingTaskElement = screen.getByText(/Blocking Task \(/)
    blockingTaskElement.click()

    expect(onTaskClick).toHaveBeenCalledWith(blockingTask)
  })

  it('should handle tasks with different priorities', () => {
    const task1: AgentTask = {
      ...createMockTask('task-1', 'P0 Task'),
      priority: 'P0',
    }
    const task2: AgentTask = {
      ...createMockTask('task-2', 'P2 Task'),
      priority: 'P2',
    }
    const task3: AgentTask = {
      ...createMockTask('task-3', 'Main Task', ['task-1']),
      priority: 'P1',
    }

    render(<DependencyGraph task={task3} allTasks={[task1, task2, task3]} />)

    expect(screen.getByText(/P0 Task/)).toBeInTheDocument()
  })

  it('should handle tasks with different statuses', () => {
    const task1: AgentTask = {
      ...createMockTask('task-1', 'Done Task'),
      status: 'done',
    }
    const task2: AgentTask = {
      ...createMockTask('task-2', 'Main Task', ['task-1']),
      status: 'blocked',
    }

    render(<DependencyGraph task={task2} allTasks={[task1, task2]} />)

    expect(screen.getByText(/Done Task/)).toBeInTheDocument()
  })
})
