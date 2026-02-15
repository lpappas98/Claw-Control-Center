/**
 * transcriptParser.test.mjs — Unit tests for transcript parsing
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseTranscript } from './transcriptParser.mjs'

describe('transcriptParser', () => {
  it('should handle missing files gracefully', async () => {
    const result = await parseTranscript('/nonexistent/path.jsonl')
    assert.equal(result.duration, null)
    assert.equal(result.totalTokens, null)
    assert.equal(result.model, null)
    assert.equal(result.status, 'unknown')
  })

  it('should parse a valid transcript file', async () => {
    // Use an actual transcript file that exists
    const result = await parseTranscript('/home/openclaw/.openclaw/agents/main/sessions/0004fc61-7ec5-46b2-abc4-21547fae7310.jsonl')
    
    // This file should have metrics
    assert.ok(result.duration !== null, 'Duration should not be null')
    assert.ok(result.totalTokens !== null, 'Total tokens should not be null')
    assert.ok(result.model !== null, 'Model should not be null')
    assert.equal(result.model, 'claude-haiku-4-5')
    assert.equal(result.status, 'completed')
    
    // Basic sanity checks
    assert.ok(result.duration >= 0, 'Duration should be non-negative')
    assert.ok(result.totalTokens > 0, 'Total tokens should be positive')
  })

  it('should handle empty files gracefully', async () => {
    // Create a temp empty file for testing
    const { writeFile, unlink } = await import('node:fs/promises')
    const tempFile = '/tmp/test-empty-transcript.jsonl'
    
    await writeFile(tempFile, '', 'utf-8')
    const result = await parseTranscript(tempFile)
    await unlink(tempFile)
    
    assert.equal(result.duration, null)
    assert.equal(result.totalTokens, null)
    assert.equal(result.model, null)
    assert.equal(result.status, 'unknown')
  })

  it('should handle malformed JSON gracefully', async () => {
    const { writeFile, unlink } = await import('node:fs/promises')
    const tempFile = '/tmp/test-malformed-transcript.jsonl'
    
    await writeFile(tempFile, 'not valid json\n{broken', 'utf-8')
    const result = await parseTranscript(tempFile)
    await unlink(tempFile)
    
    assert.equal(result.duration, null)
    assert.equal(result.totalTokens, null)
    assert.equal(result.model, null)
    assert.equal(result.status, 'unknown')
  })
})
