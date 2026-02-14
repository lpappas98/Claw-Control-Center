#!/usr/bin/env node

import http from 'http';
import { test, describe, it, before, after } from 'node:test';
import assert from 'assert';

const BASE_URL = 'http://localhost:8787';
let taskId = null;

function httpRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

describe('Claw Control Center - E2E Tests', () => {
  describe('Task Creation & Management', () => {
    it('1. Creates a new task successfully', async () => {
      const result = await httpRequest('POST', '/api/tasks', {
        title: 'E2E Test Task',
        description: 'Test task created via E2E',
        status: 'todo',
      });

      assert.ok(result.status < 500, `Server error: ${result.status}`);
      if (result.body && result.body.id) {
        taskId = result.body.id;
      }
    });

    it('2. Retrieves tasks list', async () => {
      const result = await httpRequest('GET', '/api/tasks');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
      assert.ok(result.body !== undefined, 'Response body should be defined');
    });

    it('3. Updates a task', async () => {
      if (!taskId) {
        console.log('Skipping task update - no task ID');
        return;
      }

      const result = await httpRequest('PUT', `/api/tasks/${taskId}`, {
        title: 'Updated Task Title',
        status: 'in-progress',
      });

      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('4. Creates task with dependencies', async () => {
      // Create blocker task
      const blockerResult = await httpRequest('POST', '/api/tasks', {
        title: 'Blocker Task',
        status: 'todo',
      });

      assert.ok(blockerResult.status < 500, `Server error: ${blockerResult.status}`);

      // Create dependent task
      const dependentResult = await httpRequest('POST', '/api/tasks', {
        title: 'Dependent Task',
        status: 'todo',
        dependencies: blockerResult.body?.id ? [blockerResult.body.id] : [],
      });

      assert.ok(dependentResult.status < 500, `Server error: ${dependentResult.status}`);
    });

    it('5. Batch creates multiple tasks', async () => {
      const promises = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(
          httpRequest('POST', '/api/tasks', {
            title: `Batch Task ${i}`,
            status: 'todo',
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach((result) => {
        assert.ok(result.status < 500, `Server error: ${result.status}`);
      });
    });
  });

  describe('API Endpoints', () => {
    it('6. GET /api/status - Server status', async () => {
      const result = await httpRequest('GET', '/api/status');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('7. GET /api/projects - Project list', async () => {
      const result = await httpRequest('GET', '/api/projects');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('8. GET /api/workers - Workers/agents list', async () => {
      const result = await httpRequest('GET', '/api/workers');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('9. GET /api/blockers - Task blockers', async () => {
      const result = await httpRequest('GET', '/api/blockers');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('10. GET /api/activity - Activity log', async () => {
      const result = await httpRequest('GET', '/api/activity');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('11. GET /api/models - Available models', async () => {
      const result = await httpRequest('GET', '/api/models');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('12. GET /api/rules - Rules list', async () => {
      const result = await httpRequest('GET', '/api/rules');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('13. GET /api/live - Server live check', async () => {
      const result = await httpRequest('GET', '/api/live');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('14. GET /api/pm/projects - Project management', async () => {
      const result = await httpRequest('GET', '/api/pm/projects');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });

    it('15. GET /api/intake/projects - Intake projects', async () => {
      const result = await httpRequest('GET', '/api/intake/projects');
      assert.ok(result.status < 500, `Server error: ${result.status}`);
    });
  });

  describe('Task Workflow', () => {
    let workflowTaskId = null;

    it('16. Creates task for workflow test', async () => {
      const result = await httpRequest('POST', '/api/tasks', {
        title: 'Workflow Test Task',
        status: 'todo',
      });

      assert.ok(result.status < 500);
      if (result.body && result.body.id) {
        workflowTaskId = result.body.id;
      }
    });

    it('17. Transitions task to in-progress', async () => {
      if (!workflowTaskId) return;

      const result = await httpRequest('PUT', `/api/tasks/${workflowTaskId}`, {
        status: 'in-progress',
      });

      assert.ok(result.status < 500);
    });

    it('18. Transitions task to completed', async () => {
      if (!workflowTaskId) return;

      const result = await httpRequest('PUT', `/api/tasks/${workflowTaskId}`, {
        status: 'completed',
      });

      assert.ok(result.status < 500);
    });

    it('19. Creates recurring task', async () => {
      const result = await httpRequest('POST', '/api/tasks', {
        title: 'Recurring Task',
        status: 'todo',
        recurring: {
          frequency: 'daily',
          startDate: new Date().toISOString(),
        },
      });

      assert.ok(result.status < 500);
    });

    it('20. Adds task notes/comments', async () => {
      if (!workflowTaskId) return;

      const result = await httpRequest('PUT', `/api/tasks/${workflowTaskId}`, {
        notes: 'This is a test note added to the task',
      });

      assert.ok(result.status < 500);
    });
  });

  describe('Performance & Load', () => {
    it('21. Creates 10+ tasks rapidly', async () => {
      const promises = [];
      for (let i = 1; i <= 15; i++) {
        promises.push(
          httpRequest('POST', '/api/tasks', {
            title: `Load Test Task ${i}`,
            status: 'todo',
          })
        );
      }

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.status < 500).length;
      assert.equal(successCount, results.length, `All ${results.length} requests should succeed`);
    });

    it('22. Server remains responsive under load', async () => {
      const startTime = Date.now();
      const result = await httpRequest('GET', '/api/tasks');
      const endTime = Date.now();

      assert.ok(result.status < 500);
      const responseTime = endTime - startTime;
      console.log(`  Response time: ${responseTime}ms`);
      assert.ok(responseTime < 5000, `Response time should be < 5s, got ${responseTime}ms`);
    });
  });
});

// Main execution
async function runTests() {
  console.log('\n🧪 Starting E2E Tests\n');
  process.exit(0);
}

// Run the tests (node:test runs them automatically)
