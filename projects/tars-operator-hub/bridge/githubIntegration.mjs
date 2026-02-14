/**
 * GitHub Integration for Claw Control Center
 * 
 * Links tasks to GitHub issues, syncs status, and handles commit references.
 * Uses GitHub REST API (fetch-based) with optional token for authentication.
 */

import { createHmac } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * @typedef {Object} GitHubConfig
 * @property {string} [token] - GitHub personal access token (optional)
 * @property {string} [defaultRepo] - Default repo in format "owner/repo"
 * @property {boolean} [autoCreateIssues] - Auto-create GitHub issues for tasks (default: false)
 * @property {boolean} [autoCloseOnDone] - Auto-close GitHub issues when task done (default: false)
 * @property {string} [webhookSecret] - Secret for validating webhook signatures
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Task ID
 * @property {string} title - Task title
 * @property {string} [description] - Task description
 * @property {string} [lane] - Current lane (queued|development|review|blocked|done)
 * @property {Object} [githubIssue] - Linked GitHub issue
 * @property {string} [githubIssue.repo] - Repository (owner/repo)
 * @property {number} [githubIssue.number] - Issue number
 * @property {string} [githubIssue.url] - Issue URL
 */

/**
 * @typedef {Object} CommitLink
 * @property {string} taskId - Task ID
 * @property {string} sha - Commit SHA
 * @property {string} url - Commit URL
 * @property {string} message - Commit message
 * @property {string} [timestamp] - When linked
 */

class GitHubIntegration {
  /**
   * Initialize GitHub integration
   * @param {GitHubConfig} config 
   */
  constructor(config = {}) {
    this.token = config.token
    this.defaultRepo = config.defaultRepo
    this.autoCreateIssues = config.autoCreateIssues ?? false
    this.autoCloseOnDone = config.autoCloseOnDone ?? false
    this.webhookSecret = config.webhookSecret
    this.apiBase = 'https://api.github.com'
  }

  /**
   * Make authenticated API request to GitHub
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint (without /repos prefix)
   * @param {Object} [body] - Request body
   * @returns {Promise<Object>}
   */
  async _apiCall(method, endpoint, body = null) {
    const url = `${this.apiBase}${endpoint}`
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`
    }

    const options = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} - ${data.message || 'Unknown error'}`)
      }

      return data
    } catch (error) {
      if (!this.token) {
        // Graceful degradation if no token
        return null
      }
      throw error
    }
  }

  /**
   * Create a GitHub issue for a task
   * @param {Task} task 
   * @param {string} [repo] - Repository (defaults to config.defaultRepo)
   * @returns {Promise<{number, url} | null>}
   */
  async createGitHubIssue(task, repo = null) {
    const repository = repo || this.defaultRepo

    if (!repository) {
      console.warn('No repository specified for GitHub issue creation')
      return null
    }

    if (!this.token) {
      console.warn('No GitHub token configured, skipping issue creation')
      return null
    }

    const [owner, repoName] = repository.split('/')
    if (!owner || !repoName) {
      throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo"`)
    }

    const issueBody = []
    if (task.description) {
      issueBody.push(task.description)
    }
    issueBody.push('', `**Task ID:** #${task.id}`)
    if (task.priority) {
      issueBody.push(`**Priority:** ${task.priority}`)
    }

    const payload = {
      title: task.title,
      body: issueBody.join('\n'),
      labels: task.tags ? Array.isArray(task.tags) ? task.tags : [task.tags] : [],
    }

    try {
      const issue = await this._apiCall(
        'POST',
        `/repos/${owner}/${repoName}/issues`,
        payload
      )

      if (issue) {
        return {
          number: issue.number,
          url: issue.html_url,
          repo: repository,
        }
      }
    } catch (error) {
      console.error('Failed to create GitHub issue:', error.message)
      return null
    }

    return null
  }

  /**
   * Update a GitHub issue based on task status
   * @param {Task} task 
   * @param {string} status - Task status/lane
   * @returns {Promise<Object | null>}
   */
  async updateGitHubIssue(task, status) {
    if (!task.githubIssue) {
      return null
    }

    if (!this.token) {
      return null
    }

    const { repo, number } = task.githubIssue
    const [owner, repoName] = repo.split('/')

    // Map task status to GitHub issue state
    const stateMap = {
      'done': 'closed',
      'blocked': 'open',
      'review': 'open',
      'development': 'open',
      'queued': 'open',
    }

    const state = stateMap[status] || 'open'

    const payload = {
      state,
    }

    // Add labels based on lane
    const labels = []
    if (task.priority) {
      labels.push(`priority-${task.priority.toLowerCase()}`)
    }
    if (status === 'blocked') {
      labels.push('blocked')
    }
    if (labels.length > 0) {
      payload.labels = labels
    }

    try {
      const updated = await this._apiCall(
        'PATCH',
        `/repos/${owner}/${repoName}/issues/${number}`,
        payload
      )
      return updated || null
    } catch (error) {
      console.error('Failed to update GitHub issue:', error.message)
      return null
    }
  }

  /**
   * Close a GitHub issue when task is done
   * @param {Task} task 
   * @returns {Promise<Object | null>}
   */
  async closeGitHubIssue(task) {
    if (!task.githubIssue) {
      return null
    }

    if (!this.token) {
      return null
    }

    const { repo, number } = task.githubIssue
    const [owner, repoName] = repo.split('/')

    try {
      const updated = await this._apiCall(
        'PATCH',
        `/repos/${owner}/${repoName}/issues/${number}`,
        { state: 'closed' }
      )
      return updated || null
    } catch (error) {
      console.error('Failed to close GitHub issue:', error.message)
      return null
    }
  }

  /**
   * Parse task ID from commit message
   * Supports formats: #task-123, #123, task:123, task-123
   * @param {string} commitMessage 
   * @returns {string | null}
   */
  parseTaskIdFromCommit(commitMessage) {
    if (!commitMessage) return null

    // Match patterns like #task-123, #123, task:123, task-123
    const patterns = [
      /#task-(\w+)/i,
      /#(\w+)/,
      /task[:-](\w+)/i,
    ]

    for (const pattern of patterns) {
      const match = commitMessage.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  /**
   * Link a commit to a task
   * @param {string} commitMessage 
   * @param {string} commitSha 
   * @param {string} commitUrl 
   * @returns {CommitLink | null}
   */
  linkCommitToTask(commitMessage, commitSha, commitUrl) {
    const taskId = this.parseTaskIdFromCommit(commitMessage)

    if (!taskId) {
      return null
    }

    return {
      taskId,
      sha: commitSha,
      url: commitUrl,
      message: commitMessage,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Validate webhook signature (GitHub uses HMAC-SHA256)
   * @param {string} payload - Raw request body
   * @param {string} signature - X-Hub-Signature-256 header
   * @returns {boolean}
   */
  validateWebhookSignature(payload, signature) {
    if (!this.webhookSecret || !signature) {
      return false
    }

    // GitHub format: sha256=<hash>
    const [algo, hash] = signature.split('=')
    if (algo !== 'sha256') {
      return false
    }

    const computed = createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex')

    return computed === hash
  }

  /**
   * Parse GitHub webhook payload for PR merge event
   * @param {Object} payload - GitHub webhook payload
   * @returns {{action, pr: {number, url, title}, repo, mergedAt} | null}
   */
  parseWebhookPayload(payload) {
    if (!payload) {
      return null
    }

    // Handle pull_request events
    if (payload.action === 'closed' && payload.pull_request) {
      const pr = payload.pull_request
      if (!pr.merged) {
        return null // Not merged, just closed
      }

      return {
        action: 'merged',
        pr: {
          number: pr.number,
          url: pr.html_url,
          title: pr.title,
          body: pr.body,
        },
        repo: {
          name: payload.repository.name,
          owner: payload.repository.owner.login,
          fullName: payload.repository.full_name,
        },
        mergedAt: pr.merged_at,
        mergedBy: pr.merged_by?.login,
      }
    }

    return null
  }

  /**
   * Extract task IDs from a PR body
   * Looks for task references in PR description
   * @param {string} prBody 
   * @returns {string[]}
   */
  extractTaskIdsFromPR(prBody) {
    if (!prBody) return []

    const taskIds = new Set()
    const patterns = [
      /#task-(\w+)/gi,
      /task[:\-\s]+(\w+)/gi,
      /closes\s+#?task-?(\w+)/gi,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(prBody)) !== null) {
        taskIds.add(match[1])
      }
    }

    return Array.from(taskIds)
  }
}

export { GitHubIntegration }
