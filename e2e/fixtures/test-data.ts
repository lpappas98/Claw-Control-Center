/**
 * Test data fixtures for Playwright tests
 */

export const TEST_TASKS = {
  basic: {
    title: 'E2E Test Task - Basic',
    description: 'This is a basic test task for E2E testing',
    priority: 'P2',
    lane: 'queued',
    tag: 'QA',
  },
  
  highPriority: {
    title: 'E2E Test Task - High Priority',
    description: 'Critical task for testing high priority workflows',
    priority: 'P0',
    lane: 'queued',
    tag: 'Backend',
  },
  
  development: {
    title: 'E2E Test Task - Development',
    description: 'Task in development lane for testing',
    priority: 'P1',
    lane: 'development',
    tag: 'UI',
  },
  
  review: {
    title: 'E2E Test Task - Review',
    description: 'Task in review lane for testing',
    priority: 'P2',
    lane: 'review',
    tag: 'Frontend',
  },
};

export const TEST_PROJECTS = {
  testProject: {
    id: 'test-project-e2e',
    name: 'E2E Test Project',
    tagline: 'Project for end-to-end testing',
    description: 'This project is used for automated E2E tests',
  },
};

export const TEST_INTAKE = {
  simple: {
    projectId: 'test-project-e2e',
    text: 'Build a simple login page with email and password fields',
  },
  
  complex: {
    projectId: 'test-project-e2e',
    text: 'Create a comprehensive dashboard with charts, user management, and real-time updates',
  },
};

export const TEST_AGENTS = {
  tars: {
    slot: 'tars',
    name: 'TARS',
    role: 'Project Manager',
    emoji: '🧠',
  },
  
  forge: {
    slot: 'dev-1',
    name: 'Forge',
    role: 'Developer',
    emoji: '🛠️',
  },
  
  patch: {
    slot: 'dev-2',
    name: 'Patch',
    role: 'Developer',
    emoji: '🧩',
  },
  
  sentinel: {
    slot: 'qa',
    name: 'Sentinel',
    role: 'QA',
    emoji: '🛡️',
  },
};

export const TEST_WORK_DATA = {
  commits: [
    {
      hash: 'abc123def456',
      message: 'feat: implement test feature',
      timestamp: '2026-02-15T12:00:00Z',
    },
    {
      hash: 'def456ghi789',
      message: 'fix: resolve test bug',
      timestamp: '2026-02-15T13:00:00Z',
    },
  ],
  
  files: [
    {
      path: 'src/components/TestComponent.tsx',
      additions: 45,
      deletions: 12,
    },
    {
      path: 'src/pages/TestPage.tsx',
      additions: 120,
      deletions: 5,
    },
  ],
  
  testResults: {
    passed: 15,
    failed: 2,
    skipped: 1,
  },
  
  artifacts: [
    {
      name: 'test-report.html',
      url: 'http://example.com/reports/test-report.html',
      size: 2048,
    },
  ],
};

export const API_ENDPOINTS = {
  tasks: '/api/tasks',
  projects: '/api/projects',
  agents: '/api/agents',
  intake: '/api/intake',
  system: '/api/system/status',
  activity: '/api/activity',
};

// Helper to generate unique task titles for concurrent tests
export function generateUniqueTaskTitle(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to create task with work data
export function createTaskWithWork(baseTask: any, workData: any) {
  return {
    ...baseTask,
    work: workData,
  };
}
