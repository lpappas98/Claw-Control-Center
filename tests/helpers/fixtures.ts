/**
 * Test data fixtures and generators
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  lane: string;
  assignedAgent?: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a timestamp
 */
export function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a test user fixture
 */
export function createUser(overrides: Partial<User> = {}): User {
  const id = overrides.id || generateId();
  return {
    id,
    username: overrides.username || `testuser_${id}`,
    email: overrides.email || `testuser_${id}@example.com`,
    password: overrides.password || 'TestPassword123!',
    role: overrides.role || 'user',
  };
}

/**
 * Create a test task fixture
 */
export function createTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id || generateId();
  return {
    id,
    title: overrides.title || `Test Task ${id}`,
    description: overrides.description || `Description for test task ${id}`,
    priority: overrides.priority || 'P2',
    status: overrides.status || 'pending',
    lane: overrides.lane || 'queued',
    assignedAgent: overrides.assignedAgent,
    createdAt: overrides.createdAt || generateTimestamp(),
  };
}

/**
 * Create a test agent fixture
 */
export function createAgent(overrides: Partial<Agent> = {}): Agent {
  const id = overrides.id || generateId();
  return {
    id,
    name: overrides.name || `agent_${id}`,
    role: overrides.role || 'qa',
    status: overrides.status || 'active',
  };
}

/**
 * Create multiple test tasks
 */
export function createTasks(count: number, baseOverrides: Partial<Task> = {}): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createTask({
      ...baseOverrides,
      title: baseOverrides.title || `Test Task ${i + 1}`,
    })
  );
}

/**
 * Create multiple test users
 */
export function createUsers(count: number, baseOverrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      ...baseOverrides,
      username: baseOverrides.username || `testuser${i + 1}`,
      email: baseOverrides.email || `testuser${i + 1}@example.com`,
    })
  );
}

/**
 * Create multiple test agents
 */
export function createAgents(count: number, baseOverrides: Partial<Agent> = {}): Agent[] {
  return Array.from({ length: count }, (_, i) =>
    createAgent({
      ...baseOverrides,
      name: baseOverrides.name || `agent${i + 1}`,
    })
  );
}

/**
 * Generate random text
 */
export function randomText(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `${randomText(8)}@example.com`;
}

/**
 * Generate random number in range
 */
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick random item from array
 */
export function randomItem<T>(items: T[]): T {
  return items[randomNumber(0, items.length - 1)];
}

/**
 * Wait for a specified duration (use sparingly)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
