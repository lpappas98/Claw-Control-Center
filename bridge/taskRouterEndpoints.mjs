/**
 * Task Router Endpoints
 * /claim, /complete, /blocked, /release
 * 
 * These are called by agents to signal task progress in the push model
 */

import { emitTaskCompleted, emitTaskBlocked } from './taskEvents.mjs'

export function setupTaskRouterEndpoints(app, tasksStore, taskRouter) {
  /**
   * POST /api/tasks/:id/claim
   * Atomically claim a task for an agent
   * Called by: TaskRouter (internal)
   * Returns: 200 if claimed, 409 if already claimed
   */
  app.post('/api/tasks/:id/claim', async (req, res) => {
    try {
      const { id } = req.params
      const { agentId } = req.body

      if (!agentId) {
        return res.status(400).json({ error: 'agentId required' })
      }

      const task = await tasksStore.get(id)
      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Only claim if still in queued status
      if (task.lane !== 'queued') {
        return res.status(409).json({
          error: 'Task already claimed or no longer queued',
          current_lane: task.lane,
          current_agent: task.assignedTo
        })
      }

      // Update to in_progress
      const updated = await tasksStore.update(
        id,
        {
          lane: 'in_progress',
          assignedTo: agentId,
          claimedAt: Date.now(),
          claimedBy: agentId
        },
        agentId
      )

      res.json(updated)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * POST /api/tasks/:id/complete
   * Mark task as complete (move to review)
   * Called by: Agent session (end of work)
   */
  app.post('/api/tasks/:id/complete', async (req, res) => {
    try {
      const { id } = req.params
      const { agentId } = req.body

      const task = await tasksStore.get(id)
      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Move to review lane
      const updated = await tasksStore.update(
        id,
        {
          lane: 'review',
          completedAt: Date.now(),
          statusNote: 'Task completed by agent, moved to review'
        },
        agentId || 'agent'
      )

      // Emit event so router knows agent is free
      if (agentId) {
        emitTaskCompleted(id, agentId, { result: 'success' })
      }

      res.json(updated)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * POST /api/tasks/:id/blocked
   * Mark task as blocked (agent cannot proceed)
   * Called by: Agent session (cannot proceed)
   */
  app.post('/api/tasks/:id/blocked', async (req, res) => {
    try {
      const { id } = req.params
      const { agentId, reason } = req.body

      const task = await tasksStore.get(id)
      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Move to blocked lane
      const updated = await tasksStore.update(
        id,
        {
          lane: 'blocked',
          blockedAt: Date.now(),
          blockedReason: reason || 'No reason provided',
          blockedBy: agentId || 'unknown',
          statusNote: `Blocked: ${reason || 'Unknown reason'}`
        },
        agentId || 'agent'
      )

      // Emit event so router knows agent is free
      if (agentId) {
        emitTaskBlocked(id, agentId, reason)
      }

      res.json(updated)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * POST /api/tasks/:id/release
   * Release a claimed task back to queued (for orphaned sessions)
   * Called by: Health cron (when detecting stuck agents)
   */
  app.post('/api/tasks/:id/release', async (req, res) => {
    try {
      const { id } = req.params

      const task = await tasksStore.get(id)
      if (!task) {
        return res.status(404).json({ error: 'Task not found' })
      }

      // Move back to queued
      const updated = await tasksStore.update(
        id,
        {
          lane: 'queued',
          claimedAt: null,
          claimedBy: null,
          statusNote: 'Released by health monitor - session was stuck'
        },
        'system'
      )

      res.json(updated)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}

export default setupTaskRouterEndpoints
