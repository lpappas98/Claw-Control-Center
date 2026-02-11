/**
 * OpenClaw Client Library for TARS Operator Hub
 * 
 * This module provides connection utilities for OpenClaw instances
 * to connect to the TARS Operator Hub Control Center.
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCcJYKMTGUKVn0vcH_I6qBqIU0xPtXLj4Q",
  authDomain: "claw-control-center.firebaseapp.com",
  projectId: "claw-control-center",
  storageBucket: "claw-control-center.firebasestorage.app",
  messagingSenderId: "1033311674576",
  appId: "1:1033311674576:web:9ccb2b95db32f2119c64fa"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig, 'openclaw-client')
const db = getFirestore(app)

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

/**
 * Connect this OpenClaw instance to the Control Center using a connection code
 */
export async function connectToControlCenter(
  code: string,
  instanceName: string,
  metadata?: ConnectionMetadata
): Promise<ConnectionResult> {
  try {
    // 1. Find and validate the token
    const tokenRef = doc(db, 'connectionTokens', code)
    const tokenSnap = await getDoc(tokenRef)
    
    if (!tokenSnap.exists()) {
      return { success: false, error: 'Invalid connection code' }
    }
    
    const tokenData = tokenSnap.data()
    
    // Check if already used
    if (tokenData.used) {
      return { success: false, error: 'Connection code already used' }
    }
    
    // Check expiration
    const expiresAt = tokenData.expiresAt.toDate()
    if (expiresAt < new Date()) {
      return { success: false, error: 'Connection code expired' }
    }
    
    // 2. Generate instance ID
    const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    
    // 3. Create connected instance record
    const instance = {
      id: instanceId,
      userId: tokenData.userId,
      name: instanceName,
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'active',
      metadata: metadata || {},
    }
    
    await setDoc(
      doc(db, 'users', tokenData.userId, 'connectedInstances', instanceId),
      instance
    )
    
    // 4. Mark token as used
    await updateDoc(tokenRef, {
      used: true,
      usedAt: new Date().toISOString(),
      instanceId,
    })
    
    return {
      success: true,
      userId: tokenData.userId,
      instanceId,
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
export async function sendHeartbeat(userId: string, instanceId: string): Promise<boolean> {
  try {
    const instanceRef = doc(db, 'users', userId, 'connectedInstances', instanceId)
    await updateDoc(instanceRef, {
      lastSeenAt: new Date().toISOString(),
      status: 'active',
    })
    return true
  } catch (error) {
    console.error('Heartbeat error:', error)
    return false
  }
}

/**
 * Disconnect this instance from the Control Center
 */
export async function disconnect(userId: string, instanceId: string): Promise<boolean> {
  try {
    const instanceRef = doc(db, 'users', userId, 'connectedInstances', instanceId)
    await updateDoc(instanceRef, {
      status: 'inactive',
      disconnectedAt: new Date().toISOString(),
    })
    return true
  } catch (error) {
    console.error('Disconnect error:', error)
    return false
  }
}

/**
 * Example usage in OpenClaw agent:
 * 
 * ```typescript
 * import { connectToControlCenter, sendHeartbeat } from './openclaw-client/connection'
 * 
 * // When user says "Connect to Claw Control Center with code: ABCD12"
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
 *   // Save credentials locally
 *   await saveConfig({
 *     userId: result.userId,
 *     instanceId: result.instanceId,
 *   })
 *   
 *   // Start heartbeat interval
 *   setInterval(() => {
 *     sendHeartbeat(result.userId!, result.instanceId!)
 *   }, 60000) // Every minute
 * }
 * ```
 */
