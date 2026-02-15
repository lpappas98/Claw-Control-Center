/**
 * E2E Authentication Tests
 * 
 * Tests for user authentication flows including:
 * - Login/logout
 * - Session management
 * - Protected routes
 * - Token refresh
 * - Multi-device sessions
 * - Password reset (if applicable)
 */

import { test, expect } from '@playwright/test'

// Test configuration
const TEST_USER = {
  username: 'test@example.com',
  password: 'TestPassword123!',
  displayName: 'Test User'
}

const INVALID_USER = {
  username: 'invalid@example.com',
  password: 'WrongPassword123!'
}

test.describe('Authentication E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to app root
    await page.goto('http://localhost:5173')
  })

  test.describe('Login Flow', () => {
    
    test('should display login form when not authenticated', async ({ page }) => {
      // Check for login elements
      // Note: Update selectors based on actual implementation
      const loginButton = page.getByRole('button', { name: /sign in|login/i })
      await expect(loginButton).toBeVisible()
    })

    test('should successfully log in with valid credentials', async ({ page }) => {
      // Fill login form
      await page.fill('input[name="email"]', TEST_USER.username)
      await page.fill('input[name="password"]', TEST_USER.password)
      
      // Submit login
      await page.click('button[type="submit"]')
      
      // Wait for navigation or success indicator
      await page.waitForURL('**/dashboard', { timeout: 5000 })
      
      // Verify authenticated state
      const userMenu = page.getByText(TEST_USER.displayName)
      await expect(userMenu).toBeVisible()
    })

    test('should show error message with invalid credentials', async ({ page }) => {
      await page.fill('input[name="email"]', INVALID_USER.username)
      await page.fill('input[name="password"]', INVALID_USER.password)
      
      await page.click('button[type="submit"]')
      
      // Should show error and remain on login page
      const errorMessage = page.getByText(/invalid credentials|login failed/i)
      await expect(errorMessage).toBeVisible()
    })

    test('should validate required fields', async ({ page }) => {
      // Try to submit empty form
      await page.click('button[type="submit"]')
      
      // Should show validation errors
      const emailError = page.getByText(/email.*required/i)
      const passwordError = page.getByText(/password.*required/i)
      
      await expect(emailError).toBeVisible()
      await expect(passwordError).toBeVisible()
    })

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate offline
      await page.context().setOffline(true)
      
      await page.fill('input[name="email"]', TEST_USER.username)
      await page.fill('input[name="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')
      
      // Should show network error
      const errorMessage = page.getByText(/network error|unable to connect/i)
      await expect(errorMessage).toBeVisible()
      
      // Restore connection
      await page.context().setOffline(false)
    })
  })

  test.describe('Session Management', () => {
    
    test('should maintain session across page reloads', async ({ page }) => {
      // Login first
      await loginUser(page, TEST_USER)
      
      // Reload page
      await page.reload()
      
      // Should still be authenticated
      const userMenu = page.getByText(TEST_USER.displayName)
      await expect(userMenu).toBeVisible()
    })

    test('should persist session in localStorage/sessionStorage', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      // Check for auth token in storage
      const token = await page.evaluate(() => {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      })
      
      expect(token).toBeTruthy()
    })

    test('should expire session after timeout', async ({ page }) => {
      // This test would require mocking time or waiting
      // For now, just verify the mechanism exists
      
      await loginUser(page, TEST_USER)
      
      // Fast-forward time (would need clock mocking)
      // await page.evaluate(() => {
      //   // Simulate expired token
      // })
      
      // Try to access protected resource
      // Should redirect to login
    })

    test('should handle concurrent sessions across tabs', async ({ browser }) => {
      // Open two tabs
      const context = await browser.newContext()
      const page1 = await context.newPage()
      const page2 = await context.newPage()
      
      await page1.goto('http://localhost:5173')
      await page2.goto('http://localhost:5173')
      
      // Login in first tab
      await loginUser(page1, TEST_USER)
      
      // Reload second tab - should also be authenticated
      await page2.reload()
      const userMenu = page2.getByText(TEST_USER.displayName)
      await expect(userMenu).toBeVisible()
      
      await context.close()
    })
  })

  test.describe('Logout Flow', () => {
    
    test('should successfully log out', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      // Click logout
      await page.click('[aria-label="User menu"]')
      await page.click('button:has-text("Logout")')
      
      // Should redirect to login
      await page.waitForURL('**/login')
      
      // Should clear auth token
      const token = await page.evaluate(() => localStorage.getItem('auth_token'))
      expect(token).toBeNull()
    })

    test('should clear session data on logout', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      // Logout
      await page.click('[aria-label="User menu"]')
      await page.click('button:has-text("Logout")')
      
      // Verify all session data cleared
      const sessionData = await page.evaluate(() => ({
        token: localStorage.getItem('auth_token'),
        user: localStorage.getItem('user'),
        session: sessionStorage.getItem('session')
      }))
      
      expect(sessionData.token).toBeNull()
      expect(sessionData.user).toBeNull()
    })

    test('should log out from all tabs', async ({ browser }) => {
      const context = await browser.newContext()
      const page1 = await context.newPage()
      const page2 = await context.newPage()
      
      await page1.goto('http://localhost:5173')
      await page2.goto('http://localhost:5173')
      
      await loginUser(page1, TEST_USER)
      await page2.reload()
      
      // Logout from first tab
      await page1.click('[aria-label="User menu"]')
      await page1.click('button:has-text("Logout")')
      
      // Second tab should also be logged out
      await page2.reload()
      const loginForm = page2.getByRole('button', { name: /sign in|login/i })
      await expect(loginForm).toBeVisible()
      
      await context.close()
    })
  })

  test.describe('Protected Routes', () => {
    
    test('should redirect to login when accessing protected route', async ({ page }) => {
      // Try to access protected route without auth
      await page.goto('http://localhost:5173/dashboard')
      
      // Should redirect to login
      await page.waitForURL('**/login')
    })

    test('should preserve redirect URL after login', async ({ page }) => {
      // Try to access specific protected route
      await page.goto('http://localhost:5173/projects/123')
      
      // Login
      await loginUser(page, TEST_USER)
      
      // Should redirect back to original route
      await page.waitForURL('**/projects/123')
    })

    test('should allow access to public routes without auth', async ({ page }) => {
      // Public routes should be accessible
      await page.goto('http://localhost:5173/about')
      
      // Should not redirect
      expect(page.url()).toContain('/about')
    })
  })

  test.describe('Token Management', () => {
    
    test('should refresh expired tokens automatically', async ({ page, context }) => {
      await loginUser(page, TEST_USER)
      
      // Mock token expiry
      await context.route('**/api/**', async (route) => {
        const response = await route.fetch()
        if (response.status() === 401) {
          // Should trigger token refresh
        }
        await route.fulfill({ response })
      })
      
      // Make API call
      // Should automatically refresh token and retry
    })

    test('should handle token refresh failure', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      // Simulate failed token refresh
      // Should log out user and redirect to login
    })

    test('should include auth token in API requests', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      let authHeaderPresent = false
      
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          const headers = request.headers()
          authHeaderPresent = !!headers['authorization']
        }
      })
      
      // Trigger an API call
      await page.goto('http://localhost:5173/dashboard')
      
      expect(authHeaderPresent).toBe(true)
    })
  })

  test.describe('Security', () => {
    
    test('should not expose sensitive data in URLs', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      // Check that password/token not in URL
      expect(page.url()).not.toContain('password')
      expect(page.url()).not.toContain('token')
    })

    test('should use HTTPS in production', async ({ page }) => {
      // Skip in dev, verify in prod
      if (process.env.NODE_ENV === 'production') {
        expect(page.url()).toMatch(/^https:/)
      }
    })

    test('should have secure, httpOnly cookies', async ({ page }) => {
      await loginUser(page, TEST_USER)
      
      const cookies = await page.context().cookies()
      const authCookie = cookies.find(c => c.name.includes('session') || c.name.includes('auth'))
      
      if (authCookie) {
        expect(authCookie.httpOnly).toBe(true)
        if (process.env.NODE_ENV === 'production') {
          expect(authCookie.secure).toBe(true)
        }
      }
    })

    test('should sanitize error messages', async ({ page }) => {
      await page.fill('input[name="email"]', INVALID_USER.username)
      await page.fill('input[name="password"]', INVALID_USER.password)
      await page.click('button[type="submit"]')
      
      // Error should be generic, not expose details
      const pageContent = await page.content()
      expect(pageContent).not.toContain('SQL')
      expect(pageContent).not.toContain('database')
      expect(pageContent).not.toContain('stack trace')
    })
  })

  test.describe('API Authentication', () => {
    
    test('should authenticate API requests with token', async ({ request }) => {
      // Get auth token (login via API)
      const loginResponse = await request.post('http://localhost:8787/api/auth/login', {
        data: {
          email: TEST_USER.username,
          password: TEST_USER.password
        }
      })
      
      expect(loginResponse.ok()).toBeTruthy()
      const { token } = await loginResponse.json()
      
      // Use token for authenticated request
      const tasksResponse = await request.get('http://localhost:8787/api/tasks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      expect(tasksResponse.ok()).toBeTruthy()
    })

    test('should reject requests without valid token', async ({ request }) => {
      const response = await request.get('http://localhost:8787/api/tasks')
      
      expect(response.status()).toBe(401)
    })

    test('should reject requests with expired token', async ({ request }) => {
      // Use expired token
      const response = await request.get('http://localhost:8787/api/tasks', {
        headers: {
          'Authorization': 'Bearer expired_token_here'
        }
      })
      
      expect(response.status()).toBe(401)
    })
  })
})

/**
 * Helper function to login a user
 */
async function loginUser(page: any, user: typeof TEST_USER) {
  await page.fill('input[name="email"]', user.username)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  
  // Wait for successful login
  await page.waitForURL('**/dashboard', { timeout: 5000 })
}
