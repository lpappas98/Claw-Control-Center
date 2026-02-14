#!/usr/bin/env node
/**
 * spawn-agents.mjs
 * 
 * Spawns Claw Control Center agents based on OpenClaw config.
 * Run on gateway startup or manually to initialize the agent pool.
 */

import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json')
const BRIDGE_URL = process.env.CLAW_BRIDGE_URL || 'http://localhost:8787'
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789'

async function loadConfig() {
  try {
    const raw = await readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(raw)
    return config.clawControlCenter || null
  } catch (err) {
    console.error(`❌ Failed to load config from ${OPENCLAW_CONFIG}`)
    console.error(err.message)
    return null
  }
}

async function checkBridge() {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`)
    if (!res.ok) throw new Error(`Bridge returned ${res.status}`)
    console.log(`✅ Bridge reachable at ${BRIDGE_URL}`)
    return true
  } catch (err) {
    console.error(`❌ Bridge not reachable at ${BRIDGE_URL}`)
    console.error(`   ${err.message}`)
    console.error(`   Start it with: cd ~/.openclaw/workspace && npm run bridge`)
    return false
  }
}

function createBootstrapTask(agent, bridgeUrl) {
  return `# Agent Bootstrap: ${agent.name} (${agent.id})

You are **${agent.name}** (${agent.emoji}), a specialized agent in the Claw Control Center multi-agent system.

## Your Role
${agent.description || 'No description provided'}

**Your capabilities (roles):** ${agent.roles.join(', ')}

## First-Time Setup

### 1. Register with Bridge

Run this command to register yourself:

\`\`\`bash
curl -X POST ${bridgeUrl}/api/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "${agent.id}",
    "name": "${agent.name}",
    "emoji": "${agent.emoji}",
    "roles": ${JSON.stringify(agent.roles)},
    "model": "${agent.model}",
    "workspace": "~/.openclaw/workspace"
  }'
\`\`\`

**Expected response:**
\`\`\`json
{
  "id": "${agent.id}",
  "status": "online",
  "roles": ${JSON.stringify(agent.roles)}
}
\`\`\`

### 2. Verify Registration

Check that you're registered:

\`\`\`bash
curl ${bridgeUrl}/api/agents/${agent.id}
\`\`\`

### 3. Start Task Workflow

From now on, check for assigned tasks in every heartbeat:

\`\`\`bash
# List tasks assigned to you
curl "${bridgeUrl}/api/tasks?assignedTo=${agent.id}&status=assigned"

# Start working on a task
curl -X POST ${bridgeUrl}/api/tasks/{task-id}/start

# Update task progress
curl -X PUT ${bridgeUrl}/api/tasks/{task-id} \\
  -H "Content-Type: application/json" \\
  -d '{"status": "in_progress", "notes": "Working on it..."}'

# Complete task
curl -X POST ${bridgeUrl}/api/tasks/{task-id}/complete
\`\`\`

## Your Heartbeat

Check for tasks every **15 minutes**. Your schedule:
- Offset: ${getHeartbeatOffset(agent.id)} minutes past the hour
- Pattern: :${String(getHeartbeatOffset(agent.id)).padStart(2, '0')}, :${String(getHeartbeatOffset(agent.id) + 15).padStart(2, '0')}, :${String(getHeartbeatOffset(agent.id) + 30).padStart(2, '0')}, :${String(getHeartbeatOffset(agent.id) + 45).padStart(2, '0')}

**Heartbeat workflow:**
1. Check for assigned tasks
2. If task assigned → start working
3. If no tasks → reply HEARTBEAT_OK
4. Update task status as you progress

## Communication

- **Task assignments** come via the bridge (${bridgeUrl}/api/tasks)
- **Coordination** happens through task updates
- **PM (TARS)** creates and assigns tasks
- **You** work independently and report via task status

## Rules

1. **Only work on assigned tasks** - don't pick up tasks assigned to others
2. **Update task status** - keep the PM informed via status updates
3. **Ask for help** - if blocked, update task with blocker info
4. **Stay in scope** - work on your roles (${agent.roles.join(', ')})
5. **Clean commits** - commit working code, not WIP

## Now: Complete Your Setup

1. Run the registration command above
2. Verify you're registered
3. Reply with "Registration complete, ready for tasks"

Once registered, you'll automatically receive tasks matching your roles.

---

**Your identity:**
- ID: ${agent.id}
- Name: ${agent.name}
- Emoji: ${agent.emoji}
- Roles: ${agent.roles.join(', ')}
- Model: ${agent.model}
`
}

function getHeartbeatOffset(agentId) {
  const offsets = {
    'tars': 0,
    'dev-1': 3,
    'dev-2': 6,
    'qa': 9,
    'architect': 12,
  }
  return offsets[agentId] || Math.floor(Math.random() * 15)
}

async function spawnAgent(agent, bridgeUrl) {
  console.log(`\n📡 Spawning agent: ${agent.name} (${agent.emoji} ${agent.id})`)
  console.log(`   Roles: ${agent.roles.join(', ')}`)
  console.log(`   Model: ${agent.model}`)

  const bootstrapTask = createBootstrapTask(agent, bridgeUrl)

  try {
    // Use sessions_spawn via the gateway
    // Note: This requires OpenClaw gateway to be running and accessible
    const res = await fetch(`${GATEWAY_URL}/api/sessions/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: `claw-agent-${agent.id}`,
        agentId: 'haiku', // Use haiku for spawned agents (cost-effective)
        model: agent.model,
        task: bootstrapTask,
        cleanup: 'keep', // Keep sessions running
        runTimeoutSeconds: 300,
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gateway returned ${res.status}: ${text}`)
    }

    const result = await res.json()
    console.log(`   ✅ Spawned session: ${result.sessionKey || result.label}`)
    return result
  } catch (err) {
    console.error(`   ❌ Failed to spawn: ${err.message}`)
    return null
  }
}

async function main() {
  console.log('🚀 Claw Control Center - Agent Spawn System\n')

  // Load config
  const config = await loadConfig()
  if (!config) {
    console.error('❌ No clawControlCenter config found')
    console.error(`   Add config to ${OPENCLAW_CONFIG}`)
    console.error('   See docs/AUTO_SPAWN_SETUP.md for template')
    process.exit(1)
  }

  if (!config.enabled) {
    console.log('ℹ️  Auto-spawn disabled in config (enabled: false)')
    process.exit(0)
  }

  // Check bridge
  const bridgeOk = await checkBridge()
  if (!bridgeOk) {
    console.error('\n❌ Bridge must be running to spawn agents')
    process.exit(1)
  }

  // Filter agents with autoSpawn=true
  const agentsToSpawn = (config.agents || []).filter(a => a.autoSpawn === true)

  if (agentsToSpawn.length === 0) {
    console.log('\nℹ️  No agents configured with autoSpawn=true')
    console.log('   Set "autoSpawn": true in agent config to enable')
    process.exit(0)
  }

  console.log(`\n📋 Found ${agentsToSpawn.length} agent(s) to spawn:\n`)
  agentsToSpawn.forEach(a => {
    console.log(`   ${a.emoji} ${a.name} (${a.id}) - ${a.roles.join(', ')}`)
  })

  // Spawn agents sequentially
  console.log(`\n🔄 Spawning agents...\n`)
  const results = []
  for (const agent of agentsToSpawn) {
    const result = await spawnAgent(agent, config.bridgeUrl || BRIDGE_URL)
    results.push({ agent, result })
    // Small delay between spawns to avoid overwhelming the gateway
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  // Summary
  const successful = results.filter(r => r.result !== null).length
  const failed = results.length - successful

  console.log(`\n✅ Spawn complete:`)
  console.log(`   ${successful} successful`)
  console.log(`   ${failed} failed`)

  if (failed > 0) {
    console.log(`\n❌ Failed agents:`)
    results
      .filter(r => r.result === null)
      .forEach(r => console.log(`   - ${r.agent.name} (${r.agent.id})`))
  }

  console.log(`\n📊 Next steps:`)
  console.log(`   1. Check agent registration: curl ${config.bridgeUrl || BRIDGE_URL}/api/agents`)
  console.log(`   2. View agents in UI: http://localhost:5173 → Agents tab`)
  console.log(`   3. Create tasks and assign to agents via UI or API`)

  process.exit(failed > 0 ? 1 : 0)
}

main()
