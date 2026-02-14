#!/usr/bin/env node

/**
 * Agent Registration Script
 * 
 * Registers an agent with the Claw Control Center bridge.
 * Run on agent startup to announce itself to the system.
 * 
 * Supports:
 * - Individual agent registration
 * - Team-based registration (reads from team config)
 * - Auto-detection of team membership
 * 
 * Usage:
 *   # Register individual agent
 *   node scripts/register-agent.mjs --agent dev-agent --roles backend-dev,frontend-dev
 *   
 *   # Register all agents from team config
 *   node scripts/register-agent.mjs --team alpha
 *   
 *   # Register agent with custom options
 *   node scripts/register-agent.mjs --agent pixel --roles qa,testing --emoji 🎬
 *   node scripts/register-agent.mjs --agent designer --roles design --bridge http://localhost:8787
 */

import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8787'
const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace')
const INSTANCE_ID = process.env.INSTANCE_ID || `openclaw-${os.hostname()}`

/**
 * Get local IP address for Tailscale/routing
 */
function getTailscaleIP() {
  const interfaces = os.networkInterfaces()
  
  // Look for Tailscale interface (100.x.x.x)
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (name.includes('tailscale')) {
      const ipv4 = addrs.find(a => a.family === 'IPv4')
      if (ipv4) return ipv4.address
    }
  }
  
  // Fallback to any private IPv4
  for (const addrs of Object.values(interfaces)) {
    const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.address.startsWith('127.'))
    if (ipv4) return ipv4.address
  }
  
  return '127.0.0.1'
}

/**
 * Validate agent configuration
 */
function validateAgent(agent) {
  const errors = []
  
  if (!agent.id || typeof agent.id !== 'string' || agent.id.length === 0) {
    errors.push('--agent must be a non-empty string')
  }
  
  if (!agent.roles || agent.roles.length === 0) {
    errors.push('--roles must be provided (comma-separated list)')
  }
  
  if (agent.emoji && agent.emoji.length > 2) {
    errors.push('--emoji must be a single character or emoji')
  }
  
  return errors
}

/**
 * Register agent with bridge
 */
async function registerAgent(agent) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agent)
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }
    
    return await response.json()
  } catch (err) {
    throw new Error(`Failed to register with bridge: ${err.message}`)
  }
}

/**
 * Parse command line arguments
 */
function parseOptions() {
  const { values, positionals } = parseArgs({
    options: {
      agent: {
        type: 'string',
        description: 'Agent ID (e.g., dev-agent, pixel)',
        short: 'a'
      },
      team: {
        type: 'string',
        description: 'Team name (e.g., alpha, beta) - registers all team agents',
        short: 't'
      },
      name: {
        type: 'string',
        description: 'Display name (defaults to agent ID)',
        short: 'n'
      },
      roles: {
        type: 'string',
        description: 'Comma-separated roles (e.g., backend-dev,api)',
        short: 'r'
      },
      emoji: {
        type: 'string',
        description: 'Agent emoji/avatar (defaults to 🤖)',
        short: 'e'
      },
      bridge: {
        type: 'string',
        description: 'Bridge URL (defaults to http://localhost:8787)',
        short: 'b'
      },
      model: {
        type: 'string',
        description: 'AI model (defaults to anthropic/claude-haiku-4-5)',
        short: 'm'
      },
      workspace: {
        type: 'string',
        description: 'Workspace path (defaults to OPENCLAW_WORKSPACE)',
        short: 'w'
      },
      help: {
        type: 'boolean',
        description: 'Show help',
        short: 'h'
      }
    },
    strict: true,
    allowPositionals: true
  })

  return { values, positionals }
}

/**
 * Load team configuration
 */
function loadTeamConfig(teamName) {
  const teamPath = path.join(OPENCLAW_WORKSPACE, 'templates', 'teams', `team-${teamName}.json`)
  
  try {
    const content = fs.readFileSync(teamPath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    throw new Error(`Failed to load team config: ${err.message}`)
  }
}

/**
 * Main entry point
 */
async function main() {
  const { values } = parseOptions()
  
  if (values.help) {
    console.log(`
Agent Registration Script
=========================

Register an agent with the Claw Control Center bridge.

Usage:
  node scripts/register-agent.mjs --agent <id> --roles <roles> [options]
  node scripts/register-agent.mjs --team <name> [options]

Options:
  -a, --agent <id>      Agent ID (required unless --team used)
  -t, --team <name>     Team name (e.g., alpha, beta) - registers all agents
  -r, --roles <roles>   Comma-separated roles (required unless --team used)
  -n, --name <name>     Display name (defaults to agent ID)
  -e, --emoji <emoji>   Agent emoji (defaults to 🤖)
  -b, --bridge <url>    Bridge URL (default: http://localhost:8787)
  -m, --model <model>   AI model (default: anthropic/claude-haiku-4-5)
  -w, --workspace <path> Workspace path
  -h, --help            Show this help

Examples:
  Register backend developer:
    node scripts/register-agent.mjs --agent dev-1 --roles backend-dev,api --emoji 🔧

  Register QA agent:
    node scripts/register-agent.mjs --agent qa-1 --roles qa,testing --emoji 🧪

  Register all agents from Team Alpha:
    node scripts/register-agent.mjs --team alpha

  With custom bridge:
    node scripts/register-agent.mjs --agent pixel --roles design \\
      --bridge http://192.168.1.100:8787

Environment Variables:
  BRIDGE_URL              Bridge server URL
  OPENCLAW_WORKSPACE      Workspace path
  INSTANCE_ID             OpenClaw instance identifier
    `)
    process.exit(0)
  }
  
  try {
    const bridgeUrl = values.bridge || BRIDGE_URL
    
    // Team-based registration
    if (values.team) {
      console.log(`📡 Registering Team ${values.team}...`)
      
      const teamConfig = loadTeamConfig(values.team)
      const agents = teamConfig.agents.list
      
      console.log(`   Found ${agents.length} agents`)
      
      let successCount = 0
      for (const agentConfig of agents) {
        try {
          const agent = {
            id: agentConfig.id,
            name: agentConfig.name,
            emoji: agentConfig.emoji || '🤖',
            roles: agentConfig.roles || [],
            model: agentConfig.model || 'anthropic/claude-haiku-4-5',
            workspace: agentConfig.workspace || OPENCLAW_WORKSPACE,
            status: 'online',
            instanceId: INSTANCE_ID,
            tailscaleIP: getTailscaleIP(),
            activeTasks: [],
            teamId: values.team,
            metadata: {
              teamName: teamConfig.name
            }
          }
          
          const errors = validateAgent(agent)
          if (errors.length > 0) {
            console.warn(`⚠️  Skipping ${agent.id}: ${errors.join(', ')}`)
            continue
          }
          
          console.log(`  ↳ ${agent.emoji} ${agent.name}...`)
          const result = await registerAgent(agent)
          console.log(`     ✓ ${result.id}`)
          successCount++
        } catch (err) {
          console.warn(`  ✗ ${agentConfig.name}: ${err.message}`)
        }
      }
      
      console.log(`\n✅ Registered ${successCount}/${agents.length} agents`)
      process.exit(successCount === agents.length ? 0 : 1)
    }
    
    // Individual agent registration
    if (!values.agent) {
      console.error('❌ Error: --agent or --team is required')
      process.exit(1)
    }
    
    if (!values.roles) {
      console.error('❌ Error: --roles is required (or use --team)')
      process.exit(1)
    }
    
    // Parse roles
    const roles = values.roles.split(',').map(r => r.trim()).filter(Boolean)
    
    // Build agent object
    const agent = {
      id: values.agent,
      name: values.name || values.agent,
      emoji: values.emoji || '🤖',
      roles,
      model: values.model || 'anthropic/claude-haiku-4-5',
      workspace: values.workspace || OPENCLAW_WORKSPACE,
      status: 'online',
      instanceId: INSTANCE_ID,
      tailscaleIP: getTailscaleIP(),
      activeTasks: [],
      metadata: {}
    }
    
    // Validate
    const errors = validateAgent(agent)
    if (errors.length > 0) {
      console.error('❌ Validation errors:')
      errors.forEach(err => console.error(`  - ${err}`))
      process.exit(1)
    }
    
    console.log(`📡 Registering agent: ${agent.id} (${agent.emoji})`)
    console.log(`   Roles: ${agent.roles.join(', ')}`)
    console.log(`   Bridge: ${bridgeUrl}`)
    
    const result = await registerAgent(agent)
    
    console.log(`✅ Registration successful!`)
    console.log(`   ID: ${result.id}`)
    console.log(`   Status: ${result.status}`)
    console.log(`   Instance: ${result.instanceId}`)
    console.log(`   IP: ${result.tailscaleIP}`)
    console.log(`   Workspace: ${result.workspace}`)
    
    // Return as JSON for programmatic use
    console.log(JSON.stringify(result))
    process.exit(0)
    
  } catch (err) {
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }
}

main().catch(console.error)
