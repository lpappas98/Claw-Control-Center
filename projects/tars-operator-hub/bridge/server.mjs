import express from 'express'
import cors from 'cors'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.PORT ?? 8787)
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')

/** @type {import('../src/types').ActivityEvent[]} */
const activity = []

function pushActivity(evt) {
  activity.unshift(evt)
  while (activity.length > 500) activity.pop()
}

function newId(prefix = 'evt') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

async function runCli(bin, args, timeoutMs = 8000) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, { timeout: timeoutMs })
    const out = `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim()
    return { ok: true, output: out }
  } catch (err) {
    const msg = err?.message ?? String(err)
    const stdout = err?.stdout ?? ''
    const stderr = err?.stderr ?? ''
    const output = `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim()
    return { ok: false, error: msg, output }
  }
}

function healthFromGatewayText(text) {
  const t = text.toLowerCase()
  if (t.includes('running') || t.includes('active')) return { health: 'ok', summary: 'running' }
  if (t.includes('stopped') || t.includes('inactive') || t.includes('not running')) return { health: 'down', summary: 'stopped' }
  return { health: 'unknown', summary: text.split('\n')[0]?.slice(0, 120) || 'unknown' }
}

async function getGatewayStatus() {
  const res = await runCli('openclaw', ['gateway', 'status'])
  if (!res.ok) return { health: 'unknown', summary: 'openclaw gateway status failed', details: [res.error, res.output].filter(Boolean) }
  const parsed = healthFromGatewayText(res.output)
  return { ...parsed, details: res.output ? res.output.split('\n').slice(0, 6) : undefined }
}

async function listProjects() {
  const root = path.join(WORKSPACE, 'projects')
  let entries = []
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  const projects = await Promise.all(
    dirs.map(async (name) => {
      const p = path.join(root, name)
      let stat
      try {
        stat = await fs.stat(p)
      } catch {
        stat = null
      }
      return {
        id: name,
        name,
        path: p,
        status: 'Unknown',
        lastUpdatedAt: stat?.mtime ? new Date(stat.mtime).toISOString() : undefined,
      }
    })
  )

  projects.sort((a, b) => (b.lastUpdatedAt ?? '').localeCompare(a.lastUpdatedAt ?? ''))
  return projects
}

function loadHeartbeatsFromFile(filePath) {
  if (!existsSync(filePath)) return null
  return fs
    .readFile(filePath, 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => null)
}

function computeWorkerStatus(lastBeatAt) {
  if (!lastBeatAt) return 'offline'
  const ageMs = Date.now() - new Date(lastBeatAt).getTime()
  if (ageMs < 45_000) return 'active'
  if (ageMs < 5 * 60_000) return 'waiting'
  if (ageMs < 30 * 60_000) return 'stale'
  return 'offline'
}

async function listWorkers() {
  const candidates = [
    path.join(WORKSPACE, 'worker-heartbeats.json'),
    path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json'),
  ]

  let data = null
  for (const c of candidates) {
    data = await loadHeartbeatsFromFile(c)
    if (data) break
  }

  if (!data) return []

  const list = Array.isArray(data) ? data : data.workers
  if (!Array.isArray(list)) return []

  return list.map((w) => {
    const beats = Array.isArray(w.beats) ? w.beats : []
    const lastBeatAt = w.lastBeatAt ?? beats[0]?.at
    return {
      slot: w.slot ?? w.id ?? 'unknown',
      status: computeWorkerStatus(lastBeatAt),
      task: w.task,
      lastBeatAt,
      beats: beats.slice(0, 48),
    }
  })
}

async function getStatus() {
  const gateway = await getGatewayStatus()

  // Node + browser relay are placeholders until a canonical local API exists.
  const nodes = { health: 'unknown', pairedCount: 0, pendingCount: 0, details: ['Wire to openclaw nodes APIs when available.'] }
  const browserRelay = { health: 'unknown', attachedTabs: 0, details: ['Wire to browser relay telemetry when available.'] }

  return {
    updatedAt: new Date().toISOString(),
    gateway,
    nodes,
    browserRelay,
  }
}

async function computeBlockers() {
  const status = await getStatus()
  /** @type {import('../src/types').Blocker[]} */
  const blockers = []

  if (status.gateway.health === 'down' || status.gateway.health === 'unknown') {
    blockers.push({
      id: 'gateway-not-ok',
      title: status.gateway.health === 'down' ? 'Gateway stopped' : 'Gateway status unknown',
      severity: status.gateway.health === 'down' ? 'High' : 'Medium',
      detectedAt: new Date().toISOString(),
      details: 'Gateway must be running for nodes, browser relay, and automation to function.',
      remediation: [
        { label: 'Gateway status', command: 'openclaw gateway status' },
        { label: 'Restart gateway', command: 'openclaw gateway restart' },
      ],
    })
  }

  return blockers
}

app.get('/api/status', async (_req, res) => {
  const s = await getStatus()
  res.json(s)
})

app.get('/api/projects', async (_req, res) => {
  const projects = await listProjects()
  res.json(projects)
})

app.get('/api/workers', async (_req, res) => {
  const workers = await listWorkers()
  res.json(workers)
})

app.get('/api/blockers', async (_req, res) => {
  res.json(await computeBlockers())
})

app.get('/api/activity', async (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 200)))
  res.json(activity.slice(0, limit))
})

app.post('/api/control', async (req, res) => {
  const action = req.body
  const at = new Date().toISOString()

  /** @type {import('../src/types').ControlResult} */
  let result = { ok: false, message: 'Unknown action' }

  if (action?.kind === 'gateway.restart') {
    const r = await runCli('openclaw', ['gateway', 'restart'])
    result = { ok: r.ok, message: r.ok ? 'gateway restarted' : 'gateway restart failed', output: r.output }
  } else if (action?.kind === 'gateway.start') {
    const r = await runCli('openclaw', ['gateway', 'start'])
    result = { ok: r.ok, message: r.ok ? 'gateway started' : 'gateway start failed', output: r.output }
  } else if (action?.kind === 'gateway.stop') {
    const r = await runCli('openclaw', ['gateway', 'stop'])
    result = { ok: r.ok, message: r.ok ? 'gateway stopped' : 'gateway stop failed', output: r.output }
  } else if (action?.kind === 'nodes.refresh') {
    result = { ok: true, message: 'nodes refresh is a no-op (adapter scaffold)' }
  }

  pushActivity({
    id: newId('control'),
    at,
    level: result.ok ? 'info' : 'error',
    source: 'operator-hub',
    message: `control ${action?.kind}: ${result.message}`,
    meta: { output: result.output },
  })

  res.json(result)
})

app.get('/healthz', (_req, res) => res.send('ok'))

app.listen(PORT, () => {
  pushActivity({
    id: newId('bridge'),
    at: new Date().toISOString(),
    level: 'info',
    source: 'operator-hub',
    message: `bridge started on :${PORT}`,
  })
  console.log(`Operator Hub bridge listening on http://localhost:${PORT}`)
})
