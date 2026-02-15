/**
 * Tests for work tracking API endpoints
 * POST /api/tasks/:id/commits
 * POST /api/tasks/:id/files
 * POST /api/tasks/:id/tests
 * POST /api/tasks/:id/artifacts
 * GET /api/tasks/:id/work-done
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const API_BASE = 'http://localhost:8787'
const TEST_TASK_ID = `task-worktest-${Date.now()}`
const TASK_WORK_DIR = path.join(process.cwd(), '.clawhub', 'task-work')

describe('Work Tracking API', () => {
  let testTaskId = null

  before(async () => {
    // Create a test task
    const response = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Work Tracking Test Task',
        description: 'Test task for work tracking endpoints',
        lane: 'development',
        priority: 'P1',
        assignedTo: 'test-agent'
      })
    })

    assert.ok(response.ok, `Failed to create test task: ${response.status}`)
    const task = await response.json()
    testTaskId = task.id
    console.log(`Created test task: ${testTaskId}`)
  })

  after(async () => {
    // Clean up test task
    if (testTaskId) {
      await fetch(`${API_BASE}/api/tasks/${testTaskId}`, {
        method: 'DELETE'
      })
      
      // Clean up work data file
      const workFilePath = path.join(TASK_WORK_DIR, `${testTaskId}.json`)
      try {
        await fs.unlink(workFilePath)
      } catch (err) {
        // Ignore if file doesn't exist
      }
      
      console.log(`Cleaned up test task: ${testTaskId}`)
    }
  })

  describe('POST /api/tasks/:id/commits', () => {
    it('should log commits to task', async () => {
      const commits = [
        {
          hash: 'abc123def456',
          message: 'feat: implement work tracking',
          timestamp: new Date().toISOString()
        },
        {
          hash: 'def789ghi012',
          message: 'fix: correct validation logic',
          timestamp: new Date().toISOString()
        }
      ]

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commits })
      })

      assert.equal(response.status, 200, `Expected 200, got ${response.status}`)
      const result = await response.json()
      
      assert.ok(result.commits, 'Response should include commits')
      assert.equal(result.commits.length, 2, 'Should have 2 commits')
      assert.equal(result.commitCount, 2, 'Summary should show 2 commits')
    })

    it('should reject commits without required fields', async () => {
      const invalidCommit = { message: 'missing hash and timestamp' }

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidCommit)
      })

      assert.equal(response.status, 400, 'Should reject invalid commit')
    })

    it('should avoid duplicate commits by hash', async () => {
      const commit = {
        hash: 'duplicate123',
        message: 'test: duplicate commit',
        timestamp: new Date().toISOString()
      }

      // Send first time
      await fetch(`${API_BASE}/api/tasks/${testTaskId}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commits: [commit] })
      })

      // Send second time (should be ignored)
      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commits: [commit] })
      })

      const result = await response.json()
      const duplicateCount = result.commits.filter(c => c.hash === 'duplicate123').length
      assert.equal(duplicateCount, 1, 'Should only have one commit with hash duplicate123')
    })

    it('should return 404 for non-existent task', async () => {
      const response = await fetch(`${API_BASE}/api/tasks/nonexistent-task-id/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commits: [{
            hash: 'test',
            message: 'test',
            timestamp: new Date().toISOString()
          }]
        })
      })

      assert.equal(response.status, 404, 'Should return 404 for non-existent task')
    })
  })

  describe('POST /api/tasks/:id/files', () => {
    it('should log file changes to task', async () => {
      const files = [
        {
          path: 'src/components/TaskModal.tsx',
          additions: 120,
          deletions: 45
        },
        {
          path: 'src/services/api.ts',
          additions: 80,
          deletions: 12
        }
      ]

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      })

      assert.equal(response.status, 200, `Expected 200, got ${response.status}`)
      const result = await response.json()
      
      assert.ok(result.files, 'Response should include files')
      assert.ok(result.files.length >= 2, 'Should have at least 2 files')
      assert.equal(result.fileCount, result.files.length, 'File count should match')
    })

    it('should reject files without required fields', async () => {
      const invalidFile = { path: 'missing/additions/deletions' }

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidFile)
      })

      assert.equal(response.status, 400, 'Should reject invalid file')
    })
  })

  describe('POST /api/tasks/:id/tests', () => {
    it('should log test results to task', async () => {
      const testResults = {
        passed: 15,
        failed: 2,
        skipped: 1
      }

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResults })
      })

      assert.equal(response.status, 200, `Expected 200, got ${response.status}`)
      const result = await response.json()
      
      assert.ok(result.testResults, 'Response should include test results')
      assert.equal(result.testResults.passed, 15, 'Should have 15 passed tests')
      assert.equal(result.testResults.failed, 2, 'Should have 2 failed tests')
      assert.equal(result.testResults.skipped, 1, 'Should have 1 skipped test')
      assert.equal(result.testSummary.total, 18, 'Total should be 18')
    })

    it('should update test results (not append)', async () => {
      // First update
      await fetch(`${API_BASE}/api/tasks/${testTaskId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testResults: { passed: 10, failed: 1, skipped: 0 }
        })
      })

      // Second update (should replace, not add)
      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testResults: { passed: 20, failed: 0, skipped: 2 }
        })
      })

      const result = await response.json()
      assert.equal(result.testResults.passed, 20, 'Should replace, not add to previous')
      assert.equal(result.testResults.failed, 0, 'Failed should be 0')
    })
  })

  describe('POST /api/tasks/:id/artifacts', () => {
    it('should log artifacts to task', async () => {
      const artifacts = [
        {
          name: 'coverage-report.html',
          size: 45678,
          path: '/artifacts/coverage/report.html'
        },
        {
          name: 'build.log',
          size: 12345,
          path: '/artifacts/logs/build.log'
        }
      ]

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifacts })
      })

      assert.equal(response.status, 200, `Expected 200, got ${response.status}`)
      const result = await response.json()
      
      assert.ok(result.artifacts, 'Response should include artifacts')
      assert.ok(result.artifacts.length >= 2, 'Should have at least 2 artifacts')
    })

    it('should reject artifacts without required fields', async () => {
      const invalidArtifact = { name: 'missing-size-and-path' }

      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidArtifact)
      })

      assert.equal(response.status, 400, 'Should reject invalid artifact')
    })
  })

  describe('GET /api/tasks/:id/work-done', () => {
    it('should return comprehensive work summary', async () => {
      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/work-done`)

      assert.equal(response.status, 200, `Expected 200, got ${response.status}`)
      const result = await response.json()
      
      assert.ok(result.taskId, 'Should include task ID')
      assert.ok(result.task, 'Should include task details')
      assert.ok(result.summary, 'Should include auto-generated summary')
      assert.ok(result.commits, 'Should include commits array')
      assert.ok(result.files, 'Should include files array')
      assert.ok(result.testResults, 'Should include test results')
      assert.ok(result.artifacts, 'Should include artifacts array')
      assert.ok(result.stats, 'Should include stats')
      assert.ok(result.updatedAt, 'Should include updatedAt timestamp')
    })

    it('should auto-generate summary from commit messages', async () => {
      const response = await fetch(`${API_BASE}/api/tasks/${testTaskId}/work-done`)
      const result = await response.json()
      
      // Should include commit messages in summary
      assert.ok(result.summary.includes('feat:') || result.summary.includes('fix:'), 
        'Summary should include commit messages')
    })

    it('should return empty work data for task with no work logged', async () => {
      // Create a new task with no work
      const taskResponse = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Empty Work Task',
          lane: 'queued'
        })
      })
      const task = await taskResponse.json()

      const response = await fetch(`${API_BASE}/api/tasks/${task.id}/work-done`)
      const result = await response.json()
      
      assert.equal(result.commits.length, 0, 'Should have no commits')
      assert.equal(result.files.length, 0, 'Should have no files')
      assert.equal(result.artifacts.length, 0, 'Should have no artifacts')
      assert.equal(result.summary, 'No commits logged yet.', 'Should have default summary')

      // Clean up
      await fetch(`${API_BASE}/api/tasks/${task.id}`, { method: 'DELETE' })
    })

    it('should return 404 for non-existent task', async () => {
      const response = await fetch(`${API_BASE}/api/tasks/nonexistent-task-id/work-done`)
      assert.equal(response.status, 404, 'Should return 404 for non-existent task')
    })
  })

  describe('Integration: Full work logging flow', () => {
    it('should handle complete work logging workflow', async () => {
      // Create a new task for this test
      const taskResponse = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Task',
          lane: 'development'
        })
      })
      const task = await taskResponse.json()

      // Log commits
      await fetch(`${API_BASE}/api/tasks/${task.id}/commits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commits: [
            {
              hash: 'int123',
              message: 'feat: implement feature',
              timestamp: new Date().toISOString()
            }
          ]
        })
      })

      // Log files
      await fetch(`${API_BASE}/api/tasks/${task.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { path: 'src/feature.ts', additions: 100, deletions: 20 }
          ]
        })
      })

      // Log test results
      await fetch(`${API_BASE}/api/tasks/${task.id}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testResults: { passed: 10, failed: 0, skipped: 0 }
        })
      })

      // Log artifacts
      await fetch(`${API_BASE}/api/tasks/${task.id}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifacts: [
            { name: 'build.zip', size: 1024, path: '/artifacts/build.zip' }
          ]
        })
      })

      // Get work done summary
      const workDoneResponse = await fetch(`${API_BASE}/api/tasks/${task.id}/work-done`)
      const workDone = await workDoneResponse.json()

      // Verify all data is present
      assert.equal(workDone.commits.length, 1, 'Should have 1 commit')
      assert.equal(workDone.files.length, 1, 'Should have 1 file')
      assert.equal(workDone.testResults.passed, 10, 'Should have 10 passed tests')
      assert.equal(workDone.artifacts.length, 1, 'Should have 1 artifact')
      assert.ok(workDone.summary.includes('feat:'), 'Summary should include commit message')

      // Clean up
      await fetch(`${API_BASE}/api/tasks/${task.id}`, { method: 'DELETE' })
      const workFilePath = path.join(TASK_WORK_DIR, `${task.id}.json`)
      try {
        await fs.unlink(workFilePath)
      } catch (err) {
        // Ignore
      }
    })
  })
})
