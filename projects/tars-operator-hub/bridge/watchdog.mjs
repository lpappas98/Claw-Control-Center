import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * Heartbeat file diagnostics used to detect watchdog / writer issues.
 *
 * @param {string[]} candidates
 * @param {number} [nowMs]
 * @returns {Promise<import('../src/types').WatchdogDiagnostics>}
 */
export async function getHeartbeatDiagnostics(candidates, nowMs = Date.now()) {
  let chosen = null
  for (const c of candidates) {
    if (existsSync(c)) {
      chosen = c
      break
    }
  }

  if (!chosen) {
    return {
      health: 'down',
      summary: 'no heartbeat file found',
      heartbeatFile: { exists: false },
    }
  }

  /** @type {import('node:fs').Stats | null} */
  let stat = null
  try {
    stat = await fs.stat(chosen)
  } catch {
    stat = null
  }

  const mtimeMs = stat?.mtime ? new Date(stat.mtime).getTime() : undefined
  const ageMs = typeof mtimeMs === 'number' && Number.isFinite(mtimeMs) ? Math.max(0, nowMs - mtimeMs) : undefined

  let parseOk = false
  let error
  let workerCount
  try {
    const raw = await fs.readFile(chosen, 'utf8')
    const json = JSON.parse(raw)
    const list = Array.isArray(json) ? json : json?.workers
    workerCount = Array.isArray(list) ? list.length : undefined
    parseOk = true
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  // Heuristics: file missing/invalid => down; too old => warn/down.
  let health = 'unknown'
  let summary = 'unknown'
  if (!parseOk) {
    health = 'down'
    summary = 'heartbeat JSON invalid'
  } else if (typeof ageMs === 'number') {
    if (ageMs < 60_000) {
      health = 'ok'
      summary = 'heartbeats fresh'
    } else if (ageMs < 5 * 60_000) {
      health = 'warn'
      summary = 'heartbeats delayed'
    } else {
      health = 'down'
      summary = 'heartbeats stale'
    }
  } else {
    health = 'warn'
    summary = 'heartbeat mtime unknown'
  }

  return {
    health,
    summary,
    heartbeatFile: {
      exists: true,
      path: chosen,
      mtime: stat?.mtime ? new Date(stat.mtime).toISOString() : undefined,
      ageMs,
      parseOk,
      error,
      workerCount,
      sizeBytes: stat?.size,
    },
  }
}
