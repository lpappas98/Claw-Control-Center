import { test, expect } from '@playwright/test';

/**
 * E2E Card Test for task-cfc617d87215f-1771199810995
 * 
 * Tests basic card rendering and interaction functionality
 */

test.describe('E2E Card Test - test-1771199810985', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should load Mission Control page', async ({ page }) => {
    await expect(page).toHaveTitle(/Claw Control/);
    const header = page.locator('text=Claw Control');
    await expect(header).toBeVisible();
  });

  test('should display task cards in kanban lanes', async ({ page }) => {
    // Wait for lanes to be visible
    const lanes = page.locator('[data-testid="kanban-lane"]');
    await expect(lanes.first()).toBeVisible({ timeout: 10000 });
    
    // Check that we have lanes
    const laneCount = await lanes.count();
    expect(laneCount).toBeGreaterThan(0);
  });

  test('should display task card with title', async ({ page }) => {
    // Find any task card
    const taskCard = page.locator('button').filter({ hasText: /P[0-3]/ }).first();
    await expect(taskCard).toBeVisible({ timeout: 10000 });
  });

  test('should open task modal when card is clicked', async ({ page }) => {
    // Click first task card
    const taskCard = page.locator('button').filter({ hasText: /P[0-3]/ }).first();
    await taskCard.click({ timeout: 10000 });
    
    // Wait for modal to appear
    const modal = page.locator('[role="dialog"]').or(page.locator('text=Details').first());
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('should close modal when clicking close button', async ({ page }) => {
    // Open modal
    const taskCard = page.locator('button').filter({ hasText: /P[0-3]/ }).first();
    await taskCard.click({ timeout: 10000 });
    
    // Click close button
    const closeButton = page.locator('button').filter({ hasText: /Close|×/ }).first();
    await closeButton.click();
    
    // Modal should be gone
    await page.waitForTimeout(500);
    const modals = page.locator('[role="dialog"]');
    const count = await modals.count();
    expect(count).toBe(0);
  });

  test('should display priority badge on card', async ({ page }) => {
    // Find a card with priority badge
    const priorityBadge = page.locator('text=/P[0-3]/').first();
    await expect(priorityBadge).toBeVisible({ timeout: 10000 });
  });

  test('should display lane headers', async ({ page }) => {
    // Check for standard lane names
    const proposedLane = page.locator('text=Proposed').or(page.locator('text=PROPOSED'));
    const queuedLane = page.locator('text=Queued').or(page.locator('text=QUEUED'));
    const devLane = page.locator('text=Development').or(page.locator('text=DEVELOPMENT'));
    
    // At least one lane should be visible
    const lanes = page.locator('text=/PROPOSED|QUEUED|DEVELOPMENT|REVIEW|DONE/i');
    await expect(lanes.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display activity feed', async ({ page }) => {
    // Look for activity section
    const activitySection = page.locator('text=/Activity|ACTIVITY/i').first();
    await expect(activitySection).toBeVisible({ timeout: 10000 });
  });
});
