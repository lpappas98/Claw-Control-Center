/**
 * OpenAI Integration Module
 * 
 * Integrates with OpenAI API to:
 * - Generate structured task lists from intake data
 * - Match tasks to agent capabilities
 * - Create tasks with intelligent assignment
 */

import logger from './logger.mjs'

/**
 * Build structured prompt for task generation using agent capabilities
 */
function buildPrompt(intakeText, projectContext = {}, agentCapabilities = {}) {
  const projectInfo = projectContext.name || projectContext.id || 'Unnamed Project'
  
  // Build agent capabilities reference
  const agentRoles = Object.entries(agentCapabilities).map(([agentId, agent]) => {
    const rolesList = Array.isArray(agent.roles) ? agent.roles.join(', ') : agent.roles || 'general'
    return `- ${agent.name || agentId}: ${rolesList}`
  }).join('\n')

  return `You are a technical project manager analyzing a feature request and generating concrete implementation tasks.

PROJECT: ${projectInfo}

AVAILABLE AGENTS & THEIR SKILLS:
${agentRoles || '- Generic developers available for assignment'}

USER INTAKE: "${intakeText}"

Your task: Generate 3-8 concrete, actionable tasks to implement this feature.

For each task provide:
1. title: Clear, actionable task title (5-10 words)
2. description: What the task accomplishes (1-2 sentences)
3. assignee: Which agent should do this? Use agent ID or agent name from above. If no match, use "tars" as default PM.
4. priority: "P0" (urgent), "P1" (high), "P2" (normal), or "P3" (low)
5. estimatedHours: Rough estimate (0.5, 1, 2, 4, 8, 16)
6. dependsOn: List task titles this depends on (empty array if none)

CRITICAL RULES:
- Match tasks to agent skills when possible
- Make tasks specific and independent (can be worked in parallel)
- Include QA/testing tasks
- Return ONLY valid JSON array, no explanations
- Each task title must be unique

FORMAT: Return ONLY a JSON array like this:
[
  {
    "title": "Design user profile UI",
    "description": "Create mockups and wireframes for the profile page showing all data fields",
    "assignee": "blueprint",
    "priority": "P1",
    "estimatedHours": 4,
    "dependsOn": []
  },
  {
    "title": "Build profile API endpoints",
    "description": "Implement REST endpoints for profile CRUD operations with authentication",
    "assignee": "forge",
    "priority": "P1",
    "estimatedHours": 8,
    "dependsOn": []
  },
  {
    "title": "Implement profile page component",
    "description": "Build React component using profile API endpoints with error handling",
    "assignee": "dev-2",
    "priority": "P1",
    "estimatedHours": 6,
    "dependsOn": ["Build profile API endpoints"]
  },
  {
    "title": "Test profile feature end-to-end",
    "description": "Write E2E and unit tests covering all profile operations",
    "assignee": "qa",
    "priority": "P2",
    "estimatedHours": 4,
    "dependsOn": ["Implement profile page component"]
  }
]

Generate tasks for: "${intakeText}"`
}

/**
 * Call OpenAI API to generate tasks
 */
export async function callOpenAiApi(prompt) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a technical project manager who generates structured task lists in valid JSON format only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    if (!content) {
      throw new Error('Empty response from OpenAI API')
    }

    return content
  } catch (err) {
    logger.error('OpenAI API call failed', { error: err.message })
    throw err
  }
}

/**
 * Parse and validate OpenAI response
 */
export function parseOpenAiResponse(responseText) {
  const tasks = []
  let parsed

  try {
    // Extract JSON array from response
    const match = responseText.match(/\[[\s\S]*\]/)
    if (!match) {
      throw new Error('No JSON array found in response')
    }

    parsed = JSON.parse(match[0])
    
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed content is not an array')
    }
  } catch (err) {
    throw new Error(`Failed to parse OpenAI response: ${err.message}`)
  }

  // Validate and normalize tasks
  for (const task of parsed) {
    if (!task.title || typeof task.title !== 'string') {
      throw new Error('Task missing or invalid title')
    }

    const normalized = {
      title: task.title.trim(),
      description: task.description ? String(task.description).trim() : '',
      assignee: task.assignee ? String(task.assignee).trim().toLowerCase() : 'tars',
      priority: normalizePriority(task.priority),
      estimatedHours: typeof task.estimatedHours === 'number' ? Math.max(0.5, task.estimatedHours) : 4,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(d => String(d).trim()).filter(Boolean) : []
    }

    tasks.push(normalized)
  }

  if (tasks.length === 0) {
    throw new Error('No valid tasks generated from OpenAI response')
  }

  return tasks
}

/**
 * Normalize priority to valid values
 */
function normalizePriority(priority) {
  const v = String(priority || '').toUpperCase()
  if (['P0', 'P1', 'P2', 'P3'].includes(v)) return v
  return 'P2'
}

/**
 * Match agent by ID or name
 */
function findAgentId(assignee, agents) {
  // Direct ID match
  const byId = agents.find(a => a.id.toLowerCase() === assignee.toLowerCase())
  if (byId) return byId.id

  // Name match
  const byName = agents.find(a => a.name && a.name.toLowerCase() === assignee.toLowerCase())
  if (byName) return byName.id

  // Fallback to default PM
  return 'tars'
}

/**
 * Match agent by task characteristics and agent roles
 */
function findBestAgent(task, agents) {
  const taskText = `${task.title} ${task.description}`.toLowerCase()
  
  // Score each agent based on role match
  let bestAgent = null
  let bestScore = -1

  for (const agent of agents) {
    if (!Array.isArray(agent.roles)) continue
    
    let score = 0
    for (const role of agent.roles) {
      const roleStr = String(role).toLowerCase()
      
      // Strong matches
      if (taskText.includes(roleStr)) score += 3
      
      // Pattern matches
      if (roleStr.includes('design') && /design|ui|ux|mockup|wireframe/.test(taskText)) score += 2
      if (roleStr.includes('frontend') && /react|vue|angular|css|html|component/.test(taskText)) score += 2
      if (roleStr.includes('backend') && /api|endpoint|database|server|auth/.test(taskText)) score += 2
      if (roleStr.includes('qa') && /test|qa|verify|validation|e2e/.test(taskText)) score += 2
      if (roleStr.includes('pm') && /plan|coordinate|epic|priorit|manage/.test(taskText)) score += 2
    }

    if (score > bestScore) {
      bestScore = score
      bestAgent = agent.id
    }
  }

  // Fallback
  return bestAgent || 'tars'
}

/**
 * Main integration function: Analyze intake and generate tasks
 */
export async function analyzeIntake(intakeText, projectContext = {}, agents = []) {
  if (!intakeText || typeof intakeText !== 'string') {
    throw new Error('intakeText is required')
  }

  const textTrimmed = intakeText.trim()
  if (textTrimmed.length === 0) {
    throw new Error('intakeText cannot be empty')
  }

  // Build agent capabilities map for prompt
  const agentCapabilities = {}
  for (const agent of agents) {
    agentCapabilities[agent.id] = {
      name: agent.name || agent.id,
      roles: agent.roles || []
    }
  }

  // Build prompt
  const prompt = buildPrompt(textTrimmed, projectContext, agentCapabilities)
  
  logger.debug('Calling OpenAI with prompt', { promptLength: prompt.length })

  // Call OpenAI
  const aiResponse = await callOpenAiApi(prompt)
  
  logger.debug('OpenAI response received', { responseLength: aiResponse.length })

  // Parse response
  const parsedTasks = parseOpenAiResponse(aiResponse)
  
  logger.debug('Tasks parsed', { taskCount: parsedTasks.length })

  // Assign agents based on assignee field + role matching
  const tasksWithAssignment = parsedTasks.map((task, idx) => {
    // First try to match by assignee ID/name
    const assignedAgent = findAgentId(task.assignee, agents)
    
    // If default fallback, try to find best match by roles
    let finalAgent = assignedAgent
    if (assignedAgent === 'tars') {
      finalAgent = findBestAgent(task, agents)
    }

    return {
      id: `task-intake-${Date.now()}-${idx}`,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      dependsOn: task.dependsOn,
      assignedTo: finalAgent,
      lane: 'review',
      createdBy: 'openai-intake',
      projectId: projectContext.id || null,
      metadata: {
        source: 'openai-intake',
        generatedAt: new Date().toISOString()
      }
    }
  })

  // Calculate confidence (based on task clarity)
  const confidence = Math.min(1, 0.7 + (parsedTasks.length / 20))

  return {
    tasks: tasksWithAssignment,
    confidence,
    reasoning: `Generated ${parsedTasks.length} tasks from intake using OpenAI. Tasks assigned based on agent capabilities and role matching.`,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalTasks: tasksWithAssignment.length,
      totalEstimatedHours: tasksWithAssignment.reduce((sum, t) => sum + t.estimatedHours, 0),
      aiModel: 'gpt-4-turbo'
    }
  }
}
