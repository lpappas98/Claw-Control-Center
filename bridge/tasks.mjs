import fs from 'node:fs/promises'
import path from 'node:path'

function cap(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

export async function loadTasks(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(raw)
    return cap(Array.isArray(data) ? data : data?.tasks, 500)
  } catch {
    return []
  }
}

export async function saveTasks(filePath, tasks) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${filePath}.tmp`
  const payload = JSON.stringify(cap(tasks, 500), null, 2)
  await fs.writeFile(tmp, payload, 'utf8')
  await fs.rename(tmp, filePath)
}

export function makeId(prefix = 'task') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export function normalizeLane(lane) {
  const v = String(lane ?? '').toLowerCase()
  if (v === 'proposed' || v === 'queued' || v === 'development' || v === 'review' || v === 'blocked' || v === 'done') return v
  return 'queued'
}

export function normalizePriority(p) {
  const v = String(p ?? '').toUpperCase()
  if (v === 'P0' || v === 'P1' || v === 'P2' || v === 'P3') return v
  return 'P2'
}
