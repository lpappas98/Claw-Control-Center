/**
 * TaskEvents - Simple event emitter for task state changes
 * Orchestrates the push-based execution model
 */

import { EventEmitter } from 'node:events'

const emitter = new EventEmitter()
emitter.setMaxListeners(20)

/**
 * Emit when task enters queued status
 * Triggers TaskRouter to check if agent can spawn immediately
 */
export function emitTaskQueued(taskId, agentAssignment = null) {
  emitter.emit('task:queued', { taskId, agentAssignment, at: Date.now() })
}

/**
 * Emit when agent session completes a task
 * Triggers TaskRouter to free up agent slot and check for next task
 */
export function emitTaskCompleted(taskId, agentId, result = {}) {
  emitter.emit('task:completed', { taskId, agentId, result, at: Date.now() })
}

/**
 * Emit when task is blocked by agent
 * Similar to completed - frees up agent slot
 */
export function emitTaskBlocked(taskId, agentId, reason = '') {
  emitter.emit('task:blocked', { taskId, agentId, reason, at: Date.now() })
}

/**
 * Subscribe to task queued events
 */
export function onTaskQueued(handler) {
  emitter.on('task:queued', handler)
}

/**
 * Subscribe to task completed events
 */
export function onTaskCompleted(handler) {
  emitter.on('task:completed', handler)
}

/**
 * Subscribe to task blocked events
 */
export function onTaskBlocked(handler) {
  emitter.on('task:blocked', handler)
}

/**
 * Remove event listeners (for cleanup)
 */
export function removeAllListeners() {
  emitter.removeAllListeners()
}

export default emitter
