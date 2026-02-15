import React, { useState, useEffect, useMemo } from 'react'

type Project = {
  id: string
  name: string
  tagline: string
  status: 'active' | 'paused' | 'archived'
  owner: string
  tags: string[]
  description: string
  links: { label: string; url: string }[]
  stats: { open: number; blocked: number; done: number; total: number }
  updatedAt: string
}

type Aspect = {
  id: string
  projectId: string
  name: string
  desc: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: 'planned' | 'in_progress' | 'blocked' | 'done'
  progress: number
  createdAt: string
  updatedAt: string
}

type ProjectTab = 'Overview' | 'Kanban'

// ─── ProjectHeader ────────────────────────────────────────────
function ProjectHeader({ project }: { project: Project }) {
  return (
    <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 600 }}>{project.name}</h2>
          <p style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontSize: 14 }}>{project.tagline}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ padding: '4px 8px', borderRadius: 4, background: project.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: project.status === 'active' ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 500 }}>
              {project.status.toUpperCase()}
            </span>
            {project.tags.map((tag) => (
              <span key={tag} style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', fontSize: 12 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>
          <div>Owner: <strong>{project.owner}</strong></div>
          <div style={{ marginTop: 4 }}>Updated {formatAgo(project.updatedAt)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <div style={{ textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{project.stats.open}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Open</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fca5a5' }}>{project.stats.blocked}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Blocked</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#86efac' }}>{project.stats.done}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Done</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fbbf24' }}>{Math.round((project.stats.done / project.stats.total) * 100)}%</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Progress</div>
        </div>
      </div>
    </div>
  )
}

// ─── AspectCard ───────────────────────────────────────────────
function AspectCard({ aspect }: { aspect: Aspect }) {
  const statusColor = aspect.status === 'done' ? '#10b981' : aspect.status === 'in_progress' ? '#60a5fa' : aspect.status === 'blocked' ? '#ef4444' : '#9ca3af'
  const priorityColor = aspect.priority === 'P0' ? '#ef4444' : aspect.priority === 'P1' ? '#fb923c' : aspect.priority === 'P2' ? '#facc15' : '#94a3b8'

  return (
    <div style={{ padding: 16, background: '#1e293b', borderRadius: 8, border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>{aspect.name}</h4>
        <span style={{ padding: '2px 8px', borderRadius: 3, background: priorityColor + '20', color: priorityColor, fontSize: 11, fontWeight: 600 }}>
          {aspect.priority}
        </span>
      </div>
      <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#cbd5e1', lineHeight: 1.4 }}>{aspect.desc}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 3, background: statusColor + '20', color: statusColor, fontSize: 11, fontWeight: 500 }}>
          {aspect.status}
        </span>
        {aspect.progress > 0 && (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {aspect.progress}%
          </div>
        )}
      </div>
      {aspect.progress > 0 && (
        <div style={{ marginTop: 8, height: 4, background: '#334155', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#60a5fa', width: `${aspect.progress}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── ActivityFeed ─────────────────────────────────────────────
function ActivityFeed({ projectName }: { projectName: string }) {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch('http://localhost:8787/api/activity')
        const data = await res.json()
        // Filter activities that mention this project
        const filtered = (Array.isArray(data) ? data : [])
          .filter((act: any) => {
            const msg = (act.message || act.msg || '').toLowerCase()
            const meta = act.meta || {}
            return msg.includes(projectName.toLowerCase()) || 
                   msg.includes('project') ||
                   (meta.task && String(meta.task).toLowerCase().includes(projectName.toLowerCase()))
          })
          .slice(0, 10) // Show last 10 activities
        setActivities(filtered)
      } catch (err) {
        console.error('Failed to fetch activities:', err)
        setActivities([])
      } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [projectName])

  if (loading) {
    return (
      <section>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Activity</h4>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Loading...</div>
      </section>
    )
  }

  return (
    <section>
      <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Activity</h4>
      {activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
          {activities.map((act: any, idx: number) => {
            const msg = act.message || act.msg || ''
            const ts = act.at || act.ts || ''
            const timeStr = ts ? formatAgo(ts) : 'unknown'
            return (
              <div
                key={idx}
                style={{
                  padding: '8px',
                  background: '#334155',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#cbd5e1',
                  lineHeight: 1.3,
                }}
              >
                <div style={{ marginBottom: 2 }}>
                  {msg.length > 60 ? msg.substring(0, 60) + '...' : msg}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{timeStr}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>No recent activity</div>
      )}
    </section>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────
function OverviewTab({ project, aspects }: { project: Project; aspects: Aspect[] }) {
  const [description, setDescription] = useState(project.description)
  const [isSavingDesc, setIsSavingDesc] = useState(false)

  const saveDescription = async () => {
    setIsSavingDesc(true)
    try {
      // Call PUT /api/projects/:id
      await fetch(`http://localhost:8787/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
    } catch (err) {
      console.error('Failed to save description:', err)
    } finally {
      setIsSavingDesc(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, padding: 20 }}>
      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Aspects grid */}
        <section>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>Aspects ({aspects.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {aspects.length > 0 ? (
              aspects.map((aspect) => <AspectCard key={aspect.id} aspect={aspect} />)
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: '#94a3b8', background: '#1e293b', borderRadius: 8 }}>
                No aspects yet
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Description */}
        <section>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Description</h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
          <button
            onClick={saveDescription}
            disabled={isSavingDesc}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: isSavingDesc ? 0.6 : 1,
            }}
          >
            {isSavingDesc ? 'Saving...' : 'Save'}
          </button>
        </section>

        {/* Quick Links */}
        <section>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Quick Links</h4>
          {project.links.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {project.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '8px 12px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    color: '#60a5fa',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 500,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#334155'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1e293b'
                  }}
                >
                  {link.label} →
                </a>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>No links added yet</div>
          )}
          <button
            onClick={() => alert('(stub) Add link modal')}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 4,
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + Add Link
          </button>
        </section>

        {/* Activity Feed */}
        <ActivityFeed projectName={project.name} />
      </div>
    </div>
  )
}

// ─── Kanban Tab ───────────────────────────────────────────────
function KanbanTab({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch(`http://localhost:8787/api/tasks?project=${projectId}`)
        const data = await res.json()
        setTasks(data || [])
      } catch (err) {
        console.error('Failed to fetch tasks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [projectId])

  const columns = [
    { id: 'proposed', title: 'Proposed', color: '#94a3b8' },
    { id: 'queued', title: 'Queued', color: '#fbbf24' },
    { id: 'development', title: 'Development', color: '#60a5fa' },
    { id: 'review', title: 'Review', color: '#a78bfa' },
    { id: 'done', title: 'Done', color: '#10b981' },
  ]

  const tasksByColumn = useMemo(() => {
    const byCol: Record<string, any[]> = {}
    columns.forEach((col) => {
      byCol[col.id] = tasks.filter((t) => t.lane === col.id)
    })
    return byCol
  }, [tasks])

  if (loading) {
    return <div style={{ padding: 20, color: '#94a3b8' }}>Loading tasks...</div>
  }

  return (
    <div style={{ padding: 20, overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 16, minWidth: 'max-content' }}>
        {columns.map((col) => {
          const colTasks = tasksByColumn[col.id] || []
          return (
            <div key={col.id} style={{ minWidth: 300 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: col.color }}>
                {col.title} ({colTasks.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      padding: 12,
                      background: '#1e293b',
                      border: `1px solid ${col.color}30`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 500, color: '#fff', marginBottom: 4 }}>{task.title}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>
                      {task.priority ? `${task.priority} • ` : ''}{task.owner ? `@${task.owner}` : 'Unassigned'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Projects Component ───────────────────────────────────
function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [aspects, setAspects] = useState<Aspect[]>([])
  const [tab, setTab] = useState<ProjectTab>('Overview')
  const [loading, setLoading] = useState(true)

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) || projects[0], [projects, selectedProjectId])

  // Load projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:8787/api/projects')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setProjects(data)
          setSelectedProjectId(data[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  // Load aspects for selected project
  useEffect(() => {
    const fetchAspects = async () => {
      if (!selectedProject) return
      try {
        // Try /api/aspects first, then /api/aspects-hub
        let res = await fetch(`http://localhost:8787/api/aspects?projectId=${selectedProject.id}`)
        if (res.status === 404) {
          res = await fetch(`http://localhost:8787/api/aspects-hub?projectId=${selectedProject.id}`)
        }
        if (res.ok) {
          const data = await res.json()
          setAspects(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to fetch aspects:', err)
        setAspects([])
      }
    }
    fetchAspects()
  }, [selectedProject])

  if (loading) {
    return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Loading projects...</div>
  }

  if (!selectedProject) {
    return (
      <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>
        No projects found. Create one to get started.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 220,
          background: '#1e293b',
          borderRight: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>PROJECTS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProjectId(p.id)
                  setTab('Overview')
                }}
                style={{
                  padding: '8px 12px',
                  background: p.id === selectedProjectId ? '#334155' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  color: '#e2e8f0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: p.id === selectedProjectId ? 600 : 400,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (p.id !== selectedProjectId) {
                    e.currentTarget.style.background = '#334155' + '80'
                  }
                }}
                onMouseLeave={(e) => {
                  if (p.id !== selectedProjectId) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div>{p.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {p.status === 'active' ? '🟢' : '🔴'} {p.status}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => alert('(stub) New project modal')}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 12px',
              background: '#334155',
              border: 'none',
              borderRadius: 4,
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ProjectHeader project={selectedProject} />

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #334155', background: '#0f172a', paddingLeft: 20 }}>
          {(['Overview', 'Kanban'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                color: tab === t ? '#60a5fa' : '#94a3b8',
                borderBottom: tab === t ? '2px solid #60a5fa' : 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: tab === t ? 600 : 400,
                transition: 'color 0.2s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#0f172a' }}>
          {tab === 'Overview' && <OverviewTab project={selectedProject} aspects={aspects} />}
          {tab === 'Kanban' && <KanbanTab projectId={selectedProject.id} />}
        </div>
      </div>
    </div>
  )
}

function formatAgo(iso: string): string {
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

export default ProjectsPage
