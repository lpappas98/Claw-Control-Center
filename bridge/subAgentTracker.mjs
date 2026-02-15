/**
 * SubAgentTracker — polls the OpenClaw gateway every 15s to sync sub-agent session state.
 * Catches cases where a sub-agent finishes or dies without calling /complete.
 */

const POLL_INTERVAL = 15_000

export class SubAgentTracker {
  constructor(registry, { gatewayUrl, gatewayToken, tasksStore = null }) {
    this.registry = registry
    this.gatewayUrl = gatewayUrl
    this.gatewayToken = gatewayToken
    this.tasksStore = tasksStore
    this._interval = null
  }

  start() {
    // Initial poll after 5 seconds (let bridge finish starting)
    setTimeout(() => this.poll(), 5000)
    this._interval = setInterval(() => this.poll(), POLL_INTERVAL)
    console.log(`[SubAgentTracker] Polling gateway every ${POLL_INTERVAL / 1000}s`)
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval)
      this._interval = null
    }
  }

  async poll() {
    try {
      const res = await fetch(`${this.gatewayUrl}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.gatewayToken}`,
        },
        body: JSON.stringify({ tool: 'sessions_list', args: {} }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        console.error(`[SubAgentTracker] Gateway returned ${res.status}`)
        return
      }

      const data = await res.json()
      
      // Parse sessions from response
      let sessions = []
      if (data.result?.details?.sessions) {
        sessions = data.result.details.sessions
      } else {
        const text = data.result?.content?.find(c => c.type === 'text')?.text
        if (text) {
          const parsed = JSON.parse(text)
          sessions = parsed.sessions || parsed
        }
      }

      // Filter to sub-agent sessions only
      const subAgentSessions = sessions.filter(s =>
        s.key?.includes(':subagent:')
      )

      const activeKeys = new Set(subAgentSessions.map(s => s.key))

      // Update registry with live data
      for (const session of subAgentSessions) {
        await this.registry.updateFromGateway(session.key, {
          tokenUsage: session.totalTokens || null,
          isActive: true,
        })
      }

      // Check for sessions that disappeared from gateway
      for (const entry of this.registry.getActive()) {
        if (!activeKeys.has(entry.childSessionKey)) {
          await this.registry.updateFromGateway(entry.childSessionKey, {
            tokenUsage: entry.tokenUsage,
            isActive: false,
          })
          continue
        }
        
        // Also check task lane — if task moved out of development, agent is done
        if (this.tasksStore && entry.taskId) {
          const task = await this.tasksStore.get(entry.taskId)
          if (!task) {
            // Task was deleted — agent is done
            console.log(`[SubAgentTracker] Task ${entry.taskId} deleted — marking ${entry.agentId} complete`)
            await this.registry.markComplete(entry.childSessionKey, 'completed')
          } else if (task.lane !== 'development' && task.lane !== 'queued') {
            console.log(`[SubAgentTracker] Task ${entry.taskId} is in ${task.lane} — marking ${entry.agentId} complete`)
            await this.registry.markComplete(entry.childSessionKey, 'completed')
          }
        }
      }
    } catch (err) {
      // Don't spam logs — only log if it's not a timeout
      if (!err.message?.includes('abort')) {
        console.error(`[SubAgentTracker] Poll error: ${err.message}`)
      }
    }
  }
}
