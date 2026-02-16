import { Page, expect } from '@playwright/test';

/**
 * Test helper utilities for Playwright tests
 */

// Navigation helpers
export async function navigateToMissionControl(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

export async function navigateToIntakePage(page: Page) {
  const intakeLink = page.locator('a[href*="intake"], nav >> text=/intake/i');
  if (await intakeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await intakeLink.click();
  } else {
    await page.goto('/intake');
  }
  await page.waitForLoadState('networkidle');
}

export async function navigateToProjectsPage(page: Page) {
  const projectsLink = page.locator('a[href*="projects"], nav >> text=/projects/i');
  if (await projectsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await projectsLink.click();
  } else {
    await page.goto('/projects');
  }
  await page.waitForLoadState('networkidle');
}

export async function navigateToSystemPage(page: Page) {
  const systemLink = page.locator('a[href*="system"], nav >> text=/system/i');
  if (await systemLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await systemLink.click();
  } else {
    await page.goto('/system');
  }
  await page.waitForLoadState('networkidle');
}

// Task operations
export async function createTask(page: Page, taskData: {
  title: string;
  description?: string;
  priority?: string;
  lane?: string;
  tag?: string;
}) {
  // Click create task button
  const createButton = page.locator('button:has-text("Create"), button:has-text("Add Task")').first();
  await createButton.click();
  
  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"], .modal', { timeout: 5000 });
  
  // Fill in task details
  const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
  await titleInput.fill(taskData.title);
  
  if (taskData.description) {
    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]').first();
    await descInput.fill(taskData.description);
  }
  
  if (taskData.priority) {
    const prioritySelect = page.locator('select[name="priority"]').first();
    await prioritySelect.selectOption(taskData.priority);
  }
  
  if (taskData.tag) {
    const tagInput = page.locator('input[name="tag"], select[name="tag"]').first();
    if (await tagInput.getAttribute('type') === 'select-one') {
      await tagInput.selectOption(taskData.tag);
    } else {
      await tagInput.fill(taskData.tag);
    }
  }
  
  // Submit the form
  const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
  await submitButton.click();
  
  // Wait for modal to close
  await page.waitForSelector('[role="dialog"], .modal', { state: 'hidden', timeout: 5000 });
  
  return taskData.title;
}

export async function openTask(page: Page, taskTitle: string) {
  const taskCard = page.locator(`[data-task-title="${taskTitle}"], .task-card:has-text("${taskTitle}")`).first();
  await taskCard.click();
  
  // Wait for modal to open
  await page.waitForSelector('[role="dialog"], .task-modal', { timeout: 5000 });
}

export async function deleteTask(page: Page, taskTitle: string) {
  await openTask(page, taskTitle);
  
  // Click delete button
  const deleteButton = page.locator('button:has-text("Delete")').first();
  await deleteButton.click();
  
  // Confirm deletion
  const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
  await confirmButton.click();
  
  // Wait for modal to close
  await page.waitForSelector('[role="dialog"], .task-modal', { state: 'hidden', timeout: 5000 });
}

export async function updateTaskLane(page: Page, taskTitle: string, newLane: string) {
  await openTask(page, taskTitle);
  
  // Change lane
  const laneSelect = page.locator('select[name="lane"]').first();
  await laneSelect.selectOption(newLane);
  
  // Save changes
  const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
  await saveButton.click();
  
  // Wait for modal to close
  await page.waitForSelector('[role="dialog"], .task-modal', { state: 'hidden', timeout: 5000 });
}

// Assertion helpers
export async function assertTaskExists(page: Page, taskTitle: string) {
  const task = page.locator(`:text("${taskTitle}")`);
  await expect(task).toBeVisible({ timeout: 10000 });
}

export async function assertTaskNotExists(page: Page, taskTitle: string) {
  const task = page.locator(`:text("${taskTitle}")`);
  await expect(task).not.toBeVisible({ timeout: 5000 });
}

export async function assertTaskInLane(page: Page, taskTitle: string, lane: string) {
  const laneColumn = page.locator(`[data-lane="${lane}"], .lane:has-text("${lane}")`).first();
  const taskInLane = laneColumn.locator(`:text("${taskTitle}")`);
  await expect(taskInLane).toBeVisible({ timeout: 10000 });
}

export async function assertModalOpen(page: Page) {
  const modal = page.locator('[role="dialog"], .modal');
  await expect(modal).toBeVisible({ timeout: 5000 });
}

export async function assertModalClosed(page: Page) {
  const modal = page.locator('[role="dialog"], .modal');
  await expect(modal).not.toBeVisible({ timeout: 5000 });
}

// Wait helpers
export async function waitForTaskUpdate(page: Page, timeout = 5000) {
  await page.waitForTimeout(500); // Brief pause for UI update
  await page.waitForLoadState('networkidle', { timeout });
}

export async function waitForApiResponse(page: Page, urlPattern: string, timeout = 10000) {
  return page.waitForResponse(
    (response) => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
}

// Data cleanup helpers
export async function cleanupTestTasks(page: Page, titlePattern: string) {
  const testTasks = page.locator(`.task-card:has-text("${titlePattern}")`);
  const count = await testTasks.count();
  
  for (let i = 0; i < count; i++) {
    try {
      const task = testTasks.nth(i);
      const title = await task.textContent();
      if (title?.includes(titlePattern)) {
        await deleteTask(page, title);
      }
    } catch (e) {
      // Continue cleanup even if one task fails
      console.warn(`Failed to delete task: ${e}`);
    }
  }
}

// API helpers
export async function makeApiRequest(page: Page, method: string, endpoint: string, data?: any) {
  return page.evaluate(
    async ({ method, endpoint, data }) => {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`http://localhost:8787${endpoint}`, options);
      return {
        status: response.status,
        data: await response.json().catch(() => null),
      };
    },
    { method, endpoint, data }
  );
}

/**
 * Create a test task via API (marked with testTask: true for auto-cleanup)
 */
export async function createTestTaskViaAPI(page: Page, taskData: {
  title: string;
  description?: string;
  priority?: string;
  lane?: string;
  tags?: string[];
}) {
  return makeApiRequest(page, 'POST', '/api/tasks', {
    ...taskData,
    metadata: {
      testTask: true
    }
  });
}

/**
 * Delete a task via API (for cleanup)
 */
export async function deleteTaskViaAPI(page: Page, taskId: string) {
  return makeApiRequest(page, 'DELETE', `/api/tasks/${taskId}`, null);
}

/**
 * Cleanup all test tasks via API
 */
export async function cleanupAllTestTasks(page: Page) {
  const response = await makeApiRequest(page, 'GET', '/api/tasks', null);
  if (response.status === 200 && Array.isArray(response.data)) {
    const testTasks = response.data.filter((task: any) => 
      task.metadata?.testTask === true ||
      task.id?.includes('-test-') ||
      task.title?.toLowerCase().includes('test task') ||
      task.title?.toLowerCase().includes('e2e')
    );
    
    console.log(`Cleaning up ${testTasks.length} test tasks`);
    
    for (const task of testTasks) {
      await deleteTaskViaAPI(page, task.id);
    }
    
    return testTasks.length;
  }
  return 0;
}

// Screenshot helper
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ 
    path: `test-results/screenshots/${name}.png`,
    fullPage: true 
  });
}
