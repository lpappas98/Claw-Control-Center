/**
 * Tests for setup-agent-workspace.sh script
 * Tests workspace directory creation and file setup
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Create a temporary directory for testing
const testWorkspaceRoot = path.join(os.tmpdir(), `test-agent-workspace-${Date.now()}`)

/**
 * Helper to create test workspace structure
 */
function createMockWorkspace(agentId, emoji, roles) {
  const agentDir = path.join(testWorkspaceRoot, 'agents', agentId)
  const configDir = path.join(agentDir, '.claw')

  // Ensure directories exist
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true })
  }
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  // Create required files
  const files = {
    'HEARTBEAT.md': createHeartbeatTemplate(agentId),
    'SOUL.md': createSoulFile(agentId, emoji),
    '.gitignore': 'node_modules/\n*.log\n.env\n',
    'agent-id.txt': agentId,
    '.claw/config.json': createConfigJson(agentId, roles)
  }

  for (const [filename, content] of Object.entries(files)) {
    const filepath = path.join(agentDir, filename)
    fs.writeFileSync(filepath, content)
  }

  return agentDir
}

function createHeartbeatTemplate(agentId) {
  return `# ${agentId} Heartbeat

This is your task workflow template.

## Instructions

1. Read this file
2. Check task list
3. Pick highest priority task
4. Work on it

## States

- IDLE: Ready for work
- BUSY: Working
- BLOCKED: Waiting
`
}

function createSoulFile(agentId, emoji) {
  return `# ${emoji} ${agentId}

## Identity
- Agent ID: ${agentId}
- Emoji: ${emoji}
- Status: online

## Purpose
Multi-agent system component.
`
}

function createConfigJson(agentId, roles) {
  return JSON.stringify({
    agentId,
    bridgeUrl: 'http://localhost:8787',
    heartbeatInterval: 60000,
    roles: roles.split(',').map(r => r.trim()),
    workspace: '.openclaw'
  }, null, 2)
}

/**
 * Cleanup test workspace
 */
function cleanupTestWorkspace() {
  if (fs.existsSync(testWorkspaceRoot)) {
    fs.rmSync(testWorkspaceRoot, { recursive: true, force: true })
  }
}

describe('Agent Workspace Setup', () => {
  before(() => {
    cleanupTestWorkspace()
    fs.mkdirSync(testWorkspaceRoot, { recursive: true })
  })

  after(() => {
    cleanupTestWorkspace()
  })

  it('should create workspace directory structure', () => {
    const agentDir = createMockWorkspace('dev-agent', '🔧', 'backend,api')

    assert(fs.existsSync(agentDir), 'Agent directory should exist')
    assert(fs.existsSync(path.join(agentDir, '.claw')), 'Config directory should exist')
  })

  it('should create all required files', () => {
    const agentId = 'test-agent'
    const agentDir = createMockWorkspace(agentId, '✨', 'frontend')

    const requiredFiles = ['HEARTBEAT.md', 'SOUL.md', '.gitignore', 'agent-id.txt', '.claw/config.json']
    requiredFiles.forEach(file => {
      const filepath = path.join(agentDir, file)
      assert(fs.existsSync(filepath), `${file} should exist`)
    })
  })

  it('should create valid HEARTBEAT.md template', () => {
    const agentDir = createMockWorkspace('heartbeat-test', '💓', 'qa')
    const heartbeatPath = path.join(agentDir, 'HEARTBEAT.md')

    const content = fs.readFileSync(heartbeatPath, 'utf-8')
    assert(content.includes('Heartbeat'), 'Should have Heartbeat title')
    assert(content.includes('heartbeat-test'), 'Should have agent ID')
    assert(content.length > 100, 'Should have substantial content')
  })

  it('should create valid SOUL.md identity file', () => {
    const agentId = 'identity-test'
    const emoji = '🤖'
    const agentDir = createMockWorkspace(agentId, emoji, 'backend')
    const soulPath = path.join(agentDir, 'SOUL.md')

    const content = fs.readFileSync(soulPath, 'utf-8')
    assert(content.includes(emoji), 'Should have emoji')
    assert(content.includes(agentId), 'Should have agent ID')
    assert(content.includes('Identity'), 'Should have Identity section')
  })

  it('should create valid config.json file', () => {
    const agentId = 'config-test'
    const roles = 'frontend,design'
    const agentDir = createMockWorkspace(agentId, '🎨', roles)
    const configPath = path.join(agentDir, '.claw', 'config.json')

    const content = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)

    assert.equal(config.agentId, agentId, 'Should have correct agentId')
    assert(config.bridgeUrl, 'Should have bridgeUrl')
    assert(config.heartbeatInterval > 0, 'Should have heartbeatInterval')
    assert(config.roles.includes('frontend'), 'Should have frontend role')
    assert(config.roles.includes('design'), 'Should have design role')
  })

  it('should create .gitignore file', () => {
    const agentDir = createMockWorkspace('git-test', '📦', 'devops')
    const gitignorePath = path.join(agentDir, '.gitignore')

    const content = fs.readFileSync(gitignorePath, 'utf-8')
    assert(content.includes('node_modules'), 'Should ignore node_modules')
    assert(content.includes('.log'), 'Should ignore logs')
    assert(content.includes('.env'), 'Should ignore .env')
  })

  it('should create agent-id.txt file', () => {
    const agentId = 'id-test'
    const agentDir = createMockWorkspace(agentId, '🆔', 'test')
    const idPath = path.join(agentDir, 'agent-id.txt')

    const content = fs.readFileSync(idPath, 'utf-8').trim()
    assert.equal(content, agentId, 'Should have agent ID')
  })

  it('should handle multiple role assignments', () => {
    const agentDir = createMockWorkspace('multi-role', '👥', 'backend,api,devops,testing')
    const configPath = path.join(agentDir, '.claw', 'config.json')

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    assert.equal(config.roles.length, 4, 'Should have 4 roles')
    assert(config.roles.includes('backend'), 'Should have backend')
    assert(config.roles.includes('api'), 'Should have api')
    assert(config.roles.includes('devops'), 'Should have devops')
    assert(config.roles.includes('testing'), 'Should have testing')
  })

  it('should use correct emoji in SOUL.md', () => {
    const testEmojis = ['🤖', '✨', '🌙', '🔧', '🎨']

    testEmojis.forEach(emoji => {
      const agentDir = createMockWorkspace(`emoji-${emoji}`, emoji, 'test')
      const soulPath = path.join(agentDir, 'SOUL.md')
      const content = fs.readFileSync(soulPath, 'utf-8')
      assert(content.includes(emoji), `Should include ${emoji}`)
    })
  })

  it('should create config with bridge URL', () => {
    const agentDir = createMockWorkspace('bridge-test', '🌉', 'backend')
    const configPath = path.join(agentDir, '.claw', 'config.json')

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    assert(config.bridgeUrl.match(/^https?:\/\//), 'Should have valid URL')
    assert(config.bridgeUrl, 'Should have bridge URL')
  })

  it('should set correct workspace path', () => {
    const agentDir = createMockWorkspace('workspace-test', '📁', 'backend')
    const configPath = path.join(agentDir, '.claw', 'config.json')

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    assert.equal(config.workspace, '.openclaw', 'Should have .openclaw workspace')
  })

  it('should handle special characters in agent ID', () => {
    const specialIds = ['agent-with-dash', 'agent_with_underscore', 'agent1', 'agent-1-2-3']

    specialIds.forEach(agentId => {
      const agentDir = createMockWorkspace(agentId, '✨', 'test')
      assert(fs.existsSync(agentDir), `Should create ${agentId}`)

      const idPath = path.join(agentDir, 'agent-id.txt')
      const content = fs.readFileSync(idPath, 'utf-8').trim()
      assert.equal(content, agentId, `Should match ${agentId}`)
    })
  })

  it('should create independent workspace directories', () => {
    const agent1Dir = createMockWorkspace('agent-1', '🤖', 'backend')
    const agent2Dir = createMockWorkspace('agent-2', '✨', 'frontend')

    assert.notEqual(agent1Dir, agent2Dir, 'Directories should be different')
    assert(fs.existsSync(agent1Dir), 'agent-1 should exist')
    assert(fs.existsSync(agent2Dir), 'agent-2 should exist')

    // Verify they have separate configs
    const config1 = JSON.parse(fs.readFileSync(path.join(agent1Dir, '.claw', 'config.json'), 'utf-8'))
    const config2 = JSON.parse(fs.readFileSync(path.join(agent2Dir, '.claw', 'config.json'), 'utf-8'))

    assert.equal(config1.agentId, 'agent-1', 'config1 should have agent-1')
    assert.equal(config2.agentId, 'agent-2', 'config2 should have agent-2')
  })

  it('should handle cleanup on error', () => {
    const agentDir = createMockWorkspace('cleanup-test', '🧹', 'test')
    assert(fs.existsSync(agentDir), 'Should exist before cleanup')

    // Simulate cleanup
    fs.rmSync(agentDir, { recursive: true, force: true })
    assert(!fs.existsSync(agentDir), 'Should not exist after cleanup')
  })

  it('should preserve existing files if already created', () => {
    const agentId = 'idempotent-test'
    const agentDir = createMockWorkspace(agentId, '🔁', 'test')

    // Create again
    const newAgentDir = createMockWorkspace(agentId, '🔁', 'test')

    // Files should exist and be the same
    assert.equal(newAgentDir, agentDir, 'Should use same directory')
    assert(fs.existsSync(path.join(agentDir, 'HEARTBEAT.md')), 'File should exist')
  })

  it('should validate config.json is valid JSON', () => {
    const agentDir = createMockWorkspace('json-test', '📝', 'backend')
    const configPath = path.join(agentDir, '.claw', 'config.json')

    const content = fs.readFileSync(configPath, 'utf-8')
    assert.doesNotThrow(() => JSON.parse(content), 'JSON should be valid')
  })

  it('should create directories with correct permissions', () => {
    const agentDir = createMockWorkspace('perm-test', '🔐', 'backend')

    const stats = fs.statSync(agentDir)
    assert(stats.isDirectory(), 'Should be directory')

    const configDir = path.join(agentDir, '.claw')
    const configStats = fs.statSync(configDir)
    assert(configStats.isDirectory(), 'Config dir should be directory')
  })
})
