/**
 * Test Task Cleanup Service
 * 
 * Automatically cleans up test tasks:
 * - Deletes test tasks older than 10 minutes
 * - Deletes test tasks in done/review/blocked lanes immediately
 * - Runs every 5 minutes
 * - Logs cleanup activity
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { isTestTask, shouldDeleteImmediately, shouldDeleteByAge } from './testTaskDetection.mjs'

const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
const MAX_AGE = 10 * 60 * 1000 // 10 minutes

export class TestTaskCleanupService {
  constructor(tasksStore, workDataDir = '.clawhub/work-data') {
    this.tasksStore = tasksStore
    this.workDataDir = workDataDir
    this.intervalId = null
    this.isRunning = false
    this.stats = {
      totalDeleted: 0,
      lastRun: null,
      lastDeletedCount: 0
    }
  }

  /**
   * Start the cleanup service
   */
  start() {
    if (this.isRunning) {
      console.log('[TestTaskCleanup] Service already running')
      return
    }

    this.isRunning = true
    console.log(`[TestTaskCleanup] Service started - running every ${CLEANUP_INTERVAL / 1000}s`)

    // Run immediately
    this.runCleanup()

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.runCleanup()
    }, CLEANUP_INTERVAL)
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('[TestTaskCleanup] Service stopped')
  }

  /**
   * Run cleanup process
   */
  async runCleanup() {
    try {
      console.log('[TestTaskCleanup] Running cleanup cycle...')
      const startTime = Date.now()
      
      await this.tasksStore.ensureLoaded()
      const allTasks = await this.tasksStore.getAll()
      const testTasks = allTasks.filter(isTestTask)

      console.log(`[TestTaskCleanup] Found ${testTasks.length} test tasks out of ${allTasks.length} total`)

      const tasksToDelete = []

      for (const task of testTasks) {
        // Delete immediately if in done/review/blocked
        if (shouldDeleteImmediately(task)) {
          tasksToDelete.push({
            task,
            reason: `in ${task.lane} lane`
          })
          continue
        }

        // Delete if older than max age
        if (shouldDeleteByAge(task, MAX_AGE)) {
          const ageMinutes = Math.floor((Date.now() - task.createdAt) / 60000)
          tasksToDelete.push({
            task,
            reason: `age ${ageMinutes}m (max ${MAX_AGE / 60000}m)`
          })
        }
      }

      if (tasksToDelete.length === 0) {
        console.log('[TestTaskCleanup] No test tasks to delete')
        this.stats.lastRun = Date.now()
        this.stats.lastDeletedCount = 0
        return
      }

      console.log(`[TestTaskCleanup] Deleting ${tasksToDelete.length} test tasks`)

      let deletedCount = 0
      for (const { task, reason } of tasksToDelete) {
        try {
          // Delete task
          await this.tasksStore.delete(task.id)
          
          // Delete work data if exists
          await this.deleteWorkData(task.id)
          
          deletedCount++
          console.log(`[TestTaskCleanup] ✅ Deleted test task ${task.id} (${task.title}) - ${reason}`)
        } catch (err) {
          console.error(`[TestTaskCleanup] ❌ Failed to delete task ${task.id}: ${err.message}`)
        }
      }

      this.stats.totalDeleted += deletedCount
      this.stats.lastRun = Date.now()
      this.stats.lastDeletedCount = deletedCount

      const duration = Date.now() - startTime
      console.log(`[TestTaskCleanup] Cleanup complete - deleted ${deletedCount}/${tasksToDelete.length} in ${duration}ms`)

      // Log activity
      if (global.addActivity && deletedCount > 0) {
        global.addActivity({
          type: 'test_task_cleanup',
          message: `Cleaned up ${deletedCount} test task${deletedCount > 1 ? 's' : ''}`,
          count: deletedCount,
          time: Date.now()
        })
      }
    } catch (err) {
      console.error(`[TestTaskCleanup] Error in cleanup cycle: ${err.message}`)
    }
  }

  /**
   * Delete work data files for a task
   */
  async deleteWorkData(taskId) {
    try {
      const workDataPath = path.join(this.workDataDir, `${taskId}.json`)
      await fs.unlink(workDataPath)
      console.log(`[TestTaskCleanup] Deleted work data for ${taskId}`)
    } catch (err) {
      // Ignore if file doesn't exist
      if (err.code !== 'ENOENT') {
        console.error(`[TestTaskCleanup] Error deleting work data for ${taskId}: ${err.message}`)
      }
    }
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      interval: CLEANUP_INTERVAL,
      maxAge: MAX_AGE
    }
  }

  /**
   * Manually trigger cleanup (for testing)
   */
  async triggerCleanup() {
    console.log('[TestTaskCleanup] Manual cleanup triggered')
    await this.runCleanup()
  }
}

// Singleton instance
let cleanupService = null

/**
 * Get or create cleanup service instance
 */
export function getCleanupService(tasksStore, workDataDir) {
  if (!cleanupService && tasksStore) {
    cleanupService = new TestTaskCleanupService(tasksStore, workDataDir)
  }
  return cleanupService
}

/**
 * Initialize and start cleanup service
 */
export function initializeCleanup(tasksStore, workDataDir) {
  const service = getCleanupService(tasksStore, workDataDir)
  service.start()
  return service
}
