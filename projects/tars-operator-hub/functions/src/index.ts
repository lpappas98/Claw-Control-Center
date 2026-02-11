import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

interface ValidateTokenRequest {
  token: string
  instanceName: string
  metadata?: {
    version?: string
    os?: string
    node?: string
  }
}

interface ValidateTokenResponse {
  success: boolean
  userId?: string
  instanceId?: string
  error?: string
}

/**
 * Validate a connection token and create a connected instance.
 * This runs with admin privileges so it can write to any user's collection.
 */
export const validateConnectionToken = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  try {
    const { token, instanceName, metadata } = req.body as ValidateTokenRequest

    if (!token || !instanceName) {
      res.status(400).json({ success: false, error: 'Missing token or instanceName' })
      return
    }

    // 1. Find and validate the token
    const tokenDoc = await db.collection('connectionTokens').doc(token).get()
    
    if (!tokenDoc.exists) {
      res.status(404).json({ success: false, error: 'Invalid connection code' })
      return
    }

    const tokenData = tokenDoc.data()!
    
    // Check if already used
    if (tokenData.used) {
      res.status(400).json({ success: false, error: 'Connection code already used' })
      return
    }

    // Check expiration
    const expiresAt = tokenData.expiresAt.toDate()
    if (expiresAt < new Date()) {
      res.status(400).json({ success: false, error: 'Connection code expired' })
      return
    }

    // 2. Generate instance ID
    const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    const now = new Date().toISOString()

    // 3. Create connected instance under user's collection
    const instance = {
      id: instanceId,
      userId: tokenData.userId,
      name: instanceName,
      connectedAt: now,
      lastSeenAt: now,
      status: 'active',
      metadata: metadata || {},
    }

    await db
      .collection('users')
      .doc(tokenData.userId)
      .collection('connectedInstances')
      .doc(instanceId)
      .set(instance)

    // 4. Mark token as used
    await tokenDoc.ref.update({
      used: true,
      usedAt: now,
      instanceId,
    })

    const response: ValidateTokenResponse = {
      success: true,
      userId: tokenData.userId,
      instanceId,
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Error validating token:', error)
    res.status(500).json({ success: false, error: String(error) })
  }
})

/**
 * Update heartbeat for a connected instance.
 */
export const updateHeartbeat = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  try {
    const { userId, instanceId } = req.body

    if (!userId || !instanceId) {
      res.status(400).json({ success: false, error: 'Missing userId or instanceId' })
      return
    }

    const now = new Date().toISOString()

    await db
      .collection('users')
      .doc(userId)
      .collection('connectedInstances')
      .doc(instanceId)
      .update({
        lastSeenAt: now,
        status: 'active',
      })

    res.status(200).json({ success: true, lastSeenAt: now })
  } catch (error) {
    console.error('Error updating heartbeat:', error)
    res.status(500).json({ success: false, error: String(error) })
  }
})

interface MigrateDataRequest {
  userId: string
  tasks?: Array<{
    id: string
    title: string
    lane: string
    priority: string
    owner?: string
    problem?: string
    scope?: string
    acceptanceCriteria?: string[]
    createdAt: string
    updatedAt: string
    statusHistory?: Array<{ at: string; from?: string; to: string; note?: string }>
  }>
  activity?: Array<{
    id: string
    at: string
    level: string
    source: string
    message: string
    meta?: Record<string, unknown>
  }>
}

/**
 * Migrate legacy data to a user's Firestore collections.
 * This is a one-time migration helper.
 */
export const migrateData = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  try {
    const { userId, tasks, activity } = req.body as MigrateDataRequest

    if (!userId) {
      res.status(400).json({ success: false, error: 'Missing userId' })
      return
    }

    const results = {
      tasks: 0,
      activity: 0,
    }

    // Migrate tasks
    if (tasks && tasks.length > 0) {
      const batch = db.batch()
      for (const task of tasks) {
        const ref = db.collection('users').doc(userId).collection('tasks').doc(task.id)
        batch.set(ref, task)
        results.tasks++
      }
      await batch.commit()
    }

    // Migrate activity
    if (activity && activity.length > 0) {
      const batch = db.batch()
      for (const event of activity) {
        const ref = db.collection('users').doc(userId).collection('activity').doc(event.id)
        batch.set(ref, event)
        results.activity++
      }
      await batch.commit()
    }

    res.status(200).json({ success: true, migrated: results })
  } catch (error) {
    console.error('Error migrating data:', error)
    res.status(500).json({ success: false, error: String(error) })
  }
})
