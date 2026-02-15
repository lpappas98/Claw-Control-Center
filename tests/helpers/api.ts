import { APIRequestContext, request } from '@playwright/test';

/**
 * API helper utilities for test setup and teardown
 */

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';

export interface APIResponse<T = any> {
  status: number;
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Create an API request context
 */
export async function createAPIContext(baseURL: string = DEFAULT_API_BASE_URL): Promise<APIRequestContext> {
  return await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Make a GET request
 */
export async function apiGet<T = any>(
  context: APIRequestContext,
  endpoint: string,
  options: { headers?: Record<string, string> } = {}
): Promise<APIResponse<T>> {
  const response = await context.get(endpoint, {
    headers: options.headers,
  });

  const status = response.status();
  const ok = response.ok();

  try {
    const data = await response.json();
    return { status, ok, data };
  } catch {
    const text = await response.text();
    return { status, ok, error: text };
  }
}

/**
 * Make a POST request
 */
export async function apiPost<T = any>(
  context: APIRequestContext,
  endpoint: string,
  body: any,
  options: { headers?: Record<string, string> } = {}
): Promise<APIResponse<T>> {
  const response = await context.post(endpoint, {
    data: body,
    headers: options.headers,
  });

  const status = response.status();
  const ok = response.ok();

  try {
    const data = await response.json();
    return { status, ok, data };
  } catch {
    const text = await response.text();
    return { status, ok, error: text };
  }
}

/**
 * Make a PUT request
 */
export async function apiPut<T = any>(
  context: APIRequestContext,
  endpoint: string,
  body: any,
  options: { headers?: Record<string, string> } = {}
): Promise<APIResponse<T>> {
  const response = await context.put(endpoint, {
    data: body,
    headers: options.headers,
  });

  const status = response.status();
  const ok = response.ok();

  try {
    const data = await response.json();
    return { status, ok, data };
  } catch {
    const text = await response.text();
    return { status, ok, error: text };
  }
}

/**
 * Make a DELETE request
 */
export async function apiDelete<T = any>(
  context: APIRequestContext,
  endpoint: string,
  options: { headers?: Record<string, string> } = {}
): Promise<APIResponse<T>> {
  const response = await context.delete(endpoint, {
    headers: options.headers,
  });

  const status = response.status();
  const ok = response.ok();

  try {
    const data = await response.json();
    return { status, ok, data };
  } catch {
    const text = await response.text();
    return { status, ok, error: text };
  }
}

/**
 * Create a test task via API
 */
export async function createTaskViaAPI(
  context: APIRequestContext,
  task: any
): Promise<APIResponse> {
  return await apiPost(context, '/api/tasks', task);
}

/**
 * Delete a task via API
 */
export async function deleteTaskViaAPI(
  context: APIRequestContext,
  taskId: string
): Promise<APIResponse> {
  return await apiDelete(context, `/api/tasks/${taskId}`);
}

/**
 * Get task via API
 */
export async function getTaskViaAPI(
  context: APIRequestContext,
  taskId: string
): Promise<APIResponse> {
  return await apiGet(context, `/api/tasks/${taskId}`);
}

/**
 * Update task via API
 */
export async function updateTaskViaAPI(
  context: APIRequestContext,
  taskId: string,
  updates: any
): Promise<APIResponse> {
  return await apiPut(context, `/api/tasks/${taskId}`, updates);
}

/**
 * Get all tasks via API
 */
export async function getTasksViaAPI(
  context: APIRequestContext
): Promise<APIResponse> {
  return await apiGet(context, '/api/tasks');
}

/**
 * Create an agent via API
 */
export async function createAgentViaAPI(
  context: APIRequestContext,
  agent: any
): Promise<APIResponse> {
  return await apiPost(context, '/api/agents', agent);
}

/**
 * Delete an agent via API
 */
export async function deleteAgentViaAPI(
  context: APIRequestContext,
  agentId: string
): Promise<APIResponse> {
  return await apiDelete(context, `/api/agents/${agentId}`);
}

/**
 * Cleanup all test data (tasks, agents, etc.)
 * Useful for test teardown
 */
export async function cleanupTestData(
  context: APIRequestContext,
  testIds: string[]
): Promise<void> {
  for (const id of testIds) {
    // Attempt to delete from various endpoints
    await deleteTaskViaAPI(context, id).catch(() => {});
    await deleteAgentViaAPI(context, id).catch(() => {});
  }
}

/**
 * Wait for API to be ready
 */
export async function waitForAPI(
  baseURL: string = DEFAULT_API_BASE_URL,
  maxAttempts: number = 10,
  delayMs: number = 1000
): Promise<boolean> {
  const context = await createAPIContext(baseURL);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await apiGet(context, '/health');
      if (response.ok) {
        await context.dispose();
        return true;
      }
    } catch {
      // Ignore errors and retry
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  await context.dispose();
  return false;
}
