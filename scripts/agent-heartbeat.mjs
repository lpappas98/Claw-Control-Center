#!/usr/bin/env node

/**
 * Agent Heartbeat Runner
 * Runs in each agent's workspace, polls for tasks, sends status updates
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8787';
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const WORKSPACE_DIR = process.env.AGENT_WORKSPACE || process.cwd();

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
      model: modelMatch?.[1]?.trim() || 'ollama/llama3.1:8b@http://192.168.1.21:11434',
      workspace: WORKSPACE_DIR
    };
  } catch (error) {
    console.error('Failed to load IDENTITY.md:', error.message);
    process.exit(1);
  }
}

// Send heartbeat to bridge
async function sendHeartbeat(agent) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/agents/${agent.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: process.env.INSTANCE_ID || 'local',
        tailscaleIP: process.env.TAILSCALE_IP || '',
        status: 'online'
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
      `${BRIDGE_URL}/api/tasks?status=assigned&assignee=${agent.id}`
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
    const success = await sendHeartbeat(agent);
    
    if (success) {
      const tasks = await checkForTasks(agent);
      
      if (tasks.length > 0) {
        console.log(`Found ${tasks.length} assigned task(s):`);
        tasks.forEach(task => {
          console.log(`  - [${task.id}] ${task.title}`);
        });
        await logActivity(`Found ${tasks.length} assigned task(s)`);
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
