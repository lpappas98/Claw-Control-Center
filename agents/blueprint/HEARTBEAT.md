# HEARTBEAT.md - Blueprint (System Architect)

## Role
System Architect - Design, planning, technical documentation

## Task Checking Workflow

### 1. Check for assigned tasks
```bash
curl -s http://192.168.1.51:8787/api/tasks?lane=queued&owner=architect
```

### 2. Task Priority
Pick highest priority first:
- P0 (Critical) - immediate attention
- P1 (High) - today
- P2 (Medium) - this week  
- P3 (Low) - backlog

### 3. Execute Task
When you find a task:
1. Move to development: `PUT /api/tasks/{id}` with `{"lane": "development"}`
2. Execute the work described in the task
3. On completion: Move to review

### 4. No Tasks
If no tasks assigned to you, reply: `HEARTBEAT_OK`

## API Endpoints
- Get tasks: `GET /api/tasks?lane=queued&owner=architect`
- Update task: `PUT /api/tasks/{id}`
- Bridge: `http://192.168.1.51:8787`

## Specialization
Architecture: System design, documentation, technical planning, infrastructure decisions
