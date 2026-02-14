/**
 * Task Assignment Logic
 * 
 * Auto-assigns tasks to agents based on:
 * - Role matching (keywords in title/description)
 * - Agent availability (online status)
 * - Workload balancing (prefer less-loaded agents)
 */

// Role matching patterns
const ROLE_PATTERNS = {
  'designer': [
    /design/i, /ui/i, /ux/i, /mockup/i, /wireframe/i, /prototype/i,
    /visual/i, /style/i, /theme/i, /color/i, /layout/i, /sketch/i
  ],
  'frontend-dev': [
    /frontend/i, /react/i, /vue/i, /angular/i, /ui component/i,
    /tailwind/i, /css/i, /html/i, /javascript/i, /typescript/i,
    /responsive/i, /web page/i, /dashboard/i
  ],
  'backend-dev': [
    /backend/i, /api/i, /endpoint/i, /database/i, /server/i,
    /auth/i, /authentication/i, /authorization/i, /firebase/i,
    /node/i, /express/i, /graphql/i, /rest/i, /sql/i
  ],
  'fullstack-dev': [
    /fullstack/i, /full stack/i, /end.to.end/i, /integration/i
  ],
  'qa': [
    /test/i, /qa/i, /e2e/i, /integration test/i, /unit test/i,
    /verify/i, /validation/i, /quality/i, /bug/i, /regression/i
  ],
  'content': [
    /documentation/i, /readme/i, /docs/i, /content/i, /copy/i,
    /write/i, /blog/i, /article/i, /guide/i, /tutorial/i
  ],
  'devops': [
    /deploy/i, /devops/i, /ci.cd/i, /docker/i, /kubernetes/i,
    /infrastructure/i, /pipeline/i, /monitoring/i, /hosting/i
  ],
  'architect': [
    /architecture/i, /design system/i, /technical design/i,
    /system design/i, /planning/i, /blueprint/i, /strategy/i
  ],
  'pm': [
    /planning/i, /project/i, /coordination/i, /epic/i, /roadmap/i,
    /prioritize/i, /organize/i, /manage/i
  ]
}

/**
 * Analyze task and determine best-fit roles
 */
export function analyzeTaskRoles(task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase()
  const matches = []

  for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matches.push(role)
        break // Only count role once
      }
    }
  }

  // If no matches, default to general development
  if (matches.length === 0) {
    matches.push('fullstack-dev', 'backend-dev', 'frontend-dev')
  }

  return matches
}

/**
 * Find best agent for a task
 */
export async function findBestAgent(task, agentsStore) {
  const requiredRoles = analyzeTaskRoles(task)
  const agents = await agentsStore.getAvailable()

  if (agents.length === 0) return null

  // Filter agents that match any of the required roles
  const candidates = agents.filter(agent => {
    if (!agent.roles || agent.roles.length === 0) return true // Accept agents with no role restriction
    return requiredRoles.some(role => agent.roles.includes(role))
  })

  if (candidates.length === 0) {
    // Fallback: return any available agent
    return agents[0]
  }

  // Sort by workload (ascending)
  candidates.sort((a, b) => {
    const aLoad = agentsStore.getWorkload(a)
    const bLoad = agentsStore.getWorkload(b)
    return aLoad - bLoad
  })

  return candidates[0]
}

/**
 * Auto-assign task to best available agent
 */
export async function autoAssignTask(task, agentsStore, tasksStore, notificationsStore) {
  // Skip if already assigned
  if (task.assignedTo) return { assigned: false, reason: 'already-assigned' }

  // Find best agent
  const agent = await findBestAgent(task, agentsStore)
  if (!agent) {
    return { assigned: false, reason: 'no-available-agents' }
  }

  // Assign task
  await tasksStore.assign(task.id, agent.id, 'auto-assign')

  // Update agent's active tasks
  const activeTasks = [...(agent.activeTasks || []), task.id]
  await agentsStore.updateActiveTasks(agent.id, activeTasks)

  // Update agent's currentTask (for idle/working status)
  const taskInfo = {
    id: task.id,
    title: task.title || 'Untitled task'
  }
  await agentsStore.updateStatus(agent.id, 'busy', taskInfo)

  // Create notification
  await notificationsStore.create({
    agentId: agent.id,
    type: 'task-assigned',
    title: 'New task assigned',
    text: `You've been assigned: ${task.title}`,
    taskId: task.id,
    projectId: task.projectId,
    from: 'auto-assign'
  })

  return {
    assigned: true,
    agent: agent.id,
    roles: analyzeTaskRoles(task)
  }
}

/**
 * Batch auto-assign multiple tasks
 */
export async function autoAssignTasks(tasks, agentsStore, tasksStore, notificationsStore) {
  const results = []

  for (const task of tasks) {
    const result = await autoAssignTask(task, agentsStore, tasksStore, notificationsStore)
    results.push({ taskId: task.id, ...result })
  }

  return results
}

/**
 * Get assignment suggestions (preview without assigning)
 */
export async function getAssignmentSuggestions(task, agentsStore) {
  const roles = analyzeTaskRoles(task)
  const agent = await findBestAgent(task, agentsStore)

  return {
    suggestedRoles: roles,
    suggestedAgent: agent ? {
      id: agent.id,
      name: agent.name,
      workload: agentsStore.getWorkload(agent)
    } : null
  }
}
