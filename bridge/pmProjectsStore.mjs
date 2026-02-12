import fs from 'node:fs/promises'
import path from 'node:path'

const SCHEMA_VERSION = 1

function nowIso() {
  return new Date().toISOString()
}

export function slugifyId(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function isSafeId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(id)
}

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, filePath)
}

function capArray(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return []
  return links
    .map((l) => ({ label: typeof l?.label === 'string' ? l.label.trim() : '', url: typeof l?.url === 'string' ? l.url.trim() : '' }))
    .filter((l) => l.label && l.url)
    .slice(0, 50)
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.filter((t) => typeof t === 'string').map((t) => t.trim()).filter(Boolean))].slice(0, 50)
}

function normalizeProjectStatus(status) {
  const s = typeof status === 'string' ? status : ''
  if (s === 'active' || s === 'paused' || s === 'archived') return s
  return 'active'
}

function normalizePriority(p) {
  const s = typeof p === 'string' ? p : ''
  if (s === 'p0' || s === 'p1' || s === 'p2') return s
  return 'p2'
}

function normalizeFeatureStatus(s) {
  const v = typeof s === 'string' ? s : ''
  if (v === 'planned' || v === 'in_progress' || v === 'blocked' || v === 'done') return v
  return 'planned'
}

function normalizeColumn(c) {
  const v = typeof c === 'string' ? c : ''
  if (v === 'todo' || v === 'in_progress' || v === 'blocked' || v === 'done') return v
  return 'todo'
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return undefined
  const out = sources
    .map((s) => ({ kind: s?.kind, id: typeof s?.id === 'string' ? s.id.trim() : '' }))
    .filter((s) => (s.kind === 'idea' || s.kind === 'question' || s.kind === 'requirement') && s.id)
    .slice(0, 50)
  return out.length ? out : undefined
}

function normalizeDependsOn(dep) {
  if (!Array.isArray(dep)) return undefined
  const out = [...new Set(dep.filter((d) => typeof d === 'string').map((d) => d.trim()).filter(Boolean))].slice(0, 50)
  return out.length ? out : undefined
}

function normalizeTree(nodes) {
  if (!Array.isArray(nodes)) return []
  const clean = (n) => {
    const children = Array.isArray(n?.children) ? n.children.map(clean) : []
    const node = {
      id: typeof n?.id === 'string' ? n.id.trim() : '',
      title: typeof n?.title === 'string' ? n.title.trim() : '',
      summary: typeof n?.summary === 'string' ? n.summary : undefined,
      status: normalizeFeatureStatus(n?.status),
      priority: normalizePriority(n?.priority),
      tags: normalizeTags(n?.tags),
      owner: typeof n?.owner === 'string' ? n.owner : undefined,
      dependsOn: normalizeDependsOn(n?.dependsOn),
      sources: normalizeSources(n?.sources),
      children,
    }

    if (!node.tags?.length) delete node.tags
    if (!node.summary) delete node.summary
    if (!node.owner) delete node.owner
    if (!node.dependsOn) delete node.dependsOn
    if (!node.sources) delete node.sources
    if (!node.children?.length) delete node.children

    return node
  }

  return nodes.map(clean).filter((n) => n.id && n.title)
}

function flattenTree(nodes) {
  const out = []
  const walk = (n) => {
    out.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  for (const n of nodes ?? []) walk(n)
  return out
}

function ensureUniqueFeatureId(tree, desired) {
  const all = new Set(flattenTree(tree).map((n) => n.id))
  const base = slugifyId(desired) || `feat-${Date.now()}`
  let id = base
  let n = 2
  while (all.has(id)) id = `${base}-${n++}`
  return id
}

function findNodeRef(nodes, nodeId) {
  for (let i = 0; i < (nodes ?? []).length; i++) {
    const n = nodes[i]
    if (n.id === nodeId) return { parent: nodes, index: i, node: n }
    if (n.children?.length) {
      const hit = findNodeRef(n.children, nodeId)
      if (hit) return hit
    }
  }
  return null
}

function insertNode(tree, parentId, node) {
  if (!parentId) return [node, ...tree]
  const hit = findNodeRef(tree, parentId)
  if (!hit) return null
  const p = hit.node
  const children = Array.isArray(p.children) ? p.children : []
  p.children = [node, ...children]
  return tree
}

function deleteNode(tree, nodeId) {
  const hit = findNodeRef(tree, nodeId)
  if (!hit) return false
  hit.parent.splice(hit.index, 1)
  return true
}

function normalizeCards(cards) {
  if (!Array.isArray(cards)) return []
  return cards
    .map((c) => ({
      id: typeof c?.id === 'string' ? c.id.trim() : '',
      title: typeof c?.title === 'string' ? c.title.trim() : '',
      featureId: typeof c?.featureId === 'string' ? c.featureId.trim() : undefined,
      owner: typeof c?.owner === 'string' ? c.owner : undefined,
      due: typeof c?.due === 'string' ? c.due : undefined,
      priority: normalizePriority(c?.priority),
      column: normalizeColumn(c?.column),
      createdAt: typeof c?.createdAt === 'string' ? c.createdAt : undefined,
      updatedAt: typeof c?.updatedAt === 'string' ? c.updatedAt : undefined,
    }))
    .filter((c) => c.id && c.title)
    .slice(0, 2000)
}

function normalizeActivity(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((a) => ({
      id: typeof a?.id === 'string' ? a.id.trim() : '',
      at: typeof a?.at === 'string' ? a.at : nowIso(),
      actor: typeof a?.actor === 'string' ? a.actor : 'system',
      text: typeof a?.text === 'string' ? a.text : '',
    }))
    .filter((a) => a.id && a.text)
    .slice(0, 500)
}

function normalizeIntake(intake) {
  const i = intake && typeof intake === 'object' ? intake : {}

  const idea = capArray(i.idea, 50)
    .map((x) => ({
      id: typeof x?.id === 'string' ? x.id.trim() : '',
      at: typeof x?.at === 'string' ? x.at : nowIso(),
      author: x?.author === 'ai' ? 'ai' : 'human',
      text: typeof x?.text === 'string' ? x.text : '',
    }))
    .filter((x) => x.id && x.text)

  const analysis = capArray(i.analysis, 50)
    .map((x) => ({
      id: typeof x?.id === 'string' ? x.id.trim() : '',
      at: typeof x?.at === 'string' ? x.at : nowIso(),
      type: x?.type === 'software' || x?.type === 'ops' || x?.type === 'hybrid' ? x.type : 'hybrid',
      tags: normalizeTags(x?.tags),
      risks: capArray(x?.risks, 30).filter((s) => typeof s === 'string'),
      summary: typeof x?.summary === 'string' ? x.summary : '',
    }))
    .filter((x) => x.id)

  const questions = capArray(i.questions, 200)
    .map((q) => ({
      id: typeof q?.id === 'string' ? q.id.trim() : '',
      category: typeof q?.category === 'string' ? q.category : 'General',
      prompt: typeof q?.prompt === 'string' ? q.prompt : '',
      answer:
        q?.answer && typeof q.answer === 'object' && typeof q.answer.text === 'string'
          ? { text: q.answer.text, at: typeof q.answer.at === 'string' ? q.answer.at : nowIso(), author: q.answer.author === 'ai' ? 'ai' : 'human' }
          : null,
    }))
    .filter((q) => q.id && q.prompt)

  const requirements = capArray(i.requirements, 500)
    .map((r) => ({
      id: typeof r?.id === 'string' ? r.id.trim() : '',
      at: typeof r?.at === 'string' ? r.at : nowIso(),
      source: r?.source === 'ai' ? 'ai' : 'human',
      kind: r?.kind === 'goal' || r?.kind === 'constraint' || r?.kind === 'non_goal' ? r.kind : 'goal',
      text: typeof r?.text === 'string' ? r.text : '',
      citations: Array.isArray(r?.citations)
        ? r.citations
            .map((c) => ({ kind: c?.kind, id: typeof c?.id === 'string' ? c.id.trim() : '' }))
            .filter((c) => (c.kind === 'idea' || c.kind === 'question') && c.id)
            .slice(0, 50)
        : undefined,
    }))
    .filter((r) => r.id && r.text)

  return { idea, analysis, questions, requirements }
}

export function projectDir(rootDir, projectId) {
  if (!isSafeId(projectId)) throw new Error('invalid project id')
  return path.join(rootDir, projectId)
}

function overviewPath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'overview.json')
}
function treePath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'tree.json')
}
function cardsPath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'cards.json')
}
function activityPath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'activity.json')
}
function intakePath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'intake.json')
}
function featureIntakesPath(rootDir, projectId) {
  return path.join(projectDir(rootDir, projectId), 'feature-intakes.json')
}

export async function listPmProjects(rootDir) {
  let entries = []
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name).filter(isSafeId)

  const overviews = await Promise.all(
    ids.map(async (id) => {
      const o = await readJson(overviewPath(rootDir, id), null)
      return o && typeof o === 'object' ? o : null
    }),
  )

  const out = overviews.filter(Boolean)
  out.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
  return out
}

export async function loadPmProject(rootDir, projectId) {
  const overview = await readJson(overviewPath(rootDir, projectId), null)
  if (!overview || typeof overview !== 'object') return null

  const [tree, cards, intake, activity] = await Promise.all([
    readJson(treePath(rootDir, projectId), []),
    readJson(cardsPath(rootDir, projectId), []),
    readJson(intakePath(rootDir, projectId), { idea: [], analysis: [], questions: [], requirements: [] }),
    readJson(activityPath(rootDir, projectId), []),
  ])

  return {
    ...overview,
    tree: normalizeTree(tree),
    cards: normalizeCards(cards),
    intake: normalizeIntake(intake),
    activity: normalizeActivity(activity),
  }
}

export async function ensureUniqueProjectId(rootDir, desired) {
  const base = slugifyId(desired) || `project-${Date.now()}`
  let id = base
  let n = 2
  while (await pathExists(path.join(rootDir, id))) id = `${base}-${n++}`
  return id
}

export async function createPmProject(rootDir, create) {
  const name = typeof create?.name === 'string' ? create.name.trim() : ''
  if (!name) throw new Error('name required')

  const desiredId = typeof create?.id === 'string' && create.id.trim() ? create.id.trim() : name
  const id = await ensureUniqueProjectId(rootDir, desiredId)

  const createdAt = nowIso()
  const overview = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    summary: typeof create?.summary === 'string' ? create.summary : '',
    status: normalizeProjectStatus(create?.status),
    tags: normalizeTags(create?.tags),
    owner: typeof create?.owner === 'string' && create.owner.trim() ? create.owner : 'unknown',
    links: normalizeLinks(create?.links),
    createdAt,
    updatedAt: createdAt,
  }

  const dir = projectDir(rootDir, id)
  await fs.mkdir(dir, { recursive: true })

  const tree = normalizeTree(create?.tree)
  const cards = normalizeCards(create?.cards)
  const intake = normalizeIntake(create?.intake)
  const activity = normalizeActivity(create?.activity)

  await Promise.all([
    writeJsonAtomic(overviewPath(rootDir, id), overview),
    writeJsonAtomic(treePath(rootDir, id), tree),
    writeJsonAtomic(cardsPath(rootDir, id), cards),
    writeJsonAtomic(intakePath(rootDir, id), intake),
    writeJsonAtomic(activityPath(rootDir, id), activity),
  ])

  return { ...overview, tree, cards, intake, activity }
}

export async function updatePmProject(rootDir, projectId, patch) {
  const current = await loadPmProject(rootDir, projectId)
  if (!current) return null

  const nextOverview = {
    ...current,
    name: typeof patch?.name === 'string' ? patch.name.trim() || current.name : current.name,
    summary: typeof patch?.summary === 'string' ? patch.summary : current.summary,
    status: patch?.status !== undefined ? normalizeProjectStatus(patch.status) : current.status,
    tags: patch?.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
    owner: typeof patch?.owner === 'string' ? patch.owner : current.owner,
    links: patch?.links !== undefined ? normalizeLinks(patch.links) : current.links,
    updatedAt: nowIso(),
  }

  const tree = patch?.tree !== undefined ? normalizeTree(patch.tree) : current.tree
  const cards = patch?.cards !== undefined ? normalizeCards(patch.cards) : current.cards
  const intake = patch?.intake !== undefined ? normalizeIntake(patch.intake) : current.intake
  const activity = patch?.activity !== undefined ? normalizeActivity(patch.activity) : current.activity

  await Promise.all([
    writeJsonAtomic(overviewPath(rootDir, projectId), {
      schemaVersion: current.schemaVersion ?? SCHEMA_VERSION,
      id: current.id,
      name: nextOverview.name,
      summary: nextOverview.summary,
      status: nextOverview.status,
      tags: nextOverview.tags,
      owner: nextOverview.owner,
      links: nextOverview.links,
      createdAt: current.createdAt,
      updatedAt: nextOverview.updatedAt,
    }),
    patch?.tree !== undefined ? writeJsonAtomic(treePath(rootDir, projectId), tree) : Promise.resolve(),
    patch?.cards !== undefined ? writeJsonAtomic(cardsPath(rootDir, projectId), cards) : Promise.resolve(),
    patch?.intake !== undefined ? writeJsonAtomic(intakePath(rootDir, projectId), intake) : Promise.resolve(),
    patch?.activity !== undefined ? writeJsonAtomic(activityPath(rootDir, projectId), activity) : Promise.resolve(),
  ])

  return { ...nextOverview, tree, cards, intake, activity }
}

export async function softDeletePmProject(rootDir, projectId) {
  const dir = projectDir(rootDir, projectId)
  if (!(await pathExists(dir))) return false

  const trashRoot = path.join(rootDir, '_trash')
  await fs.mkdir(trashRoot, { recursive: true })
  const target = path.join(trashRoot, `${projectId}-${Date.now()}`)
  await fs.rename(dir, target)
  return true
}

export async function upsertTreeNode(rootDir, projectId, nodeId, update) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const tree = normalizeTree(p.tree)
  const hit = findNodeRef(tree, nodeId)
  if (!hit) return null

  const before = hit.node
  const next = {
    ...before,
    title: typeof update?.title === 'string' ? update.title.trim() || before.title : before.title,
    summary: typeof update?.summary === 'string' ? update.summary : before.summary,
    status: update?.status !== undefined ? normalizeFeatureStatus(update.status) : before.status,
    priority: update?.priority !== undefined ? normalizePriority(update.priority) : before.priority,
    tags: update?.tags !== undefined ? normalizeTags(update.tags) : before.tags,
    owner: typeof update?.owner === 'string' ? update.owner : before.owner,
    dependsOn: update?.dependsOn !== undefined ? normalizeDependsOn(update.dependsOn) : before.dependsOn,
    sources: update?.sources !== undefined ? normalizeSources(update.sources) : before.sources,
    children: Array.isArray(before.children) ? before.children : undefined,
  }
  if (!next.tags?.length) delete next.tags
  if (!next.owner) delete next.owner
  if (!next.summary) delete next.summary
  if (!next.dependsOn) delete next.dependsOn
  if (!next.sources) delete next.sources
  if (!next.children?.length) delete next.children

  hit.parent[hit.index] = next

  await writeJsonAtomic(treePath(rootDir, projectId), tree)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: nowIso(),
  })

  return next
}

export async function createTreeNode(rootDir, projectId, create) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const title = typeof create?.title === 'string' ? create.title.trim() : ''
  if (!title) throw new Error('title required')

  const tree = normalizeTree(p.tree)
  const id = typeof create?.id === 'string' && create.id.trim() ? create.id.trim() : ensureUniqueFeatureId(tree, title)

  const node = {
    id,
    title,
    summary: typeof create?.summary === 'string' ? create.summary : undefined,
    status: normalizeFeatureStatus(create?.status),
    priority: normalizePriority(create?.priority),
    tags: normalizeTags(create?.tags),
    owner: typeof create?.owner === 'string' ? create.owner : undefined,
    dependsOn: normalizeDependsOn(create?.dependsOn),
    sources: normalizeSources(create?.sources),
    children: [],
  }
  if (!node.summary) delete node.summary
  if (!node.tags?.length) delete node.tags
  if (!node.owner) delete node.owner
  if (!node.dependsOn) delete node.dependsOn
  if (!node.sources) delete node.sources
  if (!node.children.length) delete node.children

  const nextTree = insertNode(tree, typeof create?.parentId === 'string' ? create.parentId : '', node)
  if (!nextTree) return { error: 'parent not found' }

  await writeJsonAtomic(treePath(rootDir, projectId), nextTree)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: nowIso(),
  })

  return node
}

export async function deleteTreeNode(rootDir, projectId, nodeId) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const tree = normalizeTree(p.tree)
  const ok = deleteNode(tree, nodeId)
  if (!ok) return false

  await writeJsonAtomic(treePath(rootDir, projectId), tree)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: nowIso(),
  })

  return true
}

export async function moveTreeNode(rootDir, projectId, nodeId, newParentId) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const tree = normalizeTree(p.tree)
  
  // Find and extract the node
  const hit = findNodeRef(tree, nodeId)
  if (!hit) return { error: 'node not found' }
  
  // Can't move a node to be its own child
  if (newParentId === nodeId) return { error: 'cannot move node to itself' }
  
  // Check if newParentId is a descendant of nodeId (would create a cycle)
  if (newParentId) {
    const isDescendant = (nodes, targetId) => {
      for (const n of nodes ?? []) {
        if (n.id === targetId) return true
        if (n.children?.length && isDescendant(n.children, targetId)) return true
      }
      return false
    }
    if (isDescendant(hit.node.children ?? [], newParentId)) {
      return { error: 'cannot move node to its own descendant' }
    }
  }
  
  // Extract the node from its current location
  const node = hit.node
  hit.parent.splice(hit.index, 1)
  
  // Insert into new parent
  const nextTree = insertNode(tree, newParentId || '', node)
  if (!nextTree) return { error: 'parent not found' }

  await writeJsonAtomic(treePath(rootDir, projectId), nextTree)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: nowIso(),
  })

  return node
}

export async function reorderTreeChildren(rootDir, projectId, parentId, orderedIds) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  if (!Array.isArray(orderedIds)) return { error: 'orderedIds must be an array' }

  const tree = normalizeTree(p.tree)
  
  // Find the parent (or use root if no parentId)
  let targetChildren
  if (!parentId) {
    targetChildren = tree
  } else {
    const hit = findNodeRef(tree, parentId)
    if (!hit) return { error: 'parent not found' }
    targetChildren = hit.node.children ?? []
    if (!hit.node.children) hit.node.children = []
  }

  // Verify all orderedIds exist in current children
  const currentIds = new Set(targetChildren.map(n => n.id))
  const orderedSet = new Set(orderedIds)
  
  if (orderedSet.size !== currentIds.size) {
    return { error: 'orderedIds count mismatch' }
  }
  
  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      return { error: `unknown child id: ${id}` }
    }
  }

  // Build a map of id -> node
  const nodeMap = new Map(targetChildren.map(n => [n.id, n]))
  
  // Reorder according to orderedIds
  const reordered = orderedIds.map(id => nodeMap.get(id))
  
  // Update the tree
  if (!parentId) {
    tree.length = 0
    tree.push(...reordered)
  } else {
    const hit = findNodeRef(tree, parentId)
    hit.node.children = reordered
  }

  await writeJsonAtomic(treePath(rootDir, projectId), tree)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: nowIso(),
  })

  return reordered
}

export async function createKanbanCard(rootDir, projectId, create) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const title = typeof create?.title === 'string' ? create.title.trim() : ''
  if (!title) throw new Error('title required')

  const cards = normalizeCards(p.cards)
  const id = typeof create?.id === 'string' && create.id.trim() ? create.id.trim() : `c-${Math.random().toString(16).slice(2, 8)}-${Date.now()}`

  if (cards.some((c) => c.id === id)) throw new Error('card id already exists')

  const at = nowIso()
  const card = {
    id,
    title,
    featureId: typeof create?.featureId === 'string' ? create.featureId.trim() : undefined,
    owner: typeof create?.owner === 'string' ? create.owner : undefined,
    due: typeof create?.due === 'string' ? create.due : undefined,
    priority: normalizePriority(create?.priority),
    column: normalizeColumn(create?.column),
    createdAt: at,
    updatedAt: at,
  }

  const next = [card, ...cards].slice(0, 2000)
  await writeJsonAtomic(cardsPath(rootDir, projectId), next)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })

  return card
}

export async function updateKanbanCard(rootDir, projectId, cardId, patch) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const cards = normalizeCards(p.cards)
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx < 0) return null

  const before = cards[idx]
  const at = nowIso()
  const next = {
    ...before,
    title: typeof patch?.title === 'string' ? patch.title.trim() || before.title : before.title,
    featureId: typeof patch?.featureId === 'string' ? patch.featureId.trim() : before.featureId,
    owner: typeof patch?.owner === 'string' ? patch.owner : before.owner,
    due: typeof patch?.due === 'string' ? patch.due : before.due,
    priority: patch?.priority !== undefined ? normalizePriority(patch.priority) : before.priority,
    column: patch?.column !== undefined ? normalizeColumn(patch.column) : before.column,
    updatedAt: at,
  }

  cards[idx] = next
  await writeJsonAtomic(cardsPath(rootDir, projectId), cards)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })

  return next
}

export async function deleteKanbanCard(rootDir, projectId, cardId) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const cards = normalizeCards(p.cards)
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx < 0) return false

  cards.splice(idx, 1)
  const at = nowIso()
  await writeJsonAtomic(cardsPath(rootDir, projectId), cards)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })

  return true
}

export async function replaceIntake(rootDir, projectId, intake) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const next = normalizeIntake(intake)
  const at = nowIso()
  await writeJsonAtomic(intakePath(rootDir, projectId), next)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })
  return next
}

// Feature-level intake per tree node
export async function getFeatureIntake(rootDir, projectId, nodeId) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const intakes = await readJson(featureIntakesPath(rootDir, projectId), {})
  return intakes[nodeId] ?? null
}

export async function setFeatureIntake(rootDir, projectId, nodeId, intake) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const intakes = await readJson(featureIntakesPath(rootDir, projectId), {})
  intakes[nodeId] = intake
  
  const at = nowIso()
  await writeJsonAtomic(featureIntakesPath(rootDir, projectId), intakes)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })
  return intake
}

export async function appendActivity(rootDir, projectId, entry) {
  const p = await loadPmProject(rootDir, projectId)
  if (!p) return null

  const activity = normalizeActivity(p.activity)
  const at = typeof entry?.at === 'string' ? entry.at : nowIso()
  const id = typeof entry?.id === 'string' && entry.id.trim() ? entry.id.trim() : `a-${Math.random().toString(16).slice(2, 8)}-${Date.now()}`
  const item = {
    id,
    at,
    actor: typeof entry?.actor === 'string' ? entry.actor : 'system',
    text: typeof entry?.text === 'string' ? entry.text : '',
  }

  if (!item.text.trim()) throw new Error('text required')

  const next = [item, ...activity].slice(0, 500)
  await writeJsonAtomic(activityPath(rootDir, projectId), next)
  await writeJsonAtomic(overviewPath(rootDir, projectId), {
    ...(await readJson(overviewPath(rootDir, projectId), {})),
    updatedAt: at,
  })

  return item
}

export function toMarkdownProject(project) {
  const lines = []

  lines.push(`# ${project.name || project.id}`)
  lines.push('')

  lines.push(`- **Status:** ${project.status}`)
  lines.push(`- **Owner:** ${project.owner}`)
  if (Array.isArray(project.tags) && project.tags.length) lines.push(`- **Tags:** ${project.tags.join(', ')}`)
  lines.push(`- **Updated:** ${project.updatedAt}`)
  lines.push('')

  if (project.summary) {
    lines.push('## Summary')
    lines.push(project.summary.trim())
    lines.push('')
  }

  if (Array.isArray(project.links) && project.links.length) {
    lines.push('## Links')
    for (const l of project.links) lines.push(`- [${l.label}](${l.url})`)
    lines.push('')
  }

  function walk(nodes, depth) {
    for (const n of nodes ?? []) {
      const indent = '  '.repeat(depth)
      lines.push(`${indent}- **${n.title}** \`${n.id}\` · ${n.status} · ${String(n.priority).toUpperCase()}`)
      if (n.summary) lines.push(`${indent}  - ${n.summary}`)
      if (n.dependsOn?.length) lines.push(`${indent}  - depends on: ${n.dependsOn.map((d) => `\`${d}\``).join(', ')}`)
      if (n.sources?.length) lines.push(`${indent}  - sources: ${n.sources.map((s) => `\`${s.kind}:${s.id}\``).join(', ')}`)
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }

  lines.push('## Feature tree')
  if (project.tree?.length) walk(project.tree, 0)
  else lines.push('_No features yet._')
  lines.push('')

  const cols = ['todo', 'in_progress', 'blocked', 'done']
  const labels = { todo: 'To do', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' }

  lines.push('## Kanban')
  for (const col of cols) {
    const cards = (project.cards ?? []).filter((c) => c.column === col)
    lines.push(`### ${labels[col]}`)
    if (!cards.length) {
      lines.push('_None._')
      lines.push('')
      continue
    }
    for (const c of cards) {
      lines.push(`- **${c.title}** \`${c.id}\` · ${String(c.priority).toUpperCase()}${c.featureId ? ` · feature \`${c.featureId}\`` : ''}`)
    }
    lines.push('')
  }

  const intake = project.intake
  if (intake) {
    lines.push('## Intake')
    lines.push('')

    if (intake.idea?.length) {
      lines.push('### Idea history')
      for (const i of intake.idea) {
        lines.push(`- ${i.at} · ${i.author}: ${i.text.replace(/\n/g, ' ')}`)
      }
      lines.push('')
    }

    if (intake.analysis?.length) {
      lines.push('### Analysis')
      for (const a of intake.analysis) {
        lines.push(`- ${a.at} · ${a.type} · tags: ${a.tags?.join(', ') || '—'} · risks: ${(a.risks ?? []).join(', ') || 'none'}`)
        if (a.summary) lines.push(`  - ${a.summary.replace(/\n/g, ' ')}`)
      }
      lines.push('')
    }

    if (intake.questions?.length) {
      lines.push('### Questions')
      for (const q of intake.questions) {
        lines.push(`- **${q.prompt}** \`${q.id}\` (${q.category})`)
        lines.push(`  - Answer: ${q.answer?.text ? q.answer.text.replace(/\n/g, ' ') : 'TBD'}`)
      }
      lines.push('')
    }

    if (intake.requirements?.length) {
      lines.push('### Requirements')
      for (const r of intake.requirements) {
        lines.push(`- **${r.kind}**: ${r.text.replace(/\n/g, ' ')}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
