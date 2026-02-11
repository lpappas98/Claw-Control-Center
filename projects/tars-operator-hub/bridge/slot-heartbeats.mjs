import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const OUT_FILE = path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json')
const TASKS_FILE = process.env.OPERATOR_HUB_TASKS_FILE ?? path.join(WORKSPACE, '.clawhub', 'tasks.json')
const TICK_MS = Number(process.env.SLOT_HEARTBEAT_MS ?? 15000)

const slots = [
  { slot: 'pm', label: 'TARS', role: 'Project Manager' },
  { slot: 'architect', label: 'Blueprint', role: 'Architect' },
  { slot: 'dev-1', label: 'Forge', role: 'Developer' },
  { slot: 'dev-2', label: 'Patch', role: 'Developer' },
  { slot: 'qa', label: 'Sentinel', role: 'QA' },
]

function priorityRank(p) {
  const v = String(p ?? '').toUpperCase()
  if (v === 'P0') return 0
  if (v === 'P1') return 1
  if (v === 'P2') return 2
  if (v === 'P3') return 3
  return 9
}

async function loadTasks() {
  try {
    const raw = await fs.readFile(TASKS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tasks) ? parsed.tasks : []
  } catch {
    return []
  }
}

function pickActiveTask(tasks, slot) {
  const mine = tasks.filter((t) => t && t.owner === slot && t.lane === 'development')
  if (!mine.length) return null
  mine.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority)
    if (pr !== 0) return pr
    return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
  })
  return mine[0] ?? null
}

/** @type {Map<string, Array<{at:string}>>} */
const beatsBySlot = new Map(slots.map((s) => [s.slot, []]))

async function writeSnapshot() {
  const now = new Date().toISOString()
  const tasks = await loadTasks()

  const workers = slots.map((s) => {
    const beats = beatsBySlot.get(s.slot) ?? []
    beats.unshift({ at: now })
    while (beats.length > 40) beats.pop()
    beatsBySlot.set(s.slot, beats)

    const active = pickActiveTask(tasks, s.slot)
    const task = active?.title ?? (s.slot === 'pm' ? 'Orchestrating delivery' : 'Waiting for assignment')
    const mode = active ? 'active' : 'waiting'

    return {
      slot: s.slot,
      label: s.label,
      role: s.role,
      task,
      mode,
      lastBeatAt: now,
      beats,
    }
  })

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, JSON.stringify({ updatedAt: now, workers }, null, 2))
}

async function main() {
  await writeSnapshot()
  setInterval(() => {
    writeSnapshot().catch((e) => console.error('[slot-heartbeats] write failed', e))
  }, TICK_MS)
  console.log(`[slot-heartbeats] writing to ${OUT_FILE} every ${TICK_MS}ms`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
