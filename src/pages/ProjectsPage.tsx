import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/Badge'
import { ChevronRight, Plus, Settings, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

type ProjectTab = 'Overview' | 'Tree' | 'Kanban'

type ProjectStatus = 'active' | 'paused' | 'archived'
type FeatureStatus = 'planned' | 'in_progress' | 'blocked' | 'done'
type Priority = 'p0' | 'p1' | 'p2'
type KanbanColumn = 'todo' | 'in_progress' | 'blocked' | 'done'

type FeatureNode = {
  id: string
  title: string
  summary?: string
  status: FeatureStatus
  priority: Priority
  tags?: string[]
  owner?: string
  children?: FeatureNode[]
  dependsOn?: string[]
  sources?: { kind: 'idea' | 'question' | 'requirement'; id: string }[]
}

type KanbanCard = {
  id: string
  title: string
  featureId?: string
  owner?: string
  due?: string
  priority: Priority
  column: KanbanColumn
  createdAt: string
  updatedAt: string
}

type ProjectIntake = {
  idea: { id: string; at: string; author: 'human' | 'ai'; text: string }[]
  analysis: { id: string; at: string; type: 'software' | 'ops' | 'hybrid'; tags: string[]; risks: string[]; summary: string }[]
  questions: { id: string; category: string; prompt: string; answer?: { text: string; at: string; author: 'human' | 'ai' } | null }[]
  requirements: { id: string; at: string; source: 'human' | 'ai'; kind: 'goal' | 'constraint' | 'non_goal'; text: string; citations?: { kind: 'idea' | 'question'; id: string }[] }[]
}

type ActivityEntry = {
  id: string
  at: string
  actor: string
  text: string
}

type Project = {
  schemaVersion: number
  id: string
  name: string
  summary: string
  status: ProjectStatus
  tags: string[]
  owner: string
  links: { label: string; url: string }[]
  createdAt: string
  updatedAt: string
  tree?: FeatureNode[]
  cards?: KanbanCard[]
  activity?: ActivityEntry[]
  intake?: ProjectIntake
}

function fmtAgo(iso: string): string {
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

function flattenTree(nodes: FeatureNode[] | undefined): FeatureNode[] {
  const out: FeatureNode[] = []
  const walk = (n: FeatureNode) => {
    out.push(n)
    n.children?.forEach(walk)
  }
  nodes?.forEach(walk)
  return out
}

function getStatusColor(status: FeatureStatus): string {
  switch (status) {
    case 'done': return 'text-green-600'
    case 'in_progress': return 'text-blue-600'
    case 'blocked': return 'text-red-600'
    default: return 'text-gray-400'
  }
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'p0': return 'bg-red-100 text-red-800'
    case 'p1': return 'bg-yellow-100 text-yellow-800'
    case 'p2': return 'bg-blue-100 text-blue-800'
  }
}

function ProjectList({ projects, selectedId, onSelectProject }: { projects: Project[]; selectedId: string; onSelectProject: (id: string) => void }) {
  return (
    <div className="projects-sidebar-list">
      <div className="sidebar-section">
        <Button variant="default" size="sm" className="w-full gap-2">
          <Plus size={16} />
          New Project
        </Button>
      </div>
      <div className="sidebar-section flex-1 overflow-auto">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            className={`sidebar-project-item ${selectedId === p.id ? 'active' : ''}`}
          >
            <div className="font-medium text-sm">{p.name}</div>
            <span className={`badge-sm ${p.status === 'active' ? 'ok' : p.status === 'paused' ? 'warn' : 'down'}`}>
              {p.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProgressStats({ project, features }: { project: Project; features: FeatureNode[] }) {
  const stats = useMemo(() => {
    const done = features.filter((f) => f.status === 'done').length
    const inProgress = features.filter((f) => f.status === 'in_progress').length
    const blocked = features.filter((f) => f.status === 'blocked').length
    const total = features.length || 1

    return {
      done,
      inProgress,
      blocked,
      open: inProgress,
      total,
      percentage: Math.round(((done + inProgress) / total) * 100),
    }
  }, [features])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="stat-title">Done</div>
          <div className="stat-value text-green-600">{stats.done}</div>
          <div className="stat-subtext">{stats.total} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">In Progress</div>
          <div className="stat-value text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Blocked</div>
          <div className="stat-value text-red-600">{stats.blocked}</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span>Progress</span>
          <span className="font-medium">{stats.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{ width: `${stats.percentage}%` }} />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ feature, onSelect }: { feature: FeatureNode; onSelect: (feature: FeatureNode) => void }) {
  return (
    <button
      onClick={() => onSelect(feature)}
      className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{feature.title}</div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getPriorityColor(feature.priority)}`}>
          {feature.priority.toUpperCase()}
        </span>
      </div>
      {feature.summary && <p className="text-sm text-gray-600 mb-2 line-clamp-2">{feature.summary}</p>}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
        <span className={`w-2 h-2 rounded-full ${getStatusColor(feature.status).replace('text-', 'bg-')}`} />
        <span className="capitalize">{feature.status.replace(/_/g, ' ')}</span>
      </div>
      {feature.owner && <div className="text-xs text-gray-500">Owner: {feature.owner}</div>}
    </button>
  )
}

function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-4">No recent activity</div>
      ) : (
        activities.slice(0, 8).map((a) => (
          <div key={a.id} className="pb-3 border-b border-gray-100">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-gray-900">{a.actor}</span>
                  <span className="text-gray-600"> {a.text}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{fmtAgo(a.at)}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DescriptionEditor({
  project,
  onSave,
  saving,
}: {
  project: Project
  onSave: (summary: string) => Promise<void>
  saving: boolean
}) {
  const [value, setValue] = useState(project.summary)
  const [isDirty, setIsDirty] = useState(false)

  const handleBlur = async () => {
    if (isDirty && value !== project.summary) {
      await onSave(value)
      setIsDirty(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">Description</label>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setIsDirty(true)
        }}
        onBlur={handleBlur}
        rows={4}
        disabled={saving}
        className="w-full px-3 py-2 border border-gray-200 rounded text-sm resize-none disabled:opacity-50"
        placeholder="Project description..."
      />
      {isDirty && <div className="text-xs text-gray-500">Saving on blur...</div>}
    </div>
  )
}

function OverviewTab({ project, features }: { project: Project; features: FeatureNode[] }) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <ProgressStats project={project} features={features} />

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {features.slice(0, 6).map((f) => (
            <FeatureCard
              key={f.id}
              feature={f}
              onSelect={() => navigate(`/projects/${project.id}/features/${f.id}`)}
            />
          ))}
        </div>
        {features.length > 6 && (
          <div className="text-center pt-3">
            <button className="text-sm text-blue-600 hover:text-blue-700">View all {features.length} features →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function TreeTab() {
  return (
    <div className="p-4 text-center text-gray-500">
      <p>Tree view coming in next phase</p>
    </div>
  )
}

function KanbanTab() {
  return (
    <div className="p-4 text-center text-gray-500">
      <p>Kanban view coming in next phase</p>
    </div>
  )
}

export function ProjectsPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()

  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<ProjectTab>('Overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingDescription, setSavingDescription] = useState(false)

  const features = useMemo(() => flattenTree(currentProject?.tree), [currentProject])

  // Load projects list
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/pm/projects')
        if (!res.ok) throw new Error('Failed to load projects')
        const data = await res.json()
        setProjects(data)

        // Select first project or project from URL
        const selected = projectId || data[0]?.id
        if (selected) {
          loadProject(selected)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  // Load specific project
  const loadProject = async (id: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/pm/projects/${id}`)
      if (!res.ok) throw new Error('Failed to load project')
      const data = await res.json()
      setCurrentProject(data)
      navigate(`/projects/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDescription = async (summary: string) => {
    if (!currentProject) return
    try {
      setSavingDescription(true)
      const res = await fetch(`/api/pm/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      if (!res.ok) throw new Error('Failed to save description')
      const updated = await res.json()
      setCurrentProject(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save description')
    } finally {
      setSavingDescription(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading projects...</div>
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">
          <AlertCircle size={24} className="mx-auto mb-2" />
          {error}
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Plus size={32} className="mb-2 opacity-50" />
        <p>No projects yet. Create one to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Project List */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <ProjectList
          projects={projects}
          selectedId={currentProject.id}
          onSelectProject={loadProject}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{currentProject.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  currentProject.status === 'active' ? 'bg-green-100 text-green-800' :
                  currentProject.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {currentProject.status}
                </span>
              </div>
              {currentProject.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentProject.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm">
              <Settings size={18} />
            </Button>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div>Owner: <span className="font-medium">{currentProject.owner}</span></div>
            <div>Updated: <span className="font-medium">{fmtAgo(currentProject.updatedAt)}</span></div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
          {(['Overview', 'Tree', 'Kanban'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                tab === t
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content Area - Split View */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            {tab === 'Overview' && <OverviewTab project={currentProject} features={features} />}
            {tab === 'Tree' && <TreeTab />}
            {tab === 'Kanban' && <KanbanTab />}
          </div>

          {/* Right Sidebar */}
          <div className="w-80 border-l border-gray-200 bg-white overflow-auto p-4 space-y-6">
            <DescriptionEditor
              project={currentProject}
              onSave={handleSaveDescription}
              saving={savingDescription}
            />

            {currentProject.links.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Quick Links</h3>
                <div className="space-y-2">
                  {currentProject.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 break-all"
                    >
                      <ChevronRight size={14} />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {currentProject.activity && currentProject.activity.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Activity</h3>
                <ActivityFeed activities={currentProject.activity} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
