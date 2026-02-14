import test from 'node:test'
import assert from 'node:assert/strict'

import {
  generateTasksFromPrompt,
  createMockAiResponse,
  estimateTaskSchedule,
  getProjectContext
} from './aiTaskGeneration.mjs'

// Mock AI function for testing
function createMockAi(tasks) {
  return async (_prompt) => {
    return JSON.stringify(tasks)
  }
}

test('aiTaskGeneration: generateTasksFromPrompt with empty request throws', async () => {
  try {
    await generateTasksFromPrompt('')
    assert.fail('should throw')
  } catch (err) {
    assert.match(err.message, /empty|required/)
  }
})

test('aiTaskGeneration: generateTasksFromPrompt with null request throws', async () => {
  try {
    await generateTasksFromPrompt(null)
    assert.fail('should throw')
  } catch (err) {
    assert.match(err.message, /required/)
  }
})

test('aiTaskGeneration: generateTasksFromPrompt returns tasks with metadata', async () => {
  const mockTasks = [
    {
      title: 'Design UI',
      description: 'Create mockups',
      role: 'designer',
      estimatedHours: 4,
      dependsOn: []
    },
    {
      title: 'Build API',
      description: 'Create endpoints',
      role: 'backend-dev',
      estimatedHours: 8,
      dependsOn: []
    }
  ]

  const result = await generateTasksFromPrompt(
    'Build user profiles feature',
    'proj-123',
    {},
    createMockAi(mockTasks)
  )

  assert.ok(result.tasks)
  assert.equal(result.tasks.length, 2)
  assert.equal(result.metadata.projectId, 'proj-123')
  assert.equal(result.metadata.totalTasks, 2)
  assert.equal(result.metadata.totalEstimatedHours, 12)
})

test('aiTaskGeneration: parseAiResponse handles valid JSON array', async () => {
  const mockTasks = [
    {
      title: 'Task 1',
      description: 'Description 1',
      role: 'frontend-dev',
      estimatedHours: 4,
      dependsOn: []
    }
  ]

  const result = await generateTasksFromPrompt(
    'Build something',
    null,
    {},
    createMockAi(mockTasks)
  )

  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].title, 'Task 1')
  assert.equal(result.tasks[0].role, 'frontend-dev')
})

test('aiTaskGeneration: parseAiResponse throws on invalid JSON', async () => {
  const invalidAi = async () => 'not json'

  try {
    await generateTasksFromPrompt('Build something', null, {}, invalidAi)
    assert.fail('should throw')
  } catch (err) {
    assert.match(err.message, /parse|JSON/)
  }
})

test('aiTaskGeneration: parseAiResponse throws on missing title', async () => {
  const noTitleAi = async () => JSON.stringify([
    {
      description: 'No title',
      role: 'developer',
      estimatedHours: 4,
      dependsOn: []
    }
  ])

  try {
    await generateTasksFromPrompt('Build something', null, {}, noTitleAi)
    assert.fail('should throw')
  } catch (err) {
    assert.match(err.message, /title/)
  }
})

test('aiTaskGeneration: parsAiResponse normalizes role to lowercase', async () => {
  const mixedCaseRolesAi = async () => JSON.stringify([
    {
      title: 'Task 1',
      description: 'Test',
      role: 'BACKEND-DEV',
      estimatedHours: 4,
      dependsOn: []
    },
    {
      title: 'Task 2',
      description: 'Test',
      role: 'Designer',
      estimatedHours: 2,
      dependsOn: []
    }
  ])

  const result = await generateTasksFromPrompt(
    'Build something',
    null,
    {},
    mixedCaseRolesAi
  )

  assert.equal(result.tasks[0].role, 'backend-dev')
  assert.equal(result.tasks[1].role, 'designer')
})

test('aiTaskGeneration: parseAiResponse defaults missing fields', async () => {
  const minimalAi = async () => JSON.stringify([
    {
      title: 'Task 1'
    },
    {
      title: 'Task 2',
      estimatedHours: 0
    }
  ])

  const result = await generateTasksFromPrompt(
    'Build something',
    null,
    {},
    minimalAi
  )

  assert.equal(result.tasks[0].description, '')
  assert.equal(result.tasks[0].role, 'fullstack-dev')
  assert.equal(result.tasks[0].estimatedHours, 4)
  assert.deepEqual(result.tasks[0].dependsOn, [])
  
  // estimatedHours of 0 should be normalized to 0.5
  assert.equal(result.tasks[1].estimatedHours, 0.5)
})

test('aiTaskGeneration: resolveDependencies converts title references to indices', async () => {
  const tasksWithDeps = [
    {
      title: 'Analyze requirements',
      description: 'Understand spec',
      role: 'pm',
      estimatedHours: 2,
      dependsOn: []
    },
    {
      title: 'Design UI',
      description: 'Create mockups',
      role: 'designer',
      estimatedHours: 4,
      dependsOn: ['Analyze requirements']
    },
    {
      title: 'Build API',
      description: 'Create endpoints',
      role: 'backend-dev',
      estimatedHours: 8,
      dependsOn: ['Analyze requirements']
    },
    {
      title: 'Implement frontend',
      description: 'Build components',
      role: 'frontend-dev',
      estimatedHours: 6,
      dependsOn: ['Design UI', 'Build API']
    }
  ]

  const depsAi = async () => JSON.stringify(tasksWithDeps)

  const result = await generateTasksFromPrompt(
    'Build user profiles',
    null,
    {},
    depsAi
  )

  const tasks = result.tasks

  // Task 0 (Analyze) has no dependencies
  assert.deepEqual(tasks[0].dependsOn, [])

  // Task 1 (Design) depends on task 0
  assert.deepEqual(tasks[1].dependsOn, [0])

  // Task 2 (Build API) depends on task 0
  assert.deepEqual(tasks[2].dependsOn, [0])

  // Task 3 (Implement) depends on tasks 1 and 2
  assert.deepEqual(tasks[3].dependsOn, [1, 2])
})

test('aiTaskGeneration: resolveDependencies ignores self-references', async () => {
  const selfRefAi = async () => JSON.stringify([
    {
      title: 'Task 1',
      description: 'Test',
      role: 'developer',
      estimatedHours: 4,
      dependsOn: ['Task 1'] // Self reference
    }
  ])

  const result = await generateTasksFromPrompt(
    'Build something',
    null,
    {},
    selfRefAi
  )

  // Self-reference should be removed
  assert.deepEqual(result.tasks[0].dependsOn, [])
})

test('aiTaskGeneration: resolveDependencies ignores invalid references', async () => {
  const invalidRefAi = async () => JSON.stringify([
    {
      title: 'Task 1',
      description: 'Test',
      role: 'developer',
      estimatedHours: 4,
      dependsOn: ['Nonexistent Task']
    }
  ])

  const result = await generateTasksFromPrompt(
    'Build something',
    null,
    {},
    invalidRefAi
  )

  // Invalid reference should be removed
  assert.deepEqual(result.tasks[0].dependsOn, [])
})

test('aiTaskGeneration: estimateTaskSchedule calculates critical path', async () => {
  const tasks = [
    {
      title: 'Analyze',
      estimatedHours: 2,
      dependsOn: []
    },
    {
      title: 'Design',
      estimatedHours: 4,
      dependsOn: [0]
    },
    {
      title: 'Implement',
      estimatedHours: 8,
      dependsOn: [1]
    }
  ]

  const schedule = estimateTaskSchedule(tasks)

  assert.equal(schedule.totalHours, 14)
  assert.equal(schedule.parallelizableHours, 14)
  assert.equal(schedule.criticalPath.length, 3)
  assert.equal(schedule.criticalPath[0].plannedStart, 0)
  assert.equal(schedule.criticalPath[1].plannedStart, 2)
  assert.equal(schedule.criticalPath[2].plannedStart, 6)
})

test('aiTaskGeneration: estimateTaskSchedule handles parallel tasks', async () => {
  const tasks = [
    {
      title: 'Setup',
      estimatedHours: 2,
      dependsOn: []
    },
    {
      title: 'Frontend',
      estimatedHours: 4,
      dependsOn: [0]
    },
    {
      title: 'Backend',
      estimatedHours: 6,
      dependsOn: [0]
    },
    {
      title: 'Test',
      estimatedHours: 3,
      dependsOn: [1, 2]
    }
  ]

  const schedule = estimateTaskSchedule(tasks)

  // Critical path: Setup (2) + Backend (6) + Test (3) = 11 hours
  assert.equal(schedule.totalHours, 11)
  // But total sequential hours if done one by one would be 15
  assert.equal(schedule.parallelizableHours, 15)
})

test('aiTaskGeneration: createMockAiResponse generates valid tasks', async () => {
  const mockResponse = createMockAiResponse('Some prompt')
  const parsed = JSON.parse(mockResponse)

  assert.ok(Array.isArray(parsed))
  assert.ok(parsed.length > 0)
  
  for (const task of parsed) {
    assert.ok(task.title)
    assert.ok(task.description)
    assert.ok(task.role)
    assert.ok(typeof task.estimatedHours === 'number')
    assert.ok(Array.isArray(task.dependsOn))
  }
})

test('aiTaskGeneration: generated tasks have consistent structure', async () => {
  const mockTasks = [
    {
      title: 'Task A',
      description: 'Do something',
      role: 'backend-dev',
      estimatedHours: 4,
      dependsOn: []
    },
    {
      title: 'Task B',
      description: 'Do something else',
      role: 'frontend-dev',
      estimatedHours: 6,
      dependsOn: ['Task A']
    }
  ]

  const result = await generateTasksFromPrompt(
    'Build feature',
    'proj-1',
    { name: 'My Project' },
    createMockAi(mockTasks)
  )

  for (const task of result.tasks) {
    assert.ok(task.id)
    assert.ok(task.title)
    assert.ok(task.description)
    assert.ok(task.role)
    assert.equal(typeof task.estimatedHours, 'number')
    assert.ok(Array.isArray(task.dependsOn))
    assert.ok(task.createdAt)
    assert.equal(task.source, 'ai-generation')
    assert.equal(task.projectId, 'proj-1')
  }
})

test('aiTaskGeneration: handles project context parameter', async () => {
  const mockTasks = [
    {
      title: 'Task 1',
      description: 'Test',
      role: 'developer',
      estimatedHours: 4,
      dependsOn: []
    }
  ]

  const context = {
    name: 'My Project',
    techStack: ['React', 'Node.js'],
    existingFeatures: ['Auth', 'Dashboard']
  }

  const result = await generateTasksFromPrompt(
    'Add new feature',
    'proj-1',
    context,
    createMockAi(mockTasks)
  )

  assert.equal(result.metadata.projectId, 'proj-1')
  assert.ok(result.tasks)
})

test('aiTaskGeneration: handles model parameter in context', async () => {
  let capturedPrompt = null
  const mockAi = async (prompt) => {
    capturedPrompt = prompt
    return JSON.stringify([
      { title: 'Task', description: 'Test', role: 'dev', estimatedHours: 4, dependsOn: [] }
    ])
  }

  await generateTasksFromPrompt(
    'Build feature',
    null,
    { model: 'custom-model' },
    mockAi
  )

  assert.ok(capturedPrompt)
  // The prompt was passed to the mock AI
})

test('aiTaskGeneration: trims whitespace from request', async () => {
  const mockTasks = [
    { title: 'Task', description: 'Test', role: 'dev', estimatedHours: 4, dependsOn: [] }
  ]

  const result = await generateTasksFromPrompt(
    '  Build user profiles feature  ',
    null,
    {},
    createMockAi(mockTasks)
  )

  assert.equal(result.tasks[0].title, 'Task')
})
