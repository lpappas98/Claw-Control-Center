# Agent Profile Management - Implementation Notes

## ✅ Completed Tasks

### 1. Created `src/components/AgentProfileModal.tsx`

**Pattern**: Based on `TaskModal.tsx` structure

**Features**:
- Create and edit modes (determined by presence of `profile` prop)
- Form fields:
  - **Name** (required) - Agent display name
  - **Role** (required) - Agent role/function
  - **Emoji** (optional) - Icon for the agent (max 4 chars)
  - **Model** (optional) - AI model identifier
- Form validation: prevents saving with empty required fields
- Loading states: disables form during save operations
- Error handling: displays errors from adapter
- Dirty state tracking: only enables save button when changes are made (edit mode)
- Modal backdrop click-to-close
- Uses adapter methods: `createAgentProfile()` or `updateAgentProfile()`

**Component API**:
```tsx
<AgentProfileModal
  adapter={adapter}
  profile={profile | null}  // null = create mode, profile = edit mode
  onClose={() => void}
  onSaved={(profile: AgentProfile) => void}
/>
```

### 2. Updated `src/pages/MissionControl.tsx`

**Changes**:
- ✅ Added import for `AgentProfileModal` and `AgentProfile` type
- ✅ Added polling for agent profiles using `usePoll` (every 10s)
- ✅ Added state management:
  - `showProfileModal` - controls modal visibility
  - `editingProfile` - tracks which profile is being edited (null = create new)
- ✅ Added **"+ New Agent"** button in agents section header
- ✅ Display agent profiles in the agent cards grid
- ✅ Each profile card shows:
  - Emoji + Name
  - Role
  - Model (if set)
  - Created date
  - **Edit** button (opens modal in edit mode)
  - **Delete** button (with confirmation dialog)
- ✅ Added empty state when no profiles exist
- ✅ Modal is shown when `showProfileModal` is true
- ✅ Wired to adapter methods via AgentProfileModal

**UI Flow**:

**Create Flow**:
1. User clicks "+ New Agent" button
2. `setEditingProfile(null)` - sets create mode
3. `setShowProfileModal(true)` - opens modal
4. User fills form and clicks "Create"
5. Modal calls `adapter.createAgentProfile(data)`
6. Modal calls `onSaved()` callback
7. Modal calls `onClose()`
8. Poll automatically refreshes list within 10s

**Edit Flow**:
1. User clicks "Edit" on a profile card
2. `setEditingProfile(profile)` - sets edit mode with profile data
3. `setShowProfileModal(true)` - opens modal
4. Modal pre-fills form with profile data
5. User modifies and clicks "Save"
6. Modal calls `adapter.updateAgentProfile({ id, ...data })`
7. Modal closes, poll refreshes

**Delete Flow**:
1. User clicks "Delete" on a profile card
2. Browser `confirm()` dialog shows
3. If confirmed: calls `adapter.deleteAgentProfile(id)`
4. Poll refreshes automatically

### 3. Display Integration

**Agent Profiles Section**:
- Profiles are displayed in the same `agent-strip` as connected instances
- Each profile shows as an `agent-card` with:
  - Header: emoji + name, role
  - Actions: Edit and Delete buttons
  - Metadata: Model (if set), created date

**Empty State**:
- Shows when both `agents.length === 0` and `agentProfiles.length === 0`
- Only shown when using Firestore adapter
- Provides helpful message to create first profile

### 4. Adapter Integration

**Methods Used**:
- `adapter.listAgentProfiles()` - Fetch all profiles (polled every 10s)
- `adapter.createAgentProfile(create)` - Create new profile
- `adapter.updateAgentProfile(update)` - Update existing profile
- `adapter.deleteAgentProfile(id)` - Delete profile

**Error Handling**:
- listAgentProfiles: catches errors and returns empty array
- create/update: shows error in modal
- delete: shows alert on error

## Code Structure

### AgentProfileModal.tsx
```
AgentProfileModal
├── State
│   ├── busy (boolean)
│   ├── error (string | null)
│   ├── draftName
│   ├── draftRole
│   ├── draftEmoji
│   └── draftModel
├── Effects
│   └── Sync form with profile prop changes
├── Computed
│   ├── dirty (has changes)
│   └── canSave (required fields filled)
└── Render
    ├── Modal backdrop (click to close)
    ├── Modal header (title + close button)
    ├── Error callout (if error)
    ├── Form fields (4 inputs)
    └── Footer (Cancel + Save buttons)
```

### MissionControl.tsx Changes
```
MissionControl
├── Imports
│   ├── + AgentProfileModal
│   └── + AgentProfile type
├── State
│   ├── + agentProfiles (usePoll)
│   ├── + showProfileModal
│   └── + editingProfile
├── Render
│   └── Agent Section
│       ├── + Panel Header with "+ New Agent" button
│       ├── Existing agents (connected instances)
│       ├── + Agent profiles cards (with Edit/Delete)
│       └── + Empty state
└── Modals
    └── + AgentProfileModal
```

## Testing Checklist

- [x] Component builds successfully
- [ ] Modal opens when clicking "+ New Agent"
- [ ] Can create new agent profile
- [ ] Form validation works (prevents empty name/role)
- [ ] Can edit existing profile
- [ ] Edit mode pre-fills form correctly
- [ ] Can delete profile (with confirmation)
- [ ] Profiles display in agent cards
- [ ] Edit/Delete buttons work on profile cards
- [ ] Modal closes on backdrop click
- [ ] Modal closes on Cancel button
- [ ] Empty state shows when no profiles
- [ ] Errors display in modal
- [ ] Polling updates list automatically

## Files Changed

1. **New**: `src/components/AgentProfileModal.tsx` (177 lines)
2. **Modified**: `src/pages/MissionControl.tsx` (+110 lines)

## Git Commit

Branch: `feature/dynamic-connected-instances`
Commit: `fe7616a`

## Next Steps (Optional Enhancements)

1. **Immediate Refresh**: Add manual refresh trigger instead of waiting for poll
2. **Optimistic Updates**: Update UI immediately before server confirms
3. **Profile Assignment**: Link profiles to connected instances
4. **Online Status**: Show which profiles are currently active/connected
5. **Bulk Operations**: Select multiple profiles for batch actions
6. **Profile Templates**: Pre-defined role templates (Developer, Designer, PM, etc.)
7. **Rich Profiles**: Add more fields (description, skills, availability, etc.)
8. **Profile Search**: Filter/search profiles by name or role
9. **Profile Import/Export**: Bulk management via JSON
10. **Activity Log**: Track when profiles were created/modified/used

## Design Decisions

1. **Pattern Consistency**: Followed TaskModal.tsx pattern for familiarity
2. **Polling Strategy**: 10s interval balances freshness with API load
3. **No Optimistic Updates**: Simple approach, wait for server confirmation
4. **Inline Edit/Delete**: Quick access without extra navigation
5. **Confirmation Dialog**: Browser native confirm() for simplicity
6. **Same Section Display**: Profiles shown alongside connected instances for unified view
7. **Firestore-only**: Empty state only for Firestore adapter (where profiles are supported)

## Known Limitations

1. **Refresh Delay**: Changes take up to 10s to appear (poll interval)
2. **No Undo**: Delete is permanent (no soft delete)
3. **No Validation**: Emoji field accepts any text (not verified as emoji)
4. **No Sorting**: Profiles shown in creation order
5. **No Filtering**: Can't filter by role or model
6. **No Assignment**: Profiles not yet linked to instances or tasks
