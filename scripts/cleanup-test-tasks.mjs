#!/usr/bin/env node

/**
 * Immediate Test Task Cleanup Script
 * 
 * Deletes all existing test tasks from the system.
 * Run this once to clean up the backlog of 115+ test tasks.
 */

import { TasksStore } from '../bridge/tasksStore.mjs'
import { isTestTask } from '../bridge/testTaskDetection.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'

const TASKS_FILE = '.clawhub/tasks.json'
const WORK_DATA_DIR = '.clawhub/work-data'

async function deleteWorkData(taskId) {
  try {
    const workDataPath = path.join(WORK_DATA_DIR, `${taskId}.json`)
    await fs.unlink(workDataPath)
    console.log(`  ✅ Deleted work data for ${taskId}`)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`  ❌ Error deleting work data for ${taskId}: ${err.message}`)
    }
  }
}

async function main() {
  console.log('🧹 Test Task Cleanup Script\n')
  console.log('This will delete ALL test tasks from the system.\n')

  const tasksStore = new TasksStore(TASKS_FILE)
  await tasksStore.load()

  const allTasks = await tasksStore.getAll()
  const testTasks = allTasks.filter(isTestTask)

  console.log(`Found ${allTasks.length} total tasks`)
  console.log(`Found ${testTasks.length} test tasks to delete\n`)

  if (testTasks.length === 0) {
    console.log('✅ No test tasks to delete. System is clean!')
    return
  }

  console.log('Test tasks to be deleted:')
  for (const task of testTasks) {
    const age = Math.floor((Date.now() - task.createdAt) / 60000)
    console.log(`  - ${task.id} | ${task.title} | Lane: ${task.lane} | Age: ${age}m`)
  }

  console.log('\nDeleting test tasks...\n')

  let deletedCount = 0
  let failedCount = 0

  for (const task of testTasks) {
    try {
      // Delete task
      await tasksStore.delete(task.id)
      
      // Delete work data
      await deleteWorkData(task.id)
      
      deletedCount++
      console.log(`✅ Deleted: ${task.id} - ${task.title}`)
    } catch (err) {
      failedCount++
      console.error(`❌ Failed to delete ${task.id}: ${err.message}`)
    }
  }

  console.log(`\n✅ Cleanup complete!`)
  console.log(`   Deleted: ${deletedCount}`)
  console.log(`   Failed: ${failedCount}`)
  console.log(`   Remaining tasks: ${allTasks.length - deletedCount}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
