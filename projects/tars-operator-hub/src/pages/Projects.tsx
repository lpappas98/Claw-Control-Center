import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { PMProject, PMTreeNode, PMCard, PMIntake, FeatureIntake } from '../types'
import { Badge } from '../components/Badge'
import { FeatureIntakeModal } from '../components/FeatureIntakeModal'

function FeedItem({
  actor,
  text,
  meta,
  tone,
}: {
  actor: string
  text: string
  meta?: string
  tone?: 'clean' | 'warn' | 'error'
}) {
  return (
    <div className={`feed-item ${tone ?? 'clean'}`}>
      <div className={`feed-head ${tone ?? 'clean'}`}>
        <div className="feed-actor">{actor}</div>
        <div className="muted">·</div>
        <div className="feed-msg">{text}</div>
      </div>
      {meta ? <div className="muted" style={{ fontSize: 12 }}>{meta}</div> : null}
    </div>
  )
}

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
  sources?: { kind: 'idea' | 'question' | 'requirement'; id: string }[]
  /** Feature-level intake data */
  featureIntake?: FeatureIntake
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

type IntakeIdea = { id: string; at: string; author: 'human' | 'ai'; text: string }

type IntakeQuestion = {
  id: string
  category: string
  prompt: string
  required?: boolean
  answer: { text: string; at: string; author: 'human' | 'ai' } | null
}

type ProjectIntake = {
  idea: IntakeIdea[]
  analysis: { id: string; at: string; type: 'software' | 'ops' | 'hybrid'; tags: string[]; risks: string[]; summary: string }[]
  questions: IntakeQuestion[]
  requirements: {
    id: string
    at: string
    source: 'human' | 'ai'
    kind: 'goal' | 'constraint' | 'non_goal'
    text: string
    citations?: { kind: 'idea' | 'question'; id: string }[]
  }[]
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
  activity: { id: string; at: string; actor: string; text: string }[]
  intake?: ProjectIntake
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

function PriorityPill({ p }: { p: KanbanCard['priority'] | FeatureNode['priority'] }) {
  // Keep the existing color coding by mapping into Badge classes,
  // but show explicit priority labels (P0/P1/P2) instead of "ok/warn/down".
  const cls = p === 'p0' ? 'down' : p === 'p1' ? 'warn' : 'ok'
  return <span className={`badge ${cls}`}>{p.toUpperCase()}</span>
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
        { id: 'a-1', at: iso(14), actor: 'Logan', text: 'Moved “Design Settings nav + sections” → In progress' },
        { id: 'a-2', at: iso(54), actor: 'TARS', text: 'Created feature: “Feature tree map”' },
        { id: 'a-3', at: iso(160), actor: 'Logan', text: 'Updated project summary and links' },
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
      activity: [{ id: 'ta-1', at: iso(200), actor: 'Logan', text: 'Paused project' }],
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
              <PriorityPill p={feature.priority} />
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
                <h4 style={{ marginTop: 0 }}>Sources</h4>
                {feature.featureIntake?.questions?.some(q => q.answer?.trim()) ? (
                  <div className="stack" style={{ gap: 12 }}>
                    {feature.featureIntake.questions.filter(q => q.answer?.trim()).map((q) => (
                      <div key={q.id} className="source-card">
                        <div className="source-card-header">
                          <span className="source-category">{q.category.replace('_', ' ')}</span>
                          <code className="muted">{q.id}</code>
                        </div>
                        <div className="source-question">{q.prompt}</div>
                        <div className="source-answer">{q.answer}</div>
                        {q.answeredAt && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                            Answered {fmtAgo(q.answeredAt)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : feature.sources?.length ? (
                  <div className="muted">
                    {feature.sources.map((s) => (
                      <code key={`${s.kind}:${s.id}`} style={{ marginRight: 10 }}>
                        {s.kind}:{s.id}
                      </code>
                    ))}
                  </div>
                ) : (
                  <div className="muted">No sources linked yet. Click "Define" in the tree to add intake answers.</div>
                )}
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
                            <PriorityPill p={d.priority} />
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
                            <PriorityPill p={c.priority} />
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
                <div className="feed-grid" style={{ gridTemplateColumns: '1fr' }}>
                  {project.activity.slice(0, 8).map((a) => (
                    <FeedItem key={a.id} actor={a.actor} text={a.text} meta={fmtAgo(a.at)} />
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

function IntakeStatusBadge({ intake }: { intake?: FeatureIntake }) {
  if (!intake || intake.status === 'not_started') {
    return <span className="intake-status not-started">Not defined</span>
  }
  if (intake.status === 'in_progress') {
    const answered = intake.questions.filter(q => q.answer?.trim()).length
    const total = intake.questions.length
    return <span className="intake-status in-progress">{answered}/{total} answered</span>
  }
  return <span className="intake-status complete">✓ Defined</span>
}

function TreeView({ 
  project, 
  onOpen,
  adapter,
  onTreeUpdated,
}: { 
  project: Project
  onOpen: (n: FeatureNode) => void
  adapter?: Adapter
  onTreeUpdated?: () => void
}) {
  const [query, setQuery] = useState('')
  const [showDeps, setShowDeps] = useState(false)
  const [addingNode, setAddingNode] = useState(false)
  const [newNodeTitle, setNewNodeTitle] = useState('')
  const [definingFeature, setDefiningFeature] = useState<FeatureNode | null>(null)

  const handleAddNode = async () => {
    if (!newNodeTitle.trim() || !adapter) return
    try {
      await adapter.createPMTreeNode(project.id, {
        title: newNodeTitle.trim(),
        status: 'draft',
        priority: 'P2',
      })
      setNewNodeTitle('')
      setAddingNode(false)
      onTreeUpdated?.()
    } catch (err) {
      console.error('Failed to add node:', err)
    }
  }

  const handleSaveIntake = (nodeId: string, intake: FeatureIntake) => {
    // Update the node in memory (we'd also persist via adapter in real implementation)
    // For now, update local state - this would be replaced with adapter call
    console.log('Saving intake for node', nodeId, intake)
    // TODO: adapter.updatePMTreeNodeIntake(project.id, nodeId, intake)
    onTreeUpdated?.()
  }

  const handleIntakeComplete = (nodeId: string, intake: FeatureIntake) => {
    console.log('Intake completed for node', nodeId, intake)
    // Here we could trigger AC generation, etc.
    onTreeUpdated?.()
  }

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

  const epics = useMemo(() => project.tree.filter(isVisible), [project.tree, query])

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="tree-toolbar">
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes…" />
        <label className="field inline" style={{ margin: 0 }}>
          <input type="checkbox" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
          <span className="muted">Show dependencies</span>
        </label>
        {addingNode ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              className="input" 
              value={newNodeTitle} 
              onChange={(e) => setNewNodeTitle(e.target.value)}
              placeholder="Node title…"
              onKeyDown={(e) => e.key === 'Enter' && handleAddNode()}
              autoFocus
            />
            <button className="btn" type="button" onClick={handleAddNode} disabled={!newNodeTitle.trim()}>
              Add
            </button>
            <button className="btn ghost" type="button" onClick={() => { setAddingNode(false); setNewNodeTitle('') }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn" type="button" onClick={() => setAddingNode(true)}>
            + Add node
          </button>
        )}
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <h3 style={{ margin: 0 }}>Tree</h3>
          </div>
          <div className="muted">{all.length} node(s)</div>
        </div>

        {/* Initiative → Epics/Sections → Stories/Tasks */}
        <div className="tree-org" style={{ marginTop: 14 }}>
          <div className="tree-org-root">
            <button type="button" className="tree-box root" onClick={() => alert('(wireframe) Project settings')} title="Project">
              <div className="tree-box-title">{project.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>initiative</div>
            </button>
          </div>

          <div className="tree-org-epics" style={{ ['--cols' as never]: String(Math.max(1, epics.length)) }}>
            {epics.map((e, idx) => {
              const highlight = matches.has(e.id)
              const tone = idx % 3 === 0 ? 'tone-a' : idx % 3 === 1 ? 'tone-b' : 'tone-c'
              return (
                <div key={e.id} className="tree-org-col">
                  <div className={`tree-box epic ${tone} ${highlight ? 'highlight' : ''}`}>
                    <button
                      type="button"
                      className="tree-box-clickable"
                      onClick={() => onOpen(e)}
                      title="Open section/epic"
                    >
                      <div className="tree-box-top">
                        <span className={`dot ${nodeDotClass(e.status)}`} />
                        <PriorityPill p={e.priority} />
                      </div>
                      <div className="tree-box-title">{e.title}</div>
                      {e.summary ? <div className="muted tree-box-summary">{e.summary}</div> : <div className="muted tree-box-summary">—</div>}
                    </button>
                    <div className="tree-box-actions">
                      <IntakeStatusBadge intake={e.featureIntake} />
                      <button
                        type="button"
                        className="tree-define-btn"
                        onClick={(ev) => { ev.stopPropagation(); setDefiningFeature(e) }}
                        title="Define this feature"
                      >
                        {e.featureIntake?.status === 'complete' ? 'Edit' : 'Define'}
                      </button>
                    </div>
                  </div>

                  <div className="tree-org-children">
                    {(e.children ?? []).filter(isVisible).map((c) => {
                      const ch = matches.has(c.id)
                      return (
                        <div key={c.id} className="tree-org-child">
                          <div className={`tree-mini ${ch ? 'highlight' : ''}`}>
                            <button
                              type="button"
                              className="tree-mini-clickable"
                              onClick={() => onOpen(c)}
                              title="Open task/feature"
                            >
                              <div className="tree-mini-head">
                                <span className={`dot ${nodeDotClass(c.status)}`} />
                                <PriorityPill p={c.priority} />
                              </div>
                              <div className="tree-mini-title">{c.title}</div>
                              {showDeps && c.dependsOn?.length ? (
                                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>deps: {c.dependsOn.length}</div>
                              ) : null}
                            </button>
                            <div className="tree-mini-actions">
                              <IntakeStatusBadge intake={c.featureIntake} />
                              <button
                                type="button"
                                className="tree-define-btn"
                                onClick={(ev) => { ev.stopPropagation(); setDefiningFeature(c) }}
                                title="Define this feature"
                              >
                                {c.featureIntake?.status === 'complete' ? 'Edit' : 'Define'}
                              </button>
                            </div>
                          </div>

                          {(c.children ?? []).filter(isVisible).length ? (
                            <div className="tree-org-subtasks">
                              {(c.children ?? []).filter(isVisible).map((s) => {
                                const sh = matches.has(s.id)
                                return (
                                  <div key={s.id} className={`tree-sub ${sh ? 'highlight' : ''}`}>
                                    <button
                                      type="button"
                                      className="tree-sub-clickable"
                                      onClick={() => onOpen(s)}
                                      title="Open subtask"
                                    >
                                      <span className={`dot ${nodeDotClass(s.status)}`} />
                                      <span style={{ fontWeight: 800 }}>{s.title}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="tree-define-btn"
                                      onClick={(ev) => { ev.stopPropagation(); setDefiningFeature(s) }}
                                      title="Define this feature"
                                      style={{ marginLeft: 'auto' }}
                                    >
                                      {s.featureIntake?.status === 'complete' ? '✓' : '…'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Feature Intake Modal */}
      {definingFeature && (
        <FeatureIntakeModal
          feature={{
            id: definingFeature.id,
            title: definingFeature.title,
            description: definingFeature.summary,
            priority: definingFeature.priority?.toUpperCase() as 'P0' | 'P1' | 'P2',
            projectName: project.name,
            projectSummary: project.summary,
          }}
          intake={definingFeature.featureIntake ?? null}
          onSave={(intake) => handleSaveIntake(definingFeature.id, intake)}
          onClose={() => setDefiningFeature(null)}
          onComplete={(intake) => handleIntakeComplete(definingFeature.id, intake)}
        />
      )}
    </div>
  )
}

function KanbanBoard({ 
  project, 
  onOpenFeature,
  adapter,
  onCardMoved,
}: { 
  project: Project
  onOpenFeature: (n: FeatureNode) => void
  adapter?: Adapter
  onCardMoved?: (cardId: string, newColumn: KanbanColumnId) => void
}) {
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

  const onDrop = async (col: KanbanColumnId, ev: React.DragEvent) => {
    ev.preventDefault()
    const id = ev.dataTransfer.getData('text/kanban-card')
    if (!id) return
    
    // Update local state immediately for responsiveness
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column: col } : c)))
    
    // Persist via adapter if available
    if (adapter && project.id) {
      try {
        // Map column to BoardLane
        const laneMap: Record<KanbanColumnId, import('../types').BoardLane> = {
          todo: 'proposed',
          in_progress: 'development',
          blocked: 'blocked',
          done: 'done',
        }
        await adapter.updatePMCard(project.id, { id, lane: laneMap[col] })
        onCardMoved?.(id, col)
      } catch (err) {
        console.error('Failed to persist card move:', err)
      }
    }
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
                      <PriorityPill p={c.priority} />
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
                <PriorityPill p={f.priority} />
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
          </div>
        </div>

        <div className="feed-grid" style={{ gridTemplateColumns: '1fr' }}>
          {project.activity.map((a) => (
            <FeedItem key={a.id} actor={a.actor} text={a.text} meta={fmtAgo(a.at)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function NewProjectWizard({
  onClose,
  onCreate,
  adapter,
}: {
  onClose: () => void
  onCreate: (p: Project) => void
  adapter: Adapter
}) {
  const [mode, setMode] = useState<'choose' | 'import' | 'idea' | 'analysis' | 'questions' | 'review'>('choose')
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [ideaText, setIdeaText] = useState('')

  const [gitUrl, setGitUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const [analysis, setAnalysis] = useState<ProjectIntake['analysis'][number] | null>(null)
  const [questions, setQuestions] = useState<IntakeQuestion[]>([])

  const nowIso = () => new Date().toISOString()
  const id = () => Math.random().toString(16).slice(2, 10)

  const classify = (idea: string) => {
    const t = idea.toLowerCase()
    const hasSoftware = /(api|backend|frontend|mobile|web|database|repo|github|auth)/.test(t)
    const hasOps = /(checklist|sop|process|warehouse|home|garden|equipment|maintenance|schedule|inventory)/.test(t)
    const type: 'software' | 'ops' | 'hybrid' = hasSoftware && hasOps ? 'hybrid' : hasSoftware ? 'software' : hasOps ? 'ops' : 'hybrid'

    const tags = Array.from(
      new Set(
        [
          hasSoftware ? 'software' : null,
          hasOps ? 'ops' : null,
          t.includes('mobile') ? 'mobile' : null,
          t.includes('web') ? 'web' : null,
          t.includes('api') ? 'api' : null,
          t.includes('local') ? 'local-first' : null,
        ].filter(Boolean) as string[],
      ),
    )

    const risks = [
      /(payment|stripe|billing)/.test(t) ? 'payments' : null,
      /(email|sms|push)/.test(t) ? 'notifications' : null,
      /(pii|personal data|privacy)/.test(t) ? 'pii/privacy' : null,
      /(multi-user|team|collabor)/.test(t) ? 'multi-user' : null,
    ].filter(Boolean) as string[]

    return { type, tags: tags.length ? tags : ['hybrid'], risks }
  }

  const generateQuestions = (type: 'software' | 'ops' | 'hybrid'): IntakeQuestion[] => {
    const base: Array<{ category: string; prompt: string }> = [
      { category: 'Outcome', prompt: 'What does success look like for this project (measurable or concrete)?' },
      { category: 'Users', prompt: 'Who is this for? List the primary user(s)/actor(s).' },
      { category: 'Workflow', prompt: 'Describe the main workflow in 3–6 steps.' },
      { category: 'Scope', prompt: 'What are the non-goals (explicitly out of scope for v1)?' },
      { category: 'Constraints', prompt: 'Any constraints: timeline, budget, offline/local-only, devices, performance?' },
      { category: 'Risks', prompt: 'What are the biggest unknowns or risks we should validate early?' },
    ]

    const software: Array<{ category: string; prompt: string }> = [
      { category: 'Platform', prompt: 'What platforms: web, mobile, desktop? Single-user or multi-user?' },
      { category: 'Data', prompt: 'What are the core objects/data entities? (e.g., Trip, List, Item, Profile)' },
      { category: 'Integrations', prompt: 'Any integrations (GitHub, maps, payments, auth, etc.)?' },
      { category: 'Permissions', prompt: 'Any roles/permissions/sharing rules?' },
    ]

    const ops: Array<{ category: string; prompt: string }> = [
      { category: 'SOP', prompt: 'What is the standard process/checklist? List steps and decision points.' },
      { category: 'Assets', prompt: 'What assets/locations are involved (tools, rooms, machines, sites)?' },
      { category: 'Schedule', prompt: 'Does this recur on a schedule? What triggers it?' },
      { category: 'Safety', prompt: 'Any safety rules, stop conditions, or escalation paths?' },
    ]

    const extra = type === 'software' ? software : type === 'ops' ? ops : [...software.slice(0, 2), ...ops.slice(0, 2)]

    const picked = [...base, ...extra].slice(0, 10)

    return picked.map((q, idx) => ({
      id: `q-${idx + 1}`,
      category: q.category,
      prompt: q.prompt,
      answer: null,
    }))
  }

  const makeSeedTree = (type: 'software' | 'ops' | 'hybrid', citations: { kind: 'idea' | 'question'; id: string }[]): FeatureNode[] => {
    const src = (kind: 'idea' | 'question', id: string) => [{ kind, id } as const]

    const common: FeatureNode[] = [
      {
        id: 'sec-foundation',
        title: 'Foundation',
        summary: 'Core setup, constraints, and first principles for the project.',
        status: 'planned',
        priority: 'p0',
        sources: src('idea', 'idea-1'),
        children: [
          {
            id: 'feat-scope',
            title: 'Scope + non-goals',
            summary: 'Capture v1 boundaries so execution doesn’t sprawl.',
            status: 'planned',
            priority: 'p0',
            sources: src('question', 'q-4'),
          },
          {
            id: 'feat-constraints',
            title: 'Constraints',
            summary: 'Make constraints explicit (time, budget, offline/local-first).',
            status: 'planned',
            priority: 'p0',
            sources: src('question', 'q-5'),
          },
        ],
      },
    ]

    if (type === 'software') {
      return [
        ...common,
        {
          id: 'sec-backend',
          title: 'Backend',
          summary: 'APIs, data model, and services.',
          status: 'planned',
          priority: 'p0',
          sources: citations.map((c) => ({ kind: c.kind, id: c.id })),
          children: [
            { id: 'feat-endpoints', title: 'Key endpoints', summary: 'Define core endpoints + contracts.', status: 'planned', priority: 'p0', sources: src('question', 'q-8') },
            { id: 'feat-data', title: 'Data model', summary: 'Entities + relationships.', status: 'planned', priority: 'p0', sources: src('question', 'q-8') },
          ],
        },
        {
          id: 'sec-app',
          title: 'App sections',
          summary: 'Major UI surfaces / modules.',
          status: 'planned',
          priority: 'p1',
          sources: src('question', 'q-3'),
          children: [
            { id: 'feat-section-1', title: 'Primary section', summary: 'Main user workflow UI.', status: 'planned', priority: 'p0', sources: src('question', 'q-3') },
            { id: 'feat-section-2', title: 'Profile / settings', summary: 'Preferences, account, configuration.', status: 'planned', priority: 'p2', sources: src('question', 'q-7') },
          ],
        },
      ]
    }

    if (type === 'ops') {
      return [
        ...common,
        {
          id: 'sec-process',
          title: 'Process / SOP',
          summary: 'Steps, checklists, and decision points.',
          status: 'planned',
          priority: 'p0',
          sources: src('question', 'q-7'),
          children: [
            { id: 'feat-checklist', title: 'Checklist', summary: 'Operator checklist steps.', status: 'planned', priority: 'p0', sources: src('question', 'q-7') },
            { id: 'feat-escalation', title: 'Escalation / stop conditions', summary: 'What to do when something goes wrong.', status: 'planned', priority: 'p1', sources: src('question', 'q-10') },
          ],
        },
        {
          id: 'sec-schedule',
          title: 'Scheduling',
          summary: 'Triggers, cadence, reminders.',
          status: 'planned',
          priority: 'p1',
          sources: src('question', 'q-9'),
        },
      ]
    }

    // hybrid
    return [
      ...common,
      {
        id: 'sec-backend',
        title: 'Backend / automation',
        summary: 'APIs, agents, automations, and integrations.',
        status: 'planned',
        priority: 'p0',
        sources: src('question', 'q-8'),
      },
      {
        id: 'sec-app',
        title: 'App sections',
        summary: 'Primary user surfaces + configuration.',
        status: 'planned',
        priority: 'p1',
        sources: src('question', 'q-3'),
      },
      {
        id: 'sec-process',
        title: 'Ops / SOP',
        summary: 'Checklists and safety rules.',
        status: 'planned',
        priority: 'p1',
        sources: src('question', 'q-7'),
      },
    ]
  }

  const canContinueIdea = ideaText.trim().length >= 20

  const startIdea = () => {
    setMode('idea')
    if (!projectName.trim()) setProjectName('New project')
  }

  const runAnalysis = () => {
    const c = classify(ideaText)
    const a = {
      id: `ana-${id()}`,
      at: nowIso(),
      type: c.type,
      tags: c.tags,
      risks: c.risks,
      summary: `(mock) Detected ${c.type} project. Generated questions are tailored to your description.`,
    } as const
    setAnalysis(a)
    setQuestions(generateQuestions(a.type))
    setMode('analysis')
  }

  const createProject = async () => {
    const createdAt = nowIso()

    const intake: ProjectIntake = {
      idea: [{ id: 'idea-1', at: createdAt, author: 'human', text: ideaText.trim() }],
      analysis: analysis ? [analysis] : [],
      questions,
      requirements: [],
    }

    try {
      // Create PM project via adapter
      const pmProject = await adapter.createPMProject({
        name: projectName.trim() || 'New project',
        summary: ideaText.trim().slice(0, 140) + (ideaText.trim().length > 140 ? '…' : ''),
        status: 'active',
        tags: analysis?.tags ?? ['hybrid'],
        owner: 'Logan',
      })

      // Add intake idea
      await adapter.addPMIdeaVersion(pmProject.id, ideaText.trim())

      // Add intake analysis if present
      if (analysis) {
        await adapter.addPMAnalysis(pmProject.id, analysis.summary, [])
      }

      // Set questions if any
      if (questions.length) {
        const pmIntake = await adapter.getPMIntake(pmProject.id)
        await adapter.setPMIntake(pmProject.id, {
          ...pmIntake,
          questions: questions.map(q => ({
            id: q.id,
            category: q.category,
            prompt: q.prompt,
            required: q.required ?? true,
            answer: q.answer?.text ?? '',
            answeredAt: q.answer?.at,
          })),
        })
      }

      // Create seed tree nodes
      const seedTree = makeSeedTree(analysis?.type ?? 'hybrid', [{ kind: 'idea', id: 'idea-1' }])
      for (const node of seedTree) {
        await adapter.createPMTreeNode(pmProject.id, {
          title: node.title,
          description: node.summary,
          status: 'draft',
          priority: node.priority.toUpperCase() as 'P0' | 'P1' | 'P2',
          tags: node.tags ?? [],
        })
      }

      // Create seed cards
      const seedCards = [
        { title: 'Review intake answers + confirm scope', priority: 'P0' as const, lane: 'proposed' as const, owner: 'Logan' },
        { title: 'Turn tree nodes into detailed feature specs', priority: 'P1' as const, lane: 'proposed' as const, owner: 'TARS' },
      ]
      for (const card of seedCards) {
        await adapter.createPMCard(pmProject.id, {
          featureId: '',
          title: card.title,
          lane: card.lane,
          priority: card.priority,
          owner: card.owner,
        })
      }

      // Add activity
      await adapter.addPMActivity(pmProject.id, {
        actor: 'Logan',
        action: 'Created project via intake wizard',
      })

      // Build the local Project object for immediate UI update
      const [tree, cards, pmIntake] = await Promise.all([
        adapter.getPMTree(pmProject.id),
        adapter.listPMCards(pmProject.id),
        adapter.getPMIntake(pmProject.id),
      ])

      const p = pmToProject(pmProject, tree, cards, pmIntake)
      onCreate(p)
    } catch (err) {
      console.error('Failed to create project via adapter:', err)
      // Fall back to local-only creation
      const p: Project = {
        id: `p-${id()}`,
        name: projectName.trim() || 'New project',
        summary: ideaText.trim().slice(0, 140) + (ideaText.trim().length > 140 ? '…' : ''),
        status: 'active',
        tags: analysis?.tags ?? ['hybrid'],
        owner: 'Logan',
        updatedAt: createdAt,
        links: [],
        intake,
        tree: makeSeedTree(analysis?.type ?? 'hybrid', [{ kind: 'idea', id: 'idea-1' }]),
        cards: [
          { id: `c-${id()}`, title: 'Review intake answers + confirm scope', priority: 'p0', column: 'todo', owner: 'Logan', featureId: 'feat-scope' },
          { id: `c-${id()}`, title: 'Turn tree nodes into detailed feature specs', priority: 'p1', column: 'todo', owner: 'TARS', featureId: 'sec-app' },
        ],
        activity: [{ id: `a-${id()}`, at: createdAt, actor: 'Logan', text: 'Created project via intake wizard' }],
      }
      onCreate(p)
    }
  }

  const fileCount = files.length

  const onDropFiles = (ev: React.DragEvent) => {
    ev.preventDefault()
    const picked = Array.from(ev.dataTransfer.files ?? [])
    if (picked.length) setFiles(picked)
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}>
      <div className="modal newproj-modal" role="dialog" aria-modal="true" aria-label="New project" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>new project</div>
            <h3 style={{ margin: '6px 0 0' }}>Create project</h3>
          </div>
          <div className="stack-h">
            <button className="btn ghost" type="button" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="modal-body">
          {mode === 'choose' ? (
            <div className="wizard">
              <div className="wizard-step">
                <div className="wizard-title">
                  <h4 style={{ margin: 0 }}>Start</h4>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>Choose how you want to create this project.</div>
                <div className="wizard-actions" style={{ justifyContent: 'flex-start' }}>
                  <button className="btn" type="button" onClick={() => setMode('import')}>Import project</button>
                  <button className="btn ghost" type="button" onClick={startIdea}>Start from idea</button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'import' ? (
            <div className="wizard">
              <div className="wizard-step">
                <div className="wizard-title">
                  <h4 style={{ margin: 0 }}>Import project</h4>
                </div>

                <div className="form">
                  <div className="form-row-2">
                    <div className="field">
                      <label className="muted">Project name</label>
                      <input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Trips App" />
                    </div>
                    <div className="field">
                      <label className="muted">Git repo URL (optional)</label>
                      <input className="input" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo" />
                      <div className="form-help">Use this if you want to import from Git instead of a local folder.</div>
                    </div>
                  </div>

                  <div className="field">
                    <label className="muted">Description (optional)</label>
                    <textarea className="input" rows={3} value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} placeholder="Short description…" />
                  </div>

                  <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={onDropFiles}>
                    <div className="dropzone-inner">
                      <strong>Drag & drop a folder here</strong>
                      <div className="muted">or</div>
                      <label className="btn ghost" style={{ display: 'inline-block' }}>
                        Browse / pick folder…
                        <input
                          type="file"
                          multiple
                          // @ts-ignore non-standard, but supported by Chromium
                          {...({ webkitdirectory: true } as any)}
                          style={{ display: 'none' }}
                          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                        />
                      </label>
                      <div className="muted">Selected: <strong>{fileCount}</strong> file(s)</div>
                    </div>
                  </div>
                </div>

                <div className="wizard-actions">
                  <button className="btn ghost" type="button" onClick={() => setMode('choose')}>Back</button>
                  <button
                    className="btn"
                    type="button"
                    disabled={!projectName.trim() || (!fileCount && !gitUrl.trim())}
                    onClick={() => {
                      const createdAt = nowIso()
                      onCreate({
                        id: `p-${id()}`,
                        name: projectName.trim(),
                        summary: projectDesc.trim() || (gitUrl.trim() ? `(mock) Imported from ${gitUrl.trim()}` : '(mock) Imported from local folder'),
                        status: 'active',
                        tags: [gitUrl.trim() ? 'git' : 'folder', 'imported'],
                        owner: 'Logan',
                        updatedAt: createdAt,
                        links: gitUrl.trim() ? [{ label: 'Repo', url: gitUrl.trim() }] : [],
                        intake: {
                          idea: [{ id: 'idea-1', at: createdAt, author: 'human', text: gitUrl.trim() ? `(import) ${gitUrl.trim()}` : '(import) Local folder import.' }],
                          analysis: [],
                          questions: [],
                          requirements: [],
                        },
                        tree: [
                          { id: 'sec-repo', title: 'Imported project', summary: 'Next: analyze repo + generate questions.', status: 'planned', priority: 'p0', children: [] },
                        ],
                        cards: [{ id: `c-${id()}`, title: 'Run import analysis + generate questions', priority: 'p0', column: 'todo', owner: 'TARS', featureId: 'sec-repo' }],
                        activity: [{ id: `a-${id()}`, at: createdAt, actor: 'Logan', text: 'Created project from import' }],
                      })
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'idea' ? (
            <div className="wizard">
              <div className="wizard-step">
                <div className="wizard-title">
                  <h4 style={{ margin: 0 }}>Idea</h4>
                </div>

                <div className="form">
                  <div className="field">
                    <label className="muted">Project name</label>
                    <input className="input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Trips App" />
                  </div>

                  <div className="field">
                    <label className="muted">Describe your idea</label>
                    <textarea
                      className="input"
                      rows={8}
                      value={ideaText}
                      onChange={(e) => setIdeaText(e.target.value)}
                      placeholder="What are we building? Who is it for? What problem does it solve?"
                    />
                    <div className="form-help">Tip: include the user, the workflow, and what “done” looks like.</div>
                  </div>
                </div>

                <div className="wizard-actions">
                  <button className="btn ghost" type="button" onClick={() => setMode('choose')}>Back</button>
                  <button className="btn" type="button" disabled={!canContinueIdea} onClick={runAnalysis}>
                    Analyze →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'analysis' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Analysis (mock)</h4>
                <div className="grid-3">
                  <div className="stat-card">
                    <div className="stat-title">Type</div>
                    <div className="stat-value"><strong>{analysis?.type ?? '—'}</strong></div>
                    <div className="muted">detected from idea</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-title">Tags</div>
                    <div className="stat-value"><strong>{(analysis?.tags ?? []).join(' · ') || '—'}</strong></div>
                    <div className="muted">editable later</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-title">Risks</div>
                    <div className="stat-value"><strong>{analysis?.risks.length ? analysis?.risks.join(', ') : 'none'}</strong></div>
                    <div className="muted">first pass</div>
                  </div>
                </div>
                <div className="callout" style={{ marginTop: 12 }}>
                  <strong>Summary</strong>
                  <div className="muted" style={{ marginTop: 6 }}>{analysis?.summary}</div>
                </div>

                <div className="stack-h" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" type="button" onClick={() => setMode('idea')}>Back</button>
                  <button className="btn" type="button" onClick={() => setMode('questions')}>
                    Questions →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'questions' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Clarifying questions</h4>
                <div className="muted">These are generated based on your idea (mocked for now). Answers are stored and referenced later.</div>

                <div className="table-like" style={{ marginTop: 12 }}>
                  {questions.map((q) => (
                    <div key={q.id} className="row" style={{ margin: 0 }}>
                      <div className="row-main">
                        <div className="row-title">
                          <strong>{q.prompt}</strong>
                          <span className="pill">{q.category}</span>
                          <span className="muted"><code>{q.id}</code></span>
                        </div>
                        <textarea
                          className="input"
                          rows={3}
                          value={q.answer?.text ?? ''}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((x) => (x.id === q.id ? { ...x, answer: { text: e.target.value, at: nowIso(), author: 'human' } } : x)),
                            )
                          }
                          placeholder="Your answer…"
                          style={{ width: '100%', marginTop: 8, resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="stack-h" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" type="button" onClick={() => setMode('analysis')}>Back</button>
                  <button className="btn" type="button" onClick={() => setMode('review')}>
                    Review →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'review' ? (
            <div className="stack">
              <div className="panel" style={{ padding: 14 }}>
                <h4 style={{ marginTop: 0 }}>Review</h4>
                <div className="callout">
                  <strong>What will be stored</strong>
                  <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    <li>Idea (verbatim)</li>
                    <li>Analysis output (versioned)</li>
                    <li>Generated questions + all answers (verbatim)</li>
                    <li>Generated tree + linked sources (citations)</li>
                  </ul>
                </div>

                <div className="stack-h" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn ghost" type="button" onClick={() => setMode('questions')}>Back</button>
                  <button className="btn" type="button" onClick={createProject}>
                    Create project
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// Convert PM data to internal Project format
function pmToProject(
  pm: PMProject,
  tree: PMTreeNode[],
  cards: PMCard[],
  intake: PMIntake
): Project {
  // Convert PM tree nodes to internal FeatureNode format
  const convertNode = (n: PMTreeNode): FeatureNode => ({
    id: n.id,
    title: n.title,
    summary: n.description,
    status: n.status === 'done' ? 'done' : n.status === 'in-progress' ? 'in_progress' : n.status === 'ready' ? 'planned' : 'planned',
    priority: n.priority?.toLowerCase() as FeatureNode['priority'] ?? 'p2',
    tags: n.tags,
    owner: n.owner,
    children: n.children?.map(convertNode) ?? [],
    dependsOn: n.dependsOn,
    sources: n.sources?.map(s => ({ kind: 'question' as const, id: s.questionId })),
  })

  // Build tree hierarchy from flat nodes
  const nodeMap = new Map<string, PMTreeNode>()
  for (const n of tree) nodeMap.set(n.id, n)
  
  const rootNodes = tree.filter(n => !n.parentId)
  const buildChildren = (parentId: string): PMTreeNode[] => 
    tree.filter(n => n.parentId === parentId).map(n => ({
      ...n,
      children: buildChildren(n.id)
    }))
  
  const treeWithChildren = rootNodes.map(n => ({
    ...n,
    children: buildChildren(n.id)
  }))

  // Convert cards
  const convertCard = (c: PMCard): KanbanCard => ({
    id: c.id,
    title: c.title,
    featureId: c.featureId,
    owner: c.owner,
    priority: c.priority?.toLowerCase() as KanbanCard['priority'] ?? 'p2',
    column: c.lane === 'done' ? 'done' : c.lane === 'development' ? 'in_progress' : c.lane === 'blocked' ? 'blocked' : 'todo',
  })

  // Convert intake
  const projectIntake: ProjectIntake = {
    idea: intake.ideas.map(i => ({
      id: i.id,
      at: i.createdAt,
      author: 'human' as const,
      text: i.text,
    })),
    analysis: intake.analyses.map(a => ({
      id: a.id,
      at: a.createdAt,
      type: 'software' as const,
      tags: [],
      risks: [],
      summary: a.summary,
    })),
    questions: intake.questions.map(q => ({
      id: q.id,
      category: q.category,
      prompt: q.prompt,
      answer: q.answer ? { text: q.answer, at: q.answeredAt ?? '', author: 'human' as const } : null,
    })),
    requirements: intake.requirements.map(r => ({
      id: r.id,
      at: r.createdAt,
      source: 'human' as const,
      kind: 'goal' as const,
      text: r.text,
      citations: r.sources?.map(s => ({ kind: 'question' as const, id: s.questionId })),
    })),
  }

  return {
    id: pm.id,
    name: pm.name,
    summary: pm.summary ?? '',
    status: pm.status === 'completed' ? 'archived' : pm.status === 'paused' ? 'paused' : 'active',
    tags: pm.tags,
    owner: pm.owner ?? '',
    updatedAt: pm.updatedAt,
    links: pm.links,
    tree: treeWithChildren.map(convertNode),
    cards: cards.map(convertCard),
    activity: [],
    intake: projectIntake,
  }
}

export function Projects({ adapter }: { adapter: Adapter }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProjectTab>('Overview')
  const [drawer, setDrawer] = useState<FeatureNode | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)

  // Load projects from adapter
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const pmProjects = await adapter.listPMProjects()
      
      // Load full data for each project
      const fullProjects: Project[] = await Promise.all(
        pmProjects.map(async (pm) => {
          const [tree, cards, intake] = await Promise.all([
            adapter.getPMTree(pm.id),
            adapter.listPMCards(pm.id),
            adapter.getPMIntake(pm.id),
          ])
          return pmToProject(pm, tree, cards, intake)
        })
      )
      
      setProjects(fullProjects)
      if (fullProjects.length && !activeId) {
        setActiveId(fullProjects[0].id)
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
      // Fall back to fake data for demo/mock mode
      const fake = fakeProjects()
      setProjects(fake)
      if (fake.length && !activeId) {
        setActiveId(fake[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [adapter, activeId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const active = useMemo(() => projects.find((p) => p.id === activeId) ?? projects[0] ?? null, [projects, activeId])

  if (loading) {
    return (
      <main className="projects-layout">
        <div className="panel span-4" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">Loading projects...</p>
        </div>
      </main>
    )
  }

  return (
    <main className={`projects-layout ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <aside className="projects-sidebar" aria-hidden={sidebarCollapsed} style={sidebarCollapsed ? { display: 'none' } : undefined}>
        <div className="panel" style={{ padding: 14 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <h2 style={{ margin: 0 }}>Projects</h2>
              <button className="btn ghost" type="button" onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar">
                Hide
              </button>
            </div>
          </div>

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
              onClick={() => setShowNewProject(true)}
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
                {sidebarCollapsed ? (
                  <button className="btn ghost" type="button" onClick={() => setSidebarCollapsed(false)} title="Show sidebar">
                    Show projects
                  </button>
                ) : null}
                <button className="btn ghost" type="button" onClick={() => alert('(wireframe) Share/project settings')}>
                  Settings
                </button>
                {/* Quick add removed */}
              </div>
            </div>

            <div className="projects-main-body">
              {tab === 'Overview' ? <Overview project={active} /> : null}
              {tab === 'Tree' ? <TreeView project={active} onOpen={(n) => setDrawer(n)} adapter={adapter} onTreeUpdated={loadProjects} /> : null}
              {tab === 'Kanban' ? <KanbanBoard project={active} onOpenFeature={(n) => setDrawer(n)} adapter={adapter} /> : null}
            </div>

            <div className="projects-main-footer">
              <TabBar tab={tab} setTab={setTab} />
            </div>
          </div>
        )}
      </section>

      {active && drawer ? <FeatureDrawer project={active} feature={drawer} onClose={() => setDrawer(null)} /> : null}

      {showNewProject ? (
        <NewProjectWizard
          adapter={adapter}
          onClose={() => setShowNewProject(false)}
          onCreate={(p) => {
            setProjects((prev) => [p, ...prev])
            setActiveId(p.id)
            setTab('Overview')
            setSidebarCollapsed(false)
            setShowNewProject(false)
          }}
        />
      ) : null}
    </main>
  )
}
