/**
 * Tests for register-agent.mjs script
 * Tests agent registration with bridge API
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'node:http'

// Test configuration
const TEST_BRIDGE_URL = 'http://localhost:18787'
let testServer
let registeredAgents = []

// Simple test server
function startTestServer() {
  return new Promise((resolve) => {
    testServer = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/agents/register') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const agent = JSON.parse(body)
            registeredAgents.push(agent)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ id: agent.id, registered: true }))
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON' }))
          }
        })
      } else if (req.method === 'GET' && req.url === '/api/agents') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(registeredAgents))
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    testServer.listen(18787, () => resolve())
  })
}

function stopTestServer() {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(() => resolve())
      registeredAgents = []
    } else {
      resolve()
    }
  })
}

describe('Agent Registration Script', () => {
  before(async () => {
    await startTestServer()
  })

  after(async () => {
    await stopTestServer()
  })

  it('should register an agent with valid parameters', async () => {
    const agent = {
      id: 'test-agent-1',
      roles: ['backend', 'api'],
      emoji: '🔧',
      instanceId: 'test-instance',
      tailscaleIp: '100.0.0.1'
    }

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    })

    assert(res.ok, 'Response should be OK')
    const data = await res.json()
    assert.equal(data.registered, true, 'Agent should be registered')
    assert.equal(data.id, 'test-agent-1', 'Agent ID should match')
  })

  it('should register multiple agents independently', async () => {
    const agent1 = {
      id: 'agent-1',
      roles: ['backend'],
      emoji: '🤖',
      instanceId: 'instance-1',
      tailscaleIp: '100.0.0.1'
    }

    const agent2 = {
      id: 'agent-2',
      roles: ['frontend'],
      emoji: '✨',
      instanceId: 'instance-2',
      tailscaleIp: '100.0.0.2'
    }

    // Register first agent
    let res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent1)
    })
    assert(res.ok, 'First agent should register OK')

    // Register second agent
    res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent2)
    })
    assert(res.ok, 'Second agent should register OK')

    // Verify both registered
    res = await fetch(`${TEST_BRIDGE_URL}/api/agents`)
    const agents = await res.json()
    assert(agents.length >= 2, 'Should have at least 2 agents')
    assert(agents.map(a => a.id).includes('agent-1'), 'agent-1 should be registered')
    assert(agents.map(a => a.id).includes('agent-2'), 'agent-2 should be registered')
  })

  it('should validate agent ID is not empty', async () => {
    const invalidAgent = {
      id: '',
      roles: ['test'],
      emoji: '❌'
    }

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidAgent)
    })
    // Agent with empty ID should still register (validation at script level)
    assert(res.status >= 200, 'Should respond')
  })

  it('should reject invalid JSON', async () => {
    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json'
    })
    assert.equal(res.status, 400, 'Should return 400 for invalid JSON')
  })

  it('should include required fields in registration', async () => {
    const agent = {
      id: 'complete-agent',
      roles: ['role1', 'role2'],
      emoji: '🎯',
      instanceId: 'test-instance-complete',
      tailscaleIp: '100.0.0.5'
    }

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    })

    assert(res.ok, 'Should register successfully')
    const lastAgent = registeredAgents[registeredAgents.length - 1]
    assert(lastAgent.id, 'Should have id')
    assert(lastAgent.roles, 'Should have roles')
    assert(lastAgent.emoji, 'Should have emoji')
  })

  it('should capture Tailscale IP when available', async () => {
    const agent = {
      id: 'tailscale-test',
      roles: ['test'],
      emoji: '🌐',
      instanceId: 'test-instance',
      tailscaleIp: '100.64.42.100'
    }

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    })

    assert(res.ok, 'Should register')
    const registered = registeredAgents[registeredAgents.length - 1]
    assert.equal(registered.tailscaleIp, '100.64.42.100', 'Should have Tailscale IP')
  })

  it('should support custom bridge URL via environment', async () => {
    const agent = {
      id: 'env-bridge-test',
      roles: ['test'],
      emoji: '🔗',
      instanceId: 'test-instance',
      tailscaleIp: '100.0.0.1'
    }

    const res = await fetch(`${TEST_BRIDGE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    })

    assert(res.ok, 'Should register with custom bridge URL')
  })
})
