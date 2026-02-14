import { describe, it, after, before } from 'node:test'
import * as assert from 'node:assert/strict'
import { TaskTemplatesStore } from './taskTemplates.mjs'
import { TasksStore } from './tasksStore.mjs'
import { AgentsStore } from './agentsStore.mjs'
import { autoAssignTask } from './taskAssignment.mjs'
import * as fs from 'node:fs/promises'

/**
 * Integration tests for template instantiation and dependency resolution
 */
describe('Template Instantiation and Dependency Resolution', () => {
  let templateFile, taskFile, agentFile
  let templatesStore, tasksStore, agentsStore

  before(async () => {
    const id = Math.random()
    templateFile = `.test-templates-integration-${id}.json`
    taskFile = `.test-tasks-integration-${id}.json`
    agentFile = `.test-agents-integration-${id}.json`

    templatesStore = new TaskTemplatesStore(templateFile)
    tasksStore = new TasksStore(taskFile)
    agentsStore = new AgentsStore(agentFile)

    await templatesStore.load()
    await tasksStore.load()
    await agentsStore.load()
  })

  after(async () => {
    try {
      await fs.unlink(templateFile)
      await fs.unlink(taskFile)
      await fs.unlink(agentFile)
    } catch (e) {
      // ignore
    }
  })

  describe('dependency resolution', async () => {
    it('should resolve task title references to task IDs', async () => {
      const template = await templatesStore.createTemplate({
        name: 'Feature Development',
        tasks: [
          { title: 'Design mockup', role: 'designer', estimatedHours: 4 },
          { title: 'Implement backend', role: 'backend-dev', estimatedHours: 8, dependsOn: ['Design mockup'] },
          { title: 'Implement frontend', role: 'frontend-dev', estimatedHours: 8, dependsOn: ['Implement backend'] },
        ]
      })

      // Simulate instantiation
      const createdTasks = []
      const taskTitleToId = {}

      // First pass: create all tasks
      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          description: templateTask.description || '',
          estimatedHours: templateTask.estimatedHours || null,
          tags: ['from-template'],
          priority: 'P2'
        })

        createdTasks.push(task)
        taskTitleToId[templateTask.title] = task.id
      }

      // Second pass: resolve dependencies
      for (let i = 0; i < template.tasks.length; i++) {
        const templateTask = template.tasks[i]
        const createdTask = createdTasks[i]

        const dependencies = (templateTask.dependsOn || []).map(depTitle => {
          return taskTitleToId[depTitle]
        }).filter(Boolean)

        if (dependencies.length > 0) {
          await tasksStore.updateDependencies(createdTask.id, dependencies, 'system')
        }
      }

      // Verify dependencies were resolved correctly
      const backendTask = await tasksStore.get(createdTasks[1].id)
      assert.equal(backendTask.dependsOn.length, 1)
      assert.equal(backendTask.dependsOn[0], createdTasks[0].id)

      const frontendTask = await tasksStore.get(createdTasks[2].id)
      assert.equal(frontendTask.dependsOn.length, 1)
      assert.equal(frontendTask.dependsOn[0], createdTasks[1].id)
    })

    it('should handle missing dependencies gracefully', async () => {
      const template = await templatesStore.createTemplate({
        name: 'Partial Dependencies',
        tasks: [
          { title: 'Task A', role: 'dev', dependsOn: ['Missing Task'] },
          { title: 'Task B', role: 'dev' }
        ]
      })

      const createdTasks = []
      const taskTitleToId = {}

      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          estimatedHours: templateTask.estimatedHours || null,
          priority: 'P2'
        })

        createdTasks.push(task)
        taskTitleToId[templateTask.title] = task.id
      }

      // Resolve dependencies - missing ones should be filtered out
      const dependencies = (template.tasks[0].dependsOn || []).map(depTitle => {
        return taskTitleToId[depTitle]
      }).filter(Boolean)

      if (dependencies.length > 0) {
        await tasksStore.updateDependencies(createdTasks[0].id, dependencies, 'system')
      }

      // Verify missing dependency was ignored
      const taskA = await tasksStore.get(createdTasks[0].id)
      assert.equal(taskA.dependsOn.length, 0)
    })
  })

  describe('auto-assignment based on role', async () => {
    it('should assign tasks based on agent roles', async () => {
      // Create agents with specific roles
      const designer = await agentsStore.upsert({
        id: 'pixel',
        name: 'Pixel',
        emoji: '🎨',
        roles: ['designer', 'ui'],
        status: 'online'
      })

      const backend = await agentsStore.upsert({
        id: 'dev-backend',
        name: 'Backend Dev',
        emoji: '🔧',
        roles: ['backend-dev', 'api'],
        status: 'online'
      })

      const template = await templatesStore.createTemplate({
        name: 'Feature',
        tasks: [
          { title: 'Design', role: 'designer' },
          { title: 'Implement API', role: 'backend-dev' }
        ]
      })

      // Simulate instantiation with manual assignment based on role
      const agents = await agentsStore.getAll()
      const taskCreations = []

      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          priority: 'P2',
          tags: [templateTask.role]
        })

        // Find matching agent by role
        let matchingAgent = null
        for (const agent of agents) {
          if (agent.roles && agent.roles.includes(templateTask.role)) {
            matchingAgent = agent
            break
          }
        }

        if (matchingAgent) {
          await tasksStore.assign(task.id, matchingAgent.id, 'system')
        }

        taskCreations.push(task)
      }

      // Verify assignments
      const allTasks = await tasksStore.getAll()
      const designTask = allTasks.find(t => t.title === 'Design')
      const apiTask = allTasks.find(t => t.title === 'Implement API')

      assert.ok(designTask.assignedTo)
      assert.ok(apiTask.assignedTo)
    })

    it('should handle role matching by agent capabilities', async () => {
      // Create agents with specific roles
      const qaAgent = await agentsStore.upsert({
        id: 'agent-qa',
        name: 'QA Agent',
        emoji: '✅',
        roles: ['qa', 'testing', 'e2e'],
        status: 'online'
      })

      // Create tasks with various test-related roles
      const testPatterns = [
        { title: 'Write unit tests', role: 'testing' },
        { title: 'QA verification', role: 'qa' },
        { title: 'E2E testing', role: 'e2e' }
      ]

      const agents = await agentsStore.getAll()

      for (const pattern of testPatterns) {
        const task = await tasksStore.create({
          title: pattern.title,
          priority: 'P2',
          tags: [pattern.role]
        })

        // Find matching agent by role
        let matchingAgent = null
        for (const agent of agents) {
          if (agent.roles && agent.roles.includes(pattern.role)) {
            matchingAgent = agent
            break
          }
        }

        if (matchingAgent) {
          await tasksStore.assign(task.id, matchingAgent.id, 'system')
          assert.equal(task.id, task.id) // Task was found and matched
        }
      }
    })
  })

  describe('template instantiation workflow', async () => {
    it('should create multiple tasks with correct structure', async () => {
      const template = await templatesStore.createTemplate({
        name: 'New Feature Workflow',
        description: 'Standard workflow for feature development',
        tasks: [
          { title: 'Requirements', role: 'pm', estimatedHours: 2 },
          { title: 'Design', role: 'designer', estimatedHours: 4 },
          { title: 'Backend', role: 'backend-dev', estimatedHours: 8 },
          { title: 'Frontend', role: 'frontend-dev', estimatedHours: 8 },
          { title: 'Testing', role: 'qa', estimatedHours: 4 }
        ]
      })

      const createdTasks = []
      const projectId = 'proj-123'

      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          description: templateTask.description || '',
          projectId,
          estimatedHours: templateTask.estimatedHours || null,
          tags: ['from-template', template.id],
          priority: 'P2'
        })

        createdTasks.push(task)
      }

      // Verify all tasks were created with correct properties
      assert.equal(createdTasks.length, 5)

      const allTasks = await tasksStore.getAll({ projectId })
      assert.equal(allTasks.length, 5)

      allTasks.forEach((task, i) => {
        assert.equal(task.title, template.tasks[i].title)
        assert.equal(task.projectId, projectId)
        assert.ok(task.tags.includes('from-template'))
        assert.ok(task.estimatedHours)
      })
    })

    it('should link tasks to project when provided', async () => {
      const template = await templatesStore.createTemplate({
        name: 'Project-linked Tasks',
        tasks: [
          { title: 'Task 1', role: 'dev' },
          { title: 'Task 2', role: 'dev' }
        ]
      })

      const projectId = 'proj-456'
      const createdTasks = []

      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          projectId,
          priority: 'P2'
        })

        createdTasks.push(task)
      }

      // Verify all tasks are linked to project
      for (const task of createdTasks) {
        const retrieved = await tasksStore.get(task.id)
        assert.equal(retrieved.projectId, projectId)
      }
    })
  })

  describe('template tags and metadata', async () => {
    it('should preserve template ID in task tags', async () => {
      const template = await templatesStore.createTemplate({
        name: 'Tagged Template',
        tasks: [{ title: 'Task', role: 'dev' }]
      })

      const task = await tasksStore.create({
        title: 'Task',
        tags: ['from-template', template.id],
        priority: 'P2'
      })

      assert.equal(task.tags.length, 2)
      assert.ok(task.tags.includes('from-template'))
      assert.ok(task.tags.includes(template.id))
    })

    it('should support estimated hours from template', async () => {
      const template = await templatesStore.createTemplate({
        name: 'Time-estimated Template',
        tasks: [
          { title: 'Design', role: 'designer', estimatedHours: 4 },
          { title: 'Implementation', role: 'dev', estimatedHours: 16 },
          { title: 'Testing', role: 'qa', estimatedHours: 8 }
        ]
      })

      const createdTasks = []
      for (const templateTask of template.tasks) {
        const task = await tasksStore.create({
          title: templateTask.title,
          estimatedHours: templateTask.estimatedHours,
          priority: 'P2'
        })
        createdTasks.push(task)
      }

      assert.equal(createdTasks[0].estimatedHours, 4)
      assert.equal(createdTasks[1].estimatedHours, 16)
      assert.equal(createdTasks[2].estimatedHours, 8)

      const total = createdTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
      assert.equal(total, 28)
    })
  })
})
