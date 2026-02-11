import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const OUT_FILE = path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json')
const TICK_MS = Number(process.env.SLOT_HEARTBEAT_MS ?? 15000)

const slots = [
  { slot: 'pm', label: 'TARS', role: 'Project Manager', task: 'Orchestrating Operator Hub delivery', mode: 'active' },
  { slot: 'architect', label: 'Blueprint', role: 'Architect', task: 'Designing permanent agent runtime model', mode: 'active' },
  { slot: 'qa', label: 'Sentinel', role: 'QA', task: 'Preparing hub verification checks', mode: 'waiting' },
  { slot: 'dev-1', label: 'Forge', role: 'Developer', task: 'Implementing Home board and agent UX', mode: 'active' },
  { slot: 'dev-2', label: 'Patch', role: 'Developer', task: 'Polishing layout, spacing, and status clarity', mode: 'active' },
]

/** @type {Map<string, Array<{at:string}>>} */
const beatsBySlot = new Map(slots.map((s) => [s.slot, []]))

async function writeSnapshot() {
  const now = new Date().toISOString()
  const workers = slots.map((s) => {
    const beats = beatsBySlot.get(s.slot) ?? []
    beats.unshift({ at: now })
    while (beats.length > 40) beats.pop()
    beatsBySlot.set(s.slot, beats)

    return {
      slot: s.slot,
      label: s.label,
      role: s.role,
      task: s.task,
      mode: s.mode,
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
