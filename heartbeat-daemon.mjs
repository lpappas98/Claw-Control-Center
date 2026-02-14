#!/usr/bin/env node
/**
 * Agent Heartbeat Daemon
 * Sends heartbeats to the bridge API every 30 seconds for all registered agents
 * Runs continuously until killed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.OPERATOR_HUB_WORKSPACE ?? __dirname;
const AGENTS_FILE = path.join(WORKSPACE, '.clawhub', 'agents.json');
const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:8787';
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

let agents = [];

// Load agents from file
async function loadAgents() {
  try {
    const data = fs.readFileSync(AGENTS_FILE, 'utf8');
    agents = JSON.parse(data);
    console.log(`[${new Date().toISOString()}] Loaded ${agents.length} agents`);
    return agents.length > 0;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error loading agents:`, error.message);
    return false;
  }
}

// Send heartbeat for a single agent
function sendHeartbeat(agentId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/agents/${agentId}/heartbeat`, BRIDGE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 2,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(agentId);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write('{}');
    req.end();
  });
}

// Send heartbeats to all agents
async function heartbeatRound() {
  if (agents.length === 0) {
    const loaded = await loadAgents();
    if (!loaded) {
      console.warn(`[${new Date().toISOString()}] No agents loaded, retrying in 30s`);
      return;
    }
  }

  const promises = agents.map(agent => 
    sendHeartbeat(agent.id)
      .then(() => {
        console.log(`[${new Date().toISOString()}] ✓ ${agent.id}`);
      })
      .catch(error => {
        console.error(`[${new Date().toISOString()}] ✗ ${agent.id}: ${error.message}`);
      })
  );

  await Promise.all(promises);
}

// Main loop
async function main() {
  console.log(`[${new Date().toISOString()}] Agent Heartbeat Daemon starting`);
  console.log(`Bridge URL: ${BRIDGE_URL}`);
  console.log(`Interval: ${HEARTBEAT_INTERVAL_MS}ms`);
  console.log(`Agents file: ${AGENTS_FILE}`);

  // Load agents on startup
  await loadAgents();

  // Send heartbeats every 30 seconds
  setInterval(heartbeatRound, HEARTBEAT_INTERVAL_MS);

  // Send initial heartbeat immediately
  await heartbeatRound();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
