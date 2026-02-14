import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

const startTime = Date.now()

export class HealthChecker {
  constructor() {
    this.taskStats = { total: 0, byStatus: {} }
    this.agentStats = { total: 0, online: 0, offline: 0 }
    this.errorCount = 0
    this.lastUpdate = Date.now()
  }

  updateTaskStats(tasks) {
    const taskList = Array.isArray(tasks) ? tasks : []
    this.taskStats = {
      total: taskList.length,
      byStatus: taskList.reduce((acc, task) => {
        const status = task.lane || 'queued'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {}),
    }
    this.lastUpdate = Date.now()
  }

  updateAgentStats(agents) {
    const agentList = Array.isArray(agents) ? agents : []
    const online = agentList.filter(a => a.status === 'online').length
    this.agentStats = {
      total: agentList.length,
      online,
      offline: agentList.length - online,
    }
    this.lastUpdate = Date.now()
  }

  recordError() {
    this.errorCount++
  }

  getUptime() {
    return Math.floor((Date.now() - startTime) / 1000)
  }

  getMemoryUsage() {
    const usage = process.memoryUsage()
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
    }
  }

  getCpuUsage() {
    return process.cpuUsage()
  }

  getSystemInfo() {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      loadAverage: os.loadavg(),
    }
  }

  getReadinessStatus(workspace) {
    const required = [
      path.join(workspace, '.clawhub', 'tasks.json'),
      path.join(workspace, '.clawhub', 'agents.json'),
      path.join(workspace, '.clawhub', 'activity.json'),
    ]

    const ready = required.every(file => existsSync(file))
    return {
      ready,
      checks: {
        tasksFileExists: existsSync(required[0]),
        agentsFileExists: existsSync(required[1]),
        activityFileExists: existsSync(required[2]),
      },
    }
  }

  getLivenessStatus() {
    // A simple liveness check: process is running and responding
    return {
      alive: true,
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
    }
  }

  getDetailedStatus(workspace, integrations = {}) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: '6.3',
      service: 'operator-hub-bridge',
      stats: {
        tasks: this.taskStats,
        agents: this.agentStats,
        errors: this.errorCount,
      },
      memory: this.getMemoryUsage(),
      system: this.getSystemInfo(),
      integrations: {
        github: integrations.github ?? false,
        telegram: integrations.telegram ?? false,
        googleCalendar: integrations.calendar ?? false,
      },
      readiness: this.getReadinessStatus(workspace),
    }
  }
}

export const createHealthChecker = () => new HealthChecker()
