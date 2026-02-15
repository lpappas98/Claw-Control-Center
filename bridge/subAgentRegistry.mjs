/**
 * SubAgentRegistry — tracks sub-agent spawns and their task assignments.
 * In-memory Map, persisted to .clawhub/sub-agent-registry.json on every change.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseTranscriptBySessionKey } from './transcriptParser.mjs'

export class SubAgentRegistry {
  constructor(persistPath) {
    this.persistPath = persistPath
    this.registry = new Map()
    this._loaded = false
  }

  async load() {
    try {
      const raw = await readFile(this.persistPath, 'utf-8')
      const entries = JSON.parse(raw)
      for (const entry of entries) {
        this.registry.set(entry.childSessionKey, entry)
      }
      console.log(`[SubAgentRegistry] Loaded ${this.registry.size} entries from disk`)
    } catch {
      // File doesn't exist yet — that's fine
    }
    this._loaded = true
  }

  async _persist() {
    try {
      await mkdir(dirname(this.persistPath), { recursive: true })
      const data = JSON.stringify(Array.from(this.registry.values()), null, 2)
      await writeFile(this.persistPath, data, 'utf-8')
    } catch (err) {
      console.error('[SubAgentRegistry] Persist error:', err.message)
    }
  }

  /** Called by TaskRouter after successful sessions_spawn */
  async register({ childSessionKey, runId, agentId, taskId, taskTitle, taskPriority, taskTag, spawnedAt }) {
    this.registry.set(childSessionKey, {
      childSessionKey,
      runId,
      agentId,
      taskId,
      taskTitle,
      taskPriority,
      taskTag,
      spawnedAt: spawnedAt || Date.now(),
      status: 'active',
      completedAt: null,
      tokenUsage: null,
      lastChecked: null,
      // New fields for transcript metrics
      duration: null,
      totalTokens: null,
      model: null,
    })
    await this._persist()
    console.log(`[SubAgentRegistry] Registered: ${agentId} → ${taskId} (session: ${childSessionKey})`)
  }

  /** Called when sub-agent calls /complete or /blocked */
  async markComplete(childSessionKey, status = 'completed') {
    const entry = this.registry.get(childSessionKey)
    if (entry) {
      entry.status = status
      entry.completedAt = Date.now()
      
      // Parse transcript to extract metrics
      try {
        const metrics = await parseTranscriptBySessionKey(childSessionKey)
        entry.duration = metrics.duration
        entry.totalTokens = metrics.totalTokens
        entry.model = metrics.model
        
        // Use transcript status if provided and more specific
        if (metrics.status && metrics.status !== 'unknown') {
          entry.status = metrics.status
        }
        
        console.log(`[SubAgentRegistry] Marked ${entry.status}: ${entry.agentId} → ${entry.taskId} (${entry.duration}ms, ${entry.totalTokens} tokens, model: ${entry.model})`)
      } catch (err) {
        console.warn(`[SubAgentRegistry] Failed to parse transcript for ${childSessionKey}: ${err.message}`)
      }
      
      await this._persist()
    }
  }

  /** Mark complete by taskId (when we don't have the session key) */
  async markCompleteByTaskId(taskId, status = 'completed') {
    for (const entry of this.registry.values()) {
      if (entry.taskId === taskId && entry.status === 'active') {
        entry.status = status
        entry.completedAt = Date.now()
        
        // Parse transcript to extract metrics
        try {
          const metrics = await parseTranscriptBySessionKey(entry.childSessionKey)
          entry.duration = metrics.duration
          entry.totalTokens = metrics.totalTokens
          entry.model = metrics.model
          
          // Use transcript status if provided and more specific
          if (metrics.status && metrics.status !== 'unknown') {
            entry.status = metrics.status
          }
          
          console.log(`[SubAgentRegistry] Marked ${entry.status} by taskId: ${entry.agentId} → ${taskId} (${entry.duration}ms, ${entry.totalTokens} tokens, model: ${entry.model})`)
        } catch (err) {
          console.warn(`[SubAgentRegistry] Failed to parse transcript for ${entry.childSessionKey}: ${err.message}`)
        }
        
        await this._persist()
        return entry
      }
    }
    return null
  }

  /** Called by SubAgentTracker polling loop */
  async updateFromGateway(childSessionKey, { tokenUsage, isActive }) {
    const entry = this.registry.get(childSessionKey)
    if (!entry) return
    
    entry.tokenUsage = tokenUsage ?? entry.tokenUsage
    entry.lastChecked = Date.now()
    
    if (!isActive && entry.status === 'active') {
      // Gateway says session is gone but we never got /complete
      entry.status = 'failed'
      entry.completedAt = Date.now()
      console.log(`[SubAgentRegistry] Orphaned session detected: ${entry.agentId} → ${entry.taskId}`)
    }
    await this._persist()
  }

  getAll() { return Array.from(this.registry.values()) }
  
  getActive() { return this.getAll().filter(e => e.status === 'active') }
  
  getByAgent(agentId) { return this.getAll().filter(e => e.agentId === agentId) }
  
  getByTaskId(taskId) {
    for (const entry of this.registry.values()) {
      if (entry.taskId === taskId) return entry
    }
    return null
  }

  /** Prune old completed/failed entries (keep last 50) */
  async prune(keep = 50) {
    const all = this.getAll()
    const inactive = all.filter(e => e.status !== 'active')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    
    if (inactive.length > keep) {
      const toRemove = inactive.slice(keep)
      for (const entry of toRemove) {
        this.registry.delete(entry.childSessionKey)
      }
      await this._persist()
      console.log(`[SubAgentRegistry] Pruned ${toRemove.length} old entries`)
    }
  }
}
