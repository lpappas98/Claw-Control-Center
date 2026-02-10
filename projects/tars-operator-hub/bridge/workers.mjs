import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * Compute a coarse worker status from last heartbeat time.
 *
 * @param {string|undefined|null} lastBeatAt ISO string
 * @param {number} [nowMs] epoch millis (injected for tests)
 * @returns {'active'|'waiting'|'stale'|'offline'}
 */
export function computeWorkerStatus(lastBeatAt, nowMs = Date.now()) {
  if (!lastBeatAt) return 'offline'
  const atMs = new Date(lastBeatAt).getTime()
  if (!Number.isFinite(atMs)) return 'offline'
  const ageMs = nowMs - atMs
  if (ageMs < 45_000) return 'active'
  if (ageMs < 5 * 60_000) return 'waiting'
  if (ageMs < 30 * 60_000) return 'stale'
  return 'offline'
}

/**
 * Read heartbeats JSON file.
 *
 * @param {string} filePath
 * @returns {Promise<any|null>}
 */
export async function loadHeartbeatsFromFile(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Normalize heartbeat JSON into a worker list.
 *
 * Supports either:
 *  - Array form: [{slot, task, lastBeatAt, beats: [{at, ...}]}]
 *  - Object form: {workers: [...same...]}
 *
 * @param {any} data
 * @param {number} [nowMs]
 * @returns {{slot: string, status: 'active'|'waiting'|'stale'|'offline', task?: any, lastBeatAt?: string, beats: any[]}[]}
 */
export function normalizeWorkers(data, nowMs = Date.now()) {
  if (!data) return []
  const list = Array.isArray(data) ? data : data.workers
  if (!Array.isArray(list)) return []

  return list.map((w) => {
    const beatsRaw = Array.isArray(w?.beats) ? w.beats : []
    const beats = beatsRaw
      .filter((b) => b && typeof b.at === 'string')
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    /** @type {string|undefined} */
    let lastBeatAt = typeof w?.lastBeatAt === 'string' ? w.lastBeatAt : undefined
    const newestBeatAt = beats[0]?.at
    if (newestBeatAt && (!lastBeatAt || new Date(newestBeatAt).getTime() > new Date(lastBeatAt).getTime())) {
      lastBeatAt = newestBeatAt
    }

    return {
      slot: w?.slot ?? w?.id ?? 'unknown',
      status: computeWorkerStatus(lastBeatAt, nowMs),
      task: w?.task,
      lastBeatAt,
      beats: beats.slice(0, 48),
    }
  })
}

/**
 * Load workers from the first readable heartbeats file in a set.
 *
 * @param {string[]} candidates
 * @param {number} [nowMs]
 */
export async function listWorkersFromCandidates(candidates, nowMs = Date.now()) {
  let data = null
  for (const c of candidates) {
    data = await loadHeartbeatsFromFile(c)
    if (data) break
  }
  return normalizeWorkers(data, nowMs)
}
