import express from 'express'
import cors from 'cors'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { listWorkersFromCandidates } from './workers.mjs'
import { computeBlockersFrom } from './blockers.mjs'
import { parseGatewayStatus } from './parseGatewayStatus.mjs'
import { loadActivity, makeDebouncedSaver, saveActivity } from './activityStore.mjs'

const execFileAsync = promisify(execFile)

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.PORT ?? 8787)
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const ACTIVITY_FILE = process.env.OPERATOR_HUB_ACTIVITY_FILE ?? path.join(WORKSPACE, '.clawhub', 'activity.json')

/** @type {import('../src/types').ActivityEvent[]} */
let activity = await loadActivity(ACTIVITY_FILE)
const activitySaver = makeDebouncedSaver(() => saveActivity(ACTIVITY_FILE, activity))
let activitySaveTimer = null

let lastGatewayHealth = null
let lastGatewaySummary = null

/** @type {Set<string>} */
let lastBlockerIds = new Set()

/** @type {Map<string, string>} */
let lastWorkerStatusBySlot = new Map()

function scheduleActivitySave() {
  activitySaver.trigger()
  if (activitySaveTimer) return
  activitySaveTimer = setTimeout(async () => {
    activitySaveTimer = null
    await activitySaver.flush()
  }, 750)
}

function pushActivity(evt) {
  activity.unshift(evt)
  while (activity.length > 500) activity.pop()
  scheduleActivitySave()
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

const GATEWAY_STATUS_TTL_MS = 1500
let gatewayStatusCache = null
let gatewayStatusCacheAt = 0

async function getGatewayStatus() {
  if (gatewayStatusCache && Date.now() - gatewayStatusCacheAt < GATEWAY_STATUS_TTL_MS) return gatewayStatusCache

  const res = await runCli('openclaw', ['gateway', 'status'])
  if (!res.ok) {
    const next = { health: 'unknown', summary: 'openclaw gateway status failed', details: [res.error, res.output].filter(Boolean) }
    gatewayStatusCache = next
    gatewayStatusCacheAt = Date.now()
    return next
  }

  const parsed = parseGatewayStatus(res.output)
  const next = {
    health: parsed.health,
    summary: parsed.summary,
    details: res.output ? res.output.split('\n').slice(0, 10) : undefined,
  }
  gatewayStatusCache = next
  gatewayStatusCacheAt = Date.now()
  return next
}

async function getGitInfo(projectPath) {
  // Avoid running git in huge non-repos: quick check for .git first.
  if (!existsSync(path.join(projectPath, '.git'))) return undefined

  const rootRes = await runCli('git', ['-C', projectPath, 'rev-parse', '--show-toplevel'])
  if (!rootRes.ok) return undefined
  const root = rootRes.output.split('\n')[0]?.trim()

  const branchRes = await runCli('git', ['-C', projectPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchRes.ok ? branchRes.output.split('\n')[0]?.trim() : undefined

  const dirtyRes = await runCli('git', ['-C', projectPath, 'status', '--porcelain'])
  const dirty = dirtyRes.ok ? dirtyRes.output.trim().length > 0 : undefined

  let ahead
  let behind
  const abRes = await runCli('git', ['-C', projectPath, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
  if (abRes.ok) {
    const parts = abRes.output.trim().split(/\s+/)
    if (parts.length >= 2) {
      ahead = Number(parts[0])
      behind = Number(parts[1])
      if (!Number.isFinite(ahead)) ahead = undefined
      if (!Number.isFinite(behind)) behind = undefined
    }
  }

  const lastCommitRes = await runCli('git', ['-C', projectPath, 'log', '-1', '--format=%cI'])
  const lastCommitAt = lastCommitRes.ok ? lastCommitRes.output.split('\n')[0]?.trim() : undefined

  return { root, branch, dirty, ahead, behind, lastCommitAt }
}

async function getNodeInfo(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json')
  if (!existsSync(pkgPath)) return { hasPackageJson: false }

  try {
    const raw = await fs.readFile(pkgPath, 'utf8')
    const pkg = JSON.parse(raw)
    const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : []
    return {
      hasPackageJson: true,
      packageName: typeof pkg?.name === 'string' ? pkg.name : undefined,
      scripts: scripts.slice(0, 40),
    }
  } catch {
    return { hasPackageJson: true }
  }
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

      const [git, node] = await Promise.all([getGitInfo(p), getNodeInfo(p)])

      return {
        id: name,
        name,
        path: p,
        status: 'Unknown',
        lastUpdatedAt: stat?.mtime ? new Date(stat.mtime).toISOString() : undefined,
        git,
        node,
      }
    })
  )

  projects.sort((a, b) => (b.lastUpdatedAt ?? '').localeCompare(a.lastUpdatedAt ?? ''))
  return projects
}

async function listWorkers() {
  const candidates = [
    path.join(WORKSPACE, 'worker-heartbeats.json'),
    path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json'),
  ]

  return listWorkersFromCandidates(candidates)
}

async function getStatus() {
  const gateway = await getGatewayStatus()

  if (lastGatewayHealth !== null && (gateway.health !== lastGatewayHealth || gateway.summary !== lastGatewaySummary)) {
    const level = gateway.health === 'ok' ? 'info' : gateway.health === 'warn' ? 'warn' : 'error'
    pushActivity({
      id: newId('gateway'),
      at: new Date().toISOString(),
      level,
      source: 'bridge',
      message: `gateway: ${lastGatewayHealth} → ${gateway.health} (${gateway.summary})`,
    })
  }
  lastGatewayHealth = gateway.health
  lastGatewaySummary = gateway.summary

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
  const workers = await listWorkers()
  return computeBlockersFrom({ status, workers, workspace: WORKSPACE })
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

  const next = new Map(workers.map((w) => [w.slot, w.status]))
  for (const w of workers) {
    const prev = lastWorkerStatusBySlot.get(w.slot)
    if (prev && prev !== w.status) {
      const level = w.status === 'active' || w.status === 'waiting' ? 'info' : w.status === 'stale' ? 'warn' : 'error'
      pushActivity({
        id: newId('worker'),
        at: new Date().toISOString(),
        level,
        source: 'bridge',
        message: `worker ${w.slot}: ${prev} → ${w.status}${w.task ? ` (${w.task})` : ''}`,
      })
    }
  }
  lastWorkerStatusBySlot = next

  res.json(workers)
})

app.get('/api/blockers', async (_req, res) => {
  const blockers = await computeBlockers()
  const ids = new Set(blockers.map((b) => b.id))

  const added = [...ids].filter((id) => !lastBlockerIds.has(id))
  const removed = [...lastBlockerIds].filter((id) => !ids.has(id))
  if (added.length || removed.length) {
    pushActivity({
      id: newId('blockers'),
      at: new Date().toISOString(),
      level: blockers.length ? 'warn' : 'info',
      source: 'bridge',
      message: `blockers changed (+${added.length} -${removed.length}): now ${blockers.length}`,
      meta: { added, removed },
    })
  }
  lastBlockerIds = ids

  res.json(blockers)
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
