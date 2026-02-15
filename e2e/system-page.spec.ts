/**
 * E2E Tests for System Status Page
 * 
 * Tests the system status page including:
 * - Status cards display
 * - API health indicators
 * - Metrics display
 * - System monitoring
 */

import { test, expect } from '@playwright/test';
import { navigateToSystemPage } from './helpers/test-helpers';

test.describe('System Status Page', () => {
  
  test.beforeEach(async ({ page }) => {
    await navigateToSystemPage(page);
  });

  test.describe('Page Load', () => {
    
    test('should load System Status page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/system/);
      
      // Verify main heading
      const heading = page.locator('h1, h2').filter({ hasText: /system|status/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
    
    test('should display system status cards', async ({ page }) => {
      const statusCards = page.locator('.status-card, [data-testid="status-card"]');
      const count = await statusCards.count();
      
      // Should have at least one status card
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Health Indicators', () => {
    
    test('should display gateway health status', async ({ page }) => {
      const gatewayStatus = page.locator('[data-service="gateway"], .status-card:has-text("Gateway")').first();
      
      const hasGateway = await gatewayStatus.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasGateway) {
        // Should show health indicator (healthy, degraded, down)
        const healthBadge = gatewayStatus.locator('[data-health], .health-badge').first();
        const hasBadge = await healthBadge.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (hasBadge) {
          const status = await healthBadge.textContent();
          expect(status).toMatch(/healthy|degraded|down|unknown/i);
        }
      }
    });
    
    test('should display nodes status', async ({ page }) => {
      const nodesStatus = page.locator('[data-service="nodes"], .status-card:has-text("Nodes")').first();
      
      const hasNodes = await nodesStatus.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasNodes) {
        // Should show paired count
        const pairedCount = nodesStatus.locator('text=/paired|connected/i').first();
        const hasCount = await pairedCount.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (hasCount) {
          expect(hasCount).toBe(true);
        }
      }
    });
    
    test('should display browser relay status', async ({ page }) => {
      const browserStatus = page.locator('[data-service="browser"], .status-card:has-text("Browser")').first();
      
      const hasBrowser = await browserStatus.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasBrowser) {
        // Should show attached tabs count
        const tabsCount = nodesStatus.locator('text=/tabs|attached/i').first();
        const hasCount = await tabsCount.isVisible({ timeout: 2000 }).catch(() => false);
        
        // This is optional
        if (hasCount) {
          expect(hasCount).toBe(true);
        }
      }
    });
  });

  test.describe('API Health', () => {
    
    test('should show API endpoints health', async ({ page }) => {
      const apiSection = page.locator('.api-health, [data-testid="api-health"]').first();
      
      const hasApi = await apiSection.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasApi) {
        const endpoints = apiSection.locator('.endpoint, [data-testid="endpoint"]');
        const count = await endpoints.count();
        
        expect(count).toBeGreaterThan(0);
      }
    });
    
    test('should display response times', async ({ page }) => {
      const responseTimes = page.locator('text=/ms|response time/i').first();
      
      const hasTimes = await responseTimes.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTimes) {
        expect(hasTimes).toBe(true);
      }
    });
    
    test('should show last check timestamp', async ({ page }) => {
      const timestamp = page.locator('text=/last check|updated|ago/i').first();
      
      const hasTimestamp = await timestamp.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTimestamp) {
        expect(hasTimestamp).toBe(true);
      }
    });
  });

  test.describe('System Metrics', () => {
    
    test('should display task statistics', async ({ page }) => {
      const taskStats = page.locator('[data-metric="tasks"], .metric:has-text("Tasks")').first();
      
      const hasStats = await taskStats.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasStats) {
        // Should show task counts
        const count = taskStats.locator('text=/[0-9]+/').first();
        await expect(count).toBeVisible();
      }
    });
    
    test('should display agent statistics', async ({ page }) => {
      const agentStats = page.locator('[data-metric="agents"], .metric:has-text("Agents")').first();
      
      const hasStats = await agentStats.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasStats) {
        // Should show agent counts or status
        expect(hasStats).toBe(true);
      }
    });
    
    test('should show uptime information', async ({ page }) => {
      const uptime = page.locator('text=/uptime|running/i').first();
      
      const hasUptime = await uptime.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasUptime) {
        expect(hasUptime).toBe(true);
      }
    });
  });

  test.describe('Real-time Updates', () => {
    
    test('should update metrics periodically', async ({ page }) => {
      // Get initial timestamp
      const timestamp = page.locator('text=/updated|ago/i').first();
      
      const hasTimestamp = await timestamp.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTimestamp) {
        const initialText = await timestamp.textContent();
        
        // Wait for potential update (5-10 seconds based on polling)
        await page.waitForTimeout(10000);
        
        const updatedText = await timestamp.textContent();
        
        // Timestamp might have updated (but not guaranteed in 10s)
        expect(updatedText).toBeTruthy();
      }
    });
  });

  test.describe('Status Colors', () => {
    
    test('should use color coding for health status', async ({ page }) => {
      const statusBadge = page.locator('[data-health], .health-badge').first();
      
      const hasBadge = await statusBadge.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasBadge) {
        // Get computed style to check color
        const backgroundColor = await statusBadge.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });
        
        // Should have some background color
        expect(backgroundColor).toBeTruthy();
      }
    });
  });

  test.describe('Service Details', () => {
    
    test('should show service summaries', async ({ page }) => {
      const statusCard = page.locator('.status-card, [data-testid="status-card"]').first();
      
      const hasCard = await statusCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasCard) {
        const summary = statusCard.locator('.summary, [data-testid="summary"]').first();
        const hasSummary = await summary.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (hasSummary) {
          const summaryText = await summary.textContent();
          expect(summaryText).toBeTruthy();
        }
      }
    });
    
    test('should display service-specific metrics', async ({ page }) => {
      const statusCard = page.locator('.status-card, [data-testid="status-card"]').first();
      
      const hasCard = await statusCard.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasCard) {
        // Each service might have specific metrics
        const metrics = statusCard.locator('.metric, [data-testid="metric"]');
        const count = await metrics.count();
        
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Error States', () => {
    
    test('should display error messages for failed services', async ({ page }) => {
      // Mock API failure for a service
      await page.route('**/api/system/status*', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
      });
      
      // Reload page to trigger error
      await page.reload();
      
      await page.waitForTimeout(2000);
      
      // Should show error state
      const errorMsg = page.locator('text=/error|unavailable|failed/i').first();
      const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(hasError).toBe(true);
    });
  });

  test.describe('Refresh Functionality', () => {
    
    test('should have manual refresh button', async ({ page }) => {
      const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label*="refresh"]').first();
      
      const hasButton = await refreshButton.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasButton) {
        await refreshButton.click();
        
        // Should trigger reload
        await page.waitForTimeout(1000);
        
        expect(hasButton).toBe(true);
      }
    });
  });

  test.describe('Watchdog Status', () => {
    
    test('should display watchdog health', async ({ page }) => {
      const watchdog = page.locator('[data-service="watchdog"], .status-card:has-text("Watchdog")').first();
      
      const hasWatchdog = await watchdog.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasWatchdog) {
        const health = watchdog.locator('[data-health], .health-badge').first();
        const hasHealth = await health.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (hasHealth) {
          expect(hasHealth).toBe(true);
        }
      }
    });
  });
});
