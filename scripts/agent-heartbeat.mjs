#!/usr/bin/env node

/**
 * Agent Heartbeat Runner with Task Execution
 * Runs in each agent's workspace, polls for tasks, executes them, sends status updates
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8787';
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const WORKSPACE_DIR = process.env.AGENT_WORKSPACE || process.cwd();
const SESSION_CHECK_INTERVAL_MS = 5 * 1000; // 5 seconds

// Agent state
let currentTask = null;
let currentSessionKey = null;

// Read agent identity
async function loadAgentIdentity() {
  try {
    const identityPath = path.join(WORKSPACE_DIR, 'IDENTITY.md');
    const content = await fs.readFile(identityPath, 'utf-8');
    
    // Parse IDENTITY.md for agent info
    const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/);
    const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
    const modelMatch = content.match(/\*\*Model:\*\*\s*(.+)/);
    const agentIdMatch = content.match(/\*\*Agent ID:\*\*\s*(.+)/);
    
    return {
      id: agentIdMatch?.[1]?.trim() || 'unknown',
      name: nameMatch?.[1]?.trim() || 'Unknown Agent',
      role: roleMatch?.[1]?.trim() || 'unknown',
      model: modelMatch?.[1]?.trim() || 'anthropic/claude-haiku-4-5',
      workspace: WORKSPACE_DIR
    };
  } catch (error) {
    console.error('Failed to load IDENTITY.md:', error.message);
    process.exit(1);
  }
}

// Send heartbeat to bridge
async function sendHeartbeat(agent, taskInfo = null) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/agents/${agent.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: process.env.INSTANCE_ID || 'local',
        tailscaleIP: process.env.TAILSCALE_IP || '',
        status: 'online',
        currentTask: taskInfo
      })
    });
    
    if (!response.ok) {
      console.error(`Heartbeat failed: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Heartbeat sent for ${agent.name}`);
    return true;
  } catch (error) {
    console.error('Heartbeat error:', error.message);
    return false;
  }
}

// Check for assigned tasks
async function checkForTasks(agent) {
  try {
    const response = await fetch(
      `${BRIDGE_URL}/api/tasks?lane=queued&owner=${agent.id}`
    );
    
    if (!response.ok) {
      console.error(`Task check failed: ${response.status}`);
      return [];
    }
    
    const tasks = await response.json();
    return tasks;
  } catch (error) {
    console.error('Task check error:', error.message);
    return [];
  }
}

// Claim a task (move to development)
async function claimTask(taskId) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lane: 'development',
        statusHistory: [{
          at: new Date().toISOString(),
          to: 'development',
          note: 'claimed by agent'
        }]
      })
    });
    
    if (!response.ok) {
      console.error(`Task claim failed: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Task claim error:', error.message);
    return false;
  }
}

// Update task status
async function updateTaskStatus(taskId, lane, note) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lane,
        updatedAt: new Date().toISOString(),
        statusHistory: [{
          at: new Date().toISOString(),
          to: lane,
          note
        }]
      })
    });
    
    if (!response.ok) {
      console.error(`Task update failed: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Task update error:', error.message);
    return false;
  }
}

// Spawn OpenClaw session to execute task
async function spawnTaskSession(agent, task) {
  return new Promise((resolve, reject) => {
    // Build task brief for agent
    const taskBrief = buildTaskBrief(task);
    
    console.log(`\n=== Spawning session for task ${task.id} ===`);
    console.log(`Task: ${task.title}`);
    console.log(`Model: ${agent.model}`);
    
    // Spawn openclaw agent session with the task as a message
    // Use --local mode with agent's model configured in gateway
    const proc = spawn('openclaw', [
      'agent',
      '--message', taskBrief,
      '--json',
      '--local',
      '--thinking', 'low',
      '--session-id', `agent-${agent.id}-${task.id}`
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    let stdout = '';
    let stderr = '';
    let sessionKey = null;
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Extract session key from output
      const keyMatch = output.match(/Session:\s+([a-z0-9-]+)/i);
      if (keyMatch) {
        sessionKey = keyMatch[1];
        console.log(`Session started: ${sessionKey}`);
      }
      
      process.stdout.write(output);
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    proc.on('close', (code) => {
      console.log(`\n=== Session ended (exit code: ${code}) ===`);
      
      if (code === 0) {
        resolve({ success: true, sessionKey, stdout, stderr });
      } else {
        resolve({ success: false, sessionKey, stdout, stderr, exitCode: code });
      }
    });
    
    proc.on('error', (error) => {
      console.error('Spawn error:', error);
      reject(error);
    });
  });
}

// Build task brief for agent session
function buildTaskBrief(task) {
  let brief = `# Task: ${task.title}\n\n`;
  brief += `**Task ID:** ${task.id}\n`;
  brief += `**Priority:** ${task.priority}\n\n`;
  
  if (task.problem) {
    brief += `## Problem\n${task.problem}\n\n`;
  }
  
  if (task.scope) {
    brief += `## Scope\n${task.scope}\n\n`;
  }
  
  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    brief += `## Acceptance Criteria\n`;
    task.acceptanceCriteria.forEach((criterion, i) => {
      brief += `${i + 1}. ${criterion}\n`;
    });
    brief += '\n';
  }
  
  brief += `## Instructions\n`;
  brief += `Complete this task according to the scope and acceptance criteria above.\n`;
  brief += `When done, update your work log and move the task to review status.\n`;
  
  return brief;
}

// Execute a task
async function executeTask(agent, task) {
  console.log(`\n>>> Executing task: ${task.title}`);
  await logActivity(`Starting task: ${task.id} - ${task.title}`);
  
  // Claim the task
  const claimed = await claimTask(task.id);
  if (!claimed) {
    console.error('Failed to claim task');
    return;
  }
  
  currentTask = task;
  await sendHeartbeat(agent, { id: task.id, title: task.title });
  
  try {
    // Spawn session to do the work
    const result = await spawnTaskSession(agent, task);
    
    if (result.success) {
      console.log('✅ Task completed successfully');
      await updateTaskStatus(task.id, 'review', 'completed by agent');
      await logActivity(`Completed task: ${task.id}`);
    } else {
      console.log('❌ Task failed');
      await updateTaskStatus(task.id, 'blocked', `failed with exit code ${result.exitCode}`);
      await logActivity(`Failed task: ${task.id} (exit code: ${result.exitCode})`);
    }
  } catch (error) {
    console.error('Task execution error:', error);
    await updateTaskStatus(task.id, 'blocked', `error: ${error.message}`);
    await logActivity(`Error executing task: ${task.id} - ${error.message}`);
  } finally {
    currentTask = null;
    currentSessionKey = null;
    await sendHeartbeat(agent, null);
  }
}

// Log activity to workspace
async function logActivity(message) {
  const logPath = path.join(WORKSPACE_DIR, 'heartbeat.log');
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logLine);
  } catch (error) {
    console.error('Failed to write log:', error.message);
  }
}

// Main heartbeat loop
async function runHeartbeat() {
  const agent = await loadAgentIdentity();
  
  console.log(`Starting heartbeat for ${agent.name} (${agent.id})`);
  console.log(`Workspace: ${agent.workspace}`);
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Interval: ${HEARTBEAT_INTERVAL_MS / 1000}s\n`);
  
  await logActivity(`Agent started: ${agent.name} (${agent.id})`);
  
  // Initial heartbeat
  await sendHeartbeat(agent);
  
  // Check for tasks every interval
  setInterval(async () => {
    // Don't check for new tasks if already working
    if (currentTask) {
      console.log(`Already working on task: ${currentTask.title}`);
      await sendHeartbeat(agent, { id: currentTask.id, title: currentTask.title });
      return;
    }
    
    const success = await sendHeartbeat(agent, null);
    
    if (success) {
      const tasks = await checkForTasks(agent);
      
      if (tasks.length > 0) {
        console.log(`Found ${tasks.length} assigned task(s):`);
        tasks.forEach(task => {
          console.log(`  - [${task.priority}] ${task.id}: ${task.title}`);
        });
        await logActivity(`Found ${tasks.length} assigned task(s)`);
        
        // Pick highest priority task
        const sortedTasks = tasks.sort((a, b) => {
          const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
          return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
        });
        
        const nextTask = sortedTasks[0];
        console.log(`\n→ Picking task: [${nextTask.priority}] ${nextTask.title}`);
        
        // Execute the task (async, but setInterval will wait)
        await executeTask(agent, nextTask);
      } else {
        console.log('No assigned tasks');
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
  
  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await logActivity('Agent stopped');
    process.exit(0);
  });
}

// Start heartbeat
runHeartbeat().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
