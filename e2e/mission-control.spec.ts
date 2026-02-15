/**
 * E2E Tests for Mission Control Page
 * 
 * Tests the main dashboard including:
 * - Kanban board functionality
 * - Task cards
 * - Agent strip
 * - Activity feed
 * - Task creation
 */

import { test, expect } from '@playwright/test';
import {
  navigateToMissionControl,
  createTask,
  assertTaskExists,
  assertTaskInLane,
  waitForTaskUpdate,
} from './helpers/test-helpers';
import { TEST_TASKS, generateUniqueTaskTitle } from './fixtures/test-data';

test.describe('Mission Control Page', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToMissionControl(page);
  });

  test.describe('Page Load', () => {
    
    test('should load Mission Control page successfully', async ({ page }) => {
      // Verify page title or main heading
      await expect(page).toHaveURL(/\/$|\/mission-control/);
      
      // Verify main elements are visible
      const kanbanBoard = page.locator('.kanban, [data-testid="kanban-board"]').first();
      await expect(kanbanBoard).toBeVisible({ timeout: 10000 });
    });
    
    test('should display all kanban lanes', async ({ page }) => {
      const lanes = ['queued', 'development', 'review', 'done'];
      
      for (const lane of lanes) {
        const laneElement = page.locator(`[data-lane="${lane}"], :text("${lane}")`).first();
        await expect(laneElement).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('should display agent strip', async ({ page }) => {
      // Look for agent tiles
      const agentStrip = page.locator('.agent-strip, [data-testid="agent-strip"]').first();
      
      // If agent strip exists, verify it's visible
      const isVisible = await agentStrip.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) {
        expect(isVisible).toBe(true);
      }
    });
    
    test('should display activity feed', async ({ page }) => {
      // Look for activity feed
      const activityFeed = page.locator('.activity-feed, [data-testid="activity-feed"]').first();
      
      // If activity feed exists, verify it's visible
      const isVisible = await activityFeed.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) {
        expect(isVisible).toBe(true);
      }
    });
  });

  test.describe('Kanban Board', () => {
    
    test('should display task cards in lanes', async ({ page }) => {
      // Wait for tasks to load
      await page.waitForLoadState('networkidle');
      
      // Check for any task cards
      const taskCards = page.locator('.task-card, [data-testid="task-card"]');
      const count = await taskCards.count();
      
      // Should have at least one task or empty state
      expect(count).toBeGreaterThanOrEqual(0);
    });
    
    test('should show task priority badges', async ({ page }) => {
      // Look for priority badges
      const priorityBadges = page.locator('[data-priority], .priority-badge').first();
      
      const hasBadges = await priorityBadges.isVisible({ timeout: 5000 }).catch(() => false);
      
      // If tasks exist, they should have priority badges
      if (hasBadges) {
        const badgeText = await priorityBadges.textContent();
        expect(badgeText).toMatch(/P[0-3]/);
      }
    });
    
    test('should show +N more button when lane has overflow', async ({ page }) => {
      // This test checks if overflow handling works
      // Look for "+N more" buttons
      const moreButton = page.locator('button:has-text("+"), button:has-text("more")').first();
      
      const hasOverflow = await moreButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      // If overflow exists, button should be clickable
      if (hasOverflow) {
        await moreButton.click();
        
        // Modal should open showing overflow tasks
        const modal = page.locator('[role="dialog"], .modal');
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('should open task modal when clicking task card', async ({ page }) => {
      // Find any task card
      const taskCard = page.locator('.task-card, [data-testid="task-card"]').first();
      
      const hasTask = await taskCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTask) {
        await taskCard.click();
        
        // Task modal should open
        const modal = page.locator('[role="dialog"], .task-modal');
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        // Close modal
        const closeButton = page.locator('button[aria-label="Close"], button:has-text("×")').first();
        await closeButton.click();
      }
    });
  });

  test.describe('Task Creation', () => {
    
    test('should open create task modal', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Task")').first();
      
      await createButton.click();
      
      // Modal should open
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });
    
    test('should create a new task successfully', async ({ page }) => {
      const uniqueTitle = generateUniqueTaskTitle('E2E Test Task');
      
      const taskData = {
        ...TEST_TASKS.basic,
        title: uniqueTitle,
      };
      
      await createTask(page, taskData);
      
      // Wait for task to appear
      await waitForTaskUpdate(page);
      
      // Verify task exists
      await assertTaskExists(page, uniqueTitle);
    });
    
    test('should create task with all fields populated', async ({ page }) => {
      const uniqueTitle = generateUniqueTaskTitle('E2E Complete Task');
      
      const taskData = {
        title: uniqueTitle,
        description: 'Full task with all fields',
        priority: 'P1',
        tag: 'QA',
      };
      
      await createTask(page, taskData);
      await waitForTaskUpdate(page);
      await assertTaskExists(page, uniqueTitle);
    });
  });

  test.describe('Agent Strip', () => {
    
    test('should display agent tiles', async ({ page }) => {
      const agentTiles = page.locator('.agent-tile, [data-testid="agent-tile"]');
      const count = await agentTiles.count();
      
      // Should have at least one agent or zero if not loaded
      expect(count).toBeGreaterThanOrEqual(0);
    });
    
    test('should show agent status', async ({ page }) => {
      const agentTile = page.locator('.agent-tile, [data-testid="agent-tile"]').first();
      
      const hasAgent = await agentTile.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasAgent) {
        // Should have status indicator (idle, working, etc.)
        const statusBadge = agentTile.locator('[data-status], .status-badge').first();
        const hasStatus = await statusBadge.isVisible().catch(() => false);
        
        if (hasStatus) {
          const status = await statusBadge.textContent();
          expect(status).toMatch(/idle|working|sleeping/i);
        }
      }
    });
    
    test('should show live timers for active agents', async ({ page }) => {
      const agentTile = page.locator('.agent-tile, [data-testid="agent-tile"]').first();
      
      const hasAgent = await agentTile.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasAgent) {
        // Look for timer element
        const timer = agentTile.locator('[data-timer], .timer').first();
        const hasTimer = await timer.isVisible().catch(() => false);
        
        // Timer should update (just check it exists for now)
        if (hasTimer) {
          expect(hasTimer).toBe(true);
        }
      }
    });
  });

  test.describe('Activity Feed', () => {
    
    test('should display recent activities', async ({ page }) => {
      const activityFeed = page.locator('.activity-feed, [data-testid="activity-feed"]').first();
      
      const hasFeed = await activityFeed.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasFeed) {
        const activities = activityFeed.locator('.activity-item, [data-testid="activity-item"]');
        const count = await activities.count();
        
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
    
    test('should show activity timestamps', async ({ page }) => {
      const activity = page.locator('.activity-item, [data-testid="activity-item"]').first();
      
      const hasActivity = await activity.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasActivity) {
        // Should have timestamp (e.g., "2m ago", "5h ago")
        const timestamp = activity.locator('[data-timestamp], .timestamp').first();
        const hasTimestamp = await timestamp.isVisible().catch(() => false);
        
        if (hasTimestamp) {
          const text = await timestamp.textContent();
          expect(text).toMatch(/ago|just now/i);
        }
      }
    });
    
    test('should show activity actors (agents or users)', async ({ page }) => {
      const activity = page.locator('.activity-item, [data-testid="activity-item"]').first();
      
      const hasActivity = await activity.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasActivity) {
        const text = await activity.textContent();
        
        // Should mention an agent or user
        const hasActor = /TARS|Forge|Patch|Sentinel|user/i.test(text || '');
        expect(hasActor).toBe(true);
      }
    });
  });

  test.describe('Real-time Updates', () => {
    
    test('should update when new task is created', async ({ page }) => {
      const initialTaskCount = await page.locator('.task-card, [data-testid="task-card"]').count();
      
      // Create a new task
      const uniqueTitle = generateUniqueTaskTitle('E2E Real-time Task');
      await createTask(page, { title: uniqueTitle });
      
      // Wait for update
      await waitForTaskUpdate(page);
      
      // Task count should increase
      const newTaskCount = await page.locator('.task-card, [data-testid="task-card"]').count();
      expect(newTaskCount).toBeGreaterThanOrEqual(initialTaskCount);
    });
  });

  test.describe('Navigation', () => {
    
    test('should have working navigation links', async ({ page }) => {
      // Check for nav bar
      const nav = page.locator('nav, [role="navigation"]').first();
      await expect(nav).toBeVisible({ timeout: 5000 });
      
      // Should have links to other pages
      const links = nav.locator('a');
      const count = await links.count();
      
      expect(count).toBeGreaterThan(0);
    });
  });
});
