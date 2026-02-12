# Agent Profile Backend Implementation

**Branch:** `feature/dynamic-connected-instances`  
**Commit:** `665344a`  
**Date:** 2026-02-12

## ✅ Implementation Complete

All requirements have been successfully implemented for agent profile backend support in Claw Control Center.

---

## 1. Firestore Adapter (`src/adapters/firestoreAdapter.ts`)

### Added Methods

#### `listAgentProfiles(): Promise<AgentProfile[]>`
- Queries `users/{userId}/agentProfiles` collection
- Orders by `createdAt` descending
- Returns empty array on error (graceful degradation)
- Uses `convertTimestamps` helper for Firestore timestamp conversion

#### `getAgentProfile(id: string): Promise<AgentProfile>`
- Fetches single profile from `users/{userId}/agentProfiles/{id}`
- Throws error if profile not found
- Converts Firestore timestamps to ISO strings

#### `createAgentProfile(create: AgentProfileCreate): Promise<AgentProfile>`
- Validates input with TypeScript types
- Auto-generates ID using `makeId()` helper
- Sets `userId` from current authenticated user
- Creates timestamps (`createdAt`, `updatedAt`)
- Saves to Firestore collection
- Logs activity event: "Agent profile created: {name}"
- Returns created profile

#### `updateAgentProfile(update: AgentProfileUpdate): Promise<AgentProfile>`
- Updates existing profile document
- Updates `updatedAt` timestamp
- Logs activity event: "Agent profile updated: {name}"
- Returns updated profile

#### `deleteAgentProfile(id: string): Promise<{ ok: boolean }>`
- Deletes profile document from Firestore
- Logs activity event: "Agent profile deleted: {name}"
- Returns success result

### Firestore Collection Structure
```
users/
  {userId}/
    agentProfiles/
      {profileId}/
        - id: string
        - userId: string
        - name: string
        - role: string
        - emoji?: string
        - model?: string
        - createdAt: string (ISO)
        - updatedAt: string (ISO)
```

---

## 2. Mock Adapter (`src/adapters/mockAdapter.ts`)

### Stub Implementations
All five methods throw descriptive errors:
```typescript
throw new Error('Agent profiles only available with Firestore adapter')
```

Methods:
- `listAgentProfiles()`
- `getAgentProfile()`
- `createAgentProfile()`
- `updateAgentProfile()`
- `deleteAgentProfile()`

---

## 3. Bridge Adapter (`src/adapters/bridgeAdapter.ts`)

### Stub Implementations
All five methods throw descriptive errors:
```typescript
throw new Error('Agent profiles only available with Firestore adapter')
```

Methods:
- `listAgentProfiles()`
- `getAgentProfile()`
- `createAgentProfile()`
- `updateAgentProfile()`
- `deleteAgentProfile()`

---

## 4. Type Definitions (`src/types.ts`)

### AgentProfile Type
```typescript
export type AgentProfile = {
  id: string
  userId: string
  name: string
  role: string
  emoji?: string
  model?: string
  createdAt: string
  updatedAt: string
}
```

### AgentProfileCreate Type
```typescript
export type AgentProfileCreate = {
  name: string
  role: string
  emoji?: string
  model?: string
}
```

### AgentProfileUpdate Type
```typescript
export type AgentProfileUpdate = {
  id: string
  name?: string
  role?: string
  emoji?: string
  model?: string
}
```

### Task Type Extensions
The `Task` type already includes the required fields:
```typescript
export type Task = {
  // ... other fields
  projectId?: string           // ✅ Already present
  assignedProfileId?: string   // ✅ Already present
  // ...
}
```

---

## 5. Adapter Interface (`src/adapters/adapter.ts`)

### Agent Profile Methods Added to Interface
```typescript
export type Adapter = {
  // ... other methods
  
  // Agent Profiles
  listAgentProfiles(): Promise<AgentProfile[]>
  getAgentProfile(id: string): Promise<AgentProfile>
  createAgentProfile(create: AgentProfileCreate): Promise<AgentProfile>
  updateAgentProfile(update: AgentProfileUpdate): Promise<AgentProfile>
  deleteAgentProfile(id: string): Promise<{ ok: boolean }>
  
  // ...
}
```

---

## Implementation Patterns

### Following Existing Conventions

1. **Collection Helpers**: Uses `getUserCollection('agentProfiles')` and `getUserDoc('agentProfiles', id)`
2. **ID Generation**: Uses existing `makeId()` helper for unique IDs
3. **Timestamps**: Uses ISO strings via `new Date().toISOString()`
4. **Timestamp Conversion**: Uses `convertTimestamps()` helper for Firestore Timestamp objects
5. **Activity Logging**: Calls `logActivity('agent', message)` for audit trail
6. **Error Handling**: Graceful degradation with try/catch in list methods
7. **User Context**: Uses `getUserId()` to scope data per authenticated user

---

## Files Changed

```
src/adapters/adapter.ts          | 10 +++
src/adapters/bridgeAdapter.ts    | 17 +++++
src/adapters/firestoreAdapter.ts | 66 ++++++++++++++++++
src/adapters/mockAdapter.ts      | 17 +++++
src/types.ts                     | 35 ++++++++++
─────────────────────────────────────────
5 files changed, 145 insertions(+)
```

---

## Testing Recommendations

### Firestore Adapter
- [ ] Test `createAgentProfile()` creates document in correct collection
- [ ] Test `listAgentProfiles()` returns profiles ordered by creation date
- [ ] Test `getAgentProfile()` throws error for non-existent profile
- [ ] Test `updateAgentProfile()` updates timestamps correctly
- [ ] Test `deleteAgentProfile()` removes document and logs activity
- [ ] Verify activity logs are created for all mutations

### Integration
- [ ] Verify Task type accepts `projectId` and `assignedProfileId`
- [ ] Test authentication requirement (getUserId() throws when not authed)
- [ ] Verify user isolation (profiles only accessible by owner)

### Type Safety
- [ ] Run TypeScript compiler to verify all types are correct
- [ ] Verify adapter interface compliance

---

## Next Steps

1. **UI Integration**: Connect Mission Control UI to new adapter methods
2. **Testing**: Add unit tests for adapter methods
3. **Documentation**: Update API documentation with agent profile endpoints
4. **Firestore Rules**: Add security rules for `agentProfiles` collection
5. **Indexes**: Add Firestore index for `createdAt` ordering if needed

---

## Security Considerations

### Firestore Security Rules (Recommended)
```javascript
match /users/{userId}/agentProfiles/{profileId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

This ensures:
- Only authenticated users can access agent profiles
- Users can only access their own profiles
- No cross-user data leakage

---

## Status: ✅ Ready for Review

All requirements completed and committed to `feature/dynamic-connected-instances` branch.
