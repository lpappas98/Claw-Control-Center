import React, { useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import { Badge } from '../components/Badge'

type ProjectTab = 'Overview' | 'Tree' | 'Kanban'

type ProjectLink = { label: string; url: string }

type FeatureNode = {
  id: string
  title: string
  summary?: string
  status: 'planned' | 'in_progress' | 'blocked' | 'done'
  priority: 'p0' | 'p1' | 'p2'
  tags?: string[]
  owner?: string
  children?: FeatureNode[]
  dependsOn?: string[]
}

type KanbanColumnId = 'todo' | 'in_progress' | 'blocked' | 'done'

type KanbanCard = {
  id: string
  title: string
  featureId?: string
  owner?: string
  due?: string
  priority: 'p0' | 'p1' | 'p2'
  column: KanbanColumnId
}

type Project = {
  id: string
  name: string
  summary: string
  status: 'active' | 'paused' | 'archived'
  tags: string[]
  owner: string
  updatedAt: string
  links: ProjectLink[]
  tree: FeatureNode[]
  cards: KanbanCard[]
  activity: { id: string; at: string; text: string }[]
}

function fmtAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.round(ms / 60_000)
  if (min < 2) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 48) return `${hr}h ago`
  const d = Math.round(hr / 24)
  return `${d}d ago`
}

function flattenTree(nodes: FeatureNode[]): FeatureNode[] {
  const out: FeatureNode[] = []
  const walk = (n: FeatureNode) => {
    out.push(n)
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}

function findInTree(nodes: FeatureNode[], id: string): FeatureNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = n.children?.length ? findInTree(n.children, id) : null
    if (hit) return hit
  }
  return null
}

function nodeDotClass(status: FeatureNode['status']): string {
  if (status === 'done') return 'active'
  if (status === 'in_progress') return 'waiting'
  if (status === 'blocked') return 'stale'
  return 'offline'
}

function PriorityBadge({ p }: { p: KanbanCard['priority'] | FeatureNode['priority'] }) {
  // reuse the existing Badge component styles by mapping into its "kind".
  const kind = p === 'p0' ? ('down' as const) : p === 'p1' ? ('warn' as const) : ('ok' as const)
  return <Badge kind={kind} />
}

function fakeProjects(): Project[] {
  const now = Date.now()
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString()

  const tree: FeatureNode[] = [
    {
      id: 'feat-auth',
      title: 'Auth + identities',
      summary: 'Local auth, sessions, and role-based permissions.',
      status: 'in_progress',
      priority: 'p0',
      tags: ['security'],
      owner: 'Logan',
      children: [
        {
          id: 'feat-auth-login',
          title: 'Login / unlock flow',
          summary: 'Quick unlock for local instance + optional passcode.',
          status: 'planned',
          priority: 'p1',
          dependsOn: ['feat-auth'],
        },
        {
          id: 'feat-auth-perms',
          title: 'Tool permissions matrix',
          summary: 'Allow/deny rules for exec/browser/messaging, etc.',
          status: 'planned',
          priority: 'p0',
          dependsOn: ['feat-auth'],
        },
      ],
    },
    {
      id: 'feat-projects',
      title: 'Projects hub UX',
      summary: 'Overview / Tree / Kanban with deep feature specs.',
      status: 'planned',
      priority: 'p0',
      tags: ['ux'],
      children: [
        {
          id: 'feat-projects-overview',
          title: 'Project overview dashboard',
          summary: 'High-signal project homepage: priorities, links, activity.',
          status: 'planned',
          priority: 'p0',
          dependsOn: ['feat-projects'],
        },
        {
          id: 'feat-projects-tree',
          title: 'Feature tree map',
          summary: 'Hierarchy + dependency view with feature spec pages.',
          status: 'planned',
          priority: 'p0',
          dependsOn: ['feat-projects'],
        },
        {
          id: 'feat-projects-kanban',
          title: 'Kanban board',
          summary: 'Execution view; connect cards to features.',
          status: 'planned',
          priority: 'p1',
          dependsOn: ['feat-projects'],
        },
      ],
    },
    {
      id: 'feat-bridge',
      title: 'Bridge + local status',
      summary: 'Expose health + actions via the local bridge.',
      status: 'blocked',
      priority: 'p1',
      tags: ['backend'],
      children: [
        {
          id: 'feat-bridge-jobs',
          title: 'Jobs / cron visibility',
          summary: 'Show scheduled jobs and last runs.',
          status: 'planned',
          priority: 'p2',
          dependsOn: ['feat-bridge'],
        },
      ],
    },
  ]

  const cards: KanbanCard[] = [
    { id: 'c-1', title: 'Design Settings nav + sections', priority: 'p0', column: 'in_progress', owner: 'Logan', featureId: 'feat-auth-perms', due: 'Fri' },
    { id: 'c-2', title: 'Tree view: focus + search + filters', priority: 'p0', column: 'todo', owner: 'TARS', featureId: 'feat-projects-tree' },
    { id: 'c-3', title: 'Project overview: “Next up” block', priority: 'p1', column: 'todo', owner: 'TARS', featureId: 'feat-projects-overview' },
    { id: 'c-4', title: 'Bridge: expose service health', priority: 'p2', column: 'blocked', owner: 'TARS', featureId: 'feat-bridge' },
    { id: 'c-5', title: 'Kanban: drag + drop interactions', priority: 'p1', column: 'todo', owner: 'TARS', featureId: 'feat-projects-kanban' },
    { id: 'c-6', title: 'Write acceptance criteria template', priority: 'p2', column: 'done', owner: 'TARS', featureId: 'feat-projects' },
  ]

  return [
    {
      id: 'p-operator-hub',
      name: 'TARS Operator Hub',
      summary: 'Local-first control surface for OpenClaw + projects.',
      status: 'active',
      tags: ['local', 'operator', 'ux'],
      owner: 'Logan',
      updatedAt: iso(32),
      links: [
        { label: 'Repo', url: 'https://github.com/openclaw/openclaw' },
        { label: 'Docs', url: 'https://docs.openclaw.ai' },
        { label: 'Figma', url: 'https://figma.com' },
      ],
      tree,
      cards,
      activity: [
        { id: 'a-1', at: iso(14), text: 'Moved “Design Settings nav + sections” → In progress' },
        { id: 'a-2', at: iso(54), text: 'Created feature: “Feature tree map”' },
        { id: 'a-3', at: iso(160), text: 'Updated project summary and links' },
      ],
    },
    {
      id: 'p-task-manager',
      name: 'Task Manager',
      summary: 'Simple kanban + quick capture app (reference UI).',
      status: 'paused',
      tags: ['reference', 'kanban'],
      owner: 'Logan',
      updatedAt: iso(240),
      links: [{ label: 'Mock repo', url: 'https://example.com' }],
      tree: [
        {
          id: 'feat-capture',
          title: 'Fast capture',
          summary: 'One-line add, keyboard-first.',
          status: 'done',
          priority: 'p1',
        },
        {
          id: 'feat-board',
          title: 'Board view',
          summary: 'Columns, drag/drop, swimlanes.',
          status: 'in_progress',
          priority: 'p0',
        },
      ],
      cards: [
        { id: 'tc-1', title: 'Polish column headers', priority: 'p2', column: 'todo', owner: 'Logan' },
        { id: 'tc-2', title: 'Add keyboard shortcuts', priority: 'p1', column: 'in_progress', owner: 'Logan' },
      ],
      activity: [{ id: 'ta-1', at: iso(200), text: 'Paused project' }],
    },
  ]
}

function TabBar({ tab, setTab }: { tab: ProjectTab; setTab: (t: ProjectTab) => void }) {
  return (
    <div className="projects-tabbar" role="tablist" aria-label="Project view">
      {(['Overview', 'Tree', 'Kanban'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          className={`projects-tab ${tab === t ? 'active' : ''}`}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function FeatureDrawer({
  feature,
  project,
  onClose,
}: {
  feature: FeatureNode
  project: Project
  onClose: () => void
}) {
  const [innerTab, setInnerTab] = useState<'Spec' | 'Work' | 'Activity'>('Spec')

  const linkedCards = useMemo(
    () => project.cards.filter((c) => c.featureId === feature.id),
    [project.cards, feature.id],
  )

  const deps = useMemo(() => {
    const byId = new Map(flattenTree(project.tree).map((n) => [n.id, n] as const))
    return (feature.dependsOn ?? []).map((id) => byId.get(id)).filter(Boolean) as FeatureNode[]
  }, [feature.dependsOn, project.tree])

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Feature details ${feature.title}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              feature <code>{feature.id}</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: '6px 0 0', lineHeight: 1.15 }}>{feature.title}</h3>
              <span className={`dot ${nodeDotClass(feature.status)}`} title={feature.status} />
              <PriorityBadge p={feature.priority} />
            </div>
            {feature.summary ? <div className="muted" style={{ marginTop: 6 }}>{feature.summary}</div> : null}
          </div>
          <div className="stack-h" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="drawer-tabs" role="tablist" aria-label="Feature details">
          {(['Spec', 'Work', 'Activity'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={innerTab === t}
              className={`drawer-tab ${innerTab === t ? 'active' : ''}`}
              onClick={() => setInnerTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {innerTab === 'Spec' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Brief</h4>
                <div className="stack">
                  <div className="field">
                    <label className="muted">Problem</label>
                    <textarea className="input" rows={3} defaultValue={`(fake) Users need ${feature.title.toLowerCase()} to ship reliably without manual steps.`} />
                  </div>
                  <div className="field">
                    <label className="muted">Solution</label>
                    <textarea className="input" rows={3} defaultValue={`(fake) Provide a clear UI flow, safe defaults, and obvious status feedback.`} />
                  </div>
                  <div className="field">
                    <label className="muted">Non-goals</label>
                    <textarea className="input" rows={2} defaultValue={`(fake) Not building team workflows; single-user local mode first.`} />
                  </div>
                </div>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Acceptance criteria</h4>
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Feature has a clear “happy path” documented.</li>
                  <li>Edge cases are captured as open questions or explicit behavior.</li>
                  <li>Linked work items exist in Kanban.</li>
                </ul>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Dependencies</h4>
                {deps.length ? (
                  <div className="stack" style={{ gap: 8 }}>
                    {deps.map((d) => (
                      <div key={d.id} className="row" style={{ margin: 0 }}>
                        <div className="row-main">
                          <div className="row-title">
                            <span className={`dot ${nodeDotClass(d.status)}`} />
                            <strong>{d.title}</strong>
                            <PriorityBadge p={d.priority} />
                          </div>
                          {d.summary ? <div className="muted">{d.summary}</div> : null}
                        </div>
                        <div className="row-side">
                          <span className="muted">depends on</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">No dependencies listed.</div>
                )}
              </div>
            </div>
          ) : null}

          {innerTab === 'Work' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Linked work</h4>
                {linkedCards.length ? (
                  <div className="table-like">
                    {linkedCards.map((c) => (
                      <div key={c.id} className="row" style={{ margin: 0 }}>
                        <div className="row-main">
                          <div className="row-title">
                            <strong>{c.title}</strong>
                            <PriorityBadge p={c.priority} />
                          </div>
                          <div className="muted">Owner: {c.owner ?? '—'} · Due: {c.due ?? '—'}</div>
                        </div>
                        <div className="row-side">
                          <Badge kind={c.column === 'done' ? 'ok' : c.column === 'blocked' ? 'down' : c.column === 'in_progress' ? 'warn' : 'unknown'} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">No linked cards yet.</div>
                )}
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Checklist</h4>
                <div className="muted">(fake) Add subtasks here. In the real build this could feed Kanban cards or vice-versa.</div>
              </div>
            </div>
          ) : null}

          {innerTab === 'Activity' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Recent activity</h4>
                <div className="table-like">
                  {project.activity.slice(0, 8).map((a) => (
                    <div key={a.id} className="row" style={{ margin: 0 }}>
                      <div className="row-main">
                        <strong>{a.text}</strong>
                        <div className="muted">{fmtAgo(a.at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function TreeView({ project, onOpen }: { project: Project; onOpen: (n: FeatureNode) => void }) {
  const [query, setQuery] = useState('')
  const [showDeps, setShowDeps] = useState(false)

  const all = useMemo(() => flattenTree(project.tree), [project.tree])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return new Set<string>()
    const ids = all
      .filter((n) => `${n.title} ${n.summary ?? ''} ${n.tags?.join(' ') ?? ''}`.toLowerCase().includes(q))
      .map((n) => n.id)
    return new Set(ids)
  }, [all, query])

  const isVisible = (n: FeatureNode): boolean => {
    if (!query.trim()) return true
    if (matches.has(n.id)) return true
    return !!n.children?.some(isVisible)
  }

  const walk = (n: FeatureNode, depth: number) => {
    if (!isVisible(n)) return null
    const highlight = matches.has(n.id)

    return (
      <div key={n.id} style={{ marginLeft: depth ? depth * 14 : 0, paddingLeft: depth ? 12 : 0, borderLeft: depth ? '1px solid var(--border)' : undefined }}>
        <div className={`tree-row ${highlight ? 'highlight' : ''}`}>
          <button className="btn ghost tree-node" type="button" onClick={() => onOpen(n)} title="Open feature spec">
            <span className={`dot ${nodeDotClass(n.status)}`} />
            <span style={{ fontWeight: 800 }}>{n.title}</span>
          </button>
          <div className="tree-row-meta">
            <PriorityBadge p={n.priority} />
            {n.tags?.slice(0, 2).map((t) => (
              <span key={t} className="pill">{t}</span>
            ))}
          </div>
        </div>

        {n.summary ? <div className="muted" style={{ marginTop: 6 }}>{n.summary}</div> : null}

        {showDeps && n.dependsOn?.length ? (
          <div className="muted" style={{ marginTop: 6 }}>
            depends on: {n.dependsOn.map((d) => <code key={d} style={{ marginRight: 8 }}>{d}</code>)}
          </div>
        ) : null}

        {n.children?.length ? <div style={{ marginTop: 8 }}>{n.children.map((c) => walk(c, depth + 1))}</div> : null}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="tree-toolbar">
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search features…" />
        <label className="field inline" style={{ margin: 0 }}>
          <input type="checkbox" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
          <span className="muted">Show dependencies</span>
        </label>
        <button className="btn" type="button" onClick={() => alert('(wireframe) Add new feature node')}>
          + Add node
        </button>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <h3 style={{ margin: 0 }}>Feature tree</h3>
            <div className="muted">Hierarchy first. Optional dependency hints (toggle above).</div>
          </div>
          <div className="muted">{all.length} node(s)</div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {project.tree.map((n) => walk(n, 0))}
        </div>
      </div>
    </div>
  )
}

function KanbanBoard({ project, onOpenFeature }: { project: Project; onOpenFeature: (n: FeatureNode) => void }) {
  const [cards, setCards] = useState<KanbanCard[]>(() => project.cards)

  const byCol = useMemo(() => {
    const cols: Record<KanbanColumnId, KanbanCard[]> = { todo: [], in_progress: [], blocked: [], done: [] }
    for (const c of cards) cols[c.column].push(c)
    return cols
  }, [cards])

  const columns: { id: KanbanColumnId; title: string; hint: string }[] = [
    { id: 'todo', title: 'To do', hint: 'Not started' },
    { id: 'in_progress', title: 'In progress', hint: 'Working' },
    { id: 'blocked', title: 'Blocked', hint: 'Waiting on deps' },
    { id: 'done', title: 'Done', hint: 'Shipped' },
  ]

  const onDrop = (col: KanbanColumnId, ev: React.DragEvent) => {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/kanban-card')
    if (!id) return
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column: col } : c)))
  }

  const openFeatureForCard = (c: KanbanCard) => {
    if (!c.featureId) return
    const n = findInTree(project.tree, c.featureId)
    if (n) onOpenFeature(n)
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="panel" style={{ padding: 14 }}>
        <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Kanban</h3>
            <div className="muted">Drag cards between columns. Cards can link to a feature spec.</div>
          </div>
          <div className="stack-h">
            <button
              className="btn"
              type="button"
              onClick={() =>
                setCards((prev) => [
                  { id: `c-${Math.random().toString(16).slice(2, 6)}`, title: 'New task (wireframe)', priority: 'p2', column: 'todo', owner: 'Logan' },
                  ...prev,
                ])
              }
            >
              + Add card
            </button>
          </div>
        </div>

        <div className="kanban-grid">
          {columns.map((col) => (
            <div key={col.id} className="kanban-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(col.id, e)}>
              <div className="kanban-col-head">
                <div>
                  <strong>{col.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{col.hint}</div>
                </div>
                <span className="muted">{byCol[col.id].length}</span>
              </div>

              <div className="kanban-cards">
                {byCol[col.id].map((c) => (
                  <div
                    key={c.id}
                    className="kanban-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/kanban-card', c.id)}
                    title="Drag to move"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <strong style={{ lineHeight: 1.2 }}>{c.title}</strong>
                      <PriorityBadge p={c.priority} />
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      {c.owner ? `@${c.owner}` : '—'} {c.due ? `· due ${c.due}` : ''}
                    </div>
                    {c.featureId ? (
                      <button className="btn ghost" type="button" style={{ marginTop: 10, width: '100%' }} onClick={() => openFeatureForCard(c)}>
                        Open linked feature
                      </button>
                    ) : (
                      <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                        No feature link
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Overview({ project }: { project: Project }) {
  const topFeatures = useMemo(() => flattenTree(project.tree).slice(0, 6), [project.tree])

  return (
    <div className="stack" style={{ gap: 12 }}>
      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Product details</h3>
            <div className="muted">Project brief + high-signal at-a-glance info.</div>
          </div>
          <div className="stack-h">
            <span className={`pill ${project.status === 'active' ? 'sev-low' : project.status === 'paused' ? 'sev-medium' : 'sev-high'}`}>{project.status}</span>
            <span className="muted">updated {fmtAgo(project.updatedAt)}</span>
          </div>
        </div>

        <div className="grid-3">
          <div className="stat-card">
            <div className="stat-title">Owner</div>
            <div className="stat-value"><strong>{project.owner}</strong></div>
            <div className="muted">single-user local mode</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Tags</div>
            <div className="stat-value"><strong>{project.tags.join(' · ')}</strong></div>
            <div className="muted">(fake) configurable</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Work</div>
            <div className="stat-value"><strong>{project.cards.filter((c) => c.column !== 'done').length}</strong> open</div>
            <div className="muted">{project.cards.filter((c) => c.column === 'blocked').length} blocked</div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label className="muted">Description</label>
          <textarea className="input" rows={6} defaultValue={project.summary + '\n\n(fake) Success looks like: fast orientation, clear feature specs, and smooth execution via Kanban.'} />
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Key features + links</h3>
            <div className="muted">Quick entry points (wireframe).</div>
          </div>
          <div className="stack-h">
            {project.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="btn ghost" style={{ textDecoration: 'none' }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>

        <div className="feed-grid">
          {topFeatures.map((f) => (
            <div key={f.id} className="feed-item clean">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <strong>{f.title}</strong>
                <PriorityBadge p={f.priority} />
              </div>
              <div className="muted" style={{ marginTop: 6 }}>{f.summary ?? '—'}</div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                <span className={`dot ${nodeDotClass(f.status)}`} /> <span style={{ marginLeft: 6 }}>{f.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: 14 }}>
        <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Activity</h3>
            <div className="muted">What changed recently.</div>
          </div>
        </div>

        <div className="table-like">
          {project.activity.map((a) => (
            <div key={a.id} className="row" style={{ margin: 0 }}>
              <div className="row-main">
                <strong>{a.text}</strong>
                <div className="muted">{fmtAgo(a.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function Projects({ adapter: _adapter }: { adapter: Adapter }) {
  const [projects, setProjects] = useState<Project[]>(() => fakeProjects())
  const [activeId, setActiveId] = useState(projects[0]?.id ?? null)
  const [tab, setTab] = useState<ProjectTab>('Overview')
  const [drawer, setDrawer] = useState<FeatureNode | null>(null)

  const active = useMemo(() => projects.find((p) => p.id === activeId) ?? projects[0] ?? null, [projects, activeId])

  return (
    <main className="projects-layout">
      <aside className="projects-sidebar">
        <div className="panel" style={{ padding: 14 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Projects</h2>
              <div className="muted">Select a project to view Overview / Tree / Kanban.</div>
            </div>
          </div>

          <input
            className="input"
            placeholder="Search projects…"
            onChange={(e) => {
              const q = e.target.value.trim().toLowerCase()
              if (!q) {
                setProjects(fakeProjects())
                return
              }
              setProjects(fakeProjects().filter((p) => `${p.name} ${p.summary} ${p.tags.join(' ')}`.toLowerCase().includes(q)))
            }}
          />

          <div className="projects-list" style={{ marginTop: 12 }}>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`project-item ${active?.id === p.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveId(p.id)
                  setTab('Overview')
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <strong style={{ textAlign: 'left' }}>{p.name}</strong>
                  <span className={`pill ${p.status === 'active' ? 'sev-low' : p.status === 'paused' ? 'sev-medium' : 'sev-high'}`}>{p.status}</span>
                </div>
                <div className="muted" style={{ marginTop: 6, textAlign: 'left' }}>{p.summary}</div>
                <div className="muted" style={{ marginTop: 8, textAlign: 'left', fontSize: 12 }}>updated {fmtAgo(p.updatedAt)}</div>
              </button>
            ))}
            {!projects.length ? <div className="muted">No matches.</div> : null}
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn"
              type="button"
              onClick={() => alert('(wireframe) Create new project')}
            >
              New Project
            </button>
          </div>
        </div>
      </aside>

      <section className="projects-main">
        {!active ? (
          <div className="panel span-4">
            <h2>Projects</h2>
            <p className="muted">No project selected.</p>
          </div>
        ) : (
          <div className="panel projects-main-panel">
            <div className="projects-main-header">
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12 }}>project</div>
                <h2 style={{ margin: '6px 0 0' }}>{active.name}</h2>
                <div className="muted" style={{ marginTop: 6 }}>{active.summary}</div>
              </div>
              <div className="stack-h" style={{ justifyContent: 'flex-end' }}>
                <button className="btn ghost" type="button" onClick={() => alert('(wireframe) Share/project settings')}>
                  Settings
                </button>
                <button className="btn" type="button" onClick={() => alert('(wireframe) Quick add work item')}>
                  + Quick add
                </button>
              </div>
            </div>

            <div className="projects-main-body">
              {tab === 'Overview' ? <Overview project={active} /> : null}
              {tab === 'Tree' ? <TreeView project={active} onOpen={(n) => setDrawer(n)} /> : null}
              {tab === 'Kanban' ? <KanbanBoard project={active} onOpenFeature={(n) => setDrawer(n)} /> : null}
            </div>

            <div className="projects-main-footer">
              <TabBar tab={tab} setTab={setTab} />
            </div>
          </div>
        )}
      </section>

      {active && drawer ? <FeatureDrawer project={active} feature={drawer} onClose={() => setDrawer(null)} /> : null}
    </main>
  )
}
