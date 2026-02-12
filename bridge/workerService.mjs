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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid worker slots
const VALID_SLOTS = ['pm', 'architect', 'dev-1', 'dev-2', 'qa'];

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
const HEARTBEAT_FILE = path.join(__dirname, '../.clawhub/worker-heartbeats.json');

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
    this.isShuttingDown = false;

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

    logger.info(`[${this.slot}] Worker service started (PID: ${process.pid})`);
    logger.info(`[${this.slot}] Heartbeat interval: ${HEARTBEAT_INTERVAL_MS}ms`);
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

    // Stop heartbeat loop
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
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
