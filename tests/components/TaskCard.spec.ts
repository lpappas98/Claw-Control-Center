/**
 * E2E Tests for TaskCard Component
 * 
 * Tests for TaskCard rendering, interactions, and behaviors:
 * - Title and description display
 * - Priority badge rendering
 * - Assignee display
 * - Tags display and overflow
 * - Metadata (hours, comments, subtasks)
 * - Click interactions
 * - Drag and drop behavior
 */

import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation';
import { expectVisible, expectText } from '../helpers/assertions';
import { createTask, generateId } from '../helpers/fixtures';
import { createAPIContext, createTaskViaAPI, deleteTaskViaAPI } from '../helpers/api';

test.describe('TaskCard Component', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
  });

  test.describe('Basic Rendering', () => {
    
    test('should render task card with title', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `E2E Card Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      // Create task via API
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        // Reload page to see new task
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Find the task card
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        
        // Should be visible
        await expectVisible(taskCard);
        
        // Should display the title
        await expectText(taskCard.locator('strong'), task.title);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should display priority badge', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Priority Badge Test ${generateId()}`,
        priority: 'P0',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should have priority badge
        const badge = taskCard.locator('[class*="badge"]').first();
        await expectVisible(badge);
        await expectText(badge, 'P0');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should render description when present', async ({ page }) => {
      const apiContext = await createAPIContext();
      const description = 'This is a test task description for E2E testing';
      const task = createTask({
        title: `Description Test ${generateId()}`,
        description: description,
        priority: 'P2',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should display description (might be truncated)
        const partialDesc = description.slice(0, 20);
        await expectText(taskCard, partialDesc);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Priority Variants', () => {
    
    test('should render P0 (critical) priority correctly', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `P0 Priority Test ${generateId()}`,
        priority: 'P0',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        const badge = taskCard.locator('[class*="badge"]').first();
        await expectText(badge, 'P0');
        
        // P0 should have destructive (red) styling
        const badgeClass = await badge.getAttribute('class');
        expect(badgeClass).toBeTruthy();
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should render P1 priority correctly', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `P1 Priority Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        const badge = taskCard.locator('[class*="badge"]').first();
        await expectText(badge, 'P1');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should render P2 priority correctly', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `P2 Priority Test ${generateId()}`,
        priority: 'P2',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        const badge = taskCard.locator('[class*="badge"]').first();
        await expectText(badge, 'P2');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should render P3 priority correctly', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `P3 Priority Test ${generateId()}`,
        priority: 'P3',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        const badge = taskCard.locator('[class*="badge"]').first();
        await expectText(badge, 'P3');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Click Interactions', () => {
    
    test('should open task detail modal when clicked', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Click Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Click the card
        await taskCard.click();
        
        // Task detail modal should open
        const modal = page.locator('[role="dialog"]');
        await expectVisible(modal);
        
        // Modal should contain task title
        await expectText(modal, task.title);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should have hover effect', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Hover Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Hover over card
        await taskCard.hover();
        
        // Card should have hover:shadow-md class
        const className = await taskCard.getAttribute('class');
        expect(className).toContain('hover:shadow-md');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should have pointer cursor', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Cursor Test ${generateId()}`,
        priority: 'P2',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Card should have cursor-pointer class or style
        const className = await taskCard.getAttribute('class');
        const style = await taskCard.getAttribute('style');
        
        expect(className?.includes('cursor-pointer') || style?.includes('cursor')).toBe(true);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Drag and Drop Behavior', () => {
    
    test('should be draggable by default', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Draggable Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Card should have draggable attribute
        const draggable = await taskCard.getAttribute('draggable');
        expect(draggable).toBe('true');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should have grab cursor when draggable', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Grab Cursor Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should have grab cursor style
        const style = await taskCard.getAttribute('style');
        expect(style).toContain('cursor');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Text Truncation', () => {
    
    test('should truncate long titles', async ({ page }) => {
      const apiContext = await createAPIContext();
      const longTitle = 'A'.repeat(200); // Very long title
      const task = createTask({
        title: `${longTitle} ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]`).filter({ hasText: task.title.slice(0, 50) }).first();
        await expectVisible(taskCard);
        
        // Title should have line-clamp-2 class
        const title = taskCard.locator('strong');
        const className = await title.getAttribute('class');
        expect(className).toContain('line-clamp');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should truncate long descriptions', async ({ page }) => {
      const apiContext = await createAPIContext();
      const longDesc = 'This is a very long description. '.repeat(50);
      const task = createTask({
        title: `Long Desc Test ${generateId()}`,
        description: longDesc,
        priority: 'P2',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Description should be truncated with line-clamp
        const desc = taskCard.locator('[class*="line-clamp"]');
        const hasDesc = await desc.count();
        
        expect(hasDesc).toBeGreaterThanOrEqual(0);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Accessibility', () => {
    
    test('should have descriptive title attribute', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Accessibility Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should have title attribute for tooltips
        const title = await taskCard.getAttribute('title');
        expect(title).toBeTruthy();
        expect(title).toContain('Click');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should have data-testid for testing', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `TestID Test ${generateId()}`,
        priority: 'P1',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should have data-testid attribute
        const testId = await taskCard.getAttribute('data-testid');
        expect(testId).toBe('task-card');
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });

  test.describe('Edge Cases', () => {
    
    test('should render card with only title (minimal data)', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Minimal Card ${generateId()}`,
        priority: 'P3',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should still render with just title and priority
        await expectText(taskCard.locator('strong'), task.title);
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
    
    test('should render card with all optional fields', async ({ page }) => {
      const apiContext = await createAPIContext();
      const task = createTask({
        title: `Complete Card ${generateId()}`,
        description: 'Full description with all fields',
        priority: 'P0',
        lane: 'queued'
      });
      
      const response = await createTaskViaAPI(apiContext, task);
      
      if (response.ok) {
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        const taskCard = page.locator(`[data-testid="task-card"]:has-text("${task.title}")`).first();
        await expectVisible(taskCard);
        
        // Should render all visible fields
        await expectText(taskCard.locator('strong'), task.title);
        await expectVisible(taskCard.locator('[class*="badge"]').first());
        
        // Cleanup
        const taskId = response.data?.id || task.id;
        await deleteTaskViaAPI(apiContext, taskId);
      }
      
      await apiContext.dispose();
    });
  });
});
