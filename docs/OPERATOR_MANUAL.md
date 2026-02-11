# TARS Operator Hub - Operator Manual

**Complete guide for OpenClaw AI operators managing projects and tasks through the Control Center.**

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Mission Control Dashboard](#mission-control-dashboard)
4. [Task Management](#task-management)
5. [Projects Workflow](#projects-workflow)
6. [Best Practices](#best-practices)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The TARS Operator Hub is a web-based control center for managing software projects through AI-driven task workflows. It provides:

- **Task Board**: Kanban-style board for tracking work across lanes (proposed → queued → development → review → done)
- **Projects**: Full project lifecycle from initial idea through feature trees to implementation
- **Real-time Status**: Live monitoring of connected OpenClaw instances
- **Activity Feed**: Audit trail of all changes and actions

---

## Getting Started

### Connecting Your OpenClaw Instance

1. Visit the **Connect** tab
2. Click **"Generate Connection Code"**
3. Copy the 6-character code (e.g., `ABCD12`)
4. In your OpenClaw chat, say:
   ```
   Connect to Claw Control Center with code: ABCD12
   ```
5. Your instance will appear as connected within a few seconds

### First Time Setup

After connecting:

1. Navigate to **Mission Control** to see your connected instance
2. Check the **Task Board** (should be empty initially)
3. Explore the **Projects** tab to see available projects

---

## Mission Control Dashboard

The Mission Control page provides an overview of:

### Agent Status Cards

- **Name**: Your OpenClaw instance name (e.g., "TARS")
- **Status**: Online (working) or Offline (sleeping)
- **Current Task**: What the instance is currently working on
- **Last Heartbeat**: Time since last status update

When multiple instances are connected, you'll see all of them here.

### Task Board

A kanban-style board with lanes:

- **Blocked**: Tasks that can't proceed due to dependencies/issues
- **Proposed**: New ideas not yet approved for work
- **Queued**: Approved tasks waiting to be picked up
- **Development**: Tasks currently being worked on
- **Review**: Completed work awaiting review
- **Done**: Finished tasks

### Activity Feed

Recent events across all projects:

- Task creation/updates
- Status changes
- Agent actions
- System events

---

## Task Management

### Creating a Task

1. Click **"New task"** button (Mission Control or any project view)
2. Fill in the task form:
   - **Title**: Clear, descriptive title (e.g., "Fix login bug on mobile")
   - **Priority**: P0 (urgent) → P3 (low priority)
   - **Problem**: Why is this needed?
   - **Scope**: What's included/excluded?
   - **Acceptance Criteria**: How do we know it's done?
3. Click **"Create task"**

**Best Practice**: Always create a task BEFORE starting work. This ensures tracking and visibility.

### Task Lifecycle

```
Proposed → Queued → Development → Review → Done
```

**Lane Rules:**

- **Proposed** → **Queued**: Requires approval (PM/owner review)
- **Queued** → **Development**: Task is picked up for work
- **Development** → **Review**: Work is complete, needs review
- **Review** → **Done**: Approved and merged

**Blocked**: Can be set from any lane when work can't proceed

### Moving Tasks Between Lanes

**On Mission Control:**
- Tasks move automatically based on agent activity
- Manually drag cards to change lanes (if drag-drop is implemented)

**Best Practice**: Document WHY a task moved in the status history

### Task Details

Click any task card to view:

- Full description
- Acceptance criteria
- Status history (when it moved between lanes)
- Owner/assignee
- Priority changes

### Updating Tasks

1. Click the task card
2. Edit any field:
   - Title
   - Priority
   - Problem statement
   - Scope
   - Acceptance criteria
3. Changes are saved automatically

---

## Projects Workflow

The Projects page is where you design, scope, and manage entire features/products.

### Creating a New Project

1. Navigate to **Projects** tab
2. Click **"New Project"**
3. Enter project name and initial idea
4. Click **"Create"** → Opens the intake wizard

### Intake Wizard (Project-Level)

The intake wizard helps you scope a project before building it.

**Steps:**

1. **Idea**: Describe what you want to build
2. **Questions**: Answer guided questions about:
   - **Goals**: What problem does this solve?
   - **Users**: Who will use this?
   - **Scope**: What's in/out of scope?
   - **Constraints**: Time, budget, technical limits?
   - **Success metrics**: How do you measure success?
3. **Generated Scope**: AI analyzes your answers and generates:
   - Summary
   - In-scope features
   - Out-of-scope items
   - Assumptions
   - Risks

**Tips:**

- Be specific in your answers (the more detail, the better the scope)
- Reference real use cases or examples
- Don't worry about technical details yet

### Feature Tree

After intake, you'll see a **Tree** tab with a hierarchical breakdown of features:

```
📦 Project Name
├── 🎯 Epic 1: User Authentication
│   ├── ✨ Feature 1.1: Login Flow
│   ├── ✨ Feature 1.2: Password Reset
│   └── ✨ Feature 1.3: OAuth Integration
└── 🎯 Epic 2: Dashboard
    ├── ✨ Feature 2.1: Metrics Display
    └── ✨ Feature 2.2: Export Functionality
```

**Actions:**

- **Add Child**: Break down a feature into smaller sub-features
- **Edit**: Update title, description, acceptance criteria
- **Delete**: Remove a feature (careful!)
- **Feature Intake**: Launch detailed intake for a specific feature

### Feature-Level Intake

For any feature in the tree, you can run a **detailed intake** to refine requirements:

1. Click the feature node in the tree
2. Click **"Start Feature Intake"**
3. Answer questions specific to this feature:
   - **Goal**: What does this feature accomplish?
   - **Trigger**: What prompts a user to use it?
   - **Flow**: Step-by-step user flow
   - **Edge cases**: What can go wrong?
   - **Success criteria**: How do we validate it works?
4. AI generates:
   - Refined acceptance criteria
   - Detailed spec (problem statement, solution, non-goals)

**When to use Feature Intake:**

- Before implementing a complex feature
- When requirements are unclear
- To align with stakeholders before coding

### Kanban Board (Project-Level)

Each project has its own **Kanban** tab showing tasks linked to features:

- Cards are linked to tree nodes (features)
- Drag cards between lanes
- Create tasks directly from features
- Track progress across the project

**Tips:**

- One card per feature is a good starting point
- Break large features into multiple tasks when needed
- Use the tree view for planning, kanban for execution

### Exporting Projects

**JSON Export**: Full project data (tree, intake, tasks)
- Click **"Export JSON"** button
- Use for backups or analysis

**Markdown Export**: Human-readable project summary
- Click **"Export Markdown"** button
- Great for documentation or sharing

---

## Best Practices

### Task Hygiene

1. **Create tasks BEFORE doing work**
   - Don't start coding without a task card
   - Even small fixes deserve a task

2. **Write clear titles**
   - ❌ "Fix bug"
   - ✅ "Fix login redirect loop on /dashboard"

3. **Define acceptance criteria**
   - How do you know it's done?
   - What tests must pass?
   - What edge cases are handled?

4. **Move tasks consciously**
   - Don't skip lanes (e.g., proposed → done)
   - Add notes when moving to blocked

### Project Planning

1. **Start with intake**
   - Don't skip the intake wizard
   - Answer all questions thoroughly
   - Review the generated scope before proceeding

2. **Use the tree hierarchically**
   - Top-level: Epics or major features
   - Mid-level: User-facing features
   - Leaf-level: Specific implementation tasks

3. **Feature intake for complexity**
   - If a feature feels vague, run feature intake
   - Better to over-spec than under-spec

4. **Link tasks to features**
   - Every task should map to a feature node
   - Use the kanban board to see progress

### Collaboration

1. **Use activity feed for context**
   - Check recent changes before asking questions
   - Reference activity when debugging

2. **Document decisions**
   - Update task descriptions with "why"
   - Add notes to status history

3. **Keep lanes clean**
   - Done tasks should move to done (don't leave in review)
   - Blocked tasks should have clear blockers noted

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `n` | New task |
| `?` | Show keyboard shortcuts |
| `Esc` | Close modal |
| `Ctrl+K` / `Cmd+K` | Quick command palette (if implemented) |

---

## Troubleshooting

### My instance shows "offline"

1. Check that your OpenClaw is running
2. Verify the heartbeat cron job is active
3. Check the last heartbeat timestamp (should update every minute)
4. Try reconnecting with a new code

### Tasks aren't showing up

1. Refresh the page (hard refresh: `Ctrl+Shift+R`)
2. Check you're logged in with the correct Google account
3. Verify tasks were created under the right project
4. Check the console for errors

### Can't create tasks

1. Make sure you're logged in (Firebase auth)
2. Check Firestore security rules are deployed
3. Verify your account has write access

### Feature tree is empty

1. Complete the project intake wizard first
2. Manually add nodes using "Add Feature" button
3. Check that the project ID matches

### Connection code expired

Connection codes expire after 5 minutes. Generate a new code and try again.

---

## Advanced Usage

### Multiple OpenClaw Instances

You can connect multiple instances to the same Control Center:

1. Generate a code for each instance
2. Each instance shows up as a separate agent card
3. Tasks can be assigned to specific instances (via owner field)

### Custom Workflows

While the default workflow is `proposed → queued → development → review → done`, you can adapt it:

- Use "blocked" for dependencies
- Skip "proposed" for urgent work (go straight to queued)
- Use "review" for QA gates

### Data Backup

Regularly export projects as JSON:

1. Open each project
2. Click "Export JSON"
3. Store exports in version control or backup system

---

## Support

For issues, bugs, or feature requests:

- GitHub: [OpenClaw-Operator-Hub](https://github.com/lpappas98/OpenClaw-Operator-Hub)
- Discord: [OpenClaw Community](https://discord.com/invite/clawd)

---

**Last Updated**: 2026-02-11
