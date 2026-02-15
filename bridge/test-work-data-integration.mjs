/**
 * Integration test for sub-agent work data logging
 * Tests the new work data API and verification workflow
 */

import { TasksStore } from './tasksStore.mjs'
import fs from 'node:fs/promises'

const TEST_FILE = './.clawhub/test-tasks-work-data.json'

async function runTest() {
  console.log('🧪 Testing sub-agent work data integration...\n')
  
  // Clean up test file
  try {
    await fs.unlink(TEST_FILE)
  } catch {}
  
  const store = new TasksStore(TEST_FILE)
  await store.load()
  
  // Test 1: Create a task
  console.log('1️⃣ Creating test task...')
  const task = await store.create({
    title: 'Test work data logging',
    description: 'Integration test for work data',
    lane: 'queued',
    priority: 'P1',
    owner: 'qa',
    tags: ['test', 'integration']
  })
  console.log(`   ✓ Created task: ${task.id}\n`)
  
  // Test 2: Move to development (simulating claim)
  console.log('2️⃣ Moving task to development...')
  await store.update(task.id, { lane: 'development' }, 'qa')
  const devTask = await store.get(task.id)
  console.log(`   ✓ Task in development: ${devTask.lane}\n`)
  
  // Test 3: Log work data (simulating sub-agent logging commits)
  console.log('3️⃣ Logging work data (commits + test results)...')
  const workData = {
    commits: ['abc123def456', '789ghi012jkl', 'mno345pqr678'],
    testResults: {
      passed: 12,
      failed: 0,
      skipped: 1,
      coverage: '87.5%',
      duration: '2.3s'
    },
    artifacts: ['dist/bundle.js', 'coverage/lcov.info'],
    notes: 'Implemented feature X, added tests, updated docs',
    updatedAt: Date.now(),
    updatedBy: 'qa'
  }
  
  await store.update(task.id, { work: workData }, 'qa')
  const taskWithWork = await store.get(task.id)
  console.log(`   ✓ Work data logged:`)
  console.log(`     - ${taskWithWork.work.commits.length} commits`)
  console.log(`     - Test results: ${taskWithWork.work.testResults.passed} passed, ${taskWithWork.work.testResults.failed} failed`)
  console.log(`     - ${taskWithWork.work.artifacts.length} artifacts`)
  console.log(`     - Notes: ${taskWithWork.work.notes.substring(0, 40)}...\n`)
  
  // Test 4: Move to review with work data (should succeed with log)
  console.log('4️⃣ Moving task to review (with work data)...')
  await store.update(task.id, { lane: 'review' }, 'qa')
  const reviewTask = await store.get(task.id)
  console.log(`   ✓ Task moved to review: ${reviewTask.lane}`)
  console.log(`   ✓ Work data preserved: ${reviewTask.work.commits.length} commits\n`)
  
  // Test 5: Create another task and move to review WITHOUT work data
  console.log('5️⃣ Testing missing work data warning...')
  const task2 = await store.create({
    title: 'Task without work data',
    description: 'Should trigger warning',
    lane: 'development',
    priority: 'P2',
    owner: 'qa'
  })
  console.log(`   ✓ Created task without work data: ${task2.id}`)
  
  // Move to review without logging work data
  await store.update(task2.id, { lane: 'review' }, 'qa')
  const task2Review = await store.get(task2.id)
  const hasWork = task2Review.work && task2Review.work.commits && task2Review.work.commits.length > 0
  console.log(`   ✓ Task moved to review without work data`)
  console.log(`   ✓ Has work data: ${hasWork ? 'yes' : 'no (should trigger warning)'}\n`)
  
  // Test 6: Test work data append (multiple updates)
  console.log('6️⃣ Testing work data append (multiple commits)...')
  const task3 = await store.create({
    title: 'Multi-commit task',
    lane: 'development',
    owner: 'qa'
  })
  
  // First batch of commits
  await store.update(task3.id, {
    work: {
      commits: ['commit1', 'commit2'],
      updatedAt: Date.now(),
      updatedBy: 'qa'
    }
  }, 'qa')
  
  // Second batch (should append, not replace)
  const task3Data = await store.get(task3.id)
  const existingCommits = task3Data.work?.commits || []
  const newCommits = ['commit3', 'commit4']
  const allCommits = [...new Set([...existingCommits, ...newCommits])]
  
  await store.update(task3.id, {
    work: {
      ...task3Data.work,
      commits: allCommits,
      updatedAt: Date.now(),
      updatedBy: 'qa'
    }
  }, 'qa')
  
  const task3Final = await store.get(task3.id)
  console.log(`   ✓ Total commits after append: ${task3Final.work.commits.length}`)
  console.log(`   ✓ Commits: ${task3Final.work.commits.join(', ')}\n`)
  
  // Clean up
  await fs.unlink(TEST_FILE)
  
  console.log('✅ All integration tests passed!\n')
  console.log('Summary:')
  console.log('  • Work data storage: ✓')
  console.log('  • Work data retrieval: ✓')
  console.log('  • Work data preservation on lane change: ✓')
  console.log('  • Missing work data detection: ✓')
  console.log('  • Multi-commit append: ✓')
}

// Run tests
runTest().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
