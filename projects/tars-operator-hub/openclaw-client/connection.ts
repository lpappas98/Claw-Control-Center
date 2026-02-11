/**
 * OpenClaw Client Library for TARS Operator Hub
 * 
 * This module provides connection utilities for OpenClaw instances
 * to connect to the TARS Operator Hub Control Center via Cloud Functions API.
 */

const API_BASE = 'https://us-central1-claw-control-center.cloudfunctions.net'

export type ConnectionMetadata = {
  version?: string
  os?: string
  node?: string
}

export type ConnectionResult = {
  success: boolean
  userId?: string
  instanceId?: string
  error?: string
}

export type Task = {
  id: string
  title: string
  description?: string
  status: string
  priority?: string
  createdAt: string
  updatedAt: string
}

/**
 * Connect this OpenClaw instance to the Control Center using a connection code
 */
export async function connectToControlCenter(
  code: string,
  instanceName: string,
  metadata?: ConnectionMetadata
): Promise<ConnectionResult> {
  try {
    const response = await fetch(`${API_BASE}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: code,
        instanceName,
        metadata,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || 'Connection failed' }
    }

    return {
      success: true,
      userId: data.userId,
      instanceId: data.instanceId,
    }
  } catch (error) {
    console.error('Connection error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send a heartbeat to keep the instance connection active
 */
export async function sendHeartbeat(instanceId: string, status?: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/heartbeat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Instance-Id': instanceId,
      },
      body: JSON.stringify({ status: status || 'active' }),
    })

    return response.ok
  } catch (error) {
    console.error('Heartbeat error:', error)
    return false
  }
}

/**
 * Disconnect this instance from the Control Center
 */
export async function disconnect(instanceId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/disconnect`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Instance-Id': instanceId,
      },
      body: JSON.stringify({}),
    })

    return response.ok
  } catch (error) {
    console.error('Disconnect error:', error)
    return false
  }
}

/**
 * Get tasks for a user (requires authenticated instance)
 */
export async function getTasks(instanceId: string): Promise<Task[]> {
  try {
    const response = await fetch(`${API_BASE}/getTasks`, {
      headers: { 'X-Instance-Id': instanceId },
    })

    if (!response.ok) {
      console.error('Failed to get tasks:', await response.text())
      return []
    }

    const data = await response.json()
    return data.tasks || []
  } catch (error) {
    console.error('Get tasks error:', error)
    return []
  }
}

/**
 * Create a new task
 */
export async function createTask(
  instanceId: string,
  task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Task | null> {
  try {
    const response = await fetch(`${API_BASE}/createTask`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Instance-Id': instanceId,
      },
      body: JSON.stringify(task),
    })

    if (!response.ok) {
      console.error('Failed to create task:', await response.text())
      return null
    }

    const data = await response.json()
    return data.task
  } catch (error) {
    console.error('Create task error:', error)
    return null
  }
}

/**
 * Update an existing task
 */
export async function updateTask(
  instanceId: string,
  taskId: string,
  updates: Partial<Task>
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/updateTask`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Instance-Id': instanceId,
      },
      body: JSON.stringify({ taskId, ...updates }),
    })

    return response.ok
  } catch (error) {
    console.error('Update task error:', error)
    return false
  }
}

/**
 * Log an activity event
 */
export async function logActivity(
  instanceId: string,
  event: {
    level?: 'info' | 'warn' | 'error'
    source?: string
    message: string
    meta?: Record<string, unknown>
  }
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/logActivity`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Instance-Id': instanceId,
      },
      body: JSON.stringify(event),
    })

    return response.ok
  } catch (error) {
    console.error('Log activity error:', error)
    return false
  }
}

/**
 * Example usage in OpenClaw agent:
 * 
 * ```typescript
 * import { 
 *   connectToControlCenter, 
 *   sendHeartbeat,
 *   getTasks,
 *   createTask 
 * } from './openclaw-client/connection'
 * 
 * // When user says "Connect to Control Center with code: ABCD12"
 * const result = await connectToControlCenter(
 *   'ABCD12',
 *   'OpenClaw Bozeman',
 *   {
 *     version: 'v1.0.0',
 *     os: 'Linux',
 *     node: 'v18.0.0'
 *   }
 * )
 * 
 * if (result.success) {
 *   // Save instanceId locally (this is your auth token for all API calls)
 *   await saveConfig({ instanceId: result.instanceId })
 *   
 *   // Start heartbeat interval (every minute)
 *   setInterval(() => {
 *     sendHeartbeat(result.instanceId!)
 *   }, 60000)
 *   
 *   // Get tasks
 *   const tasks = await getTasks(result.instanceId!)
 *   console.log('Tasks:', tasks)
 *   
 *   // Create a task
 *   const task = await createTask(result.instanceId!, {
 *     title: 'Review PRs',
 *     status: 'proposed',
 *     priority: 'P1'
 *   })
 * }
 * ```
 */
