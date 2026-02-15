/**
 * subAgentRegistry.test.mjs — Unit tests for SubAgentRegistry with transcript metrics
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { SubAgentRegistry } from './subAgentRegistry.mjs'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const TEST_REGISTRY_PATH = '/tmp/test-sub-agent-registry.json'
const TEST_TRANSCRIPT_DIR = '/tmp/test-transcripts'

describe('SubAgentRegistry with transcript metrics', () => {
  let registry

  beforeEach(async () => {
    // Clean up any existing test files
    if (existsSync(TEST_REGISTRY_PATH)) {
      await unlink(TEST_REGISTRY_PATH)
    }
    
    // Create test transcript directory
    await mkdir(TEST_TRANSCRIPT_DIR, { recursive: true })
    
    registry = new SubAgentRegistry(TEST_REGISTRY_PATH)
    await registry.load()
  })

  afterEach(async () => {
    // Clean up
    if (existsSync(TEST_REGISTRY_PATH)) {
      await unlink(TEST_REGISTRY_PATH)
    }
  })

  it('should register a new sub-agent with metric fields initialized to null', async () => {
    await registry.register({
      childSessionKey: 'agent:main:subagent:test-123',
      runId: 'run-456',
      agentId: 'test-agent',
      taskId: 'task-789',
      taskTitle: 'Test Task',
      taskPriority: 'P1',
      taskTag: null,
      spawnedAt: Date.now()
    })

    const entry = registry.getByTaskId('task-789')
    assert.ok(entry, 'Entry should exist')
    assert.equal(entry.duration, null, 'Duration should be null initially')
    assert.equal(entry.totalTokens, null, 'Total tokens should be null initially')
    assert.equal(entry.model, null, 'Model should be null initially')
  })

  it('should extract metrics when marking complete with valid transcript', async () => {
    // Create a test transcript
    const sessionKey = 'agent:main:subagent:test-with-transcript'
    const sessionId = 'test-with-transcript'
    const transcriptPath = `${TEST_TRANSCRIPT_DIR}/${sessionId}.jsonl`
    
    const transcript = [
      { type: 'session', version: 3, id: sessionId, timestamp: '2026-02-15T10:00:00.000Z' },
      { type: 'model_change', modelId: 'claude-haiku-4-5', timestamp: '2026-02-15T10:00:00.100Z' },
      { type: 'message', message: { role: 'user', content: 'test' }, timestamp: '2026-02-15T10:00:01.000Z' },
      { 
        type: 'message', 
        message: { 
          role: 'assistant', 
          content: 'response',
          usage: { totalTokens: 1000 },
          stopReason: 'stop'
        }, 
        timestamp: '2026-02-15T10:00:05.000Z' 
      }
    ].map(e => JSON.stringify(e)).join('\n')
    
    await writeFile(transcriptPath, transcript, 'utf-8')

    // Register the entry
    await registry.register({
      childSessionKey: sessionKey,
      runId: 'run-123',
      agentId: 'test-agent',
      taskId: 'task-with-transcript',
      taskTitle: 'Test Task',
      taskPriority: 'P1',
      taskTag: null,
      spawnedAt: Date.now()
    })

    // Mark complete (this should parse the transcript)
    await registry.markComplete(sessionKey, 'completed')

    const entry = registry.getByTaskId('task-with-transcript')
    assert.ok(entry, 'Entry should exist')
    assert.equal(entry.status, 'completed')
    assert.equal(entry.duration, 4000, 'Duration should be 4000ms (5s - 1s)')
    assert.equal(entry.totalTokens, 1000, 'Total tokens should be 1000')
    assert.equal(entry.model, 'claude-haiku-4-5', 'Model should be claude-haiku-4-5')

    // Clean up transcript
    await unlink(transcriptPath)
  })

  it('should handle missing transcripts gracefully when marking complete', async () => {
    const sessionKey = 'agent:main:subagent:missing-transcript'
    
    await registry.register({
      childSessionKey: sessionKey,
      runId: 'run-123',
      agentId: 'test-agent',
      taskId: 'task-missing',
      taskTitle: 'Test Task',
      taskPriority: 'P1',
      taskTag: null,
      spawnedAt: Date.now()
    })

    // Mark complete without a transcript file
    await registry.markComplete(sessionKey, 'completed')

    const entry = registry.getByTaskId('task-missing')
    assert.ok(entry, 'Entry should exist')
    assert.equal(entry.status, 'completed')
    assert.equal(entry.duration, null, 'Duration should be null')
    assert.equal(entry.totalTokens, null, 'Total tokens should be null')
    assert.equal(entry.model, null, 'Model should be null')
  })
})
