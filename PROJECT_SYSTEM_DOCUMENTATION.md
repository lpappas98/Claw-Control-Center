# Claw Control Center - Project Management System Documentation

## Overview

The Project Management System is the core organizational framework for Claw Control Center. It provides a structured way to manage projects, tasks, code analysis, and AI-powered assistance through your connected OpenClaw instances.

## Core Concepts

### Projects

**Purpose:** A project represents a distinct unit of work - typically a codebase, application, or feature set.

**Key Properties:**
- **Name:** Project identifier
- **Description:** Overview of what the project is
- **Status:** Current state (active, on-hold, completed, archived)
- **Type:** Classification (web-app, mobile-app, library, infrastructure, etc.)
- **Tags:** Flexible categorization for filtering/grouping
- **Created/Updated timestamps:** Automatic tracking

**Project Hierarchy:**
- Projects can contain multiple tasks
- Projects can have uploaded files/codebases
- Projects can have AI-generated questions for clarification
- Projects maintain a rules knowledge base for AI context

### Tasks

**Purpose:** Individual actionable items within a project.

**Key Properties:**
- **Title:** What needs to be done
- **Description:** Detailed requirements
- **Status:** Todo, In Progress, Done, Blocked
- **Priority:** Low, Medium, High, Critical
- **Assigned To:** Optional OpenClaw instance assignment
- **Due Date:** Optional deadline
- **Tags:** Flexible categorization
- **Dependencies:** Links to other tasks (future enhancement)

**Task Workflow:**
1. Create task within project
2. Assign to OpenClaw instance (optional)
3. Track progress through status updates
4. Mark complete when done
5. Archive or delete when no longer needed

### AI-Powered Features

#### 1. Question Generator
**Purpose:** Automatically identify gaps and ambiguities in project requirements.

**How It Works:**
- Analyzes project description and task list
- Generates clarifying questions about:
  - Requirements gaps
  - Technical decisions needed
  - Scope boundaries
  - Integration points
  - Dependencies
  - Success criteria

**Use Case:** Before starting implementation, run question generation to ensure all requirements are clear.

#### 2. Deep Code Analyzer
**Purpose:** Understand uploaded codebases and extract meaningful insights.

**Capabilities:**
- File structure analysis
- Technology stack detection
- Architecture pattern identification
- Code quality assessment
- Dependency mapping
- Entry points identification
- Configuration analysis

**Use Case:** Upload an existing codebase to quickly understand it and generate tasks for modifications/improvements.

#### 3. Conversational Intake
**Purpose:** Natural language project creation through conversation.

**How It Works:**
1. Start conversation with project idea
2. AI asks clarifying questions
3. User answers iteratively
4. System generates structured project with tasks
5. Review and refine before finalizing

**Use Case:** Quickly capture project ideas without manual structure creation.

## Project Import System

### File Upload
**Supported:**
- Individual files (code, docs, configs)
- ZIP archives (entire codebases)
- Multiple file types simultaneously

**Processing:**
- Files stored in `projects/<project-id>/uploads/`
- Automatic extraction for ZIP archives
- File metadata tracking (name, size, type, upload date)

**Integration:**
- Uploaded files available for AI analysis
- Code analyzer automatically scans uploaded code
- Files become part of project context for OpenClaw instances

### Import Workflows

#### Workflow 1: New Project from Codebase
1. Create empty project
2. Upload ZIP of codebase
3. Run Deep Code Analyzer
4. Review generated insights
5. Auto-generate tasks based on analysis
6. Assign tasks to OpenClaw instances

#### Workflow 2: Existing Project Enhancement
1. Open existing project
2. Upload additional files/code
3. Re-run analysis
4. Update tasks based on new insights

## Rules System

**Purpose:** Context-specific guidelines and knowledge that AI should follow for a project.

**Rule Structure:**
- **ID:** Unique identifier
- **Title:** Brief summary
- **Description:** Optional extended description
- **Content:** The actual rule text (Markdown supported)
- **Enabled:** Active/inactive toggle
- **Created/Updated:** Automatic tracking

**Use Cases:**
- Coding standards for the project
- Architecture decisions
- API conventions
- Deployment procedures
- Testing requirements
- Security guidelines

**Rule Scope:**
- Rules are project-specific
- Rules are injected into AI context when working on that project
- Rules can be enabled/disabled without deletion
- Rules support rich formatting (Markdown)

**Integration:**
- Rules automatically included in OpenClaw instance context
- Rules visible in UI for human reference
- Rules persist across sessions

## Worker Services

### Background Processing

**Services:**
1. **AI Question Generator Worker**
   - Runs asynchronously when triggered
   - Processes project data to generate questions
   - Updates project with results

2. **Code Analyzer Worker**
   - Processes uploaded files
   - Extracts insights and patterns
   - Generates structured analysis report

3. **Project Importer Worker**
   - Handles large file uploads
   - Manages ZIP extraction
   - Coordinates with other workers for analysis

**Worker Management:**
- Start: `npm run workers`
- Stop: `npm run workers:stop`
- Restart: `npm run workers:restart`
- View logs: `npm run workers:logs`

**Worker Coordination:**
- Workers read from shared data store (JSON files)
- Workers update status in metadata files
- Workers log to individual log files in `logs/`
- Workers can run concurrently for different projects

## OpenClaw Instance Integration

### Instance Registration
- OpenClaw instances self-register via heartbeat API
- Instance metadata stored (ID, name, status, capabilities)
- Real-time status updates via polling

### Task Assignment
**Current:**
- Tasks have `assignedTo` field for instance ID
- UI shows which instance owns which task
- Manual assignment through UI

**Planned:**
- Automatic task routing based on instance capabilities
- Load balancing across instances
- Instance workload visibility

### Context Injection
When OpenClaw instance works on a project task:
1. Project description loaded
2. Relevant task details provided
3. Project rules injected into context
4. Uploaded files/code made available
5. Related tasks visible for context

## Data Storage

### File Structure
```
projects/
├── <project-id>/
│   ├── project.json          # Project metadata
│   ├── tasks.json           # Task list
│   ├── rules.json           # Project rules
│   ├── questions.json       # AI-generated questions
│   ├── analysis.json        # Code analysis results
│   └── uploads/             # Uploaded files
│       ├── file1.js
│       ├── file2.py
│       └── archive.zip
```

### Persistence
- All data persists to JSON files
- Atomic writes to prevent corruption
- Automatic timestamps on all updates
- File-based for simplicity (no database required)

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/projects/:id/tasks` - List project tasks
- `POST /api/projects/:id/tasks` - Create task
- `PUT /api/projects/:projectId/tasks/:taskId` - Update task
- `DELETE /api/projects/:projectId/tasks/:taskId` - Delete task

### AI Features
- `POST /api/projects/:id/generate-questions` - Trigger question generation
- `POST /api/projects/:id/analyze-code` - Trigger code analysis
- `POST /api/projects/:id/conversational-intake` - Start conversational project creation

### File Management
- `POST /api/projects/:id/upload` - Upload files
- `GET /api/projects/:id/files` - List uploaded files
- `DELETE /api/projects/:id/files/:filename` - Delete file

### Rules
- `GET /api/projects/:id/rules` - List project rules
- `POST /api/projects/:id/rules` - Create rule
- `PUT /api/projects/:id/rules/:ruleId` - Update rule
- `DELETE /api/projects/:id/rules/:ruleId` - Delete rule

## User Workflows

### Workflow: Start a New Software Project

1. **Create Project**
   - Click "New Project"
   - Fill in name, description, type
   - Add relevant tags
   - Save

2. **Define Requirements**
   - Create high-level tasks for major features
   - Run AI Question Generator
   - Review and answer generated questions
   - Refine tasks based on answers

3. **Establish Rules**
   - Add coding standards
   - Define architecture decisions
   - Document API conventions
   - Enable all rules

4. **Import Existing Code (if any)**
   - Upload ZIP of existing codebase
   - Run Deep Code Analyzer
   - Review analysis insights
   - Generate additional tasks for improvements

5. **Assign Work**
   - Assign tasks to OpenClaw instances
   - Monitor progress through status updates
   - Review completed work

### Workflow: Debug an Existing Codebase

1. **Create Analysis Project**
   - Create project for the debugging effort
   - Upload the problematic codebase

2. **Analyze**
   - Run Deep Code Analyzer
   - Review file structure, dependencies, entry points
   - Identify potential problem areas

3. **Create Investigation Tasks**
   - Create tasks for each issue to investigate
   - Assign to OpenClaw instances with code context
   - Track findings in task descriptions

4. **Document Solutions**
   - Update rules with lessons learned
   - Create follow-up tasks for fixes
   - Archive when complete

### Workflow: Feature Planning with AI

1. **Conversational Intake**
   - Start conversational intake session
   - Describe feature idea in natural language
   - Answer AI's clarifying questions iteratively

2. **Review Generated Project**
   - Check auto-generated project structure
   - Verify tasks make sense
   - Add/modify as needed

3. **Refine with Questions**
   - Run Question Generator
   - Answer any remaining ambiguities
   - Update project accordingly

4. **Proceed to Implementation**
   - Assign tasks to instances
   - Track progress

## Best Practices

### Project Organization
- **One project per distinct deliverable** - Don't mix unrelated work
- **Use descriptive names** - Make projects easy to identify
- **Tag consistently** - Establish tagging conventions across projects
- **Archive completed projects** - Keep active list clean

### Task Management
- **Break down large tasks** - Keep tasks focused and achievable
- **Use priorities** - Critical/High for urgent work, Low for nice-to-haves
- **Update status regularly** - Keep team/instances aware of progress
- **Link related tasks** - Use tags or descriptions to show relationships

### AI Features
- **Run question generation early** - Before significant work begins
- **Answer questions completely** - Better context = better results
- **Re-run analysis after changes** - Keep insights current
- **Review AI suggestions** - AI is assistive, not autonomous

### Rules
- **Start simple** - Add rules as patterns emerge
- **Be specific** - Clear rules are more useful than vague ones
- **Keep rules current** - Update as project evolves
- **Disable, don't delete** - Preserve history even if rule no longer applies

### File Uploads
- **Upload complete codebases** - Full context helps AI analysis
- **Use ZIP for multiple files** - Easier than individual uploads
- **Re-upload after major changes** - Keep analyzed code current
- **Clean up old uploads** - Remove obsolete files to save space

## Future Enhancements

### Planned Features
1. **Task Dependencies** - Visual DAG, blocking relationships
2. **Time Tracking** - Estimate vs actual, burndown charts
3. **Collaboration** - Multi-user access, comments, mentions
4. **Version Control Integration** - Git sync, branch awareness
5. **Advanced Analytics** - Project health metrics, velocity tracking
6. **Template System** - Reusable project structures
7. **Export/Import** - Project portability across instances
8. **Real-time Updates** - WebSocket for live collaboration
9. **Mobile UI** - Responsive design for mobile management
10. **Notification System** - Alerts for task updates, deadlines

### Integration Goals
- **GitHub/GitLab** - Issue sync, PR tracking
- **Jira/Linear** - Bidirectional sync
- **Slack/Discord** - Notifications, status updates
- **CI/CD Pipelines** - Build status, deployment tracking

## Troubleshooting

### Workers Not Starting
- Check `npm run workers:logs` for errors
- Ensure port 8787 is available
- Verify file permissions in `logs/` directory
- Check that all worker scripts are executable

### Files Not Uploading
- Check file size limits (configured in server.mjs)
- Verify `projects/<id>/uploads/` directory exists and is writable
- Check bridge server logs for upload errors
- Ensure ZIP files are not corrupted

### AI Features Not Responding
- Verify OpenClaw instance is connected
- Check that project has enough context (description, tasks)
- Review worker logs for processing errors
- Ensure API endpoints are responding (curl test)

### Rules Not Appearing
- Check that rules are enabled (not just created)
- Verify rules.json file exists and is valid JSON
- Restart bridge server to reload rules
- Check browser console for fetch errors

## Technical Architecture

### Frontend (React + Vite)
- **Location:** `src/` directory
- **Entry:** `src/main.tsx`
- **Key Components:**
  - `ProjectList.tsx` - Project grid/list view
  - `ProjectDetail.tsx` - Single project view with tabs
  - `TaskList.tsx` - Task management UI
  - `RuleEditor.tsx` - Rule CRUD interface
  - `FileUpload.tsx` - File upload UI
  - `QuestionView.tsx` - Display AI-generated questions

### Backend (Express.js)
- **Location:** `bridge/server.mjs`
- **Port:** 8787 (configurable)
- **Key Modules:**
  - `pmProjectsStore.mjs` - Project data persistence
  - `aiQuestionGenerator.mjs` - Question generation logic
  - `deepCodeAnalyzer.mjs` - Code analysis engine
  - `conversationalIntake.mjs` - Conversational project creation
  - `fileUploadHandler.mjs` - File upload processing
  - `rules.mjs` - Rules management
  - `workerService.mjs` - Worker coordination

### Data Layer
- **Storage:** File-based JSON
- **Location:** `projects/` directory
- **Schema:** Documented in each module
- **Backups:** Manual (copy projects/ directory)

### Worker Processes
- **Execution:** Separate Node.js processes
- **Communication:** File-based queues
- **Logging:** Individual log files per worker
- **Lifecycle:** Managed via npm scripts

## Security Considerations

### Current State
- **Local-only access** - No authentication required (single-user)
- **File uploads** - No virus scanning (trust local files)
- **Data privacy** - All data stored locally, not shared

### Production Recommendations
1. **Add authentication** - JWT or session-based
2. **Implement RBAC** - Role-based access for multi-user
3. **Scan uploads** - Virus/malware scanning for uploaded files
4. **Rate limiting** - Prevent API abuse
5. **Input validation** - Sanitize all user inputs
6. **HTTPS** - Encrypt traffic in production
7. **Backup strategy** - Automated backups of projects/
8. **Audit logging** - Track who changed what when

---

**Last Updated:** 2026-02-13
**Version:** 1.0
**Maintained By:** OpenClaw Project Management Team
