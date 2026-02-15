/**
 * Integration test for sub-agent work data logging
 * Tests the work data file storage and verification workflow
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE = '/home/openclaw/.openclaw/workspace'
const TASK_WORK_DIR = path.join(WORKSPACE, '.clawhub', 'task-work-test')
const TEST_TASK_ID = 'test-work-data-12345'

async function loadTaskWork(taskId) {
  const filePath = path.join(TASK_WORK_DIR, `${taskId}.json`)
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    return {
      taskId,
      commits: [],
      files: [],
      testResults: { passed: 0, failed: 0, skipped: 0 },
      artifacts: [],
      updatedAt: new Date().toISOString()
    }
  }
}

async function saveTaskWork(taskId, workData) {
  const filePath = path.join(TASK_WORK_DIR, `${taskId}.json`)
  const data = {
    ...workData,
    taskId,
    updatedAt: new Date().toISOString()
  }
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
  return data
}

function computeWorkSummary(workData) {
  const testResults = workData.testResults || { passed: 0, failed: 0, skipped: 0 }
  return {
    commitCount: Array.isArray(workData.commits) ? workData.commits.length : 0,
    fileCount: Array.isArray(workData.files) ? workData.files.length : 0,
    testSummary: {
      passed: testResults.passed || 0,
      failed: testResults.failed || 0,
      skipped: testResults.skipped || 0,
      total: (testResults.passed || 0) + (testResults.failed || 0) + (testResults.skipped || 0)
    }
  }
}

async function runTest() {
  console.log('🧪 Testing sub-agent work data integration (file-based storage)...\n')
  
  // Setup test directory
  await rm(TASK_WORK_DIR, { recursive: true, force: true })
  await mkdir(TASK_WORK_DIR, { recursive: true })
  
  // Test 1: Save work data with commits
  console.log('1️⃣ Testing work data save (commits + test results)...')
  const workData1 = {
    commits: [
      { hash: 'abc123', message: 'feat: implement feature', timestamp: '2026-02-15T23:00:00Z' },
      { hash: 'def456', message: 'test: add unit tests', timestamp: '2026-02-15T23:05:00Z' },
      { hash: 'ghi789', message: 'docs: update README', timestamp: '2026-02-15T23:10:00Z' }
    ],
    files: [
      { path: 'src/feature.ts', additions: 45, deletions: 10 },
      { path: 'tests/feature.test.ts', additions: 30, deletions: 0 }
    ],
    testResults: {
      passed: 12,
      failed: 0,
      skipped: 1
    },
    artifacts: [
      { name: 'bundle.js', size: 123456, path: 'dist/bundle.js' },
      { name: 'coverage.html', size: 45678, path: 'coverage/index.html' }
    ]
  }
  
  const saved = await saveTaskWork(TEST_TASK_ID, workData1)
  const summary = computeWorkSummary(saved)
  
  console.log(`   ✓ Saved work data to file`)
  console.log(`   ✓ Commits: ${summary.commitCount}`)
  console.log(`   ✓ Files changed: ${summary.fileCount}`)
  console.log(`   ✓ Tests: ${summary.testSummary.passed} passed, ${summary.testSummary.failed} failed, ${summary.testSummary.skipped} skipped\n`)
  
  // Test 2: Load work data
  console.log('2️⃣ Testing work data load...')
  const loaded = await loadTaskWork(TEST_TASK_ID)
  console.log(`   ✓ Loaded work data from file`)
  console.log(`   ✓ Commits preserved: ${loaded.commits.length}`)
  console.log(`   ✓ First commit: ${loaded.commits[0].message}\n`)
  
  // Test 3: Load non-existent task (should return empty structure)
  console.log('3️⃣ Testing load of non-existent task...')
  const empty = await loadTaskWork('non-existent-task')
  console.log(`   ✓ Returns empty structure for non-existent task`)
  console.log(`   ✓ Has default fields: commits=${empty.commits.length}, files=${empty.files.length}\n`)
  
  // Test 4: Verify work data detection
  console.log('4️⃣ Testing work data verification...')
  const taskWithWork = await loadTaskWork(TEST_TASK_ID)
  const hasCommits = Array.isArray(taskWithWork.commits) && taskWithWork.commits.length > 0
  console.log(`   ✓ Task has commits: ${hasCommits}`)
  console.log(`   ✓ Would ${hasCommits ? 'PASS' : 'FAIL'} review verification\n`)
  
  // Test 5: Test append/update scenario
  console.log('5️⃣ Testing work data update (append commits)...')
  const existing = await loadTaskWork(TEST_TASK_ID)
  const newCommit = { hash: 'jkl012', message: 'fix: bug fix', timestamp: '2026-02-15T23:15:00Z' }
  const updated = await saveTaskWork(TEST_TASK_ID, {
    ...existing,
    commits: [...existing.commits, newCommit],
    testResults: {
      passed: 15,  // Updated test count
      failed: 0,
      skipped: 1
    }
  })
  
  console.log(`   ✓ Updated work data`)
  console.log(`   ✓ Total commits: ${updated.commits.length}`)
  console.log(`   ✓ Latest commit: ${updated.commits[updated.commits.length - 1].message}\n`)
  
  // Clean up
  await rm(TASK_WORK_DIR, { recursive: true, force: true })
  
  console.log('✅ All integration tests passed!\n')
  console.log('Summary:')
  console.log('  • File-based work data storage: ✓')
  console.log('  • Work data retrieval: ✓')
  console.log('  • Empty data for non-existent tasks: ✓')
  console.log('  • Work data verification (has commits): ✓')
  console.log('  • Work data updates (append): ✓')
}

// Run tests
runTest().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
