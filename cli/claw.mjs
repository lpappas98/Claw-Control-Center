#!/usr/bin/env node

/**
 * Claw CLI - Agent interface for Claw Control Center
 * 
 * Usage:
 *   claw auth                      # Authenticate agent
 *   claw whoami                    # Show current agent
 *   claw check                     # Check for notifications
 *   claw tasks                     # List my tasks
 *   claw task:view <id>            # View task details
 *   claw task:start <id>           # Start working on task
 *   claw task:stop <id>            # Stop working, log time
 *   claw task:status <id> <status> # Update task status
 *   claw task:comment <id> <text>  # Add comment
 *   claw task:done <id>            # Mark task as done
 */

import { Command } from 'commander'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const program = new Command()

// Config file location
const CONFIG_DIR = path.join(os.homedir(), '.claw')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const TIMER_FILE = path.join(CONFIG_DIR, 'timer.json')

/**
 * Load CLI config
 */
async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Save CLI config
 */
async function saveConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
}

/**
 * Load task timer state
 */
async function loadTimer() {
  try {
    const raw = await fs.readFile(TIMER_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Save task timer state
 */
async function saveTimer(timer) {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(TIMER_FILE, JSON.stringify(timer, null, 2), 'utf8')
}

/**
 * Make API request
 */
async function apiRequest(method, endpoint, body = null) {
  const config = await loadConfig()
  
  if (!config) {
    console.error('❌ Not authenticated. Run: claw auth')
    process.exit(1)
  }

  const url = `${config.bridgeUrl}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }

    return response.json()
  } catch (err) {
    console.error(`❌ API Error: ${err.message}`)
    process.exit(1)
  }
}

/**
 * Format task for display
 */
function formatTask(task) {
  const priority = {
    P0: '🔴',
    P1: '🟠',
    P2: '🟡',
    P3: '⚪'
  }[task.priority] || '⚪'

  const status = {
    queued: '📋',
    development: '🔨',
    review: '👀',
    blocked: '🚫',
    done: '✅'
  }[task.lane] || '❓'

  return `${priority} ${status} ${task.id} - ${task.title}`
}

/**
 * Format duration from milliseconds
 */
function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

// ============================================================================
// Commands
// ============================================================================

program
  .name('claw')
  .description('CLI for OpenClaw agents')
  .version('1.0.0')

/**
 * claw auth
 */
program
  .command('auth')
  .description('Authenticate with Claw Control Center')
  .option('-u, --url <url>', 'Bridge URL', 'http://localhost:8787')
  .option('-a, --agent <id>', 'Agent ID')
  .action(async (options) => {
    const config = {
      bridgeUrl: options.url,
      agentId: options.agent || process.env.CLAW_AGENT_ID || 'unknown'
    }

    // Verify connection
    try {
      const response = await fetch(`${config.bridgeUrl}/api/agents/${config.agentId}`)
      if (response.ok) {
        const agent = await response.json()
        console.log(`✅ Authenticated as: ${agent.name} (${agent.id})`)
      } else {
        console.log(`⚠️  Agent not registered. Bridge URL saved: ${config.bridgeUrl}`)
      }
    } catch (err) {
      console.error(`❌ Could not connect to bridge: ${err.message}`)
      process.exit(1)
    }

    await saveConfig(config)
    console.log(`📝 Config saved to: ${CONFIG_FILE}`)
  })

/**
 * claw whoami
 */
program
  .command('whoami')
  .description('Show current agent identity')
  .action(async () => {
    const config = await loadConfig()
    if (!config) {
      console.error('❌ Not authenticated. Run: claw auth')
      return
    }

    const agent = await apiRequest('GET', `/api/agents/${config.agentId}`)
    
    console.log(`\n👤 ${agent.name} (${agent.emoji})`)
    console.log(`   ID: ${agent.id}`)
    console.log(`   Roles: ${agent.roles?.join(', ') || 'none'}`)
    console.log(`   Status: ${agent.status}`)
    console.log(`   Active tasks: ${agent.activeTasks?.length || 0}`)
    console.log(`   Instance: ${agent.instanceId || 'local'}`)
    console.log()
  })

/**
 * claw check
 */
program
  .command('check')
  .description('Check for new notifications and tasks')
  .action(async () => {
    const config = await loadConfig()
    const notifications = await apiRequest('GET', `/api/agents/${config.agentId}/notifications?unread=true`)
    
    if (notifications.length === 0) {
      console.log('✅ No new notifications')
      return
    }

    console.log(`\n📬 ${notifications.length} new notification(s):\n`)
    
    for (const notif of notifications) {
      const icon = {
        'task-assigned': '📋',
        'task-comment': '💬',
        'task-completed': '✅',
        'task-blocked': '🚫',
        'mention': '👋'
      }[notif.type] || '📢'

      console.log(`${icon} ${notif.title}`)
      console.log(`   ${notif.text}`)
      if (notif.taskId) {
        console.log(`   Task: ${notif.taskId}`)
      }
      console.log()
    }
  })

/**
 * claw tasks
 */
program
  .command('tasks')
  .description('List my tasks')
  .option('-s, --status <status>', 'Filter by status')
  .option('-a, --all', 'Show all tasks (not just mine)')
  .action(async (options) => {
    const config = await loadConfig()
    
    let endpoint = '/api/tasks'
    const params = []
    
    if (!options.all) {
      params.push(`assignedTo=${config.agentId}`)
    }
    
    if (options.status) {
      params.push(`lane=${options.status}`)
    }

    if (params.length > 0) {
      endpoint += '?' + params.join('&')
    }

    const tasks = await apiRequest('GET', endpoint)
    
    if (tasks.length === 0) {
      console.log('✅ No tasks')
      return
    }

    console.log(`\n📋 ${tasks.length} task(s):\n`)
    
    for (const task of tasks) {
      console.log(formatTask(task))
      if (task.estimatedHours) {
        console.log(`   Est: ${task.estimatedHours}h | Actual: ${task.actualHours || 0}h`)
      }
      console.log()
    }
  })

/**
 * claw task:view <id>
 */
program
  .command('task:view <id>')
  .description('View task details')
  .action(async (id) => {
    const task = await apiRequest('GET', `/api/tasks/${id}`)
    
    console.log(`\n📋 ${task.title}`)
    console.log(`   ID: ${task.id}`)
    console.log(`   Status: ${task.lane}`)
    console.log(`   Priority: ${task.priority}`)
    console.log(`   Assigned to: ${task.assignedTo || 'unassigned'}`)
    
    if (task.description) {
      console.log(`\n   ${task.description}`)
    }

    if (task.estimatedHours) {
      console.log(`\n   ⏱️  Estimated: ${task.estimatedHours}h`)
      console.log(`   ⏱️  Actual: ${task.actualHours || 0}h`)
    }

    if (task.dependsOn && task.dependsOn.length > 0) {
      console.log(`\n   ⛓️  Depends on: ${task.dependsOn.join(', ')}`)
    }

    if (task.comments && task.comments.length > 0) {
      console.log(`\n   💬 Comments (${task.comments.length}):`)
      for (const comment of task.comments.slice(-3)) {
        console.log(`      ${comment.by}: ${comment.text}`)
      }
    }

    console.log()
  })

/**
 * claw task:start <id>
 */
program
  .command('task:start <id>')
  .description('Start working on a task')
  .action(async (id) => {
    const config = await loadConfig()
    
    // Update task status to development
    await apiRequest('PUT', `/api/tasks/${id}`, {
      lane: 'development',
      statusNote: 'started working'
    })

    // Start timer
    const timer = await loadTimer()
    timer[id] = {
      taskId: id,
      agentId: config.agentId,
      startTime: Date.now()
    }
    await saveTimer(timer)

    console.log(`✅ Started working on task ${id}`)
    console.log(`⏱️  Timer started`)
  })

/**
 * claw task:stop <id>
 */
program
  .command('task:stop <id>')
  .description('Stop working on a task (logs time)')
  .action(async (id) => {
    const config = await loadConfig()
    const timer = await loadTimer()
    
    if (!timer[id]) {
      console.error('❌ No active timer for this task')
      return
    }

    const elapsed = Date.now() - timer[id].startTime
    const hours = elapsed / (1000 * 60 * 60)

    // Log time
    await apiRequest('POST', `/api/tasks/${id}/time`, {
      agentId: config.agentId,
      hours: Math.round(hours * 100) / 100,
      start: timer[id].startTime,
      end: Date.now()
    })

    // Clear timer
    delete timer[id]
    await saveTimer(timer)

    console.log(`✅ Stopped working on task ${id}`)
    console.log(`⏱️  Time logged: ${formatDuration(elapsed)}`)
  })

/**
 * claw task:status <id> <status>
 */
program
  .command('task:status <id> <status>')
  .description('Update task status (queued|development|review|blocked|done)')
  .action(async (id, status) => {
    await apiRequest('PUT', `/api/tasks/${id}`, {
      lane: status
    })

    console.log(`✅ Task ${id} moved to ${status}`)
  })

/**
 * claw task:comment <id> <text>
 */
program
  .command('task:comment <id> <text>')
  .description('Add a comment to a task')
  .action(async (id, text) => {
    const config = await loadConfig()
    
    await apiRequest('POST', `/api/tasks/${id}/comment`, {
      text,
      by: config.agentId
    })

    console.log(`✅ Comment added to task ${id}`)
  })

/**
 * claw task:done <id>
 */
program
  .command('task:done <id>')
  .description('Mark task as done (moves to review)')
  .action(async (id) => {
    const config = await loadConfig()
    
    // Stop timer if running
    const timer = await loadTimer()
    if (timer[id]) {
      const elapsed = Date.now() - timer[id].startTime
      const hours = elapsed / (1000 * 60 * 60)

      await apiRequest('POST', `/api/tasks/${id}/time`, {
        agentId: config.agentId,
        hours: Math.round(hours * 100) / 100,
        start: timer[id].startTime,
        end: Date.now()
      })

      delete timer[id]
      await saveTimer(timer)
    }

    // Move to review
    await apiRequest('PUT', `/api/tasks/${id}`, {
      lane: 'review',
      statusNote: 'completed'
    })

    console.log(`✅ Task ${id} marked as done (moved to review)`)
  })

/**
 * claw project:view <id>
 */
program
  .command('project:view <id>')
  .description('View project details')
  .action(async (id) => {
    const project = await apiRequest('GET', `/api/pm/projects/${id}`)
    
    console.log(`\n📁 ${project.name}`)
    console.log(`   ID: ${project.id}`)
    console.log(`   Description: ${project.description || 'none'}`)
    
    // Get project tasks
    const tasks = await apiRequest('GET', `/api/tasks?projectId=${id}`)
    console.log(`\n   📋 Tasks: ${tasks.length}`)
    
    const byStatus = tasks.reduce((acc, t) => {
      acc[t.lane] = (acc[t.lane] || 0) + 1
      return acc
    }, {})

    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`      ${status}: ${count}`)
    }

    console.log()
  })

// Parse CLI arguments
program.parse()
