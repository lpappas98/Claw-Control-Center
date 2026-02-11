# OpenClaw Operator Guide

## Connecting Your OpenClaw Instance

To connect your OpenClaw instance to the TARS Operator Hub:

### 1. Generate a Connection Code

1. Visit the [TARS Operator Hub](https://claw-control-center.web.app)
2. Log in with your Google account
3. Navigate to the **Connect** page
4. Click **"Generate Connection Code"**
5. You'll see a 6-character code (e.g., `UTTH46`)

The code expires in 5 minutes.

### 2. Tell Your OpenClaw to Connect

In your OpenClaw chat, send a message like:

```
Connect to Claw Control Center with code: UTTH46
```

Your OpenClaw instance will:
1. Validate the token with the Control Center
2. Register itself as a connected instance
3. Begin syncing project data

### 3. Verify Connection

Once connected, you'll see a success message in the web UI showing:
- Instance name
- Connection time
- Status (active/inactive)

Your OpenClaw can now:
- Access projects from the Control Center
- Sync tasks and kanban boards
- Report progress back to the dashboard

## Connection Flow (Technical)

```
┌─────────────┐                    ┌──────────────────┐                    ┌────────────────┐
│  Web UI     │                    │  Firestore DB    │                    │  OpenClaw      │
└─────────────┘                    └──────────────────┘                    └────────────────┘
       │                                    │                                       │
       │  1. Generate Token                 │                                       │
       ├───────────────────────────────────>│                                       │
       │  (writes to connectionTokens)      │                                       │
       │                                    │                                       │
       │  2. Display code to user           │                                       │
       │<───────────────────────────────────│                                       │
       │                                    │                                       │
       │                      3. User tells OpenClaw: "Connect with code: UTTH46"   │
       │                                    │<──────────────────────────────────────│
       │                                    │                                       │
       │                                    │  4. Validate token                    │
       │                                    │<──────────────────────────────────────│
       │                                    │     (read connectionTokens/{token})   │
       │                                    │                                       │
       │                                    │  5. If valid:                         │
       │                                    │    - Create connectedInstances/{id}   │
       │                                    │    - Mark token as used               │
       │                                    │───────────────────────────────────────>│
       │                                    │                                       │
       │  6. Real-time update (onSnapshot)  │                                       │
       │<───────────────────────────────────│                                       │
       │  (shows connected instance)        │                                       │
       │                                    │                                       │
```

## Security

- Tokens are short-lived (5 minutes)
- Tokens can only be used once
- Each instance gets a unique ID
- Users can disconnect instances at any time
- All data is user-scoped in Firestore

## Troubleshooting

### Token Expired
If you see "Token expired", generate a new code and try again.

### Connection Failed
Check that:
1. Your OpenClaw has internet access
2. The token was typed correctly (no spaces)
3. The token hasn't been used already

### Instance Not Showing
Refresh the Connect page. Instances should appear within a few seconds of connecting.

## Implementation Notes (for OpenClaw Agents)

When implementing the connection handler in your OpenClaw agent:

```typescript
// Pseudo-code for OpenClaw connection handler
async function connectToControlCenter(code: string) {
  // 1. Validate the token
  const response = await validateToken({
    token: code,
    instanceName: getInstanceName(),
    metadata: {
      version: getOpenClawVersion(),
      os: getOS(),
      node: getNodeVersion(),
    }
  })
  
  if (!response.success) {
    throw new Error(response.error)
  }
  
  // 2. Store credentials locally
  await saveConfig({
    userId: response.userId,
    instanceId: response.instanceId,
    connectedAt: new Date().toISOString(),
  })
  
  // 3. Start syncing
  await startProjectSync(response.userId)
  
  return { success: true, instanceId: response.instanceId }
}

// Heartbeat to keep connection active
setInterval(async () => {
  await updateInstanceHeartbeat(instanceId)
}, 60000) // Every minute
```

## Firebase Configuration

Your OpenClaw instance needs the Firebase web config to connect:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCcJYKMTGUKVn0vcH_I6qBqIU0xPtXLj4Q",
  authDomain: "claw-control-center.firebaseapp.com",
  projectId: "claw-control-center",
  storageBucket: "claw-control-center.firebasestorage.app",
  messagingSenderId: "1033311674576",
  appId: "1:1033311674576:web:9ccb2b95db32f2119c64fa"
}
```

This config is safe to share publicly (it's used client-side).
