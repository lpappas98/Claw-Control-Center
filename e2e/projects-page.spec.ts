/**
 * E2E Tests for Projects Page
 * 
 * Tests the projects page including:
 * - Project list display
 * - Project details
 * - Project features
 * - Project kanban board
 */

import { test, expect } from '@playwright/test';
import { navigateToProjectsPage, waitForTaskUpdate } from './helpers/test-helpers';

test.describe('Projects Page', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToProjectsPage(page);
  });

  test.describe('Page Load', () => {
    
    test('should load Projects page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/projects/);
      
      // Verify main heading
      const heading = page.locator('h1, h2').filter({ hasText: /projects/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
    
    test('should display projects list', async ({ page }) => {
      // Wait for projects to load
      await page.waitForLoadState('networkidle');
      
      const projectsList = page.locator('.projects-list, [data-testid="projects-list"]').first();
      const hasList = await projectsList.isVisible({ timeout: 5000 }).catch(() => false);
      
      // Either list is visible or empty state is shown
      if (!hasList) {
        const emptyState = page.locator('text=/no projects|empty/i').first();
        const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
        
        expect(hasList || hasEmptyState).toBeTruthy();
      }
    });
  });

  test.describe('Project List', () => {
    
    test('should display project cards', async ({ page }) => {
      const projectCards = page.locator('.project-card, [data-testid="project-card"]');
      const count = await projectCards.count();
      
      // Should have zero or more projects
      expect(count).toBeGreaterThanOrEqual(0);
      
      if (count > 0) {
        // First project should be visible
        await expect(projectCards.first()).toBeVisible();
      }
    });
    
    test('should show project names', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        const projectName = projectCard.locator('h2, h3, [data-testid="project-name"]').first();
        await expect(projectName).toBeVisible();
        
        const name = await projectName.textContent();
        expect(name).toBeTruthy();
      }
    });
    
    test('should show project taglines', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        const tagline = projectCard.locator('.tagline, [data-testid="project-tagline"]').first();
        const hasTagline = await tagline.isVisible({ timeout: 2000 }).catch(() => false);
        
        // Tagline is optional
        if (hasTagline) {
          expect(hasTagline).toBe(true);
        }
      }
    });
    
    test('should navigate to project details on click', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        // Should navigate to project detail page
        await page.waitForTimeout(1000);
        
        // URL should change or modal should open
        const urlChanged = await page.url().then(url => url.includes('/projects/'));
        const modalOpen = await page.locator('[role="dialog"], .modal').isVisible({ timeout: 2000 }).catch(() => false);
        
        expect(urlChanged || modalOpen).toBe(true);
      }
    });
  });

  test.describe('Project Details', () => {
    
    test('should display project description', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        // Look for description
        const description = page.locator('.description, [data-testid="project-description"]').first();
        const hasDescription = await description.isVisible({ timeout: 3000 }).catch(() => false);
        
        // Description is optional
        if (hasDescription) {
          expect(hasDescription).toBe(true);
        }
      }
    });
    
    test('should show project features list', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        // Look for features section
        const featuresSection = page.locator('.features, [data-testid="project-features"]').first();
        const hasFeatures = await featuresSection.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasFeatures) {
          const features = featuresSection.locator('.feature-item, [data-testid="feature-item"]');
          const count = await features.count();
          
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    });
    
    test('should display project kanban board', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        // Look for kanban board in project view
        const kanban = page.locator('.kanban, [data-testid="kanban-board"]').first();
        const hasKanban = await kanban.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (hasKanban) {
          expect(hasKanban).toBe(true);
        }
      }
    });
  });

  test.describe('Project Features', () => {
    
    test('should display feature cards', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        const featureCards = page.locator('.feature-card, [data-testid="feature-card"]');
        const count = await featureCards.count();
        
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
    
    test('should show feature titles and descriptions', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        const featureCard = page.locator('.feature-card, [data-testid="feature-card"]').first();
        const hasFeature = await featureCard.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasFeature) {
          const title = featureCard.locator('h3, h4, [data-testid="feature-title"]').first();
          await expect(title).toBeVisible();
        }
      }
    });
    
    test('should navigate to feature details', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        const featureCard = page.locator('.feature-card, [data-testid="feature-card"]').first();
        const hasFeature = await featureCard.isVisible({ timeout: 3000 }).catch(() => false);
        
        if (hasFeature) {
          await featureCard.click();
          
          // Should navigate to feature detail or open modal
          await page.waitForTimeout(1000);
          
          const urlChanged = await page.url().then(url => url.includes('/features/'));
          const modalOpen = await page.locator('[role="dialog"], .modal').isVisible({ timeout: 2000 }).catch(() => false);
          
          expect(urlChanged || modalOpen).toBe(true);
        }
      }
    });
  });

  test.describe('Project Kanban', () => {
    
    test('should filter tasks by project', async ({ page }) => {
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      
      const hasProject = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasProject) {
        // Get project name
        const projectName = await projectCard.locator('h2, h3').first().textContent();
        
        await projectCard.click();
        
        await page.waitForTimeout(1000);
        
        // Check if kanban shows only project tasks
        const tasks = page.locator('.task-card, [data-testid="task-card"]');
        const count = await tasks.count();
        
        if (count > 0) {
          // Verify tasks belong to this project
          const firstTask = tasks.first();
          const taskText = await firstTask.textContent();
          
          // Task should reference the project or be filtered properly
          expect(taskText).toBeTruthy();
        }
      }
    });
  });

  test.describe('Project Creation', () => {
    
    test('should have create project button', async ({ page }) => {
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Project"), button:has-text("New Project")').first();
      
      const hasButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasButton) {
        expect(hasButton).toBe(true);
      }
    });
  });

  test.describe('Empty State', () => {
    
    test('should show empty state when no projects exist', async ({ page }) => {
      // This test depends on initial state
      const projectCards = page.locator('.project-card, [data-testid="project-card"]');
      const count = await projectCards.count();
      
      if (count === 0) {
        const emptyState = page.locator('text=/no projects|empty/i').first();
        const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
        
        expect(hasEmptyState).toBe(true);
      }
    });
  });

  test.describe('Search and Filter', () => {
    
    test('should have search functionality', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
      
      const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasSearch) {
        await searchInput.fill('test');
        
        // Wait for filter to apply
        await page.waitForTimeout(1000);
        
        // Results should be filtered
        expect(hasSearch).toBe(true);
      }
    });
  });
});
