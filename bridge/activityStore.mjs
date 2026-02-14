import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Ensure we never store unbounded activity.
 * @param {any[]} list
 * @param {number} max
 */
function cap(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

/**
 * @param {string} filePath
 */
export async function loadActivity(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    return cap(Array.isArray(data) ? data : data?.activity, 500)
  } catch {
    return []
  }
}

/**
 * Atomic-ish write: write temp then rename.
 * @param {string} filePath
 * @param {any[]} activity
 */
export async function saveActivity(filePath, activity) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${filePath}.tmp`
  const payload = JSON.stringify(cap(activity, 500), null, 2)
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, filePath)
}

/**
 * Simple debounce helper (no timers in tests).
 * @returns {{ trigger: () => void, flush: () => Promise<void> }}
 */
export function makeDebouncedSaver(saveFn) {
  let pending = false
  let inflight = null

  async function flush() {
    if (!pending) return
    if (inflight) return inflight
    pending = false
    inflight = Promise.resolve()
      .then(saveFn)
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  return {
    trigger() {
      pending = true
    },
    flush,
  }
}
