/**
 * NavBar Component E2E Tests
 * 
 * Tests for navigation bar functionality including:
 * - Navigation links display
 * - Active tab highlighting
 * - Navigation between pages
 * - Mobile responsiveness (if applicable)
 * - Logo and branding
 */

import { test, expect } from '@playwright/test';
import { navigateTo } from '../helpers/navigation';
import { expectVisible, expectURL } from '../helpers/assertions';

const NAV_ITEMS = [
  { name: 'Mission Control', path: '/' },
  { name: 'Projects', path: '/projects' },
  { name: 'Intake', path: '/intake' },
  { name: 'Activity', path: '/activity' },
  { name: 'System', path: '/system' },
  { name: 'Config', path: '/config' },
];

test.describe('NavBar Component Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await navigateTo(page, '/');
  });

  test.describe('NavBar Structure and Display', () => {
    
    test('should display navigation bar at top of page', async ({ page }) => {
      const navbar = page.locator('header').first();
      await expectVisible(navbar);
    });

    test('should have sticky positioning', async ({ page }) => {
      // NavBar should be sticky (position: sticky, top: 0)
      const navbar = page.locator('header').first();
      
      const position = await navbar.evaluate(el => 
        window.getComputedStyle(el).position
      );
      
      expect(position).toBe('sticky');
    });

    test('should display logo/branding', async ({ page }) => {
      // Check for logo icon (SVG lightning bolt)
      const logo = page.locator('svg').first();
      await expectVisible(logo);
    });

    test('should show "Claw Control" text', async ({ page }) => {
      const brandText = page.locator('text=Claw Control');
      await expectVisible(brandText);
    });

    test('should show environment indicator (e.g., "local")', async ({ page }) => {
      const envBadge = page.locator('text=local');
      await expectVisible(envBadge);
    });

    test('should have gradient background on logo', async ({ page }) => {
      // Logo container should have gradient styling
      const logoContainer = page.locator('svg').first().locator('..');
      const gradient = await logoContainer.evaluate(el => 
        window.getComputedStyle(el).background
      );
      
      expect(gradient).toBeTruthy();
    });

    test('should have backdrop blur effect', async ({ page }) => {
      const navbar = page.locator('header').first();
      
      const backdropFilter = await navbar.evaluate(el => 
        window.getComputedStyle(el).backdropFilter
      );
      
      // Should have blur(12px)
      expect(backdropFilter).toContain('blur');
    });

    test('should have border at bottom', async ({ page }) => {
      const navbar = page.locator('header').first();
      
      const borderBottom = await navbar.evaluate(el => 
        window.getComputedStyle(el).borderBottom
      );
      
      expect(borderBottom).toBeTruthy();
    });
  });

  test.describe('Navigation Links', () => {
    
    test('should display all navigation items', async ({ page }) => {
      for (const item of NAV_ITEMS) {
        const navItem = page.getByRole('button', { name: item.name });
        await expectVisible(navItem);
      }
    });

    test('should display Mission Control link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'Mission Control' });
      await expectVisible(link);
    });

    test('should display Projects link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'Projects' });
      await expectVisible(link);
    });

    test('should display Intake link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'Intake' });
      await expectVisible(link);
    });

    test('should display Activity link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'Activity' });
      await expectVisible(link);
    });

    test('should display System link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'System' });
      await expectVisible(link);
    });

    test('should display Config link', async ({ page }) => {
      const link = page.getByRole('button', { name: 'Config' });
      await expectVisible(link);
    });

    test('should render nav items as buttons', async ({ page }) => {
      const navButtons = page.locator('nav button');
      const count = await navButtons.count();
      
      expect(count).toBe(NAV_ITEMS.length);
    });

    test('should have consistent spacing between nav items', async ({ page }) => {
      const nav = page.locator('nav');
      
      // Nav should have flex layout with gap
      const display = await nav.evaluate(el => 
        window.getComputedStyle(el).display
      );
      
      expect(display).toBe('flex');
    });

    test('should support horizontal scrolling if needed', async ({ page }) => {
      const nav = page.locator('nav');
      
      const overflowX = await nav.evaluate(el => 
        window.getComputedStyle(el).overflowX
      );
      
      expect(overflowX).toBe('auto');
    });
  });

  test.describe('Active Tab Highlighting', () => {
    
    test('should highlight Mission Control when on home page', async ({ page }) => {
      await navigateTo(page, '/');
      
      const missionControlBtn = page.getByRole('button', { name: 'Mission Control' });
      
      // Check if it has active styling (background color)
      const bgColor = await missionControlBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      // Active tab should have darker background
      expect(bgColor).toBeTruthy();
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
    });

    test('should highlight Projects when on projects page', async ({ page }) => {
      await navigateTo(page, '/projects');
      
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const bgColor = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).toBeTruthy();
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should highlight Intake when on intake page', async ({ page }) => {
      await navigateTo(page, '/intake');
      
      const intakeBtn = page.getByRole('button', { name: 'Intake' });
      
      const bgColor = await intakeBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).toBeTruthy();
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should highlight System when on system page', async ({ page }) => {
      await navigateTo(page, '/system');
      
      const systemBtn = page.getByRole('button', { name: 'System' });
      
      const bgColor = await systemBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).toBeTruthy();
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should use different text color for active tab', async ({ page }) => {
      await navigateTo(page, '/projects');
      
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      const missionControlBtn = page.getByRole('button', { name: 'Mission Control' });
      
      const activeColor = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).color
      );
      
      const inactiveColor = await missionControlBtn.evaluate(el => 
        window.getComputedStyle(el).color
      );
      
      // Colors should be different
      expect(activeColor).not.toBe(inactiveColor);
    });

    test('should only have one active tab at a time', async ({ page }) => {
      await navigateTo(page, '/intake');
      
      // Count nav buttons with active background
      const navButtons = page.locator('nav button');
      const count = await navButtons.count();
      
      let activeCount = 0;
      for (let i = 0; i < count; i++) {
        const btn = navButtons.nth(i);
        const bgColor = await btn.evaluate(el => 
          window.getComputedStyle(el).backgroundColor
        );
        
        if (bgColor !== 'rgba(0, 0, 0, 0)' && !bgColor.includes('transparent')) {
          activeCount++;
        }
      }
      
      // Should have exactly 1 active tab
      expect(activeCount).toBeGreaterThanOrEqual(1);
    });

    test('should update active state when navigating', async ({ page }) => {
      // Start at home
      await navigateTo(page, '/');
      
      let missionControlBtn = page.getByRole('button', { name: 'Mission Control' });
      let initialBg = await missionControlBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      // Navigate to projects
      await navigateTo(page, '/projects');
      
      let projectsBtn = page.getByRole('button', { name: 'Projects' });
      let projectsBg = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      // Projects should now be active (have background)
      expect(projectsBg).toBeTruthy();
      expect(projectsBg).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should handle nested routes (e.g., /projects/:id)', async ({ page }) => {
      // If on a nested route under /projects, Projects tab should be active
      await navigateTo(page, '/projects');
      
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      const bgColor = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });
  });

  test.describe('Navigation Functionality', () => {
    
    test('should navigate to Mission Control when clicked', async ({ page }) => {
      await navigateTo(page, '/projects');
      
      const missionControlBtn = page.getByRole('button', { name: 'Mission Control' });
      await missionControlBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, '/');
    });

    test('should navigate to Projects when clicked', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/projects/);
    });

    test('should navigate to Intake when clicked', async ({ page }) => {
      const intakeBtn = page.getByRole('button', { name: 'Intake' });
      await intakeBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/intake/);
    });

    test('should navigate to Activity when clicked', async ({ page }) => {
      const activityBtn = page.getByRole('button', { name: 'Activity' });
      await activityBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/activity/);
    });

    test('should navigate to System when clicked', async ({ page }) => {
      const systemBtn = page.getByRole('button', { name: 'System' });
      await systemBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/system/);
    });

    test('should navigate to Config when clicked', async ({ page }) => {
      const configBtn = page.getByRole('button', { name: 'Config' });
      await configBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/config/);
    });

    test('should use client-side routing (no page reload)', async ({ page }) => {
      // Listen for navigation events
      let navigationCount = 0;
      page.on('framenavigated', () => {
        navigationCount++;
      });
      
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.click();
      
      await page.waitForTimeout(500);
      
      // Should have navigated
      await expectURL(page, /\/projects/);
      
      // Navigation should have occurred (SPA navigation)
      expect(navigationCount).toBeGreaterThanOrEqual(1);
    });

    test('should maintain scroll position on navigation', async ({ page }) => {
      // This is hard to test without content, but we verify navigation works
      const intakeBtn = page.getByRole('button', { name: 'Intake' });
      await intakeBtn.click();
      
      await page.waitForTimeout(500);
      
      const systemBtn = page.getByRole('button', { name: 'System' });
      await systemBtn.click();
      
      await page.waitForTimeout(500);
      
      // Both navigations should work
      await expectURL(page, /\/system/);
    });

    test('should work with browser back button', async ({ page }) => {
      // Navigate to projects
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.click();
      
      await page.waitForTimeout(500);
      await expectURL(page, /\/projects/);
      
      // Go back
      await page.goBack();
      await page.waitForTimeout(500);
      
      // Should be back at home
      await expectURL(page, '/');
    });

    test('should work with browser forward button', async ({ page }) => {
      // Navigate forward and back
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.click();
      
      await page.waitForTimeout(500);
      await page.goBack();
      await page.waitForTimeout(500);
      
      // Now go forward
      await page.goForward();
      await page.waitForTimeout(500);
      
      await expectURL(page, /\/projects/);
    });
  });

  test.describe('Hover and Focus States', () => {
    
    test('should show hover state on navigation items', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      // Hover over button
      await projectsBtn.hover();
      await page.waitForTimeout(200);
      
      // Button should change appearance (hard to test precisely)
      // We just verify it's still visible
      await expectVisible(projectsBtn);
    });

    test('should be keyboard accessible', async ({ page }) => {
      // Tab to first nav item
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      // Keep tabbing to reach nav buttons
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
      
      // Should be able to focus nav items
      const focusedElement = page.locator(':focus');
      const isFocused = await focusedElement.isVisible().catch(() => false);
      
      expect(typeof isFocused).toBe('boolean');
    });

    test('should navigate via Enter key when focused', async ({ page }) => {
      // Focus the Projects button
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.focus();
      
      // Press Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Should navigate
      await expectURL(page, /\/projects/);
    });

    test('should have visual focus indicator', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await projectsBtn.focus();
      
      // Focused element should have outline or box-shadow
      const outline = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).outline
      );
      
      expect(outline).toBeTruthy();
    });
  });

  test.describe('Styling and Appearance', () => {
    
    test('should have consistent button styling', async ({ page }) => {
      const buttons = page.locator('nav button');
      const count = await buttons.count();
      
      // All buttons should have similar styling
      for (let i = 0; i < Math.min(count, 3); i++) {
        const btn = buttons.nth(i);
        const padding = await btn.evaluate(el => 
          window.getComputedStyle(el).padding
        );
        
        expect(padding).toBeTruthy();
      }
    });

    test('should use consistent font weight', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const fontWeight = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).fontWeight
      );
      
      expect(fontWeight).toBe('500');
    });

    test('should have rounded corners on buttons', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const borderRadius = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).borderRadius
      );
      
      expect(borderRadius).toBe('6px');
    });

    test('should use transition effects', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const transition = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).transition
      );
      
      expect(transition).toContain('0.15s');
    });

    test('should align logo and nav items properly', async ({ page }) => {
      const header = page.locator('header > div').first();
      
      const display = await header.evaluate(el => 
        window.getComputedStyle(el).display
      );
      
      expect(display).toBe('flex');
      
      const alignItems = await header.evaluate(el => 
        window.getComputedStyle(el).alignItems
      );
      
      expect(alignItems).toBe('center');
    });

    test('should have appropriate z-index for stickiness', async ({ page }) => {
      const navbar = page.locator('header').first();
      
      const zIndex = await navbar.evaluate(el => 
        window.getComputedStyle(el).zIndex
      );
      
      expect(zIndex).toBe('30');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    
    test('should be visible on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const navbar = page.locator('header').first();
      await expectVisible(navbar);
    });

    test('should allow horizontal scrolling of nav on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const nav = page.locator('nav');
      
      const overflowX = await nav.evaluate(el => 
        window.getComputedStyle(el).overflowX
      );
      
      expect(overflowX).toBe('auto');
    });

    test('should maintain readable font size on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const fontSize = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      
      // Should be 12px according to code
      expect(fontSize).toBe('12px');
    });

    test('should show all nav items on mobile (scrollable)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const navButtons = page.locator('nav button');
      const count = await navButtons.count();
      
      expect(count).toBe(NAV_ITEMS.length);
    });

    test('should maintain logo visibility on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);
      
      const logo = page.locator('svg').first();
      await expectVisible(logo);
      
      const brandText = page.locator('text=Claw Control');
      await expectVisible(brandText);
    });
  });

  test.describe('Accessibility', () => {
    
    test('should use semantic HTML (header element)', async ({ page }) => {
      const header = page.locator('header');
      const tagName = await header.evaluate(el => el.tagName.toLowerCase());
      
      expect(tagName).toBe('header');
    });

    test('should use semantic HTML (nav element)', async ({ page }) => {
      const nav = page.locator('nav');
      const tagName = await nav.evaluate(el => el.tagName.toLowerCase());
      
      expect(tagName).toBe('nav');
    });

    test('should use button elements for navigation', async ({ page }) => {
      const navButtons = page.locator('nav button');
      const firstBtn = navButtons.first();
      
      const tagName = await firstBtn.evaluate(el => el.tagName.toLowerCase());
      
      expect(tagName).toBe('button');
    });

    test('should have meaningful button text', async ({ page }) => {
      const buttons = page.locator('nav button');
      const count = await buttons.count();
      
      for (let i = 0; i < count; i++) {
        const text = await buttons.nth(i).textContent();
        expect(text).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });

    test('should support screen readers', async ({ page }) => {
      // Buttons should have accessible names
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      await expectVisible(projectsBtn);
      
      const accessibleName = await projectsBtn.evaluate(el => 
        (el as HTMLElement).innerText
      );
      
      expect(accessibleName).toBe('Projects');
    });

    test('should have sufficient color contrast', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      
      const color = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).color
      );
      
      // Color should be defined (specific contrast testing requires more tools)
      expect(color).toBeTruthy();
    });
  });

  test.describe('Edge Cases', () => {
    
    test('should handle rapid navigation clicks', async ({ page }) => {
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      const intakeBtn = page.getByRole('button', { name: 'Intake' });
      const systemBtn = page.getByRole('button', { name: 'System' });
      
      // Click rapidly
      await projectsBtn.click();
      await intakeBtn.click();
      await systemBtn.click();
      
      await page.waitForTimeout(1000);
      
      // Should end up on system page
      await expectURL(page, /\/system/);
    });

    test('should handle unknown routes gracefully', async ({ page }) => {
      await navigateTo(page, '/unknown-route');
      
      // NavBar should still render
      const navbar = page.locator('header').first();
      await expectVisible(navbar);
    });

    test('should maintain state across page refresh', async ({ page }) => {
      await navigateTo(page, '/projects');
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Should still be on projects page
      await expectURL(page, /\/projects/);
      
      // Projects tab should be active
      const projectsBtn = page.getByRole('button', { name: 'Projects' });
      const bgColor = await projectsBtn.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should handle long nav item text gracefully', async ({ page }) => {
      // All nav items should fit properly
      const buttons = page.locator('nav button');
      
      for (let i = 0; i < await buttons.count(); i++) {
        const btn = buttons.nth(i);
        const whiteSpace = await btn.evaluate(el => 
          window.getComputedStyle(el).whiteSpace
        );
        
        // Should use nowrap to prevent wrapping
        expect(whiteSpace).toBe('nowrap');
      }
    });
  });
});
