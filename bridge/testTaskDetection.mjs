/**
 * Test Task Detection Utility
 * 
 * Identifies test/E2E tasks that should not be assigned to real agents
 * and should be auto-deleted after completion or timeout.
 */

// Keywords that indicate a test task
const TEST_KEYWORDS = [
  'e2e',
  'test task',
  'batch task',
  'queued test',
  'p0 test',
  'overflow test',
  'workflow test',
  'status lifecycle',
  'load test',
  'recurring task'
]

/**
 * Check if a task is a test task
 * @param {Object} task - Task object
 * @returns {boolean} True if task is a test task
 */
export function isTestTask(task) {
  if (!task) return false

  // Check metadata flag (primary indicator)
  if (task.metadata?.testTask === true) return true

  // Check task ID pattern: task-*-test-*
  if (task.id && /task-.*-test-/i.test(task.id)) return true

  // Check title for test keywords
  const title = (task.title || '').toLowerCase()
  if (TEST_KEYWORDS.some(keyword => title.includes(keyword))) return true

  // Check description for test keywords
  const description = (task.description || '').toLowerCase()
  if (TEST_KEYWORDS.some(keyword => description.includes(keyword))) return true

  return false
}

/**
 * Check if a task should be auto-deleted immediately
 * (test tasks in done/review/blocked lanes)
 * @param {Object} task - Task object
 * @returns {boolean} True if should delete immediately
 */
export function shouldDeleteImmediately(task) {
  if (!isTestTask(task)) return false

  const deletableLanes = ['done', 'review', 'blocked']
  return deletableLanes.includes(task.lane)
}

/**
 * Check if a task should be deleted due to age
 * (test tasks older than maxAge milliseconds)
 * @param {Object} task - Task object
 * @param {number} maxAgeMs - Maximum age in milliseconds (default 10 minutes)
 * @returns {boolean} True if should delete due to age
 */
export function shouldDeleteByAge(task, maxAgeMs = 10 * 60 * 1000) {
  if (!isTestTask(task)) return false

  const now = Date.now()
  const taskAge = now - (task.createdAt || now)
  return taskAge > maxAgeMs
}

/**
 * Get all test tasks from a task list
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Array of test tasks
 */
export function filterTestTasks(tasks) {
  return tasks.filter(isTestTask)
}

/**
 * Get all production (non-test) tasks from a task list
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Array of production tasks
 */
export function filterProductionTasks(tasks) {
  return tasks.filter(task => !isTestTask(task))
}
