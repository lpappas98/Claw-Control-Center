/**
 * Routine Executor
 * 
 * Checks routines every minute and creates tasks when a routine is due.
 * Handles auto-assignment based on taskTemplate.assignedTo.
 */

import { makeId, normalizeLane, normalizePriority } from './tasks.mjs'
import { autoAssignTask } from './taskAssignment.mjs'

export class RoutineExecutor {
  constructor(routinesStore, tasksStore, agentsStore, notificationsStore) {
    this.routinesStore = routinesStore
    this.tasksStore = tasksStore
    this.agentsStore = agentsStore
    this.notificationsStore = notificationsStore
    this.running = false
    this.checkInterval = null
  }

  /**
   * Start the routine executor
   * Checks every minute for due routines
   */
  start() {
    if (this.running) return

    this.running = true
    this.scheduleCheck()
  }

  /**
   * Stop the routine executor
   */
  stop() {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval)
      this.checkInterval = null
    }
    this.running = false
  }

  scheduleCheck() {
    if (!this.running) return

    this.checkRoutines().catch(err => {
      console.error('Routine executor error:', err)
    })

    this.checkInterval = setTimeout(() => this.scheduleCheck(), 60000)
  }

  /**
   * Check all routines and execute those that are due
   */
  async checkRoutines() {
    await this.routinesStore.ensureLoaded()
    const dueRoutines = await this.routinesStore.getDueRoutines()

    for (const routine of dueRoutines) {
      await this.executeRoutine(routine)
    }
  }

  /**
   * Execute a single routine: create task from template
   */
  async executeRoutine(routine) {
    try {
      const taskData = {
        title: routine.taskTemplate.title,
        description: routine.taskTemplate.description || `Auto-created from routine: ${routine.name}`,
        lane: normalizeLane('queued'),
        priority: normalizePriority('P2'),
        tags: routine.taskTemplate.tags || [],
        estimatedHours: routine.taskTemplate.estimatedHours,
        createdBy: 'routine-executor'
      }

      let task = await this.tasksStore.create(taskData)

      if (routine.taskTemplate.assignedTo) {
        const assignedTo = routine.taskTemplate.assignedTo

        if (assignedTo.startsWith('agent-') || assignedTo.startsWith('dev-')) {
          task = await this.tasksStore.update(task.id, { assignedTo }, 'routine-executor')

          if (this.notificationsStore && task.assignedTo) {
            await this.notificationsStore.create({
              agentId: task.assignedTo,
              type: 'task-assigned',
              title: 'New task from routine',
              text: `Task created from recurring routine: ${routine.name}`,
              taskId: task.id
            })
          }
        } else {
          task = await this.tasksStore.update(task.id, {
            tags: [...(task.tags || []), assignedTo]
          }, 'routine-executor')

          await autoAssignTask(task, this.agentsStore, this.tasksStore, this.notificationsStore)
        }
      } else {
        await autoAssignTask(task, this.agentsStore, this.tasksStore, this.notificationsStore)
      }

      await this.routinesStore.recordExecution(routine.id)
    } catch (err) {
      console.error(`Failed to execute routine ${routine.id} (${routine.name}):`, err)
    }
  }
}

let executor = null

/**
 * Get or create the routine executor singleton
 */
export function getRoutineExecutor(routinesStore, tasksStore, agentsStore, notificationsStore) {
  if (!executor) {
    executor = new RoutineExecutor(routinesStore, tasksStore, agentsStore, notificationsStore)
  }
  return executor
}
