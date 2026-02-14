import express from 'express'
import cors from 'cors'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { WebSocketServer } from 'ws'
import http from 'node:http'

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
  getFeatureDetail,
  getFeatureSubFeatures,
  listPmProjects,
  loadPmProject,
  regenerateAiContext,
  replaceIntake,
  softDeletePmProject,
  toMarkdownProject,
  updateAcceptanceCriteria,
  updateKanbanCard,
  updatePmProject,
  upsertTreeNode,
} from './pmProjectsStore.mjs'

import { getAgentsStore } from './agentsStore.mjs'
import { getTasksStore } from './tasksStore.mjs'
import { getNotificationsStore } from './notificationsStore.mjs'
import { getTaskTemplatesStore } from './taskTemplates.mjs'
import { autoAssignTask, getAssignmentSuggestions } from './taskAssignment.mjs'
import { generateTasksFromPrompt, getProjectContext } from './aiTaskGeneration.mjs'
import { getRoutinesStore } from './routines.mjs'
import { getRoutineExecutor } from './routineExecutor.mjs'
import { getCalendarIntegration } from './calendarIntegration.mjs'
import { GitHubIntegration } from './githubIntegration.mjs'
import { sendTelegramNotification, sendTestNotification, formatTaskNotification, loadTelegramConfig } from './telegramIntegration.mjs'
import logger from './logger.mjs'
import { createHealthChecker } from './healthChecks.mjs'

const execFileAsync = promisify(execFile)
const healthChecker = createHealthChecker()
const startTime = Date.now()

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Middleware for request logging
app.use((req, res, next) => {
  const startTime = Date.now()
  const originalSend = res.send
  
  res.send = function (data) {
    const duration = Date.now() - startTime
    logger.debug(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: duration,
      size: Buffer.byteLength(data),
    })
    return originalSend.call(this, data)
  }
  next()
})

// Error tracking middleware
app.use((err, req, res, next) => {
  if (err) {
    healthChecker.recordError()
    logger.error('Request error', {
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
    })
  }
  next(err)
})

const PORT = Number(process.env.PORT ?? 8787)
const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const ACTIVITY_FILE = process.env.OPERATOR_HUB_ACTIVITY_FILE ?? path.join(WORKSPACE, '.clawhub', 'activity.json')
const RULES_FILE = process.env.OPERATOR_HUB_RULES_FILE ?? path.join(WORKSPACE, '.clawhub', 'rules.json')
const RULE_HISTORY_FILE = process.env.OPERATOR_HUB_RULE_HISTORY_FILE ?? path.join(WORKSPACE, '.clawhub', 'rule-history.json')
const TASKS_FILE = process.env.OPERATOR_HUB_TASKS_FILE ?? path.join(WORKSPACE, '.clawhub', 'tasks.json')
const INTAKE_PROJECTS_FILE = process.env.OPERATOR_HUB_INTAKE_PROJECTS_FILE ?? path.join(WORKSPACE, '.clawhub', 'intake-projects.json')
const PM_PROJECTS_DIR = process.env.OPERATOR_HUB_PM_PROJECTS_DIR ?? path.join(WORKSPACE, '.clawhub', 'projects')
const AGENTS_FILE = process.env.OPERATOR_HUB_AGENTS_FILE ?? path.join(WORKSPACE, '.clawhub', 'agents.json')
const NEW_TASKS_FILE = process.env.OPERATOR_HUB_NEW_TASKS_FILE ?? path.join(WORKSPACE, '.clawhub', 'new-tasks.json')
const NOTIFICATIONS_FILE = process.env.OPERATOR_HUB_NOTIFICATIONS_FILE ?? path.join(WORKSPACE, '.clawhub', 'notifications.json')
const TEMPLATES_FILE = process.env.OPERATOR_HUB_TEMPLATES_FILE ?? path.join(WORKSPACE, '.clawhub', 'taskTemplates.json')
const ROUTINES_FILE = process.env.OPERATOR_HUB_ROUTINES_FILE ?? path.join(WORKSPACE, '.clawhub', 'routines.json')
const CONFIG_FILE = process.env.OPERATOR_HUB_CONFIG_FILE ?? path.join(WORKSPACE, '.clawhub', 'config.json')

// Load GitHub config
async function loadGitHubConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8')
    const config = JSON.parse(raw)
    return config?.integrations?.github ?? {}
  } catch {
    return {}
  }
}

const gitHubConfig = await loadGitHubConfig()
const github = new GitHubIntegration(gitHubConfig)

async function loadCalendarConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8')
    const config = JSON.parse(raw)
    return config?.integrations?.googleCalendar ?? {}
  } catch {
    return {}
  }
}

const calendarConfig = await loadCalendarConfig()
const calendar = getCalendarIntegration(calendarConfig)

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

// Initialize new stores (multi-agent system)
const agentsStore = getAgentsStore(AGENTS_FILE)
const newTasksStore = getTasksStore(NEW_TASKS_FILE)
const notificationsStore = getNotificationsStore(NOTIFICATIONS_FILE)
const templatesStore = getTaskTemplatesStore(TEMPLATES_FILE)
const routinesStore = getRoutinesStore(ROUTINES_FILE)

// Ensure stores are loaded
await agentsStore.load()
await newTasksStore.load()
await notificationsStore.load()
await templatesStore.load()
await routinesStore.load()

// Initialize routine executor
const routineExecutor = getRoutineExecutor(routinesStore, newTasksStore, agentsStore, notificationsStore)
routineExecutor.start()

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
  if (typeof task === 'object' && task.title) return String(task.title).trim()
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

  // Get workers from agents store (new system) instead of worker-heartbeats.json
  const agents = await agentsStore.getAll()
  const workers = agents.map(agent => {
    const lastBeatIso = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toISOString() : undefined
    const taskTitle = agent.currentTask && typeof agent.currentTask === 'object' 
      ? agent.currentTask.title 
      : agent.currentTask
    return {
      slot: agent.id,
      label: agent.name,
      status: agent.status === 'online' ? 'active' : agent.status === 'busy' ? 'active' : 'offline',
      task: taskTitle || undefined,
      lastBeatAt: lastBeatIso,
      beats: lastBeatIso ? [{ at: lastBeatIso }] : []
    }
  })

  const status = await getStatus()
  const blockers = computeBlockersFrom({ status, workers, workspace: WORKSPACE, now: new Date(nowMs) })
  const watchdog = { health: 'unknown', summary: 'using new agent system' }
  recordTaskLifecycle(workers, nowMs)

  res.json({ updatedAt: nowIso, status, workers, blockers, watchdog })
})

app.get('/api/projects', async (_req, res) => {
  const projects = await listProjects()
  res.json(projects)
})

app.get('/api/workers', async (_req, res) => {
  // Return agents in worker format for UI compatibility
  const agentsStore = getAgentsStore()
  const agents = await agentsStore.getAll()
  
  // Transform agents to worker format
  const workers = agents.map(agent => {
    const lastBeatIso = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toISOString() : null
    return {
      slot: agent.id,
      label: agent.name,
      status: agent.status === 'online' ? 'active' : agent.status === 'busy' ? 'active' : 'offline',
      task: agent.currentTask || null,
      lastBeatAt: lastBeatIso,
      beats: lastBeatIso ? [{ at: lastBeatIso }] : [],
    }
  })
  
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
})

// ---- Tasks (operator board seed) ----
app.get('/api/tasks', async (req, res) => {
  let filtered = tasks.slice()
  
  // Filter by lane if provided
  if (req.query.lane) {
    filtered = filtered.filter(t => t.lane === req.query.lane)
  }
  
  // Filter by owner if provided
  if (req.query.owner) {
    filtered = filtered.filter(t => t.owner === req.query.owner)
  }
  
  // Filter by status (legacy support - map to lane)
  if (req.query.status) {
    filtered = filtered.filter(t => t.lane === req.query.status)
  }
  
  // Filter by assignee (legacy support - map to owner)
  if (req.query.assignee) {
    filtered = filtered.filter(t => t.owner === req.query.assignee)
  }
  
  const sorted = filtered.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
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
  
  logger.info('Task created', {
    taskId: next.id,
    title: next.title,
    priority: next.priority,
    lane: next.lane,
  })
  
  res.json(next)
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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
  // Broadcast task update
  if (global.broadcastWS) global.broadcastWS("task-updated", next)
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

// ====== AGENT ENDPOINTS ======

app.post('/api/agents/register', async (req, res) => {
  try {
    const body = req.body ?? {}
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return res.status(400).send('id required')

    // Normalize currentTask: extract title if object, otherwise use as-is
    let currentTask = body.currentTask || null
    if (currentTask && typeof currentTask === 'object' && currentTask.title) {
      currentTask = currentTask.title
    }

    const agent = await agentsStore.upsert({
      id,
      name: body.name || id,
      emoji: body.emoji || '🤖',
      roles: Array.isArray(body.roles) ? body.roles : [],
      model: body.model || '',
      workspace: body.workspace || '',
      status: body.status || 'offline',
      instanceId: body.instanceId || '',
      tailscaleIP: body.tailscaleIP || '',
      currentTask,
      activeTasks: Array.isArray(body.activeTasks) ? body.activeTasks : [],
      metadata: body.metadata || {}
    })

    res.json(agent)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Agent heartbeat endpoint
app.post('/api/agents/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body ?? {}
    
    const agent = await agentsStore.updateStatus(
      id,
      body.status || 'online',
      body.currentTask || null
    )
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }
    
    // Update instance info if provided
    if (body.instanceId || body.tailscaleIP) {
      await agentsStore.upsert({
        ...agent,
        instanceId: body.instanceId || agent.instanceId,
        tailscaleIP: body.tailscaleIP || agent.tailscaleIP
      })
    }
    
    res.json({ success: true, agent })
    // Broadcast agent update
    if (global.broadcastWS) global.broadcastWS("agent-updated", agent)
  } catch (err) {
    res.status(500).json({ error: err?.message ?? 'heartbeat failed' })
  }
})

app.get('/api/agents', async (_req, res) => {
  try {
    const agents = await agentsStore.getAll()
    res.json(agents)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/agents/:id', async (req, res) => {
  try {
    const agent = await agentsStore.get(req.params.id)
    if (!agent) return res.status(404).send('agent not found')
    res.json(agent)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/agents/:id/status', async (req, res) => {
  try {
    const body = req.body ?? {}
    const status = typeof body.status === 'string' ? body.status : 'offline'
    // Normalize currentTask: extract title if object, otherwise use as-is
    let currentTask = body.currentTask || null
    if (currentTask && typeof currentTask === 'object' && currentTask.title) {
      currentTask = currentTask.title
    }

    const agent = await agentsStore.updateStatus(req.params.id, status, currentTask)
    if (!agent) return res.status(404).send('agent not found')
    res.json(agent)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/agents/:id/tasks', async (req, res) => {
  try {
    const agent = await agentsStore.get(req.params.id)
    if (!agent) return res.status(404).send('agent not found')

    const taskIds = agent.activeTasks || []
    const agentTasks = []
    for (const taskId of taskIds) {
      const task = await newTasksStore.get(taskId)
      if (task) agentTasks.push(task)
    }

    res.json({ agent, tasks: agentTasks })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// ====== NOTIFICATION ENDPOINTS ======

app.get('/api/agents/:id/notifications', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true'
    const notifications = await notificationsStore.getForAgent(req.params.id, { unread: unreadOnly })
    res.json(notifications)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/notifications', async (req, res) => {
  try {
    const body = req.body ?? {}
    const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : ''
    if (!agentId) return res.status(400).send('agentId required')

    const notification = await notificationsStore.create({
      agentId,
      type: body.type || 'info',
      title: body.title || '',
      text: body.text || '',
      taskId: body.taskId || null,
      projectId: body.projectId || null,
      from: body.from || null,
      metadata: body.metadata || {}
    })

    res.json(notification)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await notificationsStore.markRead(req.params.id)
    if (!notification) return res.status(404).send('notification not found')
    res.json(notification)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const deleted = await notificationsStore.delete(req.params.id)
    if (!deleted) return res.status(404).send('notification not found')
    res.json({ success: true, id: req.params.id })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// ====== TASK ENHANCEMENT ENDPOINTS ======

app.post('/api/tasks/:id/assign', async (req, res) => {
  try {
    const taskId = req.params.id
    const body = req.body ?? {}
    const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : ''
    if (!agentId) return res.status(400).send('agentId required')

    const task = await newTasksStore.assign(taskId, agentId, body.assignedBy || 'api')
    if (!task) return res.status(404).send('task not found')

    // Update agent's active tasks
    const agent = await agentsStore.get(agentId)
    if (agent) {
      const activeTasks = [...(agent.activeTasks || []), taskId]
      await agentsStore.updateActiveTasks(agentId, activeTasks)
    }

    // Create notification
    if (agent) {
      await notificationsStore.create({
        agentId,
        type: 'task-assigned',
        title: 'Task assigned',
        text: `You've been assigned: ${task.title}`,
        taskId,
        projectId: task.projectId,
        from: 'manual-assign'
      })
    }

    res.json(task)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/tasks/:id/auto-assign', async (req, res) => {
  try {
    const task = await newTasksStore.get(req.params.id)
    if (!task) return res.status(404).send('task not found')

    const result = await autoAssignTask(task, agentsStore, newTasksStore, notificationsStore)
    res.json(result)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/tasks/:id/comment', async (req, res) => {
  try {
    const body = req.body ?? {}
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) return res.status(400).send('text required')

    const by = typeof body.by === 'string' ? body.by.trim() : 'unknown'
    const task = await newTasksStore.addComment(req.params.id, text, by)
    if (!task) return res.status(404).send('task not found')
    res.json(task)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/tasks/:id/time', async (req, res) => {
  try {
    const body = req.body ?? {}
    const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : ''
    const hours = typeof body.hours === 'number' ? body.hours : 0
    const note = typeof body.note === 'string' ? body.note.trim() : null
    if (!agentId) return res.status(400).send('agentId required')
    if (hours <= 0) return res.status(400).send('hours must be positive')

    const task = await newTasksStore.logTime(req.params.id, agentId, hours, body.start, body.end, note)
    if (!task) return res.status(404).send('task not found')
    res.json(task)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/tasks/:id/time', async (req, res) => {
  try {
    const timeEntries = await newTasksStore.getTimeEntries(req.params.id)
    if (!timeEntries) return res.status(404).send('task not found')
    res.json(timeEntries)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/tasks/:id/context', async (req, res) => {
  try {
    const task = await newTasksStore.get(req.params.id)
    if (!task) return res.status(404).send('task not found')

    // Get dependencies
    const dependencies = await newTasksStore.getDependencies(req.params.id)
    const blocked = await newTasksStore.getBlockedTasks(req.params.id)
    const subtasks = await newTasksStore.getSubtasks(req.params.id)

    // Get assigned agent info
    let agent = null
    if (task.assignedTo) {
      agent = await agentsStore.get(task.assignedTo)
    }

    const context = {
      task,
      agent,
      dependencies,
      blocked,
      subtasks
    }

    res.json(context)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/tasks/:id/dependencies', async (req, res) => {
  try {
    const body = req.body ?? {}
    const dependsOn = Array.isArray(body.dependsOn) ? body.dependsOn : []
    const updatedBy = body.updatedBy || 'api'

    const task = await newTasksStore.updateDependencies(req.params.id, dependsOn, updatedBy)
    if (!task) return res.status(404).send('task not found')
    res.json(task)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/tasks/:id/blockers', async (req, res) => {
  try {
    const blockers = await newTasksStore.getBlockerTasks(req.params.id)
    res.json(blockers)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/tasks/:id/blocked', async (req, res) => {
  try {
    const blocked = await newTasksStore.getBlockedTasks(req.params.id)
    res.json(blocked)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// ====== TASK TEMPLATES ENDPOINTS ======

app.get('/api/templates', async (_req, res) => {
  try {
    const templates = await templatesStore.getAll()
    res.json(templates)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/templates/:id', async (req, res) => {
  try {
    const template = await templatesStore.getTemplate(req.params.id)
    if (!template) return res.status(404).send('template not found')
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/templates', async (req, res) => {
  try {
    const body = req.body ?? {}
    const template = await templatesStore.createTemplate({
      name: body.name,
      description: body.description || '',
      tasks: body.tasks || []
    })
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/templates/:id', async (req, res) => {
  try {
    const body = req.body ?? {}
    const updates = {}
    
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.tasks !== undefined) updates.tasks = body.tasks
    
    const template = await templatesStore.updateTemplate(req.params.id, updates)
    if (!template) return res.status(404).send('template not found')
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const deleted = await templatesStore.deleteTemplate(req.params.id)
    if (!deleted) return res.status(404).send('template not found')
    res.json({ success: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Task instantiation from template
app.post('/api/tasks/from-template', async (req, res) => {
  try {
    const body = req.body ?? {}
    const templateId = body.templateId
    const projectId = body.projectId || null
    const createdBy = body.createdBy || 'api'

    if (!templateId) {
      return res.status(400).send('templateId is required')
    }

    const template = await templatesStore.getTemplate(templateId)
    if (!template) {
      return res.status(404).send('template not found')
    }

    // Create tasks from template
    const createdTasks = []
    const taskTitleToId = {}

    // First pass: create all tasks
    for (const templateTask of template.tasks) {
      const task = await newTasksStore.create({
        title: templateTask.title,
        description: templateTask.description || '',
        projectId,
        createdBy,
        estimatedHours: templateTask.estimatedHours || null,
        tags: ['from-template', templateId],
        priority: 'P2'
      })

      createdTasks.push(task)
      taskTitleToId[templateTask.title] = task.id
    }

    // Second pass: resolve dependencies and auto-assign
    for (let i = 0; i < template.tasks.length; i++) {
      const templateTask = template.tasks[i]
      const createdTask = createdTasks[i]

      // Resolve dependencies
      const dependencies = (templateTask.dependsOn || []).map(depTitle => {
        return taskTitleToId[depTitle]
      }).filter(Boolean)

      if (dependencies.length > 0) {
        await newTasksStore.updateDependencies(createdTask.id, dependencies, 'system')
      }

      // Auto-assign based on role - update task to include role in description/tags for pattern matching
      const taskWithRole = {
        ...createdTask,
        title: `${createdTask.title} (${templateTask.role})`,
        tags: [...(createdTask.tags || []), templateTask.role]
      }

      await autoAssignTask(taskWithRole, agentsStore, newTasksStore, notificationsStore)
    }

    res.json({
      templateId,
      taskIds: createdTasks.map(t => t.id),
      tasks: createdTasks
    })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// ====== ROUTINES ENDPOINTS ======

app.get('/api/routines', async (_req, res) => {
  try {
    const routines = await routinesStore.getAll()
    const sorted = routines.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    res.json(sorted)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to fetch routines')
  }
})

app.get('/api/routines/:id', async (req, res) => {
  try {
    const routine = await routinesStore.getRoutine(req.params.id)
    if (!routine) return res.status(404).send('routine not found')
    res.json(routine)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to fetch routine')
  }
})

app.post('/api/routines', async (req, res) => {
  try {
    const body = req.body ?? {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : ''

    if (!name) return res.status(400).send('name required')
    if (!schedule) return res.status(400).send('schedule required')

    const routine = await routinesStore.createRoutine({
      name,
      description: typeof body.description === 'string' ? body.description : '',
      schedule,
      taskTemplate: body.taskTemplate || {},
      enabled: body.enabled !== false
    })

    res.status(201).json(routine)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to create routine')
  }
})

app.put('/api/routines/:id', async (req, res) => {
  try {
    const routine = await routinesStore.updateRoutine(req.params.id, req.body)
    if (!routine) return res.status(404).send('routine not found')
    res.json(routine)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to update routine')
  }
})

app.delete('/api/routines/:id', async (req, res) => {
  try {
    const deleted = await routinesStore.deleteRoutine(req.params.id)
    if (!deleted) return res.status(404).send('routine not found')
    res.json({ id: req.params.id, deleted: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to delete routine')
  }
})

app.post('/api/routines/:id/run', async (req, res) => {
  try {
    const routine = await routinesStore.getRoutine(req.params.id)
    if (!routine) return res.status(404).send('routine not found')

    const taskData = {
      title: routine.taskTemplate.title,
      description: routine.taskTemplate.description || `Manual trigger from routine: ${routine.name}`,
      lane: normalizeLane('queued'),
      priority: normalizePriority('P2'),
      tags: routine.taskTemplate.tags || [],
      estimatedHours: routine.taskTemplate.estimatedHours,
      createdBy: 'api'
    }

    let task = await newTasksStore.create(taskData)

    if (routine.taskTemplate.assignedTo) {
      const assignedTo = routine.taskTemplate.assignedTo
      if (assignedTo.startsWith('agent-') || assignedTo.startsWith('dev-')) {
        task = await newTasksStore.update(task.id, { assignedTo }, 'api')

        if (task.assignedTo) {
          await notificationsStore.create({
            agentId: task.assignedTo,
            type: 'task-assigned',
            title: 'New task from routine',
            text: `Task manually triggered from routine: ${routine.name}`,
            taskId: task.id
          })
        }
      } else {
        task = await newTasksStore.update(task.id, {
          tags: [...(task.tags || []), assignedTo]
        }, 'api')
        await autoAssignTask(task, agentsStore, newTasksStore, notificationsStore)
      }
    } else {
      await autoAssignTask(task, agentsStore, newTasksStore, notificationsStore)
    }

    res.json(task)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to run routine')
  }
})

// ====== LEGACY TASK ENDPOINTS (BACKWARD COMPATIBILITY) ======

// Enhanced legacy POST /api/tasks to support lane -> done transition with auto-unblock
app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const task = await newTasksStore.update(req.params.id, { lane: 'done' }, 'api')
    if (!task) return res.status(404).send('task not found')

    // Auto-unblock tasks that depend on this one
    const unblocked = await newTasksStore.handleCompletion(req.params.id)

    res.json({ task, unblocked })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// ====== AI TASK GENERATION ======

app.post('/api/ai/tasks/generate', async (req, res) => {
  try {
    const body = req.body ?? {}
    const request = typeof body.request === 'string' ? body.request.trim() : ''
    if (!request) return res.status(400).send('request required')

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : null
    let context = body.context ?? {}

    // Allow model override
    if (body.model && typeof body.model === 'string') {
      context.model = body.model
    }

    // Generate tasks via AI
    const result = await generateTasksFromPrompt(request, projectId, context)

    res.json(result)
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to generate tasks')
  }
})

// ====== GITHUB INTEGRATION ======

/**
 * Create a GitHub issue for a task
 * POST /api/tasks/:id/github
 */
app.post('/api/tasks/:id/github', async (req, res) => {
  try {
    const taskId = req.params.id
    const repo = req.body?.repo || null

    // Get the task
    const task = await newTasksStore.getTask(taskId)
    if (!task) return res.status(404).send('task not found')

    // Create GitHub issue
    const issueInfo = await github.createGitHubIssue(task, repo)
    if (!issueInfo) {
      return res.status(400).send('failed to create GitHub issue (token may not be configured)')
    }

    // Update task with GitHub issue info
    const updated = await newTasksStore.update(taskId, {
      githubIssue: issueInfo,
    }, 'api')

    res.json({ task: updated, issue: issueInfo })
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to create GitHub issue')
  }
})

/**
 * Get commits linked to a task
 * GET /api/tasks/:id/commits
 */
app.get('/api/tasks/:id/commits', async (req, res) => {
  try {
    const taskId = req.params.id
    const task = await newTasksStore.getTask(taskId)
    if (!task) return res.status(404).send('task not found')

    const commits = task.commits || []
    res.json({ taskId, commits })
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to get commits')
  }
})

/**
 * Link a commit to a task
 * POST /api/tasks/:id/link-commit
 */
app.post('/api/tasks/:id/link-commit', async (req, res) => {
  try {
    const taskId = req.params.id
    const { commitMessage, commitSha, commitUrl } = req.body

    if (!commitMessage || !commitSha || !commitUrl) {
      return res.status(400).send('commitMessage, commitSha, and commitUrl required')
    }

    const task = await newTasksStore.getTask(taskId)
    if (!task) return res.status(404).send('task not found')

    const commitLink = github.linkCommitToTask(commitMessage, commitSha, commitUrl)
    if (!commitLink) {
      return res.status(400).send('no task ID found in commit message')
    }

    // Add to task's commits array
    const commits = task.commits || []
    commits.push(commitLink)

    const updated = await newTasksStore.update(taskId, { commits }, 'api')

    res.json({ task: updated, commit: commitLink })
  } catch (err) {
    res.status(400).send(err?.message ?? 'failed to link commit')
  }
})

/**
 * GitHub webhook handler for PR merge events
 * POST /api/github/webhook
 * 
 * Validates signature and processes PR merge events to auto-move tasks to done
 */
app.post('/api/github/webhook', async (req, res) => {
  try {
    // Get raw body for signature validation
    const rawBody = req.rawBody || JSON.stringify(req.body)
    const signature = req.headers['x-hub-signature-256']

    // Validate webhook signature
    if (!github.validateWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid GitHub webhook signature')
      return res.status(401).send('unauthorized')
    }

    // Parse webhook payload
    const event = github.parseWebhookPayload(req.body)
    if (!event) {
      // Not a PR merge event, just acknowledge
      return res.json({ received: true, processed: false })
    }

    // Extract task IDs from PR body
    const taskIds = github.extractTaskIdsFromPR(event.pr.body)

    if (taskIds.length === 0) {
      return res.json({ received: true, processed: false, reason: 'no task IDs found in PR' })
    }

    // Move tasks to done
    const updated = []
    for (const taskId of taskIds) {
      try {
        const task = await newTasksStore.update(taskId, {
          lane: 'done',
          githubPRMerged: {
            number: event.pr.number,
            url: event.pr.url,
            mergedAt: event.mergedAt,
            mergedBy: event.mergedBy,
          },
        }, 'github-webhook')

        if (task) {
          updated.push(task)

          // Close GitHub issue if enabled
          if (github.autoCloseOnDone && task.githubIssue) {
            await github.closeGitHubIssue(task)
          }
        }
      } catch (err) {
        logger.error(`Failed to update task ${taskId}`, { error: err.message, stack: err.stack })
      }
    }

    res.json({
      received: true,
      processed: true,
      pr: {
        number: event.pr.number,
        url: event.pr.url,
      },
      tasksUpdated: updated.length,
      tasks: updated.map(t => ({ id: t.id, lane: t.lane })),
    })
  } catch (err) {
    logger.error('Webhook error', { error: err.message, stack: err.stack })
    res.status(400).send(err?.message ?? 'webhook processing failed')
  }
})

// Add rawBody middleware for webhook signature validation
const rawBodyMiddleware = express.raw({ type: 'application/json' })
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/github/webhook') {
    rawBodyMiddleware(req, res, next)
  } else {
    next()
  }
})

app.post('/api/calendar/sync', async (req, res) => {
  try {
    const allTasks = newTasksStore.data ?? []
    const result = await calendar.syncAllTaskDeadlines(allTasks)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, reason: err.message })
  }
})

app.post('/api/tasks/:id/calendar', async (req, res) => {
  try {
    const taskId = req.params.id
    const task = await newTasksStore.get(taskId)
    
    if (!task) {
      return res.status(404).json({ success: false, reason: 'Task not found' })
    }

    const result = await calendar.syncTaskToCalendar(task)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, reason: err.message })
  }
})

app.post('/api/tasks/:id/calendar/block', async (req, res) => {
  try {
    const taskId = req.params.id
    const hours = req.body?.hours ?? 1
    const task = await newTasksStore.get(taskId)
    
    if (!task) {
      return res.status(404).json({ success: false, reason: 'Task not found' })
    }

    const result = await calendar.blockTimeOnCalendar(task, hours)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, reason: err.message })
  }
})

app.delete('/api/tasks/:id/calendar', async (req, res) => {
  try {
    const taskId = req.params.id
    const task = await newTasksStore.get(taskId)
    
    if (!task) {
      return res.status(404).json({ success: false, reason: 'Task not found' })
    }

    const result = await calendar.removeTaskFromCalendar(task)
    res.json(result)
  } catch (err) {
    res.status(400).json({ success: false, reason: err.message })
  }
})

app.post('/api/calendar/setup', async (req, res) => {
  try {
    const configured = calendar.isConfigured()
    res.json({
      success: true,
      message: configured ? 'Calendar is configured' : 'Calendar not yet configured',
      configured,
      calendarId: calendar.calendarId
    })
  } catch (err) {
    res.status(400).json({ success: false, reason: err.message })
  }
})

// Telegram Integration Endpoints

/**
 * Test Telegram integration
 * POST /api/integrations/telegram/test
 */
app.post('/api/integrations/telegram/test', async (req, res) => {
  try {
    // Load config
    const configPath = path.join(WORKSPACE, '.clawhub', 'config.json')
    let config = {}
    try {
      const raw = await fs.readFile(configPath, 'utf8')
      config = JSON.parse(raw)
    } catch {
      // Config file might not exist
    }

    const telegramConfig = loadTelegramConfig(config)

    if (!telegramConfig) {
      return res.status(400).json({
        success: false,
        error: 'Telegram not configured. Add botToken and channels to .clawhub/config.json'
      })
    }

    const { chatId } = req.body || {}
    const targetChatId = chatId || telegramConfig.channels?.default

    if (!targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'No chat ID specified and no default channel configured'
      })
    }

    // Send test notification
    const result = await sendTestNotification(telegramConfig.botToken, targetChatId)

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        message: 'Test notification sent to Telegram'
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }
  } catch (err) {
    logger.error('[Telegram] Test error', { error: err.message, stack: err.stack })
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

/**
 * Send manual notification to Telegram
 * POST /api/integrations/telegram/notify
 */
app.post('/api/integrations/telegram/notify', async (req, res) => {
  try {
    const { chatId, message, type, task } = req.body

    // Load config
    const configPath = path.join(WORKSPACE, '.clawhub', 'config.json')
    let config = {}
    try {
      const raw = await fs.readFile(configPath, 'utf8')
      config = JSON.parse(raw)
    } catch {
      // Config file might not exist
    }

    const telegramConfig = loadTelegramConfig(config)

    if (!telegramConfig) {
      return res.status(400).json({
        success: false,
        error: 'Telegram not configured'
      })
    }

    if (!chatId || (!message && !task)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: chatId and (message or task)'
      })
    }

    let finalMessage = message

    // If task provided, format as task notification
    if (task && !message) {
      finalMessage = formatTaskNotification(task, type || 'info', '')
    }

    const result = await sendTelegramNotification(
      telegramConfig.botToken,
      chatId,
      finalMessage,
      type || 'info'
    )

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        message: 'Notification sent to Telegram'
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      })
    }
  } catch (err) {
    logger.error('[Telegram] Notification error', { error: err.message, stack: err.stack })
    res.status(500).json({
      success: false,
      error: err.message
    })
  }
})

// Health endpoints for monitoring
app.get('/health', async (_req, res) => {
  try {
    // Get stats from current data
    const taskStats = {
      total: Array.isArray(tasks) ? tasks.length : 0,
      byStatus: Array.isArray(tasks) ? tasks.reduce((acc, task) => {
        const status = task.lane || 'queued'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {}) : {},
    }
    
    let agentList = []
    try {
      const agents = await agentsStore.getAll()
      agentList = Array.isArray(agents) ? agents : (agents?.agents ? agents.agents : [])
    } catch (e) {
      logger.warn('Failed to load agents for health check', { error: e.message })
    }
    
    const agentStats = {
      total: agentList.length,
      online: Array.isArray(agentList) ? agentList.filter(a => a?.status === 'online').length : 0,
      offline: Array.isArray(agentList) ? agentList.filter(a => a?.status !== 'online').length : 0,
    }
    
    const integrations = {
      github: !!gitHubConfig?.token,
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      googleCalendar: !!process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
    }
    
    const memoryUsage = process.memoryUsage()
    const systemInfo = {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      loadAverage: os.loadavg(),
    }
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '6.3',
      service: 'operator-hub-bridge',
      stats: {
        tasks: taskStats,
        agents: agentStats,
        errors: healthChecker.errorCount,
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      system: systemInfo,
      integrations,
      readiness: {
        ready: existsSync(TASKS_FILE) && existsSync(AGENTS_FILE) && existsSync(ACTIVITY_FILE),
        checks: {
          tasksFileExists: existsSync(TASKS_FILE),
          agentsFileExists: existsSync(AGENTS_FILE),
          activityFileExists: existsSync(ACTIVITY_FILE),
        },
      },
    }
    
    res.json(status)
  } catch (err) {
    logger.error('Health check error', { error: err.message, stack: err.stack })
    res.status(500).json({ status: 'error', message: err.message })
  }
})

app.get('/health/ready', async (_req, res) => {
  try {
    const readiness = healthChecker.getReadinessStatus(WORKSPACE)
    
    if (readiness.ready) {
      res.status(200).json({ ready: true })
    } else {
      logger.warn('Readiness check failed', { checks: readiness.checks })
      res.status(503).json({ ready: false, details: readiness.checks })
    }
  } catch (err) {
    logger.error('Readiness check error', { error: err.message })
    res.status(503).json({ ready: false, error: err.message })
  }
})

app.get('/health/live', (_req, res) => {
  const liveness = healthChecker.getLivenessStatus()
  res.json(liveness)
})

// Keep old endpoint for backward compatibility
app.get('/healthz', (_req, res) => res.send('ok'))

async function flushActivityOnExit() {
  routineExecutor.stop()
  
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
  try {
    await agentsStore.save()
    await newTasksStore.save()
    await notificationsStore.save()
    await templatesStore.save()
    await routinesStore.save()
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

// Create HTTP server for WebSocket upgrade
const server = http.createServer(app)

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' })

const wsClients = new Set()

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected')
  wsClients.add(ws)

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected')
    wsClients.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error)
    wsClients.delete(ws)
  })

  // Send initial connection confirmation
  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }))
})

// Broadcast helper
global.broadcastWS = (type, data) => {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() })
  wsClients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message)
    }
  })
}

server.listen(PORT, '0.0.0.0', () => {
  pushActivity({
    id: newId('bridge'),
    at: new Date().toISOString(),
    level: 'info',
    source: 'operator-hub',
    message: `bridge started on :${PORT}`,
  })
  logger.info(`Operator Hub bridge listening on http://0.0.0.0:${PORT}`)
  logger.info(`WebSocket server ready on ws://0.0.0.0:${PORT}/ws`)
})

// Legacy /api/workers endpoint (transforms agents to WorkerHeartbeat format)
app.get('/api/workers', async (_req, res) => {
  try {
    const agents = await agentsStore.getAll()
    // Transform agents to WorkerHeartbeat format
    const workers = agents.map(agent => {
      const lastBeatIso = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).toISOString() : undefined
      return {
        slot: agent.id,
        label: agent.name,
        status: agent.status === 'online' ? 'active' : agent.status === 'busy' ? 'active' : 'offline',
        task: agent.currentTask || undefined,
        lastBeatAt: lastBeatIso,
        beats: lastBeatIso ? [{ at: lastBeatIso }] : []
      }
    })
    res.json(workers)
  } catch (err) {
    res.status(500).send(err?.message ?? 'list workers failed')
  }
})
