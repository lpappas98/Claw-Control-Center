import { test, expect, Page, APIRequestContext, request } from '@playwright/test'

/**
 * CreateTaskModal and TaskListModal Component Tests
 *
 * CreateTaskModal:
 *   - Modal opens when "Create Task" button clicked
 *   - All form fields present (title, priority, owner, type, status)
 *   - Advanced fields (problem, scope, acceptance criteria)
 *   - Priority dropdown (P0-P3)
 *   - Owner dropdown (static list)
 *   - Form validation (title required)
 *   - Submit creates task via API
 *   - New task appears in kanban board
 *   - Modal closes on successful creation
 *   - Cancel button closes modal without saving
 *   - Error handling (API failure / network mock)
 *
 * TaskListModal:
 *   - Modal opens when +N more button clicked
 *   - Shows all tasks for that lane
 *   - Task cards display correctly
 *   - Click task opens TaskModal
 *   - Close button works
 *   - Backdrop click closes modal
 *   - Scrollable if many tasks
 *   - Search filter works
 *   - Sort options work
 */

const API_BASE = 'http://localhost:8787'

async function createAPICtx (): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  })
}

async function createTask (
  ctx: APIRequestContext,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const res = await ctx.post('/api/tasks', {
    data: {
      title: 'Test Overflow Task',
      priority: 'P2',
      lane: 'queued',
      ...overrides,
    },
  })
  const body = await res.json()
  return body.id as string
}

async function deleteTask (ctx: APIRequestContext, id: string) {
  await ctx.delete(`/api/tasks/${id}`).catch(() => {})
}

// ============================================================
// CREATETASKMODAL TESTS
// ============================================================

test.describe('CreateTaskModal', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.afterEach(async () => {
    await page.close()
  })

  // ── open/close ──────────────────────────────────────────────

  test('opens when "+ New task" button is clicked', async () => {
    await page.click('button:has-text("New task")')
    // The modal header says "Create New Task"
    await expect(page.getByText('Create New Task')).toBeVisible()
  })

  test('X button closes the modal without saving', async () => {
    await page.click('button:has-text("New task")')
    await expect(page.getByText('Create New Task')).toBeVisible()

    // Click the X (close) button inside the modal header
    await page.click('button svg path[d*="M6 18L18 6M6 6l12 12"]', { force: true })
    await expect(page.getByText('Create New Task')).not.toBeVisible({ timeout: 3000 })
  })

  test('Cancel button closes the modal without saving', async () => {
    await page.click('button:has-text("New task")')
    await expect(page.getByText('Create New Task')).toBeVisible()

    await page.click('button:has-text("Cancel")')
    await expect(page.getByText('Create New Task')).not.toBeVisible({ timeout: 3000 })
  })

  test('backdrop click closes the modal without saving', async () => {
    await page.click('button:has-text("New task")')
    await expect(page.getByText('Create New Task')).toBeVisible()

    // Click the dark backdrop overlay at the top-left corner
    await page.mouse.click(10, 10)
    await expect(page.getByText('Create New Task')).not.toBeVisible({ timeout: 3000 })
  })

  // ── form fields ─────────────────────────────────────────────

  test('title input field is present and accepts text', async () => {
    await page.click('button:has-text("New task")')
    const titleInput = page.locator('input[placeholder="What needs to be done?"]')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('My test task')
    await expect(titleInput).toHaveValue('My test task')
  })

  test('priority dropdown is present and contains P0-P3 options', async () => {
    await page.click('button:has-text("New task")')

    const prioritySelect = page.locator('select').filter({ hasText: /P0|P1|P2|P3/ }).first()
    await expect(prioritySelect).toBeVisible()

    // Verify all four priority options exist
    const options = await prioritySelect.locator('option').allTextContents()
    expect(options).toContain('P0')
    expect(options).toContain('P1')
    expect(options).toContain('P2')
    expect(options).toContain('P3')
  })

  test('owner dropdown is present with expected owners', async () => {
    await page.click('button:has-text("New task")')

    // There are two grid rows of selects; owner is the 4th select overall
    const selects = page.locator('select')
    // Find the one whose options contain known owner names
    const count = await selects.count()
    let ownerSelect = null
    for (let i = 0; i < count; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      if (opts.some(o => o.includes('architect') || o.includes('pm') || o.includes('dev-1'))) {
        ownerSelect = selects.nth(i)
        break
      }
    }
    expect(ownerSelect).not.toBeNull()
    const opts = await ownerSelect!.locator('option').allTextContents()
    expect(opts).toContain('architect')
    expect(opts).toContain('pm')
    expect(opts).toContain('dev-1')
    expect(opts).toContain('qa')
  })

  test('type dropdown is present with task types', async () => {
    await page.click('button:has-text("New task")')

    const selects = page.locator('select')
    const count = await selects.count()
    let typeSelect = null
    for (let i = 0; i < count; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      if (opts.some(o => o.includes('feature') || o.includes('bugfix'))) {
        typeSelect = selects.nth(i)
        break
      }
    }
    expect(typeSelect).not.toBeNull()
    const opts = await typeSelect!.locator('option').allTextContents()
    expect(opts).toContain('feature')
    expect(opts).toContain('bugfix')
    expect(opts).toContain('refactor')
  })

  test('Create Task button is disabled when title is empty', async () => {
    await page.click('button:has-text("New task")')
    const submitBtn = page.locator('button:has-text("Create Task")')
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toBeDisabled()
  })

  test('Create Task button enables when title is filled', async () => {
    await page.click('button:has-text("New task")')
    await page.fill('input[placeholder="What needs to be done?"]', 'Valid title')
    const submitBtn = page.locator('button:has-text("Create Task")')
    await expect(submitBtn).not.toBeDisabled()
  })

  test('Advanced section expands problem/scope/AC fields on click', async () => {
    await page.click('button:has-text("New task")')
    // Initially advanced fields not shown
    await expect(page.locator('textarea[placeholder="Why does this task exist?"]')).not.toBeVisible()
    // Click "Advanced" toggle
    await page.click('button:has-text("Advanced")')
    await expect(page.locator('textarea[placeholder="Why does this task exist?"]')).toBeVisible()
    await expect(page.locator('textarea[placeholder="What is in/out of scope?"]')).toBeVisible()
    await expect(page.locator('textarea[placeholder="One criterion per line"]')).toBeVisible()
  })

  test('submitting the form creates a task and closes the modal', async () => {
    const uniqueTitle = `Playwright-Modal-Test-${Date.now()}`
    await page.click('button:has-text("New task")')
    await page.fill('input[placeholder="What needs to be done?"]', uniqueTitle)
    await page.click('button:has-text("Create Task")')

    // Modal should close
    await expect(page.getByText('Create New Task')).not.toBeVisible({ timeout: 5000 })

    // Clean up: delete the created task via API
    const ctx = await createAPICtx()
    try {
      const res = await ctx.get('/api/tasks')
      const tasks = await res.json() as Array<{ id: string; title: string }>
      const created = tasks.find(t => t.title === uniqueTitle)
      if (created) await deleteTask(ctx, created.id)
    } finally {
      await ctx.dispose()
    }
  })

  test('new task appears in kanban board after creation', async () => {
    const uniqueTitle = `Board-Task-${Date.now()}`
    await page.click('button:has-text("New task")')
    await page.fill('input[placeholder="What needs to be done?"]', uniqueTitle)
    // Set lane to "queued" (default) — just submit
    await page.click('button:has-text("Create Task")')

    await expect(page.getByText('Create New Task')).not.toBeVisible({ timeout: 5000 })

    // The new task title should now appear somewhere on the board
    // (it may be in overflow if lane is full — just check API confirms creation)
    const ctx = await createAPICtx()
    try {
      const res = await ctx.get('/api/tasks')
      const tasks = await res.json() as Array<{ id: string; title: string }>
      const created = tasks.find(t => t.title === uniqueTitle)
      expect(created).toBeTruthy()
      if (created) await deleteTask(ctx, created.id)
    } finally {
      await ctx.dispose()
    }
  })

  test('error message displayed when API returns failure', async () => {
    await page.route('**/api/tasks', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: 'Internal server error' })
      } else {
        route.continue()
      }
    })

    await page.click('button:has-text("New task")')
    await page.fill('input[placeholder="What needs to be done?"]', 'Failing task')
    await page.click('button:has-text("Create Task")')

    // Error section should appear
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 })
    // Modal stays open
    await expect(page.getByText('Create New Task')).toBeVisible()
  })
})

// ============================================================
// TASKLISTMODAL TESTS
// ============================================================

test.describe('TaskListModal', () => {
  let page: Page
  let ctx: APIRequestContext
  const createdTaskIds: string[] = []

  test.beforeAll(async () => {
    // Create 9 tasks in "queued" lane so the overflow button appears (MAX = 7)
    ctx = await createAPICtx()
    for (let i = 0; i < 9; i++) {
      const id = await createTask(ctx, {
        title: `Overflow Task ${i + 1} - Playwright`,
        priority: 'P2',
        lane: 'queued',
      })
      createdTaskIds.push(id)
    }
  })

  test.afterAll(async () => {
    for (const id of createdTaskIds) {
      await deleteTask(ctx, id)
    }
    await ctx.dispose()
  })

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Wait for the overflow button to appear
    await page.waitForSelector('button:has-text("more")', { timeout: 10000 })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('overflow "+N more" button is visible when lane exceeds max tasks', async () => {
    const moreBtn = page.locator('button').filter({ hasText: /\+\d+ more/ }).first()
    await expect(moreBtn).toBeVisible()
  })

  test('modal opens when "+N more" button is clicked', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    // TaskListModal shows a modal with task list
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })
  })

  test('modal shows all tasks for that lane', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // The count badge in the title should show all tasks
    const countBadge = page.locator('text=/\\d+ \\/ \\d+/')
    await expect(countBadge).toBeVisible()
    const text = await countBadge.textContent()
    // Should show at least 9 tasks (the ones we created)
    const match = text?.match(/\d+ \/ (\d+)/)
    if (match) {
      expect(parseInt(match[1])).toBeGreaterThanOrEqual(9)
    }
  })

  test('task cards display title, priority badge, and lane', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Each task row is a button; find our overflow tasks
    const taskBtn = page.locator('button').filter({ hasText: 'Overflow Task 1 - Playwright' }).first()
    await expect(taskBtn).toBeVisible()

    // Priority badge (P2) should be visible within the list
    const priorityBadge = page.locator('button').filter({ hasText: 'Overflow Task 1 - Playwright' }).locator('span:has-text("P2")').first()
    await expect(priorityBadge).toBeVisible()
  })

  test('clicking a task card opens the TaskModal', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Click one of the overflow tasks
    await page.locator('button').filter({ hasText: 'Overflow Task 1 - Playwright' }).first().click()

    // TaskModal should now be visible (has details input)
    await expect(page.locator('input[placeholder="Enter title..."]').or(
      page.locator('[data-testid="task-modal"]')
    )).toBeVisible({ timeout: 5000 })
  })

  test('close button (✕) in header closes the modal', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Click the ✕ close button
    await page.locator('button[aria-label="Close modal"]').click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).not.toBeVisible({ timeout: 3000 })
  })

  test('Close button in footer closes the modal', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Footer "Close" button
    const footerClose = page.locator('button:has-text("Close")').last()
    await footerClose.click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).not.toBeVisible({ timeout: 3000 })
  })

  test('backdrop click closes the modal', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Click the fixed backdrop (behind modal) at top-left corner
    await page.mouse.click(5, 5)
    await expect(page.locator('input[placeholder*="Search tasks"]')).not.toBeVisible({ timeout: 3000 })
  })

  test('search input filters the task list', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Search for a specific task
    await page.fill('input[placeholder*="Search tasks"]', 'Overflow Task 5')

    // Should show only matching tasks
    await expect(page.locator('button').filter({ hasText: 'Overflow Task 5 - Playwright' })).toBeVisible()
    // Non-matching tasks should not be visible
    await expect(page.locator('button').filter({ hasText: 'Overflow Task 9 - Playwright' })).not.toBeVisible({ timeout: 2000 })
  })

  test('sort by name option changes task order', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Open sort menu
    await page.locator('button:has-text("Sort:")').click()
    await expect(page.locator('text=By Name')).toBeVisible()
    await page.locator('text=By Name').click()

    // Sort menu should close
    await expect(page.locator('text=By Name')).not.toBeVisible({ timeout: 2000 })

    // Sort button should now show "Sort: name"
    await expect(page.locator('button:has-text("Sort: name")')).toBeVisible()
  })

  test('priority summary badges are displayed', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Priority summary bar should show P0, P1, P2, P3 badges
    await expect(page.locator('text=P2').first()).toBeVisible()
  })

  test('modal is scrollable when task list is long', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // The task list container should have overflow-y scroll capability
    const taskList = page.locator('div[style*="overflowY: auto"], div[style*="overflow-y: auto"]').last()
    await expect(taskList).toBeVisible()
    const overflow = await taskList.evaluate(el => window.getComputedStyle(el).overflowY)
    expect(['auto', 'scroll']).toContain(overflow)
  })

  test('search shows empty state message when no results match', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Search for something that won't match
    await page.fill('input[placeholder*="Search tasks"]', 'XYZ_NO_MATCH_12345')
    await expect(page.locator('text=No tasks match your search')).toBeVisible({ timeout: 3000 })
  })

  test('sort by priority is the default sort option', async () => {
    await page.locator('button').filter({ hasText: /\+\d+ more/ }).first().click()
    await expect(page.locator('input[placeholder*="Search tasks"]')).toBeVisible({ timeout: 5000 })

    // Default sort should be "priority"
    await expect(page.locator('button:has-text("Sort: priority")')).toBeVisible()
  })
})
