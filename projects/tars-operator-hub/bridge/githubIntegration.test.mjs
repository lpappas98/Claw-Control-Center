/**
 * Tests for GitHub Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  describe('createGitHubIssue', () => {
    it('should create a GitHub issue from a task', async () => {
      const task = {
        id: 'task-123',
        title: 'Fix auth bug',
        description: 'Session token expires too quickly',
        priority: 'P0',
        tags: ['bug', 'auth'],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          number: 42,
          html_url: 'https://github.com/owner/repo/issues/42',
        }),
      })

      const result = await github.createGitHubIssue(task)

      expect(result).toEqual({
        number: 42,
        url: 'https://github.com/owner/repo/issues/42',
        repo: 'owner/repo',
      })

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'token ghp_testtoken',
          }),
        })
      )
    })

    it('should return null if no token configured', async () => {
      github = new GitHubIntegration({ defaultRepo: 'owner/repo' })
      const task = { id: 'task-123', title: 'Test' }

      const result = await github.createGitHubIssue(task)
      expect(result).toBeNull()
    })

    it('should return null if no repository specified', async () => {
      github = new GitHubIntegration({ token: 'ghp_test' })
      const task = { id: 'task-123', title: 'Test' }

      const result = await github.createGitHubIssue(task)
      expect(result).toBeNull()
    })

    it('should throw on invalid repo format', async () => {
      const task = { id: 'task-123', title: 'Test' }

      await expect(github.createGitHubIssue(task, 'invalid')).rejects.toThrow(
        'Invalid repository format'
      )
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      })

      const task = { id: 'task-123', title: 'Test' }
      const result = await github.createGitHubIssue(task)
      expect(result).toBeNull()
    })

    it('should use custom repo over default', async () => {
      const task = { id: 'task-123', title: 'Test' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ number: 1, html_url: 'http://test' }),
      })

      await github.createGitHubIssue(task, 'other/repo')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/other/repo/issues',
        expect.any(Object)
      )
    })
  })

  describe('updateGitHubIssue', () => {
    it('should update issue state based on task status', async () => {
      const task = {
        id: 'task-123',
        title: 'Test',
        githubIssue: { repo: 'owner/repo', number: 42 },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'closed' }),
      })

      await github.updateGitHubIssue(task, 'done')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/42',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"state":"closed"'),
        })
      )
    })

    it('should handle blocked status with label', async () => {
      const task = {
        id: 'task-123',
        githubIssue: { repo: 'owner/repo', number: 42 },
        priority: 'P1',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await github.updateGitHubIssue(task, 'blocked')

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.labels).toContain('blocked')
      expect(body.labels).toContain('priority-p1')
    })

    it('should return null if no githubIssue', async () => {
      const task = { id: 'task-123' }
      const result = await github.updateGitHubIssue(task, 'done')
      expect(result).toBeNull()
    })
  })

  describe('closeGitHubIssue', () => {
    it('should close GitHub issue', async () => {
      const task = {
        id: 'task-123',
        githubIssue: { repo: 'owner/repo', number: 42 },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'closed' }),
      })

      const result = await github.closeGitHubIssue(task)

      expect(result).toBeTruthy()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"state":"closed"'),
        })
      )
    })

    it('should return null if no token', async () => {
      github = new GitHubIntegration()
      const task = {
        githubIssue: { repo: 'owner/repo', number: 42 },
      }

      const result = await github.closeGitHubIssue(task)
      expect(result).toBeNull()
    })
  })

  describe('parseTaskIdFromCommit', () => {
    const cases = [
      ['fix: auth bug (#task-123)', 'task-123'],
      ['feat: add user profiles (#task_abc)', 'task_abc'],
      ['docs: update readme (task:456)', '456'],
      ['test: add unit tests (task-xyz)', 'xyz'],
      ['chore: update deps', null],
      ['', null],
      [null, null],
      ['no task here', null],
      ['fix bug #task-END', 'END'],
    ]

    cases.forEach(([message, expectedId]) => {
      it(`should parse "${message}" -> ${expectedId}`, () => {
        const result = github.parseTaskIdFromCommit(message)
        expect(result).toBe(expectedId)
      })
    })
  })

  describe('linkCommitToTask', () => {
    it('should link commit to task', () => {
      const message = 'fix: auth issue (#task-123)'
      const sha = 'abc123def456'
      const url = 'https://github.com/owner/repo/commit/abc123def456'

      const result = github.linkCommitToTask(message, sha, url)

      expect(result).toEqual({
        taskId: 'task-123',
        sha: 'abc123def456',
        url: 'https://github.com/owner/repo/commit/abc123def456',
        message: 'fix: auth issue (#task-123)',
        timestamp: expect.any(String),
      })
    })

    it('should return null if no task ID in message', () => {
      const result = github.linkCommitToTask('no task here', 'abc123', 'http://test')
      expect(result).toBeNull()
    })
  })

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = 'test-payload'
      const signature = 'sha256=d347f65c9d2cfe1abf7d4f21dba54fbe2db73e6eff3c1dbcb1c6df5bba8d97f9'

      const isValid = github.validateWebhookSignature(payload, signature)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = 'test-payload'
      const signature = 'sha256=invalid'

      const isValid = github.validateWebhookSignature(payload, signature)
      expect(isValid).toBe(false)
    })

    it('should reject if no webhook secret', () => {
      github = new GitHubIntegration()
      const isValid = github.validateWebhookSignature('payload', 'sha256=abc')
      expect(isValid).toBe(false)
    })

    it('should reject if no signature', () => {
      const isValid = github.validateWebhookSignature('payload', null)
      expect(isValid).toBe(false)
    })

    it('should reject non-sha256 signatures', () => {
      const isValid = github.validateWebhookSignature('payload', 'sha1=abc123')
      expect(isValid).toBe(false)
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

      expect(result).toEqual({
        action: 'merged',
        pr: {
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          title: 'Fix auth bug',
          body: 'Fixes #task-456',
        },
        repo: {
          name: 'repo',
          owner: 'owner',
          fullName: 'owner/repo',
        },
        mergedAt: '2024-02-14T12:00:00Z',
        mergedBy: 'developer',
      })
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
      expect(result).toBeNull()
    })

    it('should return null for null payload', () => {
      const result = github.parseWebhookPayload(null)
      expect(result).toBeNull()
    })

    it('should return null for non-PR events', () => {
      const payload = {
        action: 'opened',
        push: {},
        repository: {},
      }

      const result = github.parseWebhookPayload(payload)
      expect(result).toBeNull()
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

      expect(taskIds).toContain('123')
      expect(taskIds).toContain('456')
      expect(taskIds).toContain('789')
    })

    it('should handle various formats', () => {
      const prBody = `
        - #task-abc
        - task:def
        - task-123
        - closes task:xyz
      `

      const taskIds = github.extractTaskIdsFromPR(prBody)

      expect(taskIds.length).toBeGreaterThan(0)
      expect(taskIds).toContain('abc')
    })

    it('should return empty array for null body', () => {
      const taskIds = github.extractTaskIdsFromPR(null)
      expect(taskIds).toEqual([])
    })

    it('should return empty array if no task IDs', () => {
      const taskIds = github.extractTaskIdsFromPR('No tasks here')
      expect(taskIds).toEqual([])
    })

    it('should deduplicate task IDs', () => {
      const prBody = `
        Fixes #task-123
        Also fixes #task-123
        Related to task-123
      `

      const taskIds = github.extractTaskIdsFromPR(prBody)

      expect(taskIds.length).toBe(1)
      expect(taskIds[0]).toBe('123')
    })
  })
})
