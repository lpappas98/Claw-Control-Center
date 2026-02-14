#!/usr/bin/env node

/**
 * Agent Heartbeat Manager
 * Manages heartbeat processes for all agents
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.dirname(__dirname);

// Agent processes
const agentProcesses = new Map();

// Load agent configuration
async function loadAgentConfig() {
  try {
    const configPath = path.join(ROOT_DIR, 'agents/config.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return config.agents.filter(a => a.autoStart);
  } catch (error) {
    console.error('Failed to load agent config:', error.message);
    return [];
  }
}

// Start heartbeat for an agent
function startAgentHeartbeat(agent) {
  console.log(`Starting heartbeat for ${agent.name} (${agent.id})...`);
  
  const scriptPath = path.join(__dirname, 'agent-heartbeat.mjs');
  
  const childProcess = spawn('node', [scriptPath], {
    env: {
      ...process.env,
      AGENT_WORKSPACE: agent.workspace,
      BRIDGE_URL: 'http://localhost:8787',
      INSTANCE_ID: 'openclaw-bozeman1',
      TAILSCALE_IP: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log output
  childProcess.stdout.on('data', (data) => {
    console.log(`[${agent.id}] ${data.toString().trim()}`);
  });
  
  childProcess.stderr.on('data', (data) => {
    console.error(`[${agent.id}] ERROR: ${data.toString().trim()}`);
  });
  
  // Handle crashes
  childProcess.on('exit', (code) => {
    console.log(`[${agent.id}] Process exited with code ${code}`);
    agentProcesses.delete(agent.id);
    
    // Auto-restart after 5 seconds
    if (code !== 0) {
      console.log(`[${agent.id}] Restarting in 5 seconds...`);
      setTimeout(() => {
        if (!agentProcesses.has(agent.id)) {
          startAgentHeartbeat(agent);
        }
      }, 5000);
    }
  });
  
  agentProcesses.set(agent.id, {
    agent,
    process: childProcess
  });
  
  console.log(`✓ ${agent.name} heartbeat started (PID: ${childProcess.pid})`);
}

// Start all agents
async function startAllAgents() {
  console.log('=== Agent Heartbeat Manager ===\n');
  
  const agents = await loadAgentConfig();
  
  if (agents.length === 0) {
    console.error('No agents configured for auto-start');
    process.exit(1);
  }
  
  console.log(`Starting ${agents.length} agents:\n`);
  
  agents.forEach((agent, index) => {
    // Stagger starts by 2 seconds each
    setTimeout(() => {
      startAgentHeartbeat(agent);
    }, index * 2000);
  });
  
  // Status report
  setTimeout(() => {
    console.log(`\n=== Status ===`);
    console.log(`Active agents: ${agentProcesses.size}`);
    agentProcesses.forEach(({ agent, process: childProcess }) => {
      console.log(`  - ${agent.name} (${agent.id}): PID ${childProcess.pid}`);
    });
    console.log('\nPress Ctrl+C to stop all agents\n');
  }, (agents.length * 2000) + 1000);
}

// Stop all agents
function stopAllAgents() {
  console.log('\n\nStopping all agents...');
  
  agentProcesses.forEach(({ agent, process: childProcess }) => {
    console.log(`Stopping ${agent.name}...`);
    childProcess.kill('SIGINT');
  });
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

// Handle shutdown
process.on('SIGINT', stopAllAgents);
process.on('SIGTERM', stopAllAgents);

// Commands
const command = process.argv[2];

if (command === 'status') {
  console.log('Status check not implemented yet');
  console.log('Use: ps aux | grep agent-heartbeat');
  process.exit(0);
} else if (command === 'stop') {
  console.log('Stopping agents...');
  console.log('Use: pkill -f agent-heartbeat');
  process.exit(0);
} else {
  // Default: start all agents
  startAllAgents().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
