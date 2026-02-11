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
import { getHeartbeatDiagnostics } from './watchdog.mjs'
import { loadRules, loadRuleHistory, pushRuleHistory, saveRules, saveRuleHistory } from './rules.mjs'
import { loadTasks, makeId as makeTaskId, normalizeLane, normalizePriority, saveTasks } from './tasks.mjs'
import {
  draftScopeAndTree,
  ensureUniqueProjectId,
  generateClarifyingQuestions,
  loadIntakeProjects,
  makeId as makeIntakeId,
  saveIntakeProjects,
  toMarkdownBrief,
} from './intakeProjects.mjs'

import {
  appendActivity as appendPmActivity,
  createKanbanCard,
  createPmProject,
  createTreeNode,
  deleteKanbanCard,
  deleteTreeNode,
  listPmProjects,
  loadPmProject,
  replaceIntake,
  softDeletePmProject,
  toMarkdownProject,
  updateKanbanCard,
  updatePmProject,
  upsertTreeNode,
} from './pmProjectsStore.mjs'

const execFileAsync = promisify(execFile)

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

const PORT = Number(process.env.PORT ?? 8787)
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const ACTIVITY_FILE = process.env.OPERATOR_HUB_ACTIVITY_FILE ?? path.join(WORKSPACE, '.clawhub', 'activity.json')
const RULES_FILE = process.env.OPERATOR_HUB_RULES_FILE ?? path.join(WORKSPACE, '.clawhub', 'rules.json')
const RULE_HISTORY_FILE = process.env.OPERATOR_HUB_RULE_HISTORY_FILE ?? path.join(WORKSPACE, '.clawhub', 'rule-history.json')
const TASKS_FILE = process.env.OPERATOR_HUB_TASKS_FILE ?? path.join(WORKSPACE, '.clawhub', 'tasks.json')
const INTAKE_PROJECTS_FILE = process.env.OPERATOR_HUB_INTAKE_PROJECTS_FILE ?? path.join(WORKSPACE, '.clawhub', 'intake-projects.json')
const PM_PROJECTS_DIR = process.env.OPERATOR_HUB_PM_PROJECTS_DIR ?? path.join(WORKSPACE, '.clawhub', 'projects')

/** @type {import('../src/types').ActivityEvent[]} */
let activity = await loadActivity(ACTIVITY_FILE)
const activitySaver = makeDebouncedSaver(() => saveActivity(ACTIVITY_FILE, activity))
let activitySaveTimer = null

/** @type {import('../src/types').Rule[]} */
let rules = await loadRules(RULES_FILE)

/** @type {import('../src/types').RuleChange[]} */
let ruleHistory = await loadRuleHistory(RULE_HISTORY_FILE)

/** @type {import('../src/types').IntakeProject[]} */
let intakeProjects = await loadIntakeProjects(INTAKE_PROJECTS_FILE)

const rulesSaver = makeDebouncedSaver(() => saveRules(RULES_FILE, rules))
const ruleHistorySaver = makeDebouncedSaver(() => saveRuleHistory(RULE_HISTORY_FILE, ruleHistory))
const intakeProjectsSaver = makeDebouncedSaver(() => saveIntakeProjects(INTAKE_PROJECTS_FILE, intakeProjects))

/** @type {import('../src/types').Task[]} */
let tasks = await loadTasks(TASKS_FILE)
const tasksSaver = makeDebouncedSaver(() => saveTasks(TASKS_FILE, tasks))
let tasksSaveTimer = null

let lastGatewayHealth = null
let lastGatewaySummary = null

/** @type {Set<string>} */
let lastBlockerIds = new Set()

/** @type {Map<string, string>} */
let lastWorkerStatusBySlot = new Map()

/** @type {Map<string, string>} */
let lastWorkerTaskBySlot = new Map()

/** @type {Map<string, { title: string, startedAtMs: number, workerLabel?: string }>} */
let activeTaskRunBySlot = new Map()

/** @type {Set<string>} */
let seenTaskTitles = new Set()

function scheduleActivitySave() {
  activitySaver.trigger()
  if (activitySaveTimer) return
  activitySaveTimer = setTimeout(async () => {
    activitySaveTimer = null
    await activitySaver.flush()
  }, 750)
}

function scheduleRulesSave() {
  rulesSaver.trigger()
  ruleHistorySaver.trigger()
}

function scheduleTasksSave() {
  tasksSaver.trigger()
  if (tasksSaveTimer) return
  tasksSaveTimer = setTimeout(async () => {
    tasksSaveTimer = null
    await tasksSaver.flush()
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

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
  return `${Math.floor(ms / 3_600_000)}h ${Math.round((ms % 3_600_000) / 60_000)}m`
}

function getTaskTitle(task) {
  if (typeof task === 'string') return task.trim()
  if (task === undefined || task === null) return ''
  return String(task).trim()
}

function recordTaskLifecycle(workers, nowMs = Date.now()) {
  const nowIso = new Date(nowMs).toISOString()
  const nextTaskBySlot = new Map()
  const activeSlots = new Set(workers.map((w) => w.slot))

  for (const w of workers) {
    const slot = w.slot
    const workerLabel = w.label ?? w.slot
    const taskTitle = getTaskTitle(w.task)
    const prevTask = lastWorkerTaskBySlot.get(slot) ?? ''

    if (taskTitle) nextTaskBySlot.set(slot, taskTitle)

    if (taskTitle && taskTitle !== prevTask) {
      if (!seenTaskTitles.has(taskTitle)) {
        seenTaskTitles.add(taskTitle)
        pushActivity({
          id: newId('task-created'),
          at: nowIso,
          level: 'info',
          source: 'tasks',
          message: `task created: ${taskTitle}`,
          meta: { eventType: 'task.created', task: taskTitle, workerSlot: slot, worker: workerLabel },
        })
      }

      const prevRun = activeTaskRunBySlot.get(slot)
      if (prevRun && prevRun.title !== taskTitle) {
        const durationMs = Math.max(0, nowMs - prevRun.startedAtMs)
        pushActivity({
          id: newId('task-completed'),
          at: nowIso,
          level: 'info',
          source: 'tasks',
          message: `task completed: ${prevRun.title} · ${prevRun.workerLabel ?? slot} · took ${fmtDuration(durationMs)}`,
          meta: {
            eventType: 'task.completed',
            task: prevRun.title,
            workerSlot: slot,
            worker: prevRun.workerLabel ?? slot,
            durationMs,
            startedAt: new Date(prevRun.startedAtMs).toISOString(),
            completedAt: nowIso,
          },
        })
      }

      activeTaskRunBySlot.set(slot, { title: taskTitle, startedAtMs: nowMs, workerLabel })
      pushActivity({
        id: newId('task-started'),
        at: nowIso,
        level: 'info',
        source: 'tasks',
        message: `task assigned: ${taskTitle} → ${workerLabel}`,
        meta: { eventType: 'task.assigned', task: taskTitle, workerSlot: slot, worker: workerLabel, startedAt: nowIso },
      })
    }

    if (!taskTitle && prevTask) {
      const prevRun = activeTaskRunBySlot.get(slot)
      if (prevRun) {
        const durationMs = Math.max(0, nowMs - prevRun.startedAtMs)
        pushActivity({
          id: newId('task-completed'),
          at: nowIso,
          level: 'info',
          source: 'tasks',
          message: `task completed: ${prevRun.title} · ${prevRun.workerLabel ?? slot} · took ${fmtDuration(durationMs)}`,
          meta: {
            eventType: 'task.completed',
            task: prevRun.title,
            workerSlot: slot,
            worker: prevRun.workerLabel ?? slot,
            durationMs,
            startedAt: new Date(prevRun.startedAtMs).toISOString(),
            completedAt: nowIso,
          },
        })
      }
      activeTaskRunBySlot.delete(slot)
    }

    if (taskTitle && !activeTaskRunBySlot.has(slot)) {
      activeTaskRunBySlot.set(slot, { title: taskTitle, startedAtMs: nowMs, workerLabel })
    }
  }

  for (const [slot, prevTask] of lastWorkerTaskBySlot.entries()) {
    if (activeSlots.has(slot)) continue
    if (!prevTask) continue
    const prevRun = activeTaskRunBySlot.get(slot)
    if (prevRun) {
      const durationMs = Math.max(0, nowMs - prevRun.startedAtMs)
      pushActivity({
        id: newId('task-completed'),
        at: nowIso,
        level: 'info',
        source: 'tasks',
        message: `task completed: ${prevRun.title} · ${prevRun.workerLabel ?? slot} · took ${fmtDuration(durationMs)}`,
        meta: {
          eventType: 'task.completed',
          task: prevRun.title,
          workerSlot: slot,
          worker: prevRun.workerLabel ?? slot,
          durationMs,
          startedAt: new Date(prevRun.startedAtMs).toISOString(),
          completedAt: nowIso,
        },
      })
    }
    activeTaskRunBySlot.delete(slot)
  }

  lastWorkerTaskBySlot = nextTaskBySlot
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

async function getWatchdog() {
  const candidates = [
    path.join(WORKSPACE, 'worker-heartbeats.json'),
    path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json'),
  ]
  return getHeartbeatDiagnostics(candidates)
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

app.get('/api/live', async (_req, res) => {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const candidates = [
    path.join(WORKSPACE, 'worker-heartbeats.json'),
    path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json'),
  ]

  const [status, workers, watchdog] = await Promise.all([getStatus(), listWorkersFromCandidates(candidates, nowMs), getHeartbeatDiagnostics(candidates, nowMs)])
  const blockers = computeBlockersFrom({ status, workers, workspace: WORKSPACE, now: new Date(nowMs) })
  recordTaskLifecycle(workers, nowMs)

  res.json({ updatedAt: nowIso, status, workers, blockers, watchdog })
})

app.get('/api/projects', async (_req, res) => {
  const projects = await listProjects()
  res.json(projects)
})

app.get('/api/workers', async (_req, res) => {
  const nowMs = Date.now()
  const workers = await listWorkersFromCandidates(
    [path.join(WORKSPACE, 'worker-heartbeats.json'), path.join(WORKSPACE, '.clawhub', 'worker-heartbeats.json')],
    nowMs,
  )
  recordTaskLifecycle(workers, nowMs)

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

// ---- Models / config ----
app.get('/api/models', async (_req, res) => {
  const [listRes, statusRes] = await Promise.all([
    runCli('openclaw', ['models', 'list', '--json'], 12_000),
    runCli('openclaw', ['models', 'status', '--json'], 12_000),
  ])

  /** @type {{ defaultModel?: string, models: any[] }} */
  const out = { defaultModel: undefined, models: [] }

  if (statusRes.ok) {
    try {
      const parsed = JSON.parse(statusRes.output || '{}')
      if (typeof parsed?.resolvedDefault === 'string') out.defaultModel = parsed.resolvedDefault
      else if (typeof parsed?.defaultModel === 'string') out.defaultModel = parsed.defaultModel
    } catch {
      // ignore
    }
  }

  if (listRes.ok) {
    try {
      const parsed = JSON.parse(listRes.output || '{}')
      const models = Array.isArray(parsed?.models) ? parsed.models : []
      out.models = models
    } catch {
      out.models = []
    }
  }

  res.json(out)
})

app.post('/api/models/set', async (req, res) => {
  const modelKey = typeof req.body?.modelKey === 'string' ? req.body.modelKey.trim() : ''
  if (!modelKey) return res.status(400).send('missing modelKey')

  const at = new Date().toISOString()
  const r = await runCli('openclaw', ['models', 'set', modelKey], 20_000)
  const ok = !!r.ok

  // Try to read resolved default back for confirmation.
  let resolved
  const s = await runCli('openclaw', ['models', 'status', '--json'], 12_000)
  if (s.ok) {
    try {
      const parsed = JSON.parse(s.output || '{}')
      resolved = typeof parsed?.resolvedDefault === 'string' ? parsed.resolvedDefault : undefined
    } catch {
      resolved = undefined
    }
  }

  pushActivity({
    id: newId('models'),
    at,
    level: ok ? 'info' : 'error',
    source: 'operator-hub',
    message: ok ? `model set: ${modelKey}` : `model set failed: ${modelKey}`,
    meta: { eventType: 'model.set', modelKey, resolvedDefault: resolved, output: r.output },
  })

  res.json({ ok, message: ok ? `Default model set to ${resolved ?? modelKey}` : 'Failed to set default model', defaultModel: resolved ?? modelKey })
})

function slugifyId(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function ensureUniqueRuleId(desired) {
  const base = slugifyId(desired) || `rule-${Date.now()}`
  let id = base
  let n = 2
  while (rules.some((r) => r.id === id)) {
    id = `${base}-${n++}`
  }
  return id
}

app.get('/api/rules', async (_req, res) => {
  const sorted = rules.slice().sort((a, b) => a.title.localeCompare(b.title))
  res.json(sorted)
})

app.post('/api/rules', async (req, res) => {
  const body = req.body ?? {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  if (!title) return res.status(400).send('title required')

  const id = ensureUniqueRuleId(typeof body.id === 'string' ? body.id : title)
  const next = {
    id,
    title,
    description: typeof body.description === 'string' ? body.description : undefined,
    enabled: body.enabled === undefined ? true : !!body.enabled,
    content,
    updatedAt: new Date().toISOString(),
  }

  rules = [...rules, next]

  pushRuleHistory(ruleHistory, {
    at: next.updatedAt,
    ruleId: next.id,
    action: 'create',
    summary: 'Created rule',
    after: { title: next.title, description: next.description, content: next.content, enabled: next.enabled },
    source: 'bridge',
  })

  scheduleRulesSave()
  res.json(next)
})

app.get('/api/rules/history', async (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 200)))
  res.json(ruleHistory.slice(0, limit))
})

/* (removed) duplicate /api/tasks handlers; see unified Tasks section below */

app.delete('/api/rules/:id', async (req, res) => {
  const id = req.params.id
  const idx = rules.findIndex((r) => r.id === id)
  if (idx < 0) return res.status(404).send('rule not found')

  const before = rules[idx]
  rules = [...rules.slice(0, idx), ...rules.slice(idx + 1)]

  pushRuleHistory(ruleHistory, {
    at: new Date().toISOString(),
    ruleId: id,
    action: 'delete',
    summary: 'Deleted rule',
    before: { title: before.title, description: before.description, content: before.content, enabled: before.enabled },
    source: 'bridge',
  })

  scheduleRulesSave()
  res.json({ ok: true })
})

app.put('/api/rules/:id', async (req, res) => {
  const id = req.params.id
  const idx = rules.findIndex((r) => r.id === id)
  if (idx < 0) return res.status(404).send('rule not found')

  const before = rules[idx]
  const update = req.body ?? {}
  const next = {
    ...before,
    title: typeof update.title === 'string' ? update.title : before.title,
    description: typeof update.description === 'string' ? update.description : before.description,
    content: typeof update.content === 'string' ? update.content : before.content,
    updatedAt: new Date().toISOString(),
  }

  rules = [...rules.slice(0, idx), next, ...rules.slice(idx + 1)]

  pushRuleHistory(ruleHistory, {
    at: next.updatedAt,
    ruleId: next.id,
    action: 'update',
    summary: 'Updated rule',
    before: { title: before.title, description: before.description, content: before.content },
    after: { title: next.title, description: next.description, content: next.content },
    source: 'bridge',
  })

  scheduleRulesSave()
  res.json(next)
})

app.post('/api/rules/:id/toggle', async (req, res) => {
  const id = req.params.id
  const idx = rules.findIndex((r) => r.id === id)
  if (idx < 0) return res.status(404).send('rule not found')

  const before = rules[idx]
  const enabled = !!(req.body?.enabled)
  const next = { ...before, enabled, updatedAt: new Date().toISOString() }

  rules = [...rules.slice(0, idx), next, ...rules.slice(idx + 1)]

  pushRuleHistory(ruleHistory, {
    at: next.updatedAt,
    ruleId: next.id,
    action: 'toggle',
    summary: enabled ? 'Enabled rule' : 'Disabled rule',
    before: { enabled: before.enabled },
    after: { enabled: next.enabled },
    source: 'bridge',
  })

  scheduleRulesSave()
  res.json(next)
})

// ---- Tasks (operator board seed) ----
app.get('/api/tasks', async (_req, res) => {
  const sorted = tasks.slice().sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  res.json(sorted)
})

app.post('/api/tasks', async (req, res) => {
  const body = req.body ?? {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return res.status(400).send('title required')

  const now = new Date().toISOString()
  const lane = normalizeLane(body.lane)
  const priority = normalizePriority(body.priority)

  /** @type {import('../src/types').Task} */
  const next = {
    id: typeof body.id === 'string' && body.id.trim() ? body.id.trim() : makeTaskId('task'),
    title,
    lane,
    priority,
    owner: typeof body.owner === 'string' ? body.owner : undefined,
    problem: typeof body.problem === 'string' ? body.problem : undefined,
    scope: typeof body.scope === 'string' ? body.scope : undefined,
    acceptanceCriteria: Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria.filter((s) => typeof s === 'string') : undefined,
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ at: now, to: lane, note: 'created' }],
  }

  tasks = [next, ...tasks].slice(0, 500)
  scheduleTasksSave()
  res.json(next)
})

app.put('/api/tasks/:id', async (req, res) => {
  const id = req.params.id
  const idx = tasks.findIndex((t) => t.id === id)
  if (idx < 0) return res.status(404).send('task not found')

  const update = req.body ?? {}
  const before = tasks[idx]
  const now = new Date().toISOString()

  const nextLane = update.lane !== undefined ? normalizeLane(update.lane) : before.lane
  const nextPriority = update.priority !== undefined ? normalizePriority(update.priority) : before.priority

  const next = {
    ...before,
    title: typeof update.title === 'string' ? update.title : before.title,
    lane: nextLane,
    priority: nextPriority,
    owner: typeof update.owner === 'string' ? update.owner : before.owner,
    problem: typeof update.problem === 'string' ? update.problem : before.problem,
    scope: typeof update.scope === 'string' ? update.scope : before.scope,
    acceptanceCriteria: Array.isArray(update.acceptanceCriteria)
      ? update.acceptanceCriteria.filter((s) => typeof s === 'string')
      : before.acceptanceCriteria,
    updatedAt: now,
    statusHistory:
      nextLane !== before.lane
        ? [{ at: now, from: before.lane, to: nextLane, note: 'updated' }, ...(before.statusHistory ?? [])]
        : before.statusHistory ?? [],
  }

  tasks = [...tasks.slice(0, idx), next, ...tasks.slice(idx + 1)]
  scheduleTasksSave()
  res.json(next)
})

// ---- PM/PO Intake Projects ----
app.get('/api/intake/projects', async (_req, res) => {
  const sorted = intakeProjects.slice().sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  res.json(sorted)
})

app.get('/api/intake/projects/:id', async (req, res) => {
  const p = intakeProjects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).send('intake project not found')
  res.json(p)
})

app.post('/api/intake/projects', async (req, res) => {
  const body = req.body ?? {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  if (!title) return res.status(400).send('title required')
  if (!idea) return res.status(400).send('idea required')

  const now = new Date().toISOString()
  const id = ensureUniqueProjectId(intakeProjects, typeof body.id === 'string' ? body.id : title)

  /** @type {import('../src/types').IntakeProject} */
  const next = {
    id,
    title,
    idea,
    status: 'idea',
    tags: [],
    questions: [],
    scope: null,
    featureTree: [],
    createdAt: now,
    updatedAt: now,
  }

  intakeProjects = [next, ...intakeProjects].slice(0, 500)
  intakeProjectsSaver.trigger()
  res.json(next)
})

app.put('/api/intake/projects/:id', async (req, res) => {
  const id = req.params.id
  const idx = intakeProjects.findIndex((p) => p.id === id)
  if (idx < 0) return res.status(404).send('intake project not found')

  const update = req.body ?? {}
  const before = intakeProjects[idx]
  const now = new Date().toISOString()

  const next = {
    ...before,
    title: typeof update.title === 'string' ? update.title : before.title,
    idea: typeof update.idea === 'string' ? update.idea : before.idea,
    status: typeof update.status === 'string' ? update.status : before.status,
    tags: Array.isArray(update.tags) ? update.tags.filter((t) => typeof t === 'string') : before.tags,
    questions: Array.isArray(update.questions) ? update.questions : before.questions,
    scope: update.scope === undefined ? before.scope : update.scope,
    featureTree: Array.isArray(update.featureTree) ? update.featureTree : before.featureTree,
    updatedAt: now,
  }

  intakeProjects = [...intakeProjects.slice(0, idx), next, ...intakeProjects.slice(idx + 1)]
  intakeProjectsSaver.trigger()
  res.json(next)
})

app.post('/api/intake/projects/:id/generate-questions', async (req, res) => {
  const id = req.params.id
  const idx = intakeProjects.findIndex((p) => p.id === id)
  if (idx < 0) return res.status(404).send('intake project not found')

  const p = intakeProjects[idx]
  const questions = generateClarifyingQuestions({ idea: p.idea })
  const now = new Date().toISOString()
  const next = { ...p, questions, status: 'questions', updatedAt: now }

  intakeProjects = [...intakeProjects.slice(0, idx), next, ...intakeProjects.slice(idx + 1)]
  intakeProjectsSaver.trigger()
  res.json(next)
})

app.post('/api/intake/projects/:id/generate-scope', async (req, res) => {
  const id = req.params.id
  const idx = intakeProjects.findIndex((p) => p.id === id)
  if (idx < 0) return res.status(404).send('intake project not found')

  const p = intakeProjects[idx]
  const drafted = draftScopeAndTree({ title: p.title, idea: p.idea, questions: p.questions })
  const now = new Date().toISOString()
  const next = { ...p, scope: drafted.scope, featureTree: drafted.featureTree, status: 'scoped', updatedAt: now }

  intakeProjects = [...intakeProjects.slice(0, idx), next, ...intakeProjects.slice(idx + 1)]
  intakeProjectsSaver.trigger()
  res.json(next)
})

app.get('/api/intake/projects/:id/export.md', async (req, res) => {
  const p = intakeProjects.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).send('intake project not found')
  res.setHeader('content-type', 'text/markdown; charset=utf-8')
  res.send(toMarkdownBrief(p))
})

// ---- PM Projects Hub (overview + tree + kanban + intake artifacts) ----
app.get('/api/pm/projects', async (_req, res) => {
  const list = await listPmProjects(PM_PROJECTS_DIR)
  res.json(list)
})

app.post('/api/pm/projects', async (req, res) => {
  try {
    const created = await createPmProject(PM_PROJECTS_DIR, req.body ?? {})
    res.json(created)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid project')
  }
})

app.get('/api/pm/projects/:id', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.json(p)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/pm/projects/:id', async (req, res) => {
  try {
    const next = await updatePmProject(PM_PROJECTS_DIR, req.params.id, req.body ?? {})
    if (!next) return res.status(404).send('project not found')
    res.json(next)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/pm/projects/:id', async (req, res) => {
  try {
    const ok = await softDeletePmProject(PM_PROJECTS_DIR, req.params.id)
    if (!ok) return res.status(404).send('project not found')
    res.json({ ok: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/pm/projects/:id/export.json', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('content-disposition', `attachment; filename=project-${p.id}.json`)
    res.send(JSON.stringify(p, null, 2))
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/pm/projects/:id/export.md', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.setHeader('content-type', 'text/markdown; charset=utf-8')
    res.send(toMarkdownProject(p))
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Tree
app.get('/api/pm/projects/:id/tree', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.json(p.tree ?? [])
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/tree/nodes', async (req, res) => {
  try {
    const created = await createTreeNode(PM_PROJECTS_DIR, req.params.id, req.body ?? {})
    if (!created) return res.status(404).send('project not found')
    if (created?.error) return res.status(400).send(created.error)
    res.json(created)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/pm/projects/:id/tree/nodes/:nodeId', async (req, res) => {
  try {
    const next = await upsertTreeNode(PM_PROJECTS_DIR, req.params.id, req.params.nodeId, req.body ?? {})
    if (!next) return res.status(404).send('node not found')
    res.json(next)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/pm/projects/:id/tree/nodes/:nodeId', async (req, res) => {
  try {
    const ok = await deleteTreeNode(PM_PROJECTS_DIR, req.params.id, req.params.nodeId)
    if (ok === null) return res.status(404).send('project not found')
    if (!ok) return res.status(404).send('node not found')
    res.json({ ok: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Cards
app.get('/api/pm/projects/:id/cards', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.json(p.cards ?? [])
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/cards', async (req, res) => {
  try {
    const c = await createKanbanCard(PM_PROJECTS_DIR, req.params.id, req.body ?? {})
    if (!c) return res.status(404).send('project not found')
    res.json(c)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/pm/projects/:id/cards/:cardId', async (req, res) => {
  try {
    const c = await updateKanbanCard(PM_PROJECTS_DIR, req.params.id, req.params.cardId, req.body ?? {})
    if (!c) return res.status(404).send('card not found')
    res.json(c)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/pm/projects/:id/cards/:cardId', async (req, res) => {
  try {
    const ok = await deleteKanbanCard(PM_PROJECTS_DIR, req.params.id, req.params.cardId)
    if (ok === null) return res.status(404).send('project not found')
    if (!ok) return res.status(404).send('card not found')
    res.json({ ok: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Intake artifacts
app.get('/api/pm/projects/:id/intake', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')
    res.json(p.intake ?? { idea: [], analysis: [], questions: [], requirements: [] })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/pm/projects/:id/intake', async (req, res) => {
  try {
    const next = await replaceIntake(PM_PROJECTS_DIR, req.params.id, req.body ?? {})
    if (!next) return res.status(404).send('project not found')
    res.json(next)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/intake/idea', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (!text) return res.status(400).send('text required')

    const at = new Date().toISOString()
    const next = {
      ...p.intake,
      idea: [{ id: `idea-${Date.now()}`, at, author: req.body?.author === 'ai' ? 'ai' : 'human', text }, ...(p.intake?.idea ?? [])].slice(0, 50),
    }

    const saved = await replaceIntake(PM_PROJECTS_DIR, req.params.id, next)
    res.json(saved)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/intake/analysis', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')

    const at = new Date().toISOString()
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `ana-${Date.now()}`

    const entry = {
      id,
      at,
      type: req.body?.type,
      tags: req.body?.tags,
      risks: req.body?.risks,
      summary: typeof req.body?.summary === 'string' ? req.body.summary : '',
    }

    const next = { ...p.intake, analysis: [entry, ...(p.intake?.analysis ?? [])].slice(0, 50) }
    const saved = await replaceIntake(PM_PROJECTS_DIR, req.params.id, next)
    res.json(saved)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/intake/questions/generate', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')

    const ideaText =
      (typeof req.body?.idea === 'string' && req.body.idea.trim()) ||
      p.intake?.idea?.[0]?.text ||
      p.summary ||
      ''

    const generated = generateClarifyingQuestions({ idea: ideaText })
    const questions = generated.map((q) => ({ id: q.id, category: q.category, prompt: q.prompt, answer: null }))

    const next = { ...p.intake, questions }
    const saved = await replaceIntake(PM_PROJECTS_DIR, req.params.id, next)
    res.json(saved)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/intake/questions/:qid/answer', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')

    const qid = req.params.qid
    const text = typeof req.body?.text === 'string' ? req.body.text : ''

    const at = new Date().toISOString()
    const nextQuestions = (p.intake?.questions ?? []).map((q) =>
      q.id === qid ? { ...q, answer: text.trim() ? { text, at, author: req.body?.author === 'ai' ? 'ai' : 'human' } : null } : q,
    )

    const saved = await replaceIntake(PM_PROJECTS_DIR, req.params.id, { ...p.intake, questions: nextQuestions })
    res.json(saved)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/pm/projects/:id/intake/requirements', async (req, res) => {
  try {
    const p = await loadPmProject(PM_PROJECTS_DIR, req.params.id)
    if (!p) return res.status(404).send('project not found')

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (!text) return res.status(400).send('text required')

    const at = new Date().toISOString()
    const r = {
      id: typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : `req-${Date.now()}`,
      at,
      source: req.body?.source,
      kind: req.body?.kind,
      text,
      citations: req.body?.citations,
    }

    const next = { ...p.intake, requirements: [r, ...(p.intake?.requirements ?? [])].slice(0, 500) }
    const saved = await replaceIntake(PM_PROJECTS_DIR, req.params.id, next)
    res.json(saved)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Activity
app.post('/api/pm/projects/:id/activity', async (req, res) => {
  try {
    const item = await appendPmActivity(PM_PROJECTS_DIR, req.params.id, req.body ?? {})
    if (!item) return res.status(404).send('project not found')
    res.json(item)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// One-way migration helper: convert existing /api/intake/projects records into PM projects.
// This is best-effort and does NOT delete the legacy intake store.
app.post('/api/pm/migrate/from-intake', async (_req, res) => {
  const created = []
  const skipped = []

  for (const ip of intakeProjects ?? []) {
    try {
      const existing = await loadPmProject(PM_PROJECTS_DIR, ip.id)
      if (existing) {
        skipped.push({ id: ip.id, reason: 'already exists' })
        continue
      }

      const intake = {
        idea: [{ id: 'idea-1', at: ip.createdAt ?? new Date().toISOString(), author: 'human', text: ip.idea ?? '' }],
        analysis: [],
        questions: (ip.questions ?? []).map((q) => ({
          id: q.id,
          category: q.category,
          prompt: q.prompt,
          answer: q.answer && String(q.answer).trim() ? { text: q.answer, at: ip.updatedAt ?? new Date().toISOString(), author: 'human' } : null,
        })),
        requirements: [],
      }

      const tree = (ip.featureTree ?? []).map((n) => {
        const mapPriority = (p) => (p === 'P0' ? 'p0' : p === 'P1' ? 'p1' : 'p2')
        const walk = (x) => ({
          id: x.id,
          title: x.title,
          summary: x.description,
          status: 'planned',
          priority: mapPriority(x.priority),
          sources: [{ kind: 'idea', id: 'idea-1' }],
          children: Array.isArray(x.children) ? x.children.map(walk) : [],
        })
        return walk(n)
      })

      const proj = await createPmProject(PM_PROJECTS_DIR, {
        id: ip.id,
        name: ip.title ?? ip.id,
        summary: (ip.idea ?? '').slice(0, 280),
        status: 'active',
        tags: ip.tags ?? [],
        owner: 'unknown',
        links: [],
        tree,
        cards: [],
        activity: [{ id: `a-${Date.now()}`, at: new Date().toISOString(), actor: 'system', text: 'Migrated from legacy intake project' }],
        intake,
      })

      created.push({ id: proj.id })
    } catch (err) {
      skipped.push({ id: ip?.id, reason: err?.message ?? 'failed' })
    }
  }

  res.json({ ok: true, created, skipped })
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

async function flushActivityOnExit() {
  try {
    await activitySaver.flush()
  } catch {
    // best-effort
  }
  try {
    await rulesSaver.flush()
    await ruleHistorySaver.flush()
    await tasksSaver.flush()
    await intakeProjectsSaver.flush()
  } catch {
    // best-effort
  }
}

process.on('SIGINT', async () => {
  await flushActivityOnExit()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await flushActivityOnExit()
  process.exit(0)
})

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
