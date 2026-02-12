#!/usr/bin/env node

/**
 * Worker Service - Base daemon for Operator Hub workers
 * 
 * This service manages worker lifecycle, heartbeat updates, and state transitions.
 * Each worker runs as a standalone process and maintains real-time status in heartbeats.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid worker slots
const VALID_SLOTS = ['pm', 'architect', 'dev-1', 'dev-2', 'qa'];

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const HEARTBEAT_FILE = path.join(__dirname, '../.clawhub/worker-heartbeats.json');

// Task polling configuration
const TASK_POLL_INTERVAL_MS = 30000; // 30 seconds
const TASK_API_BASE = 'http://localhost:8787/api';
const MAX_BACKOFF_MS = 300000; // 5 minutes
const INITIAL_BACKOFF_MS = 30000; // 30 seconds

// Session monitoring configuration
const SESSION_POLL_INTERVAL_MS = 15000; // 15 seconds
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

// Worker version
const WORKER_VERSION = '1.0.0';

/**
 * Format timestamp for logging
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Logger utility
 */
const logger = {
  info: (...args) => console.log(`[${timestamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${timestamp()}] [ERROR]`, ...args),
};

/**
 * WorkerService - Manages a single worker slot
 */
class WorkerService {
  constructor(slot) {
    if (!VALID_SLOTS.includes(slot)) {
      throw new Error(`Invalid slot: ${slot}. Must be one of: ${VALID_SLOTS.join(', ')}`);
    }

    this.slot = slot;
    this.status = 'idle';
    this.currentTask = null;
    this.taskTitle = null;
    this.sessionId = null;
    this.startedAt = Date.now();
    this.heartbeatInterval = null;
    this.pollInterval = null;
    this.isShuttingDown = false;
    
    // Task polling backoff state
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.consecutiveFailures = 0;

    logger.info(`[${this.slot}] WorkerService initialized`);
  }

  /**
   * Read current heartbeats from disk
   * Handles both object and array formats for backward compatibility
   */
  async readHeartbeats() {
    try {
      const content = await fs.readFile(HEARTBEAT_FILE, 'utf8');
      const data = JSON.parse(content);
      
      // Normalize to array format if in object format
      if (data.workers && !Array.isArray(data.workers)) {
        // Convert object format {workers: {pm: {...}, architect: {...}}}
        // to array format {workers: [{slot: pm, ...}, {slot: architect, ...}]}
        const workersArray = Object.entries(data.workers).map(([slot, workerData]) => ({
          slot,
          ...workerData
        }));
        return { workers: workersArray };
      }
      
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty structure
        return { workers: [] };
      }
      throw error;
    }
  }

  /**
   * Write heartbeat atomically (write temp file, then rename)
   */
  async writeHeartbeat(data) {
    const dir = path.dirname(HEARTBEAT_FILE);
    const tempFile = path.join(dir, `.worker-heartbeats.json.tmp.${process.pid}`);

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write to temp file
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');

      // Atomic rename
      await fs.rename(tempFile, HEARTBEAT_FILE);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * Update heartbeat for this worker
   * Writes in array format: {workers: [{slot, status, ...}]}
   */
  async updateHeartbeat() {
    try {
      const heartbeats = await this.readHeartbeats();

      // Ensure workers is an array (should be from readHeartbeats, but be defensive)
      if (!Array.isArray(heartbeats.workers)) {
        heartbeats.workers = [];
      }
      
      // Find existing worker entry
      const existingIndex = heartbeats.workers.findIndex(w => w.slot === this.slot);
      const restartCount = existingIndex >= 0 ? heartbeats.workers[existingIndex]?.metadata?.restartCount || 0 : 0;
      
      // Remove existing entry
      heartbeats.workers = heartbeats.workers.filter(w => w.slot !== this.slot);
      
      // Add updated entry in array format
      heartbeats.workers.push({
        slot: this.slot,
        status: this.status,
        task: this.currentTask,
        taskTitle: this.taskTitle,
        sessionId: this.sessionId,
        lastBeatAt: new Date().toISOString(),
        lastUpdate: Date.now(),
        startedAt: this.startedAt,
        metadata: {
          workerPid: process.pid,
          workerVersion: WORKER_VERSION,
          restartCount: restartCount,
        },
      });

      await this.writeHeartbeat(heartbeats);
      logger.info(`[${this.slot}] Heartbeat updated: status=${this.status}, task=${this.currentTask || 'none'}`);
    } catch (error) {
      logger.error(`[${this.slot}] Failed to update heartbeat:`, error.message);
    }
  }

  /**
   * Poll for tasks assigned to this worker
   */
  async pollTasks() {
    // Skip if already working
    if (this.status !== 'idle') {
      return;
    }

    try {
      // Fetch all tasks from API
      const response = await fetch(`${TASK_API_BASE}/tasks`);
      if (!response.ok) {
        throw new Error(`Task API returned ${response.status}`);
      }

      const tasks = await response.json();

      // Filter for tasks assigned to this worker in "queued" lane
      const eligibleTasks = tasks.filter(task => 
        task.lane === 'queued' && task.owner === this.slot
      );

      if (eligibleTasks.length === 0) {
        return; // No tasks available
      }

      // Sort by priority (P0=2, P1=1, P2=0), then by createdAt (FIFO)
      const priorityMap = { 'P0': 2, 'P1': 1, 'P2': 0 };
      eligibleTasks.sort((a, b) => {
        const aPriority = priorityMap[a.priority] || 0;
        const bPriority = priorityMap[b.priority] || 0;
        
        if (bPriority !== aPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // FIFO as tiebreaker
        return a.createdAt - b.createdAt;
      });

      // Pick the first matching task
      const task = eligibleTasks[0];
      logger.info(`[${this.slot}] Found task: ${task.title}`);

      // Assign the task
      await this.assignTask(task);

      // Reset backoff on successful poll
      this.consecutiveFailures = 0;
      this.backoffMs = INITIAL_BACKOFF_MS;

    } catch (error) {
      this.consecutiveFailures++;
      const oldBackoff = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      
      logger.error(
        `[${this.slot}] Task polling failed (attempt ${this.consecutiveFailures}): ${error.message}. ` +
        `Retrying in ${this.backoffMs / 1000}s (was ${oldBackoff / 1000}s)`
      );
    }
  }

  /**
   * Assign a task to this worker
   */
  async assignTask(task) {
    try {
      // Update task lane to "development"
      const updateResponse = await fetch(`${TASK_API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane: 'development' })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update task ${task.id}: ${updateResponse.status}`);
      }

      logger.info(`[${this.slot}] Assigned task ${task.id} to worker`);

      // Execute the task (spawn session and monitor)
      await this.executeTask(task);

    } catch (error) {
      logger.error(`[${this.slot}] Failed to assign task ${task.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Start the worker service
   */
  async start() {
    logger.info(`[${this.slot}] Starting worker service...`);

    // Write initial heartbeat
    await this.updateHeartbeat();

    // Start heartbeat loop
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat().catch((error) => {
        logger.error(`[${this.slot}] Heartbeat update failed:`, error.message);
      });
    }, HEARTBEAT_INTERVAL_MS);

    // Start task polling loop
    this.pollInterval = setInterval(() => {
      this.pollTasks().catch((error) => {
        logger.error(`[${this.slot}] Task polling loop error:`, error.message);
      });
    }, TASK_POLL_INTERVAL_MS);

    // Do initial poll immediately
    this.pollTasks().catch((error) => {
      logger.error(`[${this.slot}] Initial task poll failed:`, error.message);
    });

    logger.info(`[${this.slot}] Worker service started (PID: ${process.pid})`);
    logger.info(`[${this.slot}] Heartbeat interval: ${HEARTBEAT_INTERVAL_MS}ms`);
    logger.info(`[${this.slot}] Task poll interval: ${TASK_POLL_INTERVAL_MS}ms`);
  }

  /**
   * Update status and trigger immediate heartbeat
   */
  async updateStatus(status, taskData = {}) {
    const oldStatus = this.status;
    this.status = status;

    // Update task info if provided
    if (taskData.task !== undefined) this.currentTask = taskData.task;
    if (taskData.taskTitle !== undefined) this.taskTitle = taskData.taskTitle;
    if (taskData.sessionId !== undefined) this.sessionId = taskData.sessionId;

    logger.info(`[${this.slot}] State transition: ${oldStatus} → ${status}`);

    // Immediately update heartbeat
    await this.updateHeartbeat();
  }

  /**
   * Stop the worker service gracefully
   */
  async stop() {
    if (this.isShuttingDown) {
      logger.warn(`[${this.slot}] Already shutting down, ignoring duplicate stop request`);
      return;
    }

    this.isShuttingDown = true;
    logger.info(`[${this.slot}] Initiating graceful shutdown...`);

    // Stop session monitor if running
    if (this.sessionMonitorInterval) {
      clearInterval(this.sessionMonitorInterval);
      this.sessionMonitorInterval = null;
      logger.info(`[${this.slot}] Stopped session monitor`);
    }

    // Stop heartbeat loop
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Stop task polling loop
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Mark as offline
    await this.updateStatus('offline', {
      task: null,
      taskTitle: null,
      sessionId: null,
    });

    logger.info(`[${this.slot}] Worker service stopped`);
  }

  /**
   * Reload configuration (placeholder for future use)
   */
  async reload() {
    logger.info(`[${this.slot}] Configuration reload requested`);
    // Future: reload config files, update settings, etc.
    logger.info(`[${this.slot}] Configuration reload complete`);
  }

  /**
   * Build prompt for Claude from task data
   */
  buildTaskPrompt(task) {
    const parts = [
      `You are ${this.slot} for the Operator Hub team.`,
      ``,
      `**Task**: ${task.title}`,
      ``,
    ];

    if (task.problem) {
      parts.push(`**Problem**: ${task.problem}`, ``);
    }

    if (task.scope) {
      parts.push(`**Scope**: ${task.scope}`, ``);
    }

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`**Acceptance Criteria**:`);
      task.acceptanceCriteria.forEach(criterion => {
        parts.push(`- ${criterion}`);
      });
      parts.push(``);
    }

    if (task.workingDir) {
      parts.push(`**Working directory**: ${task.workingDir}`, ``);
    }

    parts.push(
      `**Task ID**: ${task.id}`,
      ``,
      `**Steps**:`,
      `1. Complete the task as described`,
      `2. Test your work`,
      `3. Git add, commit`,
      `4. Update task to "review"`,
      `5. Report completion`,
      ``
    );

    return parts.join('\n');
  }

  /**
   * Spawn a Claude session for task execution
   * 
   * CRITICAL: Spawn detached so we don't wait for process exit.
   * The openclaw agent process IS the session - it runs until work is done.
   * We need to spawn it, get the sessionId, and monitor via API.
   */
  async spawnSession(task) {
    const sessionLabel = `${this.slot}-${task.id.split('-').pop()}`;
    const prompt = this.buildTaskPrompt(task);
    const sessionId = `agent:main:subagent:${sessionLabel}`;

    logger.info(`[${this.slot}] Spawning session for task ${task.id} (sessionId: ${sessionId})`);

    try {
      // Use openclaw agent command to spawn session
      const args = [
        'agent',
        '--session-id', sessionId,
        '--message', prompt,
        '--thinking', 'low'
      ];

      // Spawn DETACHED - don't wait for process to exit!
      // The process IS the session - it will run until work completes
      const proc = spawn('openclaw', args, {
        cwd: task.workingDir || '/home/openclaw/.openclaw/workspace/',
        detached: true,
        stdio: 'ignore'  // Fully detach - no pipes
      });

      // Unref so Node doesn't keep parent alive waiting for child
      proc.unref();

      // Log spawn attempt
      logger.info(`[${this.slot}] Session process spawned (PID: ${proc.pid}), monitoring via API`);

      // Give the session a moment to start up before we try monitoring
      // (OpenClaw needs time to register the session)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify session actually started by checking sessions API
      try {
        const response = await fetch(`${TASK_API_BASE}/sessions`);
        if (response.ok) {
          const sessions = await response.json();
          const session = sessions.find(s => s.id === sessionId || s.label?.includes(sessionLabel));
          
          if (session) {
            logger.info(`[${this.slot}] Session verified active: ${sessionId}`);
          } else {
            logger.warn(`[${this.slot}] Session not yet visible in API, will monitor anyway`);
          }
        }
      } catch (verifyError) {
        logger.warn(`[${this.slot}] Could not verify session start: ${verifyError.message}`);
      }

      return { sessionId };
    } catch (error) {
      logger.error(`[${this.slot}] Session spawn error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor session status and detect completion
   * 
   * Monitors via OpenClaw sessions API, NOT by waiting for process exit.
   * Sessions may complete quickly, so we check immediately and poll regularly.
   */
  async monitorSession(task, sessionId) {
    const startTime = Date.now();
    const timeout = task.timeoutMs || DEFAULT_TIMEOUT_MS;
    
    logger.info(`[${this.slot}] Starting session monitoring (timeout: ${timeout / 1000}s)`);

    // Track consecutive "not found" checks to handle race conditions
    let notFoundCount = 0;
    const MAX_NOT_FOUND = 3; // Give session time to register before assuming completion

    const checkSession = async () => {
      // Update heartbeat to show liveness
      await this.updateHeartbeat();

      // Check for timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > timeout) {
        clearInterval(checkInterval);
        logger.error(`[${this.slot}] Session timeout exceeded (${elapsed}ms > ${timeout}ms)`);
        await this.completeTask(task.id, false, sessionId, 'Session timeout exceeded');
        return;
      }

      // Check session status via OpenClaw CLI (native session management)
      try {
        // Use openclaw sessions list to get current sessions
        const { stdout, stderr, code } = await new Promise((resolve) => {
          const proc = spawn('openclaw', ['sessions', 'list', '--json'], {
            stdio: ['ignore', 'pipe', 'pipe']
          });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          proc.on('close', (code) => {
            resolve({ stdout, stderr, code });
          });

          proc.on('error', (err) => {
            resolve({ stdout: '', stderr: err.message, code: -1 });
          });
        });

        if (code !== 0) {
          logger.warn(`[${this.slot}] Failed to list sessions: ${stderr}`);
          return;
        }

        const sessionData = JSON.parse(stdout);
        const sessions = sessionData.sessions || [];
        
        // Look for our session by key (sessionId)
        const session = sessions.find(s => s.key === sessionId);

        if (!session) {
          notFoundCount++;
          
          // Session not found - could be:
          // 1. Still starting up (wait a bit)
          // 2. Already completed and cleaned up
          // 3. Failed to start
          
          if (notFoundCount >= MAX_NOT_FOUND) {
            // After multiple checks, assume session completed
            logger.info(`[${this.slot}] Session not found after ${notFoundCount} checks - assuming complete`);
            clearInterval(checkInterval);
            await this.completeTask(task.id, true, sessionId);
          } else {
            logger.info(`[${this.slot}] Session not found (${notFoundCount}/${MAX_NOT_FOUND}), will retry`);
          }
          return;
        }

        // Session found - reset not-found counter
        notFoundCount = 0;

        // Check if session has been aborted or has errors
        if (session.abortedLastRun) {
          clearInterval(checkInterval);
          logger.error(`[${this.slot}] Session aborted`);
          await this.completeTask(task.id, false, sessionId, 'Session aborted');
          return;
        }

        // Session is still active - check age
        const sessionAgeMs = session.ageMs || 0;
        const sessionAgeS = Math.round(sessionAgeMs / 1000);

        logger.info(`[${this.slot}] Session active (age: ${sessionAgeS}s, tokens: ${session.totalTokens || 0})`);
        
        // Session will disappear from list when it completes
        // We continue monitoring until it's gone
        
      } catch (error) {
        logger.error(`[${this.slot}] Error checking session status: ${error.message}`);
      }
    };

    // Do immediate check (don't wait for first interval)
    await checkSession();

    // Start polling interval
    const checkInterval = setInterval(checkSession, SESSION_POLL_INTERVAL_MS);

    // Store interval handle so we can clean it up on shutdown
    this.sessionMonitorInterval = checkInterval;
  }

  /**
   * Complete task and update status
   */
  async completeTask(taskId, success, sessionId, errorMessage = null) {
    const newLane = success ? 'review' : 'blocked';
    
    logger.info(`[${this.slot}] Completing task ${taskId}: ${success ? 'SUCCESS' : 'FAILED'} (lane: ${newLane})`);

    try {
      // Update task status via API with retry
      const updateTask = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(`${TASK_API_BASE}/tasks/${taskId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lane: newLane,
                metadata: {
                  completedAt: Date.now(),
                  completedBy: this.slot,
                  sessionId: sessionId,
                  success: success,
                  ...(errorMessage && { error: errorMessage })
                }
              })
            });

            if (response.ok) {
              logger.info(`[${this.slot}] Task ${taskId} updated to ${newLane}`);
              return true;
            }

            logger.warn(`[${this.slot}] Task update attempt ${i + 1} failed: ${response.statusText}`);
            
            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
          } catch (error) {
            logger.error(`[${this.slot}] Task update attempt ${i + 1} error: ${error.message}`);
            if (i < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
          }
        }
        return false;
      };

      await updateTask();

      // Clear session monitor if it exists
      if (this.sessionMonitorInterval) {
        clearInterval(this.sessionMonitorInterval);
        this.sessionMonitorInterval = null;
      }

      // Reset worker to idle state
      await this.updateStatus('idle', {
        task: null,
        taskTitle: null,
        sessionId: null
      });

      logger.info(`[${this.slot}] Worker returned to idle state`);
    } catch (error) {
      logger.error(`[${this.slot}] Error completing task: ${error.message}`);
    }
  }

  /**
   * Handle task assignment and execution
   */
  async executeTask(task) {
    try {
      // Update status to working
      await this.updateStatus('working', {
        task: task.id,
        taskTitle: task.title,
        sessionId: null
      });

      // Spawn session
      const { sessionId } = await this.spawnSession(task);

      // Update heartbeat with session ID
      await this.updateStatus('working', {
        task: task.id,
        taskTitle: task.title,
        sessionId: sessionId
      });

      // Start monitoring
      await this.monitorSession(task, sessionId);

    } catch (error) {
      logger.error(`[${this.slot}] Task execution failed: ${error.message}`);
      await this.completeTask(task.id, false, null, error.message);
    }
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const slot = process.argv[2];

  if (!slot) {
    console.error('Usage: node bridge/workerService.mjs <slot>');
    console.error(`Valid slots: ${VALID_SLOTS.join(', ')}`);
    process.exit(1);
  }

  try {
    // Create worker service
    const worker = new WorkerService(slot);

    // Set up signal handlers
    const shutdown = async (signal) => {
      logger.info(`[${slot}] Received ${signal}, shutting down...`);
      await worker.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Optional: SIGUSR1 for config reload
    process.on('SIGUSR1', () => {
      logger.info(`[${slot}] Received SIGUSR1, reloading configuration...`);
      worker.reload().catch((error) => {
        logger.error(`[${slot}] Config reload failed:`, error.message);
      });
    });

    // Start the service
    await worker.start();

    // Keep process alive
    logger.info(`[${slot}] Worker running. Press Ctrl+C to stop.`);

    // Simulate some work (in real implementation, this would be the task polling loop)
    await new Promise(() => {}); // Run forever until killed
  } catch (error) {
    logger.error(`[${slot}] Fatal error:`, error.message);
    process.exit(1);
  }
}

// Only run if executed directly
if (process.argv[1] === __filename) {
  main();
}

// Export for use as module
export { WorkerService };
