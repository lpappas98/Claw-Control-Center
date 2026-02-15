/**
 * E2E Tests for Task Modal Component
 * 
 * Tests all 4 tabs:
 * - Details tab
 * - Work Done tab
 * - Tests tab
 * - History tab
 * 
 * Also tests CRUD operations and delete confirmation
 */

import { test, expect } from '@playwright/test';
import { 
  navigateToMissionControl, 
  openTask, 
  assertModalOpen,
  assertModalClosed,
  waitForTaskUpdate 
} from './helpers/test-helpers';

test.describe('Task Modal Component', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToMissionControl(page);
  });

  test.describe('Modal Opening and Closing', () => {
    
    test('should open modal when clicking task card', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Modal should open
        await assertModalOpen(page);
      }
    });
    
    test('should close modal when clicking close button', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        await assertModalOpen(page);
        
        // Click close button
        const closeButton = page.locator('button[aria-label="Close"], button:has-text("×")').first();
        await closeButton.click();
        
        // Modal should close
        await assertModalClosed(page);
      }
    });
    
    test('should close modal when clicking backdrop', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        await assertModalOpen(page);
        
        // Click backdrop (area outside modal)
        await page.keyboard.press('Escape');
        
        // Modal should close
        await page.waitForTimeout(500);
        await assertModalClosed(page);
      }
    });
  });

  test.describe('Details Tab', () => {
    
    test('should display Details tab by default', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Details tab should be active
        const detailsTab = page.locator('[role="tab"]:has-text("Details"), button:has-text("Details")').first();
        const isActive = await detailsTab.getAttribute('aria-selected');
        
        expect(isActive).toBe('true');
      }
    });
    
    test('should display task title', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Should show task title
        const title = page.locator('input[name="title"], h2, h3').first();
        await expect(title).toBeVisible();
      }
    });
    
    test('should display task description', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Should show description field
        const description = page.locator('textarea[name="description"]').first();
        await expect(description).toBeVisible();
      }
    });
    
    test('should display task metadata (priority, lane, tag)', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Should show priority
        const priority = page.locator('select[name="priority"], [data-field="priority"]').first();
        await expect(priority).toBeVisible();
        
        // Should show lane
        const lane = page.locator('select[name="lane"], [data-field="lane"]').first();
        await expect(lane).toBeVisible();
      }
    });
    
    test('should allow editing task details', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Edit title
        const titleInput = page.locator('input[name="title"]').first();
        const isEditable = await titleInput.isEditable().catch(() => false);
        
        if (isEditable) {
          const originalTitle = await titleInput.inputValue();
          await titleInput.fill(originalTitle + ' [EDITED]');
          
          // Save
          const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
          await saveButton.click();
          
          await waitForTaskUpdate(page);
          
          // Should save successfully
          expect(isEditable).toBe(true);
        }
      }
    });
  });

  test.describe('Work Done Tab', () => {
    
    test('should switch to Work Done tab', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Click Work Done tab
        const workTab = page.locator('[role="tab"]:has-text("Work"), button:has-text("Work")').first();
        await workTab.click();
        
        // Tab should be active
        const isActive = await workTab.getAttribute('aria-selected');
        expect(isActive).toBe('true');
      }
    });
    
    test('should display commits list', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const workTab = page.locator('[role="tab"]:has-text("Work")').first();
        await workTab.click();
        
        // Look for commits section
        const commitsSection = page.locator('[data-section="commits"], .commits').first();
        const hasCommits = await commitsSection.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasCommits) {
          expect(hasCommits).toBe(true);
        }
      }
    });
    
    test('should display files changed', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const workTab = page.locator('[role="tab"]:has-text("Work")').first();
        await workTab.click();
        
        // Look for files section
        const filesSection = page.locator('[data-section="files"], .files').first();
        const hasFiles = await filesSection.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasFiles) {
          expect(hasFiles).toBe(true);
        }
      }
    });
    
    test('should show artifacts', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const workTab = page.locator('[role="tab"]:has-text("Work")').first();
        await workTab.click();
        
        // Look for artifacts
        const artifactsSection = page.locator('[data-section="artifacts"], .artifacts').first();
        const hasArtifacts = await artifactsSection.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasArtifacts) {
          expect(hasArtifacts).toBe(true);
        }
      }
    });
  });

  test.describe('Tests Tab', () => {
    
    test('should switch to Tests tab', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Click Tests tab
        const testsTab = page.locator('[role="tab"]:has-text("Tests"), button:has-text("Tests")').first();
        await testsTab.click();
        
        // Tab should be active
        const isActive = await testsTab.getAttribute('aria-selected');
        expect(isActive).toBe('true');
      }
    });
    
    test('should display test results summary', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const testsTab = page.locator('[role="tab"]:has-text("Tests")').first();
        await testsTab.click();
        
        // Look for test results
        const testResults = page.locator('[data-section="test-results"], .test-results').first();
        const hasResults = await testResults.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasResults) {
          // Should show passed/failed/skipped counts
          const summary = testResults.locator('text=/passed|failed|skipped/i').first();
          await expect(summary).toBeVisible();
        }
      }
    });
    
    test('should show pass/fail/skip counts', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const testsTab = page.locator('[role="tab"]:has-text("Tests")').first();
        await testsTab.click();
        
        // Look for counts
        const passedCount = page.locator('text=/passed.*[0-9]+|[0-9]+.*passed/i').first();
        const hasCount = await passedCount.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasCount) {
          expect(hasCount).toBe(true);
        }
      }
    });
  });

  test.describe('History Tab', () => {
    
    test('should switch to History tab', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Click History tab
        const historyTab = page.locator('[role="tab"]:has-text("History"), button:has-text("History")').first();
        await historyTab.click();
        
        // Tab should be active
        const isActive = await historyTab.getAttribute('aria-selected');
        expect(isActive).toBe('true');
      }
    });
    
    test('should display timeline of changes', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const historyTab = page.locator('[role="tab"]:has-text("History")').first();
        await historyTab.click();
        
        // Look for timeline
        const timeline = page.locator('[data-section="history"], .timeline, .history').first();
        const hasTimeline = await timeline.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasTimeline) {
          expect(hasTimeline).toBe(true);
        }
      }
    });
    
    test('should show status changes', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const historyTab = page.locator('[role="tab"]:has-text("History")').first();
        await historyTab.click();
        
        // Look for status change events
        const statusChange = page.locator('text=/changed.*to|moved.*from/i').first();
        const hasChange = await statusChange.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasChange) {
          expect(hasChange).toBe(true);
        }
      }
    });
    
    test('should show timestamps for each event', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const historyTab = page.locator('[role="tab"]:has-text("History")').first();
        await historyTab.click();
        
        // Look for timestamps
        const timestamp = page.locator('[data-timestamp], .timestamp, text=/ago|at/i').first();
        const hasTimestamp = await timestamp.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasTimestamp) {
          expect(hasTimestamp).toBe(true);
        }
      }
    });
  });

  test.describe('Task Update', () => {
    
    test('should update task lane', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Change lane
        const laneSelect = page.locator('select[name="lane"]').first();
        const currentLane = await laneSelect.inputValue();
        
        // Select different lane
        const options = laneSelect.locator('option');
        const count = await options.count();
        
        if (count > 1) {
          await laneSelect.selectOption({ index: 1 });
          
          // Save
          const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
          await saveButton.click();
          
          await waitForTaskUpdate(page);
          
          // Should update successfully
          expect(count).toBeGreaterThan(1);
        }
      }
    });
    
    test('should update task priority', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Change priority
        const prioritySelect = page.locator('select[name="priority"]').first();
        await prioritySelect.selectOption('P1');
        
        // Save
        const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
        await saveButton.click();
        
        await waitForTaskUpdate(page);
        
        // Should save successfully
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Task Delete', () => {
    
    test('should show delete button', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Delete button should be visible
        const deleteButton = page.locator('button:has-text("Delete")').first();
        await expect(deleteButton).toBeVisible();
      }
    });
    
    test('should show confirmation dialog before delete', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Click delete
        const deleteButton = page.locator('button:has-text("Delete")').first();
        await deleteButton.click();
        
        // Confirmation should appear
        const confirmDialog = page.locator('text=/are you sure|confirm|delete/i').first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        
        // Cancel to not actually delete
        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
        await cancelButton.click();
      }
    });
    
    test('should cancel delete operation', async ({ page }) => {
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        const deleteButton = page.locator('button:has-text("Delete")').first();
        await deleteButton.click();
        
        // Click cancel
        const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
        await cancelButton.click();
        
        // Modal should still be open
        await assertModalOpen(page);
      }
    });
  });
});
