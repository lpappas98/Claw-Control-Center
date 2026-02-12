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
   */
  async readHeartbeats() {
    try {
      const content = await fs.readFile(HEARTBEAT_FILE, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty structure
        return { workers: {} };
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
   */
  async updateHeartbeat() {
    try {
      const heartbeats = await this.readHeartbeats();

      heartbeats.workers = heartbeats.workers || {};
      heartbeats.workers[this.slot] = {
        slot: this.slot,
        status: this.status,
        task: this.currentTask,
        taskTitle: this.taskTitle,
        sessionId: this.sessionId,
        lastUpdate: Date.now(),
        startedAt: this.startedAt,
        metadata: {
          workerPid: process.pid,
          workerVersion: WORKER_VERSION,
          restartCount: heartbeats.workers[this.slot]?.metadata?.restartCount || 0,
        },
      };

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
   */
  async spawnSession(task) {
    const sessionLabel = `${this.slot}-${task.id.split('-').pop()}`;
    const prompt = this.buildTaskPrompt(task);

    logger.info(`[${this.slot}] Spawning session for task ${task.id} (label: ${sessionLabel})`);

    try {
      // Use openclaw agent command to spawn session
      // We'll use agent subagent mode which creates a persistent session
      const args = [
        'agent',
        '--session-id', `agent:main:subagent:${sessionLabel}`,
        '--message', prompt,
        '--thinking', 'low',
        '--json'
      ];

      return new Promise((resolve, reject) => {
        const process = spawn('openclaw', args, {
          cwd: task.workingDir || '/home/openclaw/.openclaw/workspace/',
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          if (code !== 0) {
            logger.error(`[${this.slot}] Session spawn failed with code ${code}`);
            logger.error(`[${this.slot}] stderr: ${stderr}`);
            reject(new Error(`Session spawn failed: ${stderr || 'Unknown error'}`));
            return;
          }

          try {
            // Parse JSON response to get session ID
            const response = JSON.parse(stdout);
            const sessionId = `agent:main:subagent:${sessionLabel}`;
            
            logger.info(`[${this.slot}] Session spawned successfully: ${sessionId}`);
            resolve({ sessionId, response });
          } catch (err) {
            logger.error(`[${this.slot}] Failed to parse session spawn response: ${err.message}`);
            reject(new Error(`Failed to parse session response: ${err.message}`));
          }
        });

        process.on('error', (err) => {
          logger.error(`[${this.slot}] Failed to spawn session: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`[${this.slot}] Session spawn error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor session status and detect completion
   */
  async monitorSession(task, sessionId) {
    const startTime = Date.now();
    const timeout = task.timeoutMs || DEFAULT_TIMEOUT_MS;
    
    logger.info(`[${this.slot}] Starting session monitoring (timeout: ${timeout}ms)`);

    const checkInterval = setInterval(async () => {
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

      // Check session status via API
      try {
        const response = await fetch(`${TASK_API_BASE}/sessions`);
        if (!response.ok) {
          logger.warn(`[${this.slot}] Failed to fetch session status: ${response.statusText}`);
          return;
        }

        const sessions = await response.json();
        const session = sessions.find(s => s.id === sessionId || s.label === sessionId);

        if (!session) {
          // Session not found - may have completed
          logger.info(`[${this.slot}] Session not found in active sessions - assuming complete`);
          clearInterval(checkInterval);
          await this.completeTask(task.id, true, sessionId);
          return;
        }

        if (session.completed) {
          clearInterval(checkInterval);
          logger.info(`[${this.slot}] Session completed successfully`);
          await this.completeTask(task.id, true, sessionId);
          return;
        }

        if (session.error || session.status === 'failed') {
          clearInterval(checkInterval);
          logger.error(`[${this.slot}] Session failed: ${session.error || 'Unknown error'}`);
          await this.completeTask(task.id, false, sessionId, session.error);
          return;
        }

        logger.info(`[${this.slot}] Session still running (elapsed: ${Math.round(elapsed / 1000)}s)`);
      } catch (error) {
        logger.error(`[${this.slot}] Error checking session status: ${error.message}`);
      }
    }, SESSION_POLL_INTERVAL_MS);

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
              method: 'PATCH',
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
