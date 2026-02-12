import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Active Sessions Store
 * Local file-based storage for active sub-agent sessions
 * Follows patterns from tasks.mjs and agentProfiles.mjs
 */

function cap(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

/**
 * Load active sessions from JSON file
 * @param {string} filePath - Path to sessions JSON file
 * @returns {Promise<import('../src/types').ActiveSession[]>}
 */
export async function loadActiveSessions(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    const sessions = cap(Array.isArray(data) ? data : data?.sessions ?? [], 1000)
    
    // Auto-filter terminated sessions older than 1 hour
    const oneHourAgo = Date.now() - 3600_000
    return sessions.filter((s) => {
      if (s.status !== 'terminated') return true
      const lastSeen = new Date(s.lastSeenAt ?? s.spawnedAt).getTime()
      return lastSeen > oneHourAgo
    })
  } catch (err) {
    if (err?.code === 'ENOENT') return []
    console.error('Error loading active sessions:', err)
    return []
  }
}

/**
 * Save active sessions to JSON file with atomic write
 * @param {string} filePath - Path to sessions JSON file
 * @param {import('../src/types').ActiveSession[]} sessions - Sessions to save
 */
export async function saveActiveSessions(filePath, sessions) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${filePath}.tmp`
  const payload = JSON.stringify(cap(sessions, 1000), null, 2)
  
  // Atomic write: write to temp file, then rename
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, filePath)
}

/**
 * Generate a unique session ID
 * @param {string} [prefix='session'] - ID prefix
 * @returns {string}
 */
export function makeSessionId(prefix = 'session') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

/**
 * List active sessions with optional filtering by instance
 * @param {string} filePath - Path to sessions JSON file
 * @param {string} [instanceId] - Optional instance ID filter
 * @returns {Promise<import('../src/types').ActiveSession[]>}
 */
export async function listActiveSessions(filePath, instanceId) {
  const sessions = await loadActiveSessions(filePath)
  
  if (instanceId) {
    return sessions.filter((s) => s.instanceId === instanceId)
  }
  
  return sessions
}

/**
 * Register a new session
 * @param {string} filePath - Path to sessions JSON file
 * @param {import('../src/types').ActiveSessionCreate} data - Session data
 * @param {string} userId - User ID (required for local bridge)
 * @returns {Promise<import('../src/types').ActiveSession>}
 */
export async function registerSession(filePath, data, userId = 'local-user') {
  const sessions = await loadActiveSessions(filePath)
  
  const now = new Date().toISOString()
  const id = makeSessionId('session')
  
  /** @type {import('../src/types').ActiveSession} */
  const newSession = {
    id,
    userId,
    instanceId: data.instanceId,
    sessionKey: data.sessionKey,
    label: data.label,
    agentId: data.agentId,
    model: data.model,
    task: data.task,
    status: data.status ?? 'active',
    spawnedAt: now,
    lastSeenAt: now,
    metadata: data.metadata,
  }
  
  const updated = [newSession, ...sessions]
  await saveActiveSessions(filePath, updated)
  
  return newSession
}

/**
 * Update an existing session
 * @param {string} filePath - Path to sessions JSON file
 * @param {import('../src/types').ActiveSessionUpdate} data - Update data
 * @returns {Promise<import('../src/types').ActiveSession | null>}
 */
export async function updateSession(filePath, data) {
  const sessions = await loadActiveSessions(filePath)
  
  const idx = sessions.findIndex((s) => s.id === data.id)
  if (idx < 0) return null
  
  const now = new Date().toISOString()
  const updated = {
    ...sessions[idx],
    label: data.label !== undefined ? data.label : sessions[idx].label,
    task: data.task !== undefined ? data.task : sessions[idx].task,
    status: data.status !== undefined ? data.status : sessions[idx].status,
    model: data.model !== undefined ? data.model : sessions[idx].model,
    lastSeenAt: now,
  }
  
  const newSessions = [...sessions.slice(0, idx), updated, ...sessions.slice(idx + 1)]
  await saveActiveSessions(filePath, newSessions)
  
  return updated
}

/**
 * Terminate a session (soft delete - mark as terminated)
 * @param {string} filePath - Path to sessions JSON file
 * @param {string} id - Session ID
 * @returns {Promise<import('../src/types').ActiveSession | null>}
 */
export async function terminateSession(filePath, id) {
  const sessions = await loadActiveSessions(filePath)
  
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx < 0) return null
  
  const now = new Date().toISOString()
  const updated = {
    ...sessions[idx],
    status: 'terminated',
    lastSeenAt: now,
  }
  
  const newSessions = [...sessions.slice(0, idx), updated, ...sessions.slice(idx + 1)]
  await saveActiveSessions(filePath, newSessions)
  
  return updated
}
