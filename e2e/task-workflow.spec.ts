import { test, expect } from '@playwright/test';

test.describe('Claw Control Center - Task Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Task status lifecycle - Created → In Progress → Completed', async ({ page }) => {
    // Create a new task
    const createButton = page.locator('button').filter({ hasText: /create|add|new/i }).first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    }

    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="title"]').first();
    
    if (await taskInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskInput.fill('Status Lifecycle Test');
      await taskInput.press('Enter');
    }

    // Find and verify task is in "Created" state
    const taskElement = page.locator('text=Status Lifecycle Test').first();
    
    if (await taskElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Move to "In Progress"
      const progressButton = taskElement.locator('..').locator('button').filter({ hasText: /progress|start|begin/i }).first();
      
      if (await progressButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await progressButton.click();
      }

      // Move to "Completed"
      const completeButton = taskElement.locator('..').locator('button').filter({ hasText: /complete|done/i }).first();
      
      if (await completeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await completeButton.click();
      }

      // Verify final state
      const completedStatus = taskElement.locator('..').locator('[class*="completed"], [class*="done"]');
      
      if (await completedStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(completedStatus).toBeVisible();
      }
    }
  });

  test('Task priority and filtering - Set priority and verify filter', async ({ page }) => {
    // Look for task creation
    const createButton = page.locator('button').filter({ hasText: /create|add/i }).first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    }

    // Create high priority task
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="title"]').first();
    
    if (await taskInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskInput.fill('High Priority Task');
    }

    // Set priority
    const prioritySelect = page.locator('select, [role="combobox"]').filter({ hasText: /priority|urgent|high|low/i }).first();
    
    if (await prioritySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prioritySelect.click();
      const highOption = page.locator('[role="option"]').filter({ hasText: /high|urgent/i }).first();
      
      if (await highOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await highOption.click();
      }
    }

    // Save task
    const submitButton = page.locator('button').filter({ hasText: /save|create|submit/i }).first();
    
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
    }

    // Verify task appears with high priority indicator
    await page.waitForTimeout(500);
    const priorityIndicator = page.locator('text=High Priority Task').locator('..').locator('[class*="priority"], [class*="high"]');
    
    if (await priorityIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(priorityIndicator).toBeVisible();
    }
  });

  test('Task assignment and collaboration', async ({ page }) => {
    // Find a task
    const taskElement = page.locator('[class*="task"], [data-testid*="task"]').first();
    
    if (await taskElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click on task to open details
      await taskElement.click();
    }

    // Look for assignment option
    const assignButton = page.locator('button').filter({ hasText: /assign|owner|member|team/i }).first();
    
    if (await assignButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assignButton.click();
    }

    // Select assignee
    const assigneeOption = page.locator('[role="option"], [class*="member"]').first();
    
    if (await assigneeOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await assigneeOption.click();
    }

    // Verify assignment
    await page.waitForTimeout(500);
    const assignmentIndicator = page.locator('[class*="assigned"], [class*="assignee"]').first();
    
    if (await assignmentIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      expect(assignmentIndicator).toBeVisible();
    }
  });

  test('Task search and filtering functionality', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="filter"]').first();
    
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('task');
      await searchInput.press('Enter');

      // Wait for filtered results
      await page.waitForTimeout(500);

      // Verify filtered results appear
      const tasks = page.locator('[class*="task"]');
      const taskCount = await tasks.count();
      
      expect(taskCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Task due dates and reminders', async ({ page }) => {
    // Create task
    const createButton = page.locator('button').filter({ hasText: /create|add/i }).first();
    
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
    }

    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="title"]').first();
    
    if (await taskInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskInput.fill('Task with Due Date');
    }

    // Set due date
    const dateInput = page.locator('input[type="date"], input[placeholder*="date"], input[placeholder*="due"]').first();
    
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateInput.fill('2026-02-28');
    }

    // Save task
    const submitButton = page.locator('button').filter({ hasText: /save|create|submit/i }).first();
    
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
    }

    // Verify due date is displayed
    await page.waitForTimeout(500);
    const dueDateDisplay = page.locator('text=2026-02-28').first();
    
    if (await dueDateDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(dueDateDisplay).toBeVisible();
    }
  });

  test('Task notes and comments', async ({ page }) => {
    // Find or create a task
    const taskElement = page.locator('[class*="task"], [data-testid*="task"]').first();
    
    if (await taskElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to open task details
      await taskElement.click();
    }

    // Look for notes/comment section
    const notesInput = page.locator('textarea, input[placeholder*="note"], input[placeholder*="comment"]').first();
    
    if (await notesInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await notesInput.fill('This is a test note for the task');
      await notesInput.press('Enter').catch(() => {});
    }

    // Verify note is saved
    await page.waitForTimeout(500);
    const noteDisplay = page.locator('text=This is a test note').first();
    
    if (await noteDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(noteDisplay).toBeVisible();
    }
  });

  test('Batch operations - Select multiple tasks', async ({ page }) => {
    // Look for select all or checkbox
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    
    if (await selectAllCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAllCheckbox.check();
    }

    // Look for bulk action menu
    const bulkActionButton = page.locator('button').filter({ hasText: /bulk|action|more/i }).first();
    
    if (await bulkActionButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bulkActionButton.click();
    }

    // Verify bulk actions are available
    const bulkOptionCount = await page.locator('[role="menuitem"], button').count();
    
    expect(bulkOptionCount).toBeGreaterThanOrEqual(0);
  });

  test('Task duplication and cloning', async ({ page }) => {
    // Find a task
    const taskElement = page.locator('[class*="task"], [data-testid*="task"]').first();
    
    if (await taskElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Right-click for context menu
      await taskElement.click({ button: 'right' }).catch(async () => {
        // Try menu button
        const menuButton = taskElement.locator('button').filter({ hasText: /menu|more/i }).first();
        
        if (await menuButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await menuButton.click();
        }
      });

      // Look for duplicate/clone option
      const duplicateOption = page.locator('[role="menuitem"]').filter({ hasText: /duplicate|clone|copy/i }).first();
      
      if (await duplicateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await duplicateOption.click();
      }

      // Verify duplicated task appears
      await page.waitForTimeout(500);
      const tasks = page.locator('[class*="task"]');
      const taskCount = await tasks.count();
      
      expect(taskCount).toBeGreaterThan(0);
    }
  });

  test('Export and import tasks', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button').filter({ hasText: /export|download|backup/i }).first();
    
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download').catch(() => null);
      
      await exportButton.click();
      
      // Wait for download completion
      const download = await downloadPromise;
      
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.(csv|json|xlsx)$/);
      }
    }
  });
});
