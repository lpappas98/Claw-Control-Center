#!/usr/bin/env node
/**
 * Test workload balancing for auto-assignment
 * 
 * This script demonstrates that:
 * 1. Tasks without owner get auto-assigned
 * 2. Multiple similar tasks are distributed across agents
 * 3. Manual owner assignment is preserved
 */

import { autoAssignTask, analyzeTaskRoles } from './taskAssignment.mjs'
import { AgentsStore } from './agentsStore.mjs'
import { LegacyTasksAdapter } from './legacyTasksAdapter.mjs'

// Mock data
let mockTasks = []
const mockAgentsData = [
  {
    id: 'forge',
    name: 'Forge',
    roles: ['backend-dev', 'api', 'database'],
    status: 'online',
    activeTasks: []
  },
  {
    id: 'patch',
    name: 'Patch',
    roles: ['frontend-dev', 'ui', 'react'],
    status: 'online',
    activeTasks: []
  }
]

// Mock stores
class MockAgentsStore {
  constructor() {
    this.agents = mockAgentsData
  }
  
  async ensureLoaded() {}
  
  async getAvailable() {
    return this.agents.filter(a => a.status === 'online')
  }
  
  getWorkload(agent) {
    return agent.activeTasks?.length || 0
  }
  
  async updateActiveTasks(id, taskIds) {
    const agent = this.agents.find(a => a.id === id)
    if (agent) {
      agent.activeTasks = taskIds
    }
  }
  
  async updateStatus(id, status, currentTask) {
    const agent = this.agents.find(a => a.id === id)
    if (agent) {
      // Keep agents as 'online' for testing workload balancing
      // In production, agents can handle multiple queued tasks
      agent.status = 'online'
      agent.currentTask = currentTask
    }
  }
}

class MockTasksStore {
  async assign(taskId, agentId) {
    const task = mockTasks.find(t => t.id === taskId)
    if (task) {
      task.owner = agentId
    }
  }
}

class MockNotificationsStore {
  async create() {}
}

// Test scenarios
const testTasks = [
  { id: 'task-1', title: 'Create REST API endpoint', description: 'Backend API work' },
  { id: 'task-2', title: 'Build React component', description: 'Frontend UI work' },
  { id: 'task-3', title: 'Implement database schema', description: 'Backend database work' },
  { id: 'task-4', title: 'Style the dashboard', description: 'Frontend CSS work' },
  { id: 'task-5', title: 'Generic development task', description: 'Some code work' },
  { id: 'task-6', title: 'Another dev task', description: 'More code work' }
]

async function runTest() {
  console.log('🧪 Testing Auto-Assignment with Workload Balancing\n')
  
  const agentsStore = new MockAgentsStore()
  const tasksStore = new MockTasksStore()
  const notificationsStore = new MockNotificationsStore()
  
  mockTasks = testTasks.map(t => ({ ...t }))
  
  // Test 1: Role analysis
  console.log('📋 Test 1: Role Analysis')
  for (const task of testTasks) {
    const roles = analyzeTaskRoles(task)
    console.log(`  ${task.title}`)
    console.log(`    → Roles: ${roles.join(', ')}`)
  }
  
  console.log('\n📊 Test 2: Auto-Assignment Distribution')
  
  // Assign tasks one by one
  for (const task of mockTasks) {
    const result = await autoAssignTask(task, agentsStore, tasksStore, notificationsStore)
    
    if (result.assigned) {
      const agent = agentsStore.agents.find(a => a.id === result.agent)
      console.log(`  ${task.title}`)
      console.log(`    ✓ Assigned to: ${agent.name} (${result.agent})`)
      console.log(`    → Workload: ${agent.activeTasks.length} task(s)`)
    } else {
      console.log(`  ${task.title}`)
      console.log(`    ✗ Not assigned: ${result.reason}`)
    }
  }
  
  // Show final workload distribution
  console.log('\n📈 Final Workload Distribution:')
  for (const agent of agentsStore.agents) {
    console.log(`  ${agent.name}: ${agent.activeTasks.length} task(s)`)
    console.log(`    Tasks: ${agent.activeTasks.join(', ')}`)
  }
  
  // Test 3: Manual assignment preservation
  console.log('\n🔒 Test 3: Manual Assignment Preservation')
  const manualTask = { 
    id: 'task-manual', 
    title: 'Manually assigned task',
    owner: 'specific-agent'  // Tasks use 'owner' field
  }
  mockTasks.push(manualTask)
  
  const manualResult = await autoAssignTask(manualTask, agentsStore, tasksStore, notificationsStore)
  console.log(`  Task with explicit owner: ${manualTask.owner}`)
  console.log(`  Auto-assign result: ${manualResult.assigned ? 'assigned' : 'skipped'}`)
  console.log(`  Reason: ${manualResult.reason || 'N/A'}`)
  
  console.log('\n✅ Test complete!')
}

runTest().catch(console.error)
