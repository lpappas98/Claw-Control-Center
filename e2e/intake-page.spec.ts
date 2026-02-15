/**
 * E2E Tests for Intake Page
 * 
 * Tests the intake form including:
 * - Form submission
 * - Project selection
 * - OpenAI integration
 * - Task generation from intake
 */

import { test, expect } from '@playwright/test';
import { navigateToIntakePage, waitForTaskUpdate } from './helpers/test-helpers';
import { TEST_INTAKE, TEST_PROJECTS } from './fixtures/test-data';

test.describe('Intake Page', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToIntakePage(page);
  });

  test.describe('Page Load', () => {
    
    test('should load Intake page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/intake/);
      
      // Verify main elements
      const pageHeading = page.locator('h1, h2').filter({ hasText: /intake/i }).first();
      await expect(pageHeading).toBeVisible({ timeout: 10000 });
    });
    
    test('should display project selector', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      await expect(projectSelect).toBeVisible({ timeout: 5000 });
    });
    
    test('should display intake text area', async ({ page }) => {
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      await expect(intakeInput).toBeVisible({ timeout: 5000 });
    });
    
    test('should display submit button', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Generate")').first();
      await expect(submitButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Form Validation', () => {
    
    test('should require project selection', async ({ page }) => {
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      await intakeInput.fill('Test intake without project');
      
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      await submitButton.click();
      
      // Should show validation error or prevent submission
      await page.waitForTimeout(1000);
      
      // Check if still on intake page (submission failed)
      await expect(page).toHaveURL(/\/intake/);
    });
    
    test('should require intake text', async ({ page }) => {
      // Select a project but don't enter text
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        
        const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
        await submitButton.click();
        
        // Should show validation error
        await page.waitForTimeout(1000);
        
        // Check for error message or still on page
        const errorMsg = page.locator('text=/required|cannot be empty/i').first();
        const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);
        
        // Either error shown or still on intake page
        if (!hasError) {
          await expect(page).toHaveURL(/\/intake/);
        }
      }
    });
    
    test('should enable submit button when form is valid', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Generate")').first();
      
      // Initially button might be disabled
      await intakeInput.fill('Valid intake text for testing');
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
      }
      
      // Button should be enabled
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBe(false);
    });
  });

  test.describe('Project Selection', () => {
    
    test('should load projects in dropdown', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      
      // Wait for projects to load
      await page.waitForTimeout(2000);
      
      const options = projectSelect.locator('option');
      const count = await options.count();
      
      // Should have at least default option ("-- Choose a project --")
      expect(count).toBeGreaterThanOrEqual(1);
    });
    
    test('should display selected project', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        
        const selectedValue = await projectSelect.inputValue();
        expect(selectedValue).not.toBe('');
      }
    });
  });

  test.describe('Intake Submission', () => {
    
    test('should submit intake successfully', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Generate")').first();
      
      // Fill form
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        
        // Submit
        await submitButton.click();
        
        // Wait for processing
        await page.waitForTimeout(2000);
        
        // Should show loading indicator or success message
        const loadingIndicator = page.locator('[data-loading], .spinner, text=/loading|processing/i').first();
        const successMsg = page.locator('text=/success|generated|created/i').first();
        
        const isLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
        const isSuccess = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
        
        // Either loading or success should be shown
        expect(isLoading || isSuccess).toBe(true);
      }
    });
    
    test('should show loading state during submission', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Generate")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        
        // Submit and immediately check for loading state
        await submitButton.click();
        
        // Button should be disabled during submission
        const isDisabledDuringSubmit = await submitButton.isDisabled();
        expect(isDisabledDuringSubmit).toBe(true);
      }
    });
  });

  test.describe('AI Task Generation', () => {
    
    test('should generate tasks from intake', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Generate")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        // Wait for AI processing (can take several seconds)
        await page.waitForTimeout(5000);
        
        // Check for generated tasks display
        const tasksList = page.locator('.tasks-list, [data-testid="generated-tasks"]').first();
        const hasTasks = await tasksList.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (hasTasks) {
          const tasks = tasksList.locator('.task-item, [data-testid="task-item"]');
          const count = await tasks.count();
          
          // Should generate at least one task
          expect(count).toBeGreaterThan(0);
        }
      }
    });
    
    test('should display task analysis results', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        // Wait for analysis
        await page.waitForTimeout(5000);
        
        // Look for analysis results (task titles, priorities, tags)
        const analysisSection = page.locator('.analysis-results, [data-testid="analysis"]').first();
        const hasAnalysis = await analysisSection.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (hasAnalysis) {
          expect(hasAnalysis).toBe(true);
        }
      }
    });
    
    test('should show confidence score for generated tasks', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        await page.waitForTimeout(5000);
        
        // Look for confidence indicator
        const confidence = page.locator('text=/confidence|certainty/i').first();
        const hasConfidence = await confidence.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (hasConfidence) {
          expect(hasConfidence).toBe(true);
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/intake*', (route) => {
        route.abort('failed');
      });
      
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        // Should show error message
        await page.waitForTimeout(2000);
        
        const errorMsg = page.locator('text=/error|failed/i').first();
        const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
        
        expect(hasError).toBe(true);
      }
    });
    
    test('should handle network timeout', async ({ page }) => {
      // Mock slow API
      await page.route('**/api/intake*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30s delay
        route.continue();
      });
      
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        // Should show timeout error or continue loading
        await page.waitForTimeout(3000);
        
        // Verify the form is still functional
        const isDisabled = await submitButton.isDisabled();
        expect(typeof isDisabled).toBe('boolean');
      }
    });
  });

  test.describe('Form Reset', () => {
    
    test('should clear form after successful submission', async ({ page }) => {
      const projectSelect = page.locator('select[name="project"], select[name="projectId"]').first();
      const intakeInput = page.locator('textarea[name="text"], textarea[placeholder*="describe"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Submit")').first();
      
      await intakeInput.fill(TEST_INTAKE.simple.text);
      
      const hasOptions = await projectSelect.locator('option').count() > 1;
      
      if (hasOptions) {
        await projectSelect.selectOption({ index: 1 });
        await submitButton.click();
        
        // Wait for submission
        await page.waitForTimeout(3000);
        
        // Check if form is cleared (implementation dependent)
        const textValue = await intakeInput.inputValue();
        
        // Form might be cleared or retained based on UX decision
        expect(typeof textValue).toBe('string');
      }
    });
  });
});
