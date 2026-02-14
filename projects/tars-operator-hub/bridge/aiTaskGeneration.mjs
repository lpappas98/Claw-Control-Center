/**
 * AI Task Generation Module
 * 
 * Generates task breakdowns from natural language requests using the OpenClaw agent system.
 * Integrates with existing project context and auto-assigns roles based on AI analysis.
 */

import { analyzeTaskRoles } from './taskAssignment.mjs'

/**
 * Role assignment guidelines
 */
const ROLE_GUIDELINES = {
  'designer': 'UI/UX design, mockups, wireframes, visual design, prototypes',
  'frontend-dev': 'React/Vue/Angular components, CSS, responsive design, dashboards, UI implementation',
  'backend-dev': 'APIs, database design, authentication, server logic, endpoints',
  'fullstack-dev': 'End-to-end features, cross-stack integration',
  'qa': 'Testing, QA, E2E tests, verification, bug validation',
  'devops': 'Deployment, CI/CD, Docker, infrastructure, monitoring',
  'content': 'Documentation, README, guides, tutorials, content writing',
  'architect': 'Technical design, system design, planning, architecture',
  'pm': 'Project planning, coordination, epic creation, prioritization'
}

/**
 * Build structured prompt for AI task generation
 */
function buildAiPrompt(userRequest, projectContext = {}) {
  const projectInfo = projectContext.name || projectContext.id || 'Unknown Project'
  const techStack = projectContext.techStack || []
  const existingFeatures = projectContext.existingFeatures || []

  const stackStr = techStack.length > 0 
    ? `\nTech Stack: ${techStack.join(', ')}` 
    : ''

  const featuresStr = existingFeatures.length > 0
    ? `\nExisting Features:\n${existingFeatures.map(f => `- ${f}`).join('\n')}`
    : ''

  const roleGuidelines = Object.entries(ROLE_GUIDELINES)
    .map(([role, desc]) => `- ${role}: ${desc}`)
    .join('\n')

  return `You are a project manager breaking down feature requests into concrete tasks.

PROJECT: ${projectInfo}${stackStr}${featuresStr}

USER REQUEST: "${userRequest}"

Your task: Break this request into 3-8 concrete tasks that can be executed in parallel or sequence.

For each task, provide:
1. title: Clear, actionable task title (5-10 words)
2. description: What the task accomplishes (1-2 sentences)
3. role: Which team member should do this? Pick one:
${roleGuidelines}
4. estimatedHours: Rough estimate (0.5, 1, 2, 4, 8, 16)
5. dependsOn: List any other task titles this depends on (format: [title1, title2])

IMPORTANT:
- Make tasks specific and actionable
- Estimate conservatively
- Consider dependencies carefully (e.g., backend before frontend)
- Return valid JSON array format only, no explanations

FORMAT: Return ONLY a JSON array like this:
[
  {
    "title": "Design user profile UI",
    "description": "Create mockups and wireframes for the profile page",
    "role": "designer",
    "estimatedHours": 4,
    "dependsOn": []
  },
  {
    "title": "Build profile API endpoints",
    "description": "Create REST endpoints for profile CRUD operations",
    "role": "backend-dev",
    "estimatedHours": 8,
    "dependsOn": []
  },
  {
    "title": "Implement profile page component",
    "description": "Build React component using profile API endpoints",
    "role": "frontend-dev",
    "estimatedHours": 6,
    "dependsOn": ["Build profile API endpoints"]
  }
]

Now generate tasks for: "${userRequest}"`
}

/**
 * Parse AI response and validate task structure
 */
function parseAiResponse(responseText) {
  const tasks = []
  let parsed

  // Extract JSON from response
  try {
    // Try to find JSON array in response
    const match = responseText.match(/\[[\s\S]*\]/)
    if (!match) {
      throw new Error('No JSON array found in response')
    }

    parsed = JSON.parse(match[0])
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array')
    }
  } catch (err) {
    throw new Error(`Failed to parse AI response: ${err.message}`)
  }

  // Validate and normalize tasks
  for (const task of parsed) {
    if (!task.title || typeof task.title !== 'string') {
      throw new Error('Task missing title')
    }

    const normalized = {
      title: task.title.trim(),
      description: task.description ? String(task.description).trim() : '',
      role: task.role ? String(task.role).trim().toLowerCase() : 'fullstack-dev',
      estimatedHours: typeof task.estimatedHours === 'number' ? Math.max(0.5, task.estimatedHours) : 4,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(d => String(d).trim()).filter(Boolean) : []
    }

    tasks.push(normalized)
  }

  if (tasks.length === 0) {
    throw new Error('No valid tasks generated')
  }

  return tasks
}

/**
 * Resolve task dependencies by title
 * Converts task title references to indices in the task array
 */
function resolveDependencies(tasks) {
  const titleToIndex = new Map(tasks.map((task, idx) => [task.title.toLowerCase(), idx]))

  const resolved = tasks.map((task, idx) => {
    const deps = task.dependsOn
      .map(depTitle => titleToIndex.get(depTitle.toLowerCase()))
      .filter(depIdx => depIdx !== undefined && depIdx !== idx)

    return {
      ...task,
      dependsOn: deps
    }
  })

  return resolved
}

/**
 * Generate tasks from user request via AI
 * 
 * @param {string} userRequest - The user's feature request
 * @param {string} projectId - Optional project ID for context
 * @param {object} context - Optional project context {name, techStack, existingFeatures, model}
 * @param {function} callAi - Optional AI function (default: calls OpenClaw)
 * @returns {Promise<{tasks: Task[]}>}
 */
export async function generateTasksFromPrompt(userRequest, projectId = null, context = {}, callAi = null) {
  if (!userRequest || typeof userRequest !== 'string') {
    throw new Error('userRequest is required')
  }

  const userRequestTrimmed = userRequest.trim()
  if (userRequestTrimmed.length === 0) {
    throw new Error('userRequest cannot be empty')
  }

  // Build prompt
  const prompt = buildAiPrompt(userRequestTrimmed, context)

  // Call AI (allow override for testing)
  let aiResponse
  if (callAi && typeof callAi === 'function') {
    aiResponse = await callAi(prompt)
  } else {
    aiResponse = await callOpenClawAgent(prompt, context.model)
  }

  // Parse and validate response
  const parsedTasks = parseAiResponse(aiResponse)

  // Resolve dependencies
  const tasksWithDeps = resolveDependencies(parsedTasks)

  // Add metadata
  const finalTasks = tasksWithDeps.map((task, idx) => ({
    id: `ai-task-${projectId || 'gen'}-${idx}`,
    ...task,
    projectId: projectId || null,
    createdAt: new Date().toISOString(),
    source: 'ai-generation'
  }))

  return {
    tasks: finalTasks,
    metadata: {
      generatedAt: new Date().toISOString(),
      projectId,
      totalTasks: finalTasks.length,
      totalEstimatedHours: finalTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
    }
  }
}

/**
 * Call OpenClaw agent system (default implementation)
 */
async function callOpenClawAgent(prompt, model = 'anthropic/claude-haiku-4-5') {
  // In a real implementation, this would call the OpenClaw agent via REST API
  // For now, we'll use a placeholder that can be mocked in tests
  
  try {
    // Try to get OpenClaw agent system
    const response = await fetch('http://localhost:18789/api/agents/pm/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature: 0.7,
        maxTokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenClaw API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response || data.text || data.completion || ''
  } catch (err) {
    // Fallback: Return a mock response for development
    console.warn('OpenClaw agent not available, using fallback:', err.message)
    return createMockAiResponse(prompt)
  }
}

/**
 * Create a mock AI response for testing/development
 */
export function createMockAiResponse(prompt) {
  // Extract the user request from the prompt
  const match = prompt.match(/USER REQUEST: "([^"]+)"/)
  const request = match ? match[1] : 'feature request'

  return JSON.stringify([
    {
      title: `Analyze ${request}`,
      description: `Understand requirements and create specifications`,
      role: 'pm',
      estimatedHours: 2,
      dependsOn: []
    },
    {
      title: `Design ${request} UI`,
      description: `Create mockups and wireframes`,
      role: 'designer',
      estimatedHours: 4,
      dependsOn: [`Analyze ${request}`]
    },
    {
      title: `Build ${request} API`,
      description: `Implement backend endpoints`,
      role: 'backend-dev',
      estimatedHours: 8,
      dependsOn: [`Analyze ${request}`]
    },
    {
      title: `Implement ${request} UI`,
      description: `Build React components`,
      role: 'frontend-dev',
      estimatedHours: 6,
      dependsOn: [`Design ${request} UI`, `Build ${request} API`]
    },
    {
      title: `Test ${request}`,
      description: `E2E and unit testing`,
      role: 'qa',
      estimatedHours: 4,
      dependsOn: [`Implement ${request} UI`]
    }
  ])
}

/**
 * Get project context from project store
 */
export async function getProjectContext(projectId, pmProjectsStore) {
  if (!projectId || !pmProjectsStore) {
    return {}
  }

  try {
    const project = await pmProjectsStore.loadPmProject(projectId)
    if (!project) return {}

    return {
      name: project.name,
      id: project.id,
      summary: project.summary,
      status: project.status,
      tags: project.tags || [],
      techStack: project.tags?.filter(t => ['react', 'node', 'typescript', 'python', 'go'].includes(t.toLowerCase())) || [],
      existingFeatures: project.tree?.map(t => t.title).slice(0, 5) || []
    }
  } catch {
    return {}
  }
}

/**
 * Estimate task dependencies (for debugging/verification)
 */
export function estimateTaskSchedule(tasks) {
  const byIndex = new Map(tasks.map((t, idx) => [idx, t]))

  // Calculate task start times (critical path)
  const startTimes = new Map()
  const endTimes = new Map()

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const depIndices = task.dependsOn || []

    let maxEndTime = 0
    for (const depIdx of depIndices) {
      if (endTimes.has(depIdx)) {
        maxEndTime = Math.max(maxEndTime, endTimes.get(depIdx))
      }
    }

    const startTime = maxEndTime
    const endTime = startTime + task.estimatedHours
    startTimes.set(i, startTime)
    endTimes.set(i, endTime)
  }

  const totalHours = Math.max(...endTimes.values(), 0)

  return {
    totalHours,
    parallelizableHours: tasks.reduce((sum, t) => sum + t.estimatedHours, 0),
    criticalPath: Array.from(startTimes.entries())
      .map(([idx, start]) => ({ ...tasks[idx], plannedStart: start }))
  }
}
