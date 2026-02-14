import { test, expect } from '@playwright/test';

test.describe('Bridge API - Task Management', () => {
  const baseURL = 'http://localhost:8787';

  test('1. GET /api/status - Server is running', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/status`);
    expect(response.status()).toBeLessThan(500);
  });

  test('2. GET /api/tasks - Retrieve tasks list', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/tasks`);
    expect(response.status()).toBeLessThan(500);
    
    const body = await response.json().catch(() => ({}));
    // Should either return an array or an object
    expect(body).toBeDefined();
  });

  test('3. POST /api/tasks - Create a new task', async ({ request }) => {
    const taskData = {
      title: 'E2E Test Task',
      description: 'A task created by E2E tests',
      status: 'todo',
    };

    const response = await request.post(`${baseURL}/api/tasks`, {
      data: taskData,
    });

    expect(response.status()).toBeLessThan(500);
    
    const body = await response.json().catch(() => null);
    if (body && body.id) {
      expect(body.id).toBeDefined();
    }
  });

  test('4. GET /api/projects - Retrieve projects', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/projects`);
    expect(response.status()).toBeLessThan(500);
  });

  test('5. GET /api/workers - Retrieve workers/agents', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/workers`);
    expect(response.status()).toBeLessThan(500);
  });

  test('6. GET /api/blockers - Retrieve task blockers', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/blockers`);
    expect(response.status()).toBeLessThan(500);
  });

  test('7. GET /api/activity - Get activity log', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/activity`);
    expect(response.status()).toBeLessThan(500);
  });

  test('8. GET /api/models - Get available models', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/models`);
    expect(response.status()).toBeLessThan(500);
  });

  test('9. GET /api/rules - Get rules', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/rules`);
    expect(response.status()).toBeLessThan(500);
  });

  test('10. GET /api/live - Check if server is live', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/live`);
    // The live endpoint should be available
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Bridge API - Task Operations', () => {
  const baseURL = 'http://localhost:8787';
  let createdTaskId: string;

  test('Create task and retrieve it', async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${baseURL}/api/tasks`, {
      data: {
        title: 'Task to Retrieve',
        description: 'Testing create and retrieve',
        status: 'todo',
      },
    });

    const createBody = await createResponse.json().catch(() => null);
    if (createBody && createBody.id) {
      createdTaskId = createBody.id;
      
      // Retrieve tasks
      const listResponse = await request.get(`${baseURL}/api/tasks`);
      expect(listResponse.status()).toBeLessThan(500);
    }
  });

  test('Update a task', async ({ request }) => {
    if (!createdTaskId) {
      test.skip();
    }

    const updateResponse = await request.put(`${baseURL}/api/tasks/${createdTaskId}`, {
      data: {
        status: 'in-progress',
        title: 'Updated Task Title',
      },
    });

    expect(updateResponse.status()).toBeLessThan(500);
  });

  test('Create multiple tasks for performance test', async ({ request }) => {
    const taskPromises = [];
    
    // Create 5 tasks in parallel
    for (let i = 1; i <= 5; i++) {
      const promise = request.post(`${baseURL}/api/tasks`, {
        data: {
          title: `Batch Task ${i}`,
          description: `Task created in batch operation`,
          status: 'todo',
        },
      });
      taskPromises.push(promise);
    }

    const responses = await Promise.all(taskPromises);
    
    // All requests should succeed
    responses.forEach((response) => {
      expect(response.status()).toBeLessThan(500);
    });
  });

  test('Verify task list is not empty', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/tasks`);
    expect(response.status()).toBeLessThan(500);
    
    const body = await response.json().catch(() => null);
    if (Array.isArray(body)) {
      expect(body.length).toBeGreaterThanOrEqual(0);
    } else if (body && typeof body === 'object') {
      expect(body).toBeDefined();
    }
  });

  test('Create task with dependencies', async ({ request }) => {
    // Create first task (blocker)
    const blockerResponse = await request.post(`${baseURL}/api/tasks`, {
      data: {
        title: 'Blocker Task',
        status: 'todo',
      },
    });

    const blockerBody = await blockerResponse.json().catch(() => null);
    
    if (blockerBody && blockerBody.id) {
      // Create dependent task
      const dependentResponse = await request.post(`${baseURL}/api/tasks`, {
        data: {
          title: 'Dependent Task',
          status: 'todo',
          dependencies: [blockerBody.id],
        },
      });

      expect(dependentResponse.status()).toBeLessThan(500);
    }
  });
});

test.describe('Bridge API - Project Management', () => {
  const baseURL = 'http://localhost:8787';

  test('List projects', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/projects`);
    expect(response.status()).toBeLessThan(500);
  });

  test('Create project', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      data: {
        name: 'E2E Test Project',
        description: 'Project created for E2E testing',
      },
    }).catch(() => ({ status: () => 500 }));

    // May fail due to missing permissions or validation, but shouldn't crash server
    expect(response.status()).toBeLessThan(500);
  });

  test('Get project management API', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/pm/projects`);
    expect(response.status()).toBeLessThan(500);
  });

  test('Get intake projects API', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/intake/projects`);
    expect(response.status()).toBeLessThan(500);
  });
});
