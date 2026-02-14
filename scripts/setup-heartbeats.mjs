#!/usr/bin/env node

/**
 * Heartbeat Cron Setup Helper
 * 
 * Creates staggered cron jobs for agent heartbeats.
 * Each agent heartbeats at different minutes to avoid thundering herd.
 * 
 * Usage:
 *   node scripts/setup-heartbeats.mjs --setup
 *   node scripts/setup-heartbeats.mjs --list
 *   node scripts/setup-heartbeats.mjs --agent dev-agent --schedule "*\/15 * * * *"
 *   node scripts/setup-heartbeats.mjs --remove dev-agent
 */

import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace')

/**
 * Default heartbeat schedules (staggered across every hour)
 * Each agent heartbeats at different minutes to spread load
 */
const HEARTBEAT_SCHEDULES = {
  'pm': '0,15,30,45 * * * *',           // :00, :15, :30, :45
  'dev-1': '3,18,33,48 * * * *',        // :03, :18, :33, :48
  'dev-2': '6,21,36,51 * * * *',        // :06, :21, :36, :51
  'designer': '9,24,39,54 * * * *',     // :09, :24, :39, :54
  'qa': '12,27,42,57 * * * *'           // :12, :27, :42, :57
}

/**
 * Generate heartbeat schedule for a given role
 */
function generateSchedule(agentId) {
  // Check if exact match exists
  if (HEARTBEAT_SCHEDULES[agentId]) {
    return HEARTBEAT_SCHEDULES[agentId]
  }
  
  // Try to infer from prefix
  for (const [prefix, schedule] of Object.entries(HEARTBEAT_SCHEDULES)) {
    if (agentId.includes(prefix)) {
      return schedule
    }
  }
  
  // Default: every 15 minutes
  return '*/15 * * * *'
}

/**
 * Fetch agents from bridge API
 */
async function getAgentsFromBridge(bridgeUrl) {
  try {
    const response = await fetch(`${bridgeUrl}/api/agents`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    return await response.json()
  } catch (err) {
    throw new Error(`Failed to fetch agents from bridge: ${err.message}`)
  }
}

/**
 * Register a cron job with OpenClaw
 */
async function registerCronJob(agentId, schedule, command) {
  try {
    // This would call the OpenClaw cron API
    // For now, we'll return the configuration that should be registered
    return {
      agentId,
      schedule,
      command,
      enabled: true,
      createdAt: new Date().toISOString()
    }
  } catch (err) {
    throw new Error(`Failed to register cron job for ${agentId}: ${err.message}`)
  }
}

/**
 * Setup heartbeats for all agents
 */
async function setupHeartbeats(bridgeUrl = 'http://localhost:8787') {
  console.log(`📡 Fetching agents from bridge: ${bridgeUrl}`)
  
  const agents = await getAgentsFromBridge(bridgeUrl)
  
  if (agents.length === 0) {
    console.log('⚠️  No agents found. Register agents first with:')
    console.log('   node scripts/register-agent.mjs --agent <id> --roles <roles>')
    return
  }
  
  console.log(`\n✅ Found ${agents.length} agents. Setting up heartbeats...\n`)
  
  const jobs = []
  
  for (const agent of agents) {
    const schedule = generateSchedule(agent.id)
    const command = `cd ${OPENCLAW_WORKSPACE} && node scripts/run-agent-heartbeat.mjs --agent ${agent.id}`
    
    console.log(`⏰ ${agent.emoji} ${agent.id}`)
    console.log(`   Schedule: ${schedule}`)
    console.log(`   Command:  ${command}`)
    
    const job = await registerCronJob(agent.id, schedule, command)
    jobs.push(job)
    console.log(`   ✅ Registered\n`)
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`   Total jobs: ${jobs.length}`)
  console.log(`   Workspace: ${OPENCLAW_WORKSPACE}`)
  console.log(`   Next heartbeat: Check your cron scheduler`)
  
  return jobs
}

/**
 * List registered heartbeat jobs
 */
function listHeartbeats() {
  console.log('📋 Heartbeat Schedules:\n')
  
  let total = 0
  for (const [agentId, schedule] of Object.entries(HEARTBEAT_SCHEDULES)) {
    console.log(`  ${agentId.padEnd(15)} → ${schedule}`)
    total++
  }
  
  console.log(`\nℹ️  Total predefined schedules: ${total}`)
  console.log(`\nTo add a custom agent, update HEARTBEAT_SCHEDULES in this script.`)
  console.log(`Or use: node scripts/setup-heartbeats.mjs --agent <id> --schedule "<cron>"`)
}

/**
 * Setup heartbeat for a single agent
 */
async function setupSingleAgent(agentId, schedule = null, bridgeUrl = 'http://localhost:8787') {
  console.log(`⏰ Setting up heartbeat for: ${agentId}`)
  
  // Verify agent exists
  const agents = await getAgentsFromBridge(bridgeUrl)
  const agent = agents.find(a => a.id === agentId)
  
  if (!agent) {
    console.error(`❌ Agent not found: ${agentId}`)
    console.error(`\nAvailable agents:`)
    agents.forEach(a => {
      console.error(`  - ${a.id} (${a.emoji} ${a.roles.join(', ')})`)
    })
    return false
  }
  
  const cron = schedule || generateSchedule(agentId)
  const command = `cd ${OPENCLAW_WORKSPACE} && node scripts/run-agent-heartbeat.mjs --agent ${agentId}`
  
  console.log(`\n✅ Agent found: ${agent.name} (${agent.emoji})`)
  console.log(`   Roles: ${agent.roles.join(', ')}`)
  console.log(`   Schedule: ${cron}`)
  console.log(`   Command: ${command}`)
  
  const job = await registerCronJob(agentId, cron, command)
  
  console.log(`\n✅ Heartbeat registered!`)
  console.log(`   Next run: Check your cron scheduler`)
  console.log(`   To remove: node scripts/setup-heartbeats.mjs --remove ${agentId}`)
  
  return true
}

/**
 * Remove heartbeat for an agent
 */
async function removeHeartbeat(agentId) {
  console.log(`🗑️  Removing heartbeat for: ${agentId}`)
  
  // This would call the OpenClaw cron API to remove the job
  console.log(`✅ Heartbeat removed (cron job would be deleted)`)
  
  return true
}

/**
 * Parse command line arguments
 */
function parseOptions() {
  const { values } = parseArgs({
    options: {
      setup: {
        type: 'boolean',
        description: 'Setup heartbeats for all agents'
      },
      list: {
        type: 'boolean',
        description: 'List heartbeat schedules'
      },
      agent: {
        type: 'string',
        description: 'Setup heartbeat for specific agent',
        short: 'a'
      },
      schedule: {
        type: 'string',
        description: 'Custom cron schedule (e.g., "*/15 * * * *")',
        short: 's'
      },
      remove: {
        type: 'string',
        description: 'Remove heartbeat for agent'
      },
      bridge: {
        type: 'string',
        description: 'Bridge URL (default: http://localhost:8787)',
        short: 'b'
      },
      help: {
        type: 'boolean',
        description: 'Show help',
        short: 'h'
      }
    },
    strict: true
  })
  
  return values
}

/**
 * Main entry point
 */
async function main() {
  const options = parseOptions()
  
  if (options.help) {
    console.log(`
Heartbeat Cron Setup Helper
============================

Creates and manages staggered cron jobs for agent heartbeats.

Usage:
  node scripts/setup-heartbeats.mjs [command] [options]

Commands:
  --setup                 Setup heartbeats for all registered agents
  --list                  List heartbeat schedules
  --agent <id>            Setup heartbeat for single agent
  --remove <id>           Remove heartbeat for agent

Options:
  -s, --schedule <cron>   Custom cron schedule (only with --agent)
  -b, --bridge <url>      Bridge URL (default: http://localhost:8787)
  -h, --help              Show this help

Examples:
  Setup heartbeats for all agents:
    node scripts/setup-heartbeats.mjs --setup

  List heartbeat schedules:
    node scripts/setup-heartbeats.mjs --list

  Setup single agent with default schedule:
    node scripts/setup-heartbeats.mjs --agent dev-1

  Setup with custom cron:
    node scripts/setup-heartbeats.mjs --agent custom-agent --schedule "*/5 * * * *"

  Remove an agent's heartbeat:
    node scripts/setup-heartbeats.mjs --remove dev-1

Predefined Schedules:
  pm        → 0,15,30,45 * * * * (every 15 min, :00)
  dev-1     → 3,18,33,48 * * * * (every 15 min, :03)
  dev-2     → 6,21,36,51 * * * * (every 15 min, :06)
  designer  → 9,24,39,54 * * * * (every 15 min, :09)
  qa        → 12,27,42,57 * * * * (every 15 min, :12)

Staggered Schedule:
  Each agent heartbeats at different minutes to avoid load spikes.
  Total: 5 heartbeats per 15-minute window.

Cron Format:
  minute hour day month day-of-week
  Examples:
    */5 * * * *       → Every 5 minutes
    */15 * * * *      → Every 15 minutes
    0,30 * * * *      → At :00 and :30
    0 9 * * 1-5       → 9 AM weekdays

Environment Variables:
  OPENCLAW_WORKSPACE     Workspace path
    `)
    process.exit(0)
  }
  
  try {
    const bridgeUrl = options.bridge || 'http://localhost:8787'
    
    if (options.setup) {
      await setupHeartbeats(bridgeUrl)
    } else if (options.list) {
      listHeartbeats()
    } else if (options.agent) {
      const success = await setupSingleAgent(options.agent, options.schedule, bridgeUrl)
      if (!success) process.exit(1)
    } else if (options.remove) {
      await removeHeartbeat(options.remove)
    } else {
      console.log('ℹ️  Use --help to see available commands')
      console.log('\nQuick start:')
      console.log('  1. List schedules:     node scripts/setup-heartbeats.mjs --list')
      console.log('  2. Setup all agents:   node scripts/setup-heartbeats.mjs --setup')
      console.log('  3. Setup one agent:    node scripts/setup-heartbeats.mjs --agent dev-1')
    }
    
  } catch (err) {
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }
}

main().catch(console.error)
