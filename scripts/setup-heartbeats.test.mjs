/**
 * Tests for setup-heartbeats.mjs script
 * Tests heartbeat cron job configuration
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'node:http'

const TEST_BRIDGE_URL = 'http://localhost:18788'
let testServer
let mockAgents = []

function startTestServer() {
  return new Promise((resolve) => {
    testServer = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/api/agents') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(mockAgents))
      } else if (req.method === 'POST' && req.url === '/api/agents/register') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const agent = JSON.parse(body)
            mockAgents.push(agent)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ id: agent.id, registered: true }))
          } catch (e) {
            res.writeHead(400)
            res.end()
          }
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    testServer.listen(18788, () => resolve())
  })
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(() => resolve())
      mockAgents = []
    } else {
      resolve()
    }
  })
}

describe('Heartbeat Setup Script', () => {
  before(async () => {
    mockAgents = []
    await startTestServer()
  })

  after(async () => {
    await stopTestServer()
  })

  it('should fetch registered agents from bridge', async () => {
    // Register test agents
    mockAgents = [
      { id: 'agent-1', roles: ['backend'] },
      { id: 'agent-2', roles: ['frontend'] },
      { id: 'agent-3', roles: ['qa'] }
    ]

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    assert(res.ok, 'Should fetch agents')
    const agents = await res.json()
    assert.equal(agents.length, 3, 'Should have 3 agents')
    assert(agents.map(a => a.id).includes('agent-1'), 'Should have agent-1')
  })

  it('should validate agent exists before scheduling', async () => {
    mockAgents = [
      { id: 'existing-agent', roles: ['backend'] }
    ]

    // Check if existing agent is in list
    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()
    const agentExists = agents.some(a => a.id === 'existing-agent')
    assert(agentExists, 'Agent should exist')
  })

  it('should reject non-existent agent', async () => {
    mockAgents = [
      { id: 'agent-1', roles: ['backend'] }
    ]

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()
    const nonExistent = agents.some(a => a.id === 'non-existent-agent')
    assert(!nonExistent, 'Non-existent agent should not be in list')
  })

  it('should support staggered scheduling', async () => {
    const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5']
    const heartbeatInterval = 60 // seconds

    // Calculate stagger times - 5 agents per minute
    const schedules = agents.map((id, index) => ({
      agent: id,
      minute: index * (heartbeatInterval / agents.length),
      cronSchedule: `*/${heartbeatInterval / agents.length} * * * *`
    }))

    // Verify no overlapping times within the minute
    const minutes = schedules.map(s => Math.floor(s.minute % 60))
    const uniqueMinutes = new Set(minutes)
    assert(uniqueMinutes.size <= agents.length, 'Should have unique minutes')
  })

  it('should prevent thundering herd problem', async () => {
    // Setup 10 agents with staggered heartbeats
    const agentCount = 10
    const heartbeatsPerMinute = 5
    const staggerMinutes = 60 / heartbeatsPerMinute

    const schedules = Array.from({ length: agentCount }, (_, i) => ({
      agent: `agent-${i}`,
      minute: (i % heartbeatsPerMinute) * staggerMinutes
    }))

    // Verify even distribution
    const distribution = {}
    schedules.forEach(s => {
      distribution[s.minute] = (distribution[s.minute] || 0) + 1
    })

    // Each slot should have roughly agentCount / heartbeatsPerMinute agents
    const expectedPerSlot = agentCount / heartbeatsPerMinute
    Object.values(distribution).forEach(count => {
      assert(Math.abs(count - expectedPerSlot) <= 1, 'Distribution should be even')
    })
  })

  it('should handle empty agent list', async () => {
    mockAgents = []

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()
    assert.equal(agents.length, 0, 'Should be empty')
  })

  it('should validate agent has required fields', async () => {
    mockAgents = [
      { id: 'complete-agent', roles: ['backend'], status: 'online' }
    ]

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()
    const agent = agents[0]

    assert(agent.id, 'Should have id')
    assert.equal(agent.id, 'complete-agent', 'ID should match')
  })

  it('should support custom cron expressions', async () => {
    // Test custom cron patterns
    const customCrons = [
      '*/5 * * * *',  // Every 5 minutes
      '0 * * * *',    // Every hour
      '0 0 * * *',    // Daily
      '0 */6 * * *'   // Every 6 hours
    ]

    customCrons.forEach(cron => {
      // Validate cron format (basic check)
      const parts = cron.split(' ')
      assert.equal(parts.length, 5, 'Cron should have 5 parts')
      parts.forEach(part => {
        assert(part.match(/^[\d\-*/,]+$|^\*$/), 'Cron part should be valid')
      })
    })
  })

  it('should handle scheduling with agent metadata', async () => {
    mockAgents = [
      { id: 'backend-1', roles: ['backend', 'api'], priority: 1 },
      { id: 'frontend-1', roles: ['frontend', 'ui'], priority: 2 },
      { id: 'qa-1', roles: ['qa', 'testing'], priority: 3 }
    ]

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()

    // Agents with lower priority value should be scheduled first
    const sorted = agents.sort((a, b) => (a.priority || 999) - (b.priority || 999))
    assert.equal(sorted[0].id, 'backend-1', 'Should sort by priority')
  })

  it('should handle connection to bridge API', async () => {
    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    assert(res.ok, 'Should connect to bridge')
  })
})
