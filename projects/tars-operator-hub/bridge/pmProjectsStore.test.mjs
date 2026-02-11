import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

import {
  createKanbanCard,
  createPmProject,
  createTreeNode,
  deleteKanbanCard,
  deleteTreeNode,
  listPmProjects,
  loadPmProject,
  replaceIntake,
  softDeletePmProject,
  updateKanbanCard,
  updatePmProject,
  upsertTreeNode,
} from './pmProjectsStore.mjs'

async function makeTmpRoot() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'operator-hub-projects-'))
  return dir
}

test('pmProjectsStore: create/list/load/update/soft-delete', async () => {
  const root = await makeTmpRoot()

  const created = await createPmProject(root, {
    name: 'My Project',
    summary: 'Hello',
    tags: ['a', 'b', 'a'],
    links: [{ label: 'Repo', url: 'https://example.com' }],
    tree: [{ id: 'feat-1', title: 'Feature 1', status: 'planned', priority: 'p0', children: [] }],
    cards: [{ id: 'c-1', title: 'Card 1', column: 'todo', priority: 'p1' }],
  })

  assert.equal(created.name, 'My Project')
  assert.equal(created.tags.length, 2)
  assert.ok(created.id)

  const list = await listPmProjects(root)
  assert.equal(list.length, 1)
  assert.equal(list[0].id, created.id)

  const loaded = await loadPmProject(root, created.id)
  assert.ok(loaded)
  assert.equal(loaded.tree.length, 1)
  assert.equal(loaded.cards.length, 1)

  const updated = await updatePmProject(root, created.id, { status: 'paused', tags: ['x'] })
  assert.ok(updated)
  assert.equal(updated.status, 'paused')
  assert.deepEqual(updated.tags, ['x'])

  const ok = await softDeletePmProject(root, created.id)
  assert.equal(ok, true)

  const after = await loadPmProject(root, created.id)
  assert.equal(after, null)
})

test('pmProjectsStore: tree node CRUD', async () => {
  const root = await makeTmpRoot()
  const p = await createPmProject(root, { name: 'Tree Demo' })

  const epic = await createTreeNode(root, p.id, { title: 'Epic 1', priority: 'p0', status: 'planned' })
  assert.ok(epic)
  assert.equal(epic.title, 'Epic 1')

  const child = await createTreeNode(root, p.id, { title: 'Child 1', parentId: epic.id, priority: 'p1' })
  assert.ok(child)

  const updated = await upsertTreeNode(root, p.id, child.id, { status: 'in_progress', dependsOn: [epic.id] })
  assert.ok(updated)
  assert.equal(updated.status, 'in_progress')
  assert.deepEqual(updated.dependsOn, [epic.id])

  const del = await deleteTreeNode(root, p.id, child.id)
  assert.equal(del, true)

  const reloaded = await loadPmProject(root, p.id)
  assert.ok(reloaded)
  const flatIds = []
  const walk = (nodes) => {
    for (const n of nodes) {
      flatIds.push(n.id)
      if (n.children) walk(n.children)
    }
  }
  walk(reloaded.tree)
  assert.ok(flatIds.includes(epic.id))
  assert.ok(!flatIds.includes(child.id))
})

test('pmProjectsStore: cards CRUD + intake replace', async () => {
  const root = await makeTmpRoot()
  const p = await createPmProject(root, { name: 'Cards Demo' })

  const card = await createKanbanCard(root, p.id, { title: 'Do thing', priority: 'p0', column: 'todo' })
  assert.ok(card)

  const moved = await updateKanbanCard(root, p.id, card.id, { column: 'done' })
  assert.ok(moved)
  assert.equal(moved.column, 'done')

  const del = await deleteKanbanCard(root, p.id, card.id)
  assert.equal(del, true)

  const intake = await replaceIntake(root, p.id, {
    idea: [{ id: 'idea-1', at: new Date().toISOString(), author: 'human', text: 'Build X' }],
    analysis: [],
    questions: [],
    requirements: [],
  })
  assert.equal(intake.idea.length, 1)
})
