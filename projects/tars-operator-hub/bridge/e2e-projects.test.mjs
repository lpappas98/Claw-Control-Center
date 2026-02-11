/**
 * E2E test script for Projects Hub in Bridge mode
 * Run with: node --test bridge/e2e-projects.test.mjs
 * 
 * Requires: Bridge running on http://localhost:8787
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'

const BASE = process.env.BRIDGE_URL ?? 'http://localhost:8787'

async function fetchJson(path, init) {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

let testProjectId = null

describe('PM Projects E2E', () => {
  before(async () => {
    // Check bridge is running
    try {
      await fetchJson('/api/status')
    } catch {
      throw new Error('Bridge not running. Start with: npm run bridge')
    }
  })

  after(async () => {
    // Clean up test project
    if (testProjectId) {
      try {
        await fetchJson(`/api/pm/projects/${testProjectId}`, { method: 'DELETE' })
      } catch {
        // ignore cleanup errors
      }
    }
  })

  it('creates a new project', async () => {
    const project = await fetchJson('/api/pm/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Test Project',
        summary: 'Created by automated test',
        status: 'active',
        tags: ['test', 'e2e'],
      }),
    })

    assert.ok(project.id, 'project should have id')
    assert.strictEqual(project.name, 'E2E Test Project')
    assert.strictEqual(project.status, 'active')
    testProjectId = project.id
  })

  it('lists projects including the new one', async () => {
    const projects = await fetchJson('/api/pm/projects')
    assert.ok(Array.isArray(projects), 'should return array')
    const found = projects.find(p => p.id === testProjectId)
    assert.ok(found, 'should find test project in list')
  })

  it('gets project by id', async () => {
    const project = await fetchJson(`/api/pm/projects/${testProjectId}`)
    assert.strictEqual(project.id, testProjectId)
    assert.strictEqual(project.name, 'E2E Test Project')
  })

  it('updates project', async () => {
    const updated = await fetchJson(`/api/pm/projects/${testProjectId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: 'Updated by E2E test',
        tags: ['test', 'e2e', 'updated'],
      }),
    })

    assert.strictEqual(updated.summary, 'Updated by E2E test')
    assert.ok(updated.tags.includes('updated'))
  })

  it('adds tree node to project', async () => {
    const node = await fetchJson(`/api/pm/projects/${testProjectId}/tree/nodes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Feature',
        description: 'E2E test feature node',
        status: 'draft',
        priority: 'P1',
      }),
    })

    assert.ok(node.id, 'node should have id')
    assert.strictEqual(node.title, 'Test Feature')
  })

  it('gets tree with the new node', async () => {
    const tree = await fetchJson(`/api/pm/projects/${testProjectId}/tree`)
    assert.ok(Array.isArray(tree), 'should return array')
    const found = tree.find(n => n.title === 'Test Feature')
    assert.ok(found, 'should find test node')
  })

  it('creates kanban card', async () => {
    const card = await fetchJson(`/api/pm/projects/${testProjectId}/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Card',
        featureId: '',
        column: 'todo',
        priority: 'P2',
      }),
    })

    assert.ok(card.id, 'card should have id')
    assert.strictEqual(card.title, 'Test Card')
    assert.strictEqual(card.column, 'todo')
  })

  it('moves card to different column', async () => {
    const cards = await fetchJson(`/api/pm/projects/${testProjectId}/cards`)
    const card = cards.find(c => c.title === 'Test Card')
    assert.ok(card, 'should find test card')

    const updated = await fetchJson(`/api/pm/projects/${testProjectId}/cards/${card.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column: 'in_progress' }),
    })

    assert.strictEqual(updated.column, 'in_progress')
  })

  it('adds intake idea version', async () => {
    const intake = await fetchJson(`/api/pm/projects/${testProjectId}/intake/idea`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'This is a test project idea' }),
    })

    // Backend returns intake object with 'idea' array (not 'ideas')
    assert.ok(intake.idea?.length > 0 || intake.ideas?.length > 0, 'should have ideas')
    const ideas = intake.idea || intake.ideas || []
    assert.ok(ideas.some(i => i.text === 'This is a test project idea'))
  })

  it('exports project as JSON', async () => {
    const exported = await fetchJson(`/api/pm/projects/${testProjectId}/export.json`)
    // Export returns the full project object directly, not wrapped
    assert.ok(exported.id || exported.project, 'should have project data')
  })

  it('exports project as Markdown', async () => {
    const res = await fetch(`${BASE}/api/pm/projects/${testProjectId}/export.md`)
    assert.ok(res.ok, 'should succeed')
    const md = await res.text()
    assert.ok(md.includes('E2E Test Project'), 'should include project name')
  })

  it('soft-deletes project', async () => {
    const result = await fetchJson(`/api/pm/projects/${testProjectId}`, {
      method: 'DELETE',
    })
    assert.ok(result.ok, 'should succeed')

    // Verify it's gone from list
    const projects = await fetchJson('/api/pm/projects')
    const found = projects.find(p => p.id === testProjectId)
    assert.ok(!found, 'should not find deleted project')
    
    testProjectId = null // don't try to clean up again
  })
})
