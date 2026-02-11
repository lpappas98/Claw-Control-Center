# Claw Control Center - Operator Guide

This guide explains how OpenClaw AI instances can interact with the Claw Control Center dashboard.

## Overview

Claw Control Center is a cloud-hosted dashboard for managing OpenClaw instances. It provides:
- Project management with tree views and kanban boards
- Task tracking with priorities and assignments
- Feature-level requirements gathering
- Activity feeds and status monitoring

## Connecting Your Instance

### Step 1: User Gets Connection Code
The user navigates to the **Connect** tab in the dashboard and clicks "Generate Connection Code". This creates a 6-character alphanumeric code (e.g., `ABC123`) that expires in 5 minutes.

### Step 2: User Tells You the Code
The user will say something like:
- "Connect to Claw Control Center with code: ABC123"
- "Link to the Hub using ABC123"

### Step 3: Validate and Register

When you receive a connection request:

1. **Parse the code** from the user's message
2. **Query Firestore** to validate the token:

```javascript
// Firestore path: connectionTokens/{code}
const tokenDoc = await getDoc(doc(db, 'connectionTokens', code))

if (!tokenDoc.exists()) {
  // Token not found or expired
  return "Invalid or expired connection code"
}

const token = tokenDoc.data()
if (token.status !== 'pending') {
  return "This code has already been used"
}
```

3. **Update the token** to mark connection:

```javascript
await updateDoc(doc(db, 'connectionTokens', code), {
  status: 'connected',
  instanceName: 'Your Instance Name',
  gatewayUrl: 'https://your-gateway-url',
  connectedAt: serverTimestamp()
})
```

4. **Add yourself to user's connected instances**:

```javascript
const userRef = doc(db, 'users', token.userId)
await updateDoc(userRef, {
  connectedInstances: arrayUnion({
    id: generateId(),
    name: 'Your Instance Name',
    gatewayUrl: 'https://your-gateway-url',
    connectedAt: new Date()
  })
})
```

5. **Confirm to user**: "Successfully connected to Claw Control Center!"

## API Reference

All data is stored in Firestore under the user's document path:

### Collections

```
users/{userId}/
  ├── projects/{projectId}/
  │   ├── tree/{nodeId}
  │   ├── cards/{cardId}
  │   ├── intake/data
  │   ├── featureIntakes/{nodeId}
  │   └── activity/{activityId}
  ├── tasks/{taskId}
  ├── rules/{ruleId}
  └── activity/{activityId}

connectionTokens/{tokenId}
```

### Project Schema

```typescript
{
  id: string
  name: string
  summary?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  tags: string[]
  links: Array<{ label: string; url: string }>
  owner?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Task Schema

```typescript
{
  id: string
  title: string
  lane: 'proposed' | 'queued' | 'development' | 'review' | 'blocked' | 'done'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  owner?: string
  problem?: string
  scope?: string
  acceptanceCriteria: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
  statusHistory: Array<{
    at: string
    from?: string
    to: string
    note?: string
  }>
}
```

### Tree Node Schema

```typescript
{
  id: string
  parentId?: string
  title: string
  description?: string
  status: 'draft' | 'ready' | 'in-progress' | 'done'
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  owner?: string
  tags: string[]
  acceptanceCriteria: string[]
  dependsOn: string[]
  sources: Array<{ questionId: string; excerpt: string }>
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Best Practices

### Task Management

1. **Create tasks before work**: Always create a task card before starting any significant work
2. **Update status**: Move tasks through lanes as work progresses
3. **Add acceptance criteria**: Define clear criteria for task completion
4. **Assign owners**: Use the `owner` field to track who's responsible

### Activity Logging

Log important events to the activity feed:
```javascript
await addDoc(collection(db, 'users', userId, 'activity'), {
  at: serverTimestamp(),
  level: 'info',
  source: 'your-instance-name',
  message: 'Description of what happened',
  meta: { /* optional context */ }
})
```

### Feature Intake

When a user wants to define a feature:
1. Generate contextual questions based on the feature
2. Present questions one at a time
3. Save answers to `featureIntakes/{nodeId}`
4. Use answers to generate acceptance criteria

## Firebase Configuration

Project: `claw-control-center`
Domain: `claw-control-center.web.app`

For direct Firestore access, use the Firebase Web SDK with the project config.

## Security Notes

- All data is scoped to the authenticated user's UID
- Connection tokens expire after 5 minutes
- Tokens are deleted after successful connection
- Firestore rules enforce user isolation
