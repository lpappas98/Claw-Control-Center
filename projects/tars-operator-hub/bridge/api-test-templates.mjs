#!/usr/bin/env node
/**
 * API Test for Task Templates
 * Tests all template endpoints without requiring a running server
 */

import express from 'express'
import cors from 'cors'
import path from 'node:path'
import os from 'node:os'

// Import the stores
import { getTaskTemplatesStore } from './taskTemplates.mjs'
import { getTasksStore } from './tasksStore.mjs'
import { getAgentsStore } from './agentsStore.mjs'
import { getNotificationsStore } from './notificationsStore.mjs'
import { autoAssignTask } from './taskAssignment.mjs'

const WORKSPACE = path.join(os.homedir(), '.openclaw', 'test-workspace')
const TEMPLATES_FILE = path.join(WORKSPACE, '.clawhub', 'test-taskTemplates.json')
const NEW_TASKS_FILE = path.join(WORKSPACE, '.clawhub', 'test-new-tasks.json')
const AGENTS_FILE = path.join(WORKSPACE, '.clawhub', 'test-agents.json')
const NOTIFICATIONS_FILE = path.join(WORKSPACE, '.clawhub', 'test-notifications.json')

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Initialize stores
const templatesStore = getTaskTemplatesStore(TEMPLATES_FILE)
const newTasksStore = getTasksStore(NEW_TASKS_FILE)
const agentsStore = getAgentsStore(AGENTS_FILE)
const notificationsStore = getNotificationsStore(NOTIFICATIONS_FILE)

await templatesStore.load()
await newTasksStore.load()
await agentsStore.load()
await notificationsStore.load()

// Template endpoints
app.get('/api/templates', async (_req, res) => {
  try {
    const templates = await templatesStore.getAll()
    res.json(templates)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.get('/api/templates/:id', async (req, res) => {
  try {
    const template = await templatesStore.getTemplate(req.params.id)
    if (!template) return res.status(404).send('template not found')
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.post('/api/templates', async (req, res) => {
  try {
    const body = req.body ?? {}
    const template = await templatesStore.createTemplate({
      name: body.name,
      description: body.description || '',
      tasks: body.tasks || []
    })
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.put('/api/templates/:id', async (req, res) => {
  try {
    const body = req.body ?? {}
    const template = await templatesStore.updateTemplate(req.params.id, {
      name: body.name,
      description: body.description,
      tasks: body.tasks
    })
    if (!template) return res.status(404).send('template not found')
    res.json(template)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const deleted = await templatesStore.deleteTemplate(req.params.id)
    if (!deleted) return res.status(404).send('template not found')
    res.json({ success: true })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Task instantiation from template
app.post('/api/tasks/from-template', async (req, res) => {
  try {
    const body = req.body ?? {}
    const templateId = body.templateId
    const projectId = body.projectId || null
    const createdBy = body.createdBy || 'api'

    if (!templateId) {
      return res.status(400).send('templateId is required')
    }

    const template = await templatesStore.getTemplate(templateId)
    if (!template) {
      return res.status(404).send('template not found')
    }

    // Create tasks from template
    const createdTasks = []
    const taskTitleToId = {}

    // First pass: create all tasks
    for (const templateTask of template.tasks) {
      const task = await newTasksStore.create({
        title: templateTask.title,
        description: templateTask.description || '',
        projectId,
        createdBy,
        estimatedHours: templateTask.estimatedHours || null,
        tags: ['from-template', templateId],
        priority: 'P2'
      })

      createdTasks.push(task)
      taskTitleToId[templateTask.title] = task.id
    }

    // Second pass: resolve dependencies and auto-assign
    for (let i = 0; i < template.tasks.length; i++) {
      const templateTask = template.tasks[i]
      const createdTask = createdTasks[i]

      // Resolve dependencies
      const dependencies = (templateTask.dependsOn || []).map(depTitle => {
        return taskTitleToId[depTitle]
      }).filter(Boolean)

      if (dependencies.length > 0) {
        await newTasksStore.updateDependencies(createdTask.id, dependencies, 'system')
      }

      // Auto-assign based on role - update task to include role in description/tags for pattern matching
      const taskWithRole = {
        ...createdTask,
        title: `${createdTask.title} (${templateTask.role})`,
        tags: [...(createdTask.tags || []), templateTask.role]
      }

      await autoAssignTask(taskWithRole, agentsStore, newTasksStore, notificationsStore)
    }

    res.json({
      templateId,
      taskIds: createdTasks.map(t => t.id),
      tasks: createdTasks
    })
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid request')
  }
})

// Test function
async function runTests() {
  console.log('🧪 Testing Task Templates API\n')

  const testResults = []

  try {
    // Test 1: GET /api/templates (empty)
    console.log('Test 1: GET /api/templates (should be empty)')
    const response1 = await fetch('http://localhost:9999/api/templates')
    const templates1 = JSON.parse(await response1.text())
    console.log('✓ Response: templates count =', templates1.length)
    testResults.push({ test: 'GET /api/templates (empty)', passed: Array.isArray(templates1) })

    // Test 2: POST /api/templates
    console.log('\nTest 2: POST /api/templates')
    const response2 = await fetch('http://localhost:9999/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Feature',
        description: 'Template for feature development',
        tasks: [
          { title: 'Design', role: 'designer', estimatedHours: 4 },
          { title: 'Backend', role: 'backend-dev', estimatedHours: 8, dependsOn: ['Design'] },
          { title: 'Frontend', role: 'frontend-dev', estimatedHours: 8, dependsOn: ['Backend'] }
        ]
      })
    })
    const template = JSON.parse(await response2.text())
    console.log('✓ Created template:', template.id, '-', template.name)
    testResults.push({ test: 'POST /api/templates', passed: !!template.id })

    const templateId = template.id

    // Test 3: GET /api/templates/:id
    console.log('\nTest 3: GET /api/templates/:id')
    const response3 = await fetch(`http://localhost:9999/api/templates/${templateId}`)
    const foundTemplate = JSON.parse(await response3.text())
    console.log('✓ Found template:', foundTemplate.name)
    testResults.push({ test: 'GET /api/templates/:id', passed: foundTemplate.id === templateId })

    // Test 4: GET /api/templates (not empty)
    console.log('\nTest 4: GET /api/templates (should have template)')
    const response4 = await fetch('http://localhost:9999/api/templates')
    const templates4 = JSON.parse(await response4.text())
    console.log('✓ Templates count:', templates4.length)
    testResults.push({ test: 'GET /api/templates (with templates)', passed: templates4.length > 0 })

    // Test 5: PUT /api/templates/:id
    console.log('\nTest 5: PUT /api/templates/:id')
    const response5 = await fetch(`http://localhost:9999/api/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Feature',
        description: 'Updated description'
      })
    })
    const updatedTemplate = JSON.parse(await response5.text())
    console.log('✓ Updated template name:', updatedTemplate.name)
    testResults.push({ test: 'PUT /api/templates/:id', passed: updatedTemplate.name === 'Updated Feature' })

    // Test 6: POST /api/tasks/from-template
    console.log('\nTest 6: POST /api/tasks/from-template')
    
    // First, check the template before instantiation
    const responseCheck = await fetch(`http://localhost:9999/api/templates/${templateId}`)
    const templateCheck = JSON.parse(await responseCheck.text())
    console.log('  Template check:', templateCheck.name, '- Tasks:', templateCheck.tasks?.length)
    
    const response6 = await fetch('http://localhost:9999/api/tasks/from-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: templateId,
        projectId: 'proj-123'
      })
    })
    const text6 = await response6.text()
    let instantiation
    try {
      instantiation = JSON.parse(text6)
    } catch (e) {
      console.log('Error response:', response6.status, text6)
      throw e
    }
    console.log('✓ Created', instantiation.taskIds.length, 'tasks from template')
    testResults.push({ test: 'POST /api/tasks/from-template', passed: instantiation.taskIds.length === 3 })

    // Test 7: DELETE /api/templates/:id
    console.log('\nTest 7: DELETE /api/templates/:id')
    const response7 = await fetch(`http://localhost:9999/api/templates/${templateId}`, {
      method: 'DELETE'
    })
    const deleteResult = JSON.parse(await response7.text())
    console.log('✓ Deleted template')
    testResults.push({ test: 'DELETE /api/templates/:id', passed: deleteResult.success })

    // Test 8: 404 for non-existent template
    console.log('\nTest 8: GET /api/templates/:id (non-existent)')
    const response8 = await fetch(`http://localhost:9999/api/templates/${templateId}`)
    console.log('✓ Status:', response8.status)
    testResults.push({ test: 'GET non-existent template returns 404', passed: response8.status === 404 })

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('Test Results Summary:')
    console.log('='.repeat(50))
    const passed = testResults.filter(t => t.passed).length
    const total = testResults.length
    console.log(`Passed: ${passed}/${total}\n`)

    testResults.forEach(t => {
      console.log(`${t.passed ? '✓' : '✗'} ${t.test}`)
    })

    process.exit(passed === total ? 0 : 1)
  } catch (error) {
    console.error('Error during testing:', error)
    process.exit(1)
  }
}

const PORT = 9999
const server = app.listen(PORT, () => {
  console.log(`Test server listening on http://localhost:${PORT}`)
  setTimeout(runTests, 500)
})
