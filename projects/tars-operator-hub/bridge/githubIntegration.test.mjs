/**
 * Tests for GitHub Integration
 */

import { describe, it, beforeEach } from 'node:test'
import * as assert from 'node:assert/strict'
import { GitHubIntegration } from './githubIntegration.mjs'

describe('GitHubIntegration', () => {
  let github
  let mockFetch

  beforeEach(() => {
    github = new GitHubIntegration({
      token: 'ghp_testtoken',
      defaultRepo: 'owner/repo',
      webhookSecret: 'test-secret',
    })

    // Mock fetch
    mockFetch = function(url, options) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          number: 42,
          html_url: 'https://github.com/owner/repo/issues/42',
        }),
      })
    }
    global.fetch = mockFetch
  })

  describe('parseTaskIdFromCommit', () => {
    it('should parse #task-123 format', () => {
      const result = github.parseTaskIdFromCommit('fix: auth bug (#task-123)')
      assert.equal(result, '123')
    })

    it('should parse #123 format', () => {
      const result = github.parseTaskIdFromCommit('fix bug #123')
      assert.equal(result, '123')
    })

    it('should parse task:456 format', () => {
      const result = github.parseTaskIdFromCommit('docs: update readme (task:456)')
      assert.equal(result, '456')
    })

    it('should parse task-abc format', () => {
      const result = github.parseTaskIdFromCommit('feat: add user profiles (task-abc)')
      assert.equal(result, 'abc')
    })

    it('should return null if no task ID in message', () => {
      const result = github.parseTaskIdFromCommit('chore: update deps')
      assert.equal(result, null)
    })

    it('should return null for empty message', () => {
      const result = github.parseTaskIdFromCommit('')
      assert.equal(result, null)
    })

    it('should return null for null message', () => {
      const result = github.parseTaskIdFromCommit(null)
      assert.equal(result, null)
    })

    it('should handle multiple task IDs (returns first)', () => {
      const result = github.parseTaskIdFromCommit('fix (#task-123) and (#task-456)')
      assert.equal(result, '123')
    })
  })

  describe('linkCommitToTask', () => {
    it('should link commit to task', () => {
      const message = 'fix: auth issue (#task-123)'
      const sha = 'abc123def456'
      const url = 'https://github.com/owner/repo/commit/abc123def456'

      const result = github.linkCommitToTask(message, sha, url)

      assert.ok(result)
      assert.equal(result.taskId, '123')
      assert.equal(result.sha, 'abc123def456')
      assert.equal(result.url, url)
      assert.equal(result.message, message)
      assert.ok(result.timestamp)
    })

    it('should return null if no task ID in message', () => {
      const result = github.linkCommitToTask('no task here', 'abc123', 'http://test')
      assert.equal(result, null)
    })
  })

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = 'test-payload'
      const signature = 'sha256=5b12467d7c448555779e70d76204105c67d27d1c991f3080c19732f9ac1988ef'

      const isValid = github.validateWebhookSignature(payload, signature)
      assert.equal(isValid, true)
    })

    it('should reject invalid signature', () => {
      const payload = 'test-payload'
      const signature = 'sha256=invalid'

      const isValid = github.validateWebhookSignature(payload, signature)
      assert.equal(isValid, false)
    })

    it('should reject if no webhook secret', () => {
      github = new GitHubIntegration()
      const isValid = github.validateWebhookSignature('payload', 'sha256=abc')
      assert.equal(isValid, false)
    })

    it('should reject if no signature', () => {
      const isValid = github.validateWebhookSignature('payload', null)
      assert.equal(isValid, false)
    })

    it('should reject non-sha256 signatures', () => {
      const isValid = github.validateWebhookSignature('payload', 'sha1=abc123')
      assert.equal(isValid, false)
    })
  })

  describe('parseWebhookPayload', () => {
    it('should parse PR merge event', () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          title: 'Fix auth bug',
          body: 'Fixes #task-456',
          merged: true,
          merged_at: '2024-02-14T12:00:00Z',
          merged_by: { login: 'developer' },
        },
        repository: {
          name: 'repo',
          owner: { login: 'owner' },
          full_name: 'owner/repo',
        },
      }

      const result = github.parseWebhookPayload(payload)

      assert.ok(result)
      assert.equal(result.action, 'merged')
      assert.equal(result.pr.number, 123)
      assert.equal(result.pr.title, 'Fix auth bug')
      assert.equal(result.repo.owner, 'owner')
      assert.equal(result.mergedBy, 'developer')
    })

    it('should return null for closed but not merged PR', () => {
      const payload = {
        action: 'closed',
        pull_request: {
          merged: false,
        },
        repository: {},
      }

      const result = github.parseWebhookPayload(payload)
      assert.equal(result, null)
    })

    it('should return null for null payload', () => {
      const result = github.parseWebhookPayload(null)
      assert.equal(result, null)
    })

    it('should return null for non-PR events', () => {
      const payload = {
        action: 'opened',
        push: {},
        repository: {},
      }

      const result = github.parseWebhookPayload(payload)
      assert.equal(result, null)
    })
  })

  describe('extractTaskIdsFromPR', () => {
    it('should extract task IDs from PR body', () => {
      const prBody = `
        Closes #task-123
        Related to task-456
        Also fixes task:789
      `

      const taskIds = github.extractTaskIdsFromPR(prBody)

      assert.ok(taskIds.includes('123'))
      assert.ok(taskIds.includes('456'))
      assert.ok(taskIds.includes('789'))
    })

    it('should handle various numeric formats', () => {
      const prBody = `
        - #task-123
        - task:456
        - task-789
        - closes task:999
      `

      const taskIds = github.extractTaskIdsFromPR(prBody)

      assert.ok(taskIds.length > 0)
      assert.ok(taskIds.includes('123'))
    })

    it('should return empty array for null body', () => {
      const taskIds = github.extractTaskIdsFromPR(null)
      assert.deepEqual(taskIds, [])
    })

    it('should return empty array if no task IDs', () => {
      const taskIds = github.extractTaskIdsFromPR('No tasks here')
      assert.deepEqual(taskIds, [])
    })

    it('should deduplicate task IDs', () => {
      const prBody = `
        Fixes #task-123
        Also fixes #task-123
        Related to task-123
      `

      const taskIds = github.extractTaskIdsFromPR(prBody)

      assert.equal(taskIds.length, 1)
      assert.equal(taskIds[0], '123')
    })
  })

  describe('constructor and initialization', () => {
    it('should initialize with default config', () => {
      const gh = new GitHubIntegration()
      assert.equal(gh.token, undefined)
      assert.equal(gh.defaultRepo, undefined)
      assert.equal(gh.autoCreateIssues, false)
      assert.equal(gh.autoCloseOnDone, false)
    })

    it('should initialize with provided config', () => {
      const gh = new GitHubIntegration({
        token: 'test-token',
        defaultRepo: 'owner/repo',
        autoCreateIssues: true,
        autoCloseOnDone: true,
      })
      assert.equal(gh.token, 'test-token')
      assert.equal(gh.defaultRepo, 'owner/repo')
      assert.equal(gh.autoCreateIssues, true)
      assert.equal(gh.autoCloseOnDone, true)
    })
  })

  describe('edge cases', () => {
    it('should handle task IDs with underscores', () => {
      const result = github.parseTaskIdFromCommit('fix: (#task_abc_123)')
      assert.equal(result, '_abc_123')
    })

    it('should handle task IDs with numbers', () => {
      const result = github.parseTaskIdFromCommit('fix: (#task-abc-123)')
      assert.equal(result, 'abc')
    })

    it('should handle mixed case task IDs', () => {
      const result = github.parseTaskIdFromCommit('fix: (#task-ABC)')
      assert.equal(result, 'ABC')
    })

    it('should extract multiple task IDs correctly', () => {
      const prBody = 'Fixes #task-100 and #task-200 and task:300'
      const taskIds = github.extractTaskIdsFromPR(prBody)
      assert.equal(taskIds.length, 3)
      assert.ok(taskIds.includes('100'))
      assert.ok(taskIds.includes('200'))
      assert.ok(taskIds.includes('300'))
    })

    it('should handle PR body with no task references', () => {
      const payload = {
        action: 'closed',
        pull_request: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          title: 'Fix bug',
          body: 'This PR has no task references',
          merged: true,
          merged_at: '2024-02-14T12:00:00Z',
          merged_by: { login: 'dev' },
        },
        repository: {
          name: 'repo',
          owner: { login: 'owner' },
          full_name: 'owner/repo',
        },
      }

      const result = github.parseWebhookPayload(payload)
      assert.ok(result)

      const taskIds = github.extractTaskIdsFromPR(result.pr.body)
      assert.equal(taskIds.length, 0)
    })
  })
})
