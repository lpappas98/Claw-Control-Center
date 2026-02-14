import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  Circle,
  ChevronUp,
  Zap,
  GitBranch,
  Users,
  Clock,
  Link as LinkIcon,
} from 'lucide-react'

type Priority = 'p0' | 'p1' | 'p2'
type FeatureStatus = 'planned' | 'in_progress' | 'blocked' | 'done'

type AcceptanceCriterion = {
  text: string
  done: boolean
}

type AIContext = {
  reasoning: string
  confidence: number
  generatedAt: string
  model: string
}

type Task = {
  id: string
  title: string
  status: FeatureStatus
  priority: Priority
  tag?: string
  assignee?: string
  done: boolean
}

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
  acceptanceCriteria?: AcceptanceCriterion[]
  aiContext?: AIContext | null
  tasks?: Task[]
}

type SubFeature = FeatureNode & {
  tasks?: Task[]
}

type ActivityEntry = {
  id: string
  at: string
  actor: string
  text: string
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatTimeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime()
    if (!Number.isFinite(ms) || ms < 0) return '—'
    const min = Math.round(ms / 60_000)
    if (min < 2) return 'just now'
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 48) return `${hr}h ago`
    const d = Math.round(hr / 24)
    return `${d}d ago`
  } catch {
    return '—'
  }
}

function getStatusColor(status: FeatureStatus): string {
  switch (status) {
    case 'done':
      return 'text-green-600'
    case 'in_progress':
      return 'text-blue-600'
    case 'blocked':
      return 'text-red-600'
    default:
      return 'text-gray-400'
  }
}

function getStatusBgColor(status: FeatureStatus): string {
  switch (status) {
    case 'done':
      return 'bg-green-50 border-green-200'
    case 'in_progress':
      return 'bg-blue-50 border-blue-200'
    case 'blocked':
      return 'bg-red-50 border-red-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'p0':
      return 'bg-red-100 text-red-800'
    case 'p1':
      return 'bg-yellow-100 text-yellow-800'
    case 'p2':
      return 'bg-blue-100 text-blue-800'
  }
}

function getStatusLabel(status: FeatureStatus): string {
  return status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1)
}

function getTasksProgress(tasks: Task[] | undefined): { done: number; total: number; percentage: number } {
  if (!tasks || tasks.length === 0) {
    return { done: 0, total: 0, percentage: 0 }
  }
  const done = tasks.filter((t) => t.done).length
  const total = tasks.length
  return { done, total, percentage: Math.round((done / total) * 100) }
}

type SubFeaturesData = {
  featureId: string
  feature: { id: string; title: string; status: FeatureStatus; priority: Priority }
  subFeatures: SubFeature[]
}

export function FeatureDetailPage() {
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>()
  const navigate = useNavigate()

  const [feature, setFeature] = useState<FeatureNode | null>(null)
  const [subFeaturesData, setSubFeaturesData] = useState<SubFeaturesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSubFeatures, setExpandedSubFeatures] = useState<Set<string>>(new Set())
  const [aiContextExpanded, setAiContextExpanded] = useState(false)
  const [regeneratingAI, setRegeneratingAI] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[]>([])

  const loadFeatureData = useCallback(async () => {
    if (!projectId || !featureId) {
      setError('Invalid project or feature ID')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [featureRes, subFeaturesRes] = await Promise.all([
        fetch(`/api/pm/projects/${projectId}/features/${featureId}`),
        fetch(`/api/pm/projects/${projectId}/features/${featureId}/subfeatures`),
      ])

      if (!featureRes.ok) throw new Error('Failed to load feature')
      if (!subFeaturesRes.ok) throw new Error('Failed to load sub-features')

      const featureData = await featureRes.json()
      const subFeaturesRes_data = await subFeaturesRes.json()

      setFeature(featureData)
      setSubFeaturesData(subFeaturesRes_data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature')
    } finally {
      setLoading(false)
    }
  }, [projectId, featureId])

  useEffect(() => {
    loadFeatureData()
  }, [loadFeatureData])

  const toggleAcceptanceCriteria = useCallback(
    async (criteriaIndex: number, newDoneState: boolean) => {
      if (!projectId || !featureId) return

      try {
        const res = await fetch(`/api/pm/projects/${projectId}/features/${featureId}/criteria/${criteriaIndex}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ done: newDoneState }),
        })

        if (!res.ok) throw new Error('Failed to update criteria')

        setFeature((prev) => {
          if (!prev) return prev
          const updated = { ...prev }
          if (updated.acceptanceCriteria) {
            updated.acceptanceCriteria = [...updated.acceptanceCriteria]
            updated.acceptanceCriteria[criteriaIndex] = {
              ...updated.acceptanceCriteria[criteriaIndex],
              done: newDoneState,
            }
          }
          return updated
        })
      } catch (err) {
        console.error('Failed to toggle criteria:', err)
      }
    },
    [projectId, featureId]
  )

  const regenerateAIContext = useCallback(async () => {
    if (!projectId || !featureId) return

    try {
      setRegeneratingAI(true)
      const res = await fetch(`/api/pm/projects/${projectId}/features/${featureId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) throw new Error('Failed to regenerate AI context')

      const aiContext = await res.json()

      setFeature((prev) => {
        if (!prev) return prev
        return { ...prev, aiContext }
      })
    } catch (err) {
      console.error('Failed to regenerate AI context:', err)
    } finally {
      setRegeneratingAI(false)
    }
  }, [projectId, featureId])

  const toggleSubFeatureExpanded = (subFeatureId: string) => {
    const newExpanded = new Set(expandedSubFeatures)
    if (newExpanded.has(subFeatureId)) {
      newExpanded.delete(subFeatureId)
    } else {
      newExpanded.add(subFeatureId)
    }
    setExpandedSubFeatures(newExpanded)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p>Loading feature...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600 text-center">
          <AlertCircle size={24} className="mx-auto mb-2" />
          <p>{error}</p>
          <div className="mt-4">
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!feature) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Feature not found
      </div>
    )
  }

  const tasksProgress = getTasksProgress(feature.tasks)
  const hasAcceptanceCriteria = feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0
  const hasAIContext = feature.aiContext

  return (
    <div className="flex h-full bg-gray-50">
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="px-0 h-auto">
                Claw Control Center
              </Button>
              <ChevronRight size={16} />
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)} className="px-0 h-auto">
                Key Features
              </Button>
              <ChevronRight size={16} />
              <span className="font-medium text-gray-900">{feature.title}</span>
            </div>
          </div>

          {/* Feature Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl font-bold text-gray-900">{feature.title}</h1>
                  <span className={`px-3 py-1 rounded-md text-xs font-semibold ${getPriorityColor(feature.priority)}`}>
                    {feature.priority.toUpperCase()}
                  </span>
                  <span className="px-3 py-1 rounded-md text-xs font-semibold border border-gray-300 text-gray-700">
                    {getStatusLabel(feature.status)}
                  </span>
                </div>
                {feature.summary && <p className="text-gray-700 leading-relaxed max-w-2xl">{feature.summary}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft size={16} />
                Back
              </Button>
            </div>

            {/* Feature Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {feature.owner && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Users size={16} className="text-gray-400" />
                  <span>Owner: {feature.owner}</span>
                </div>
              )}
              {feature.tags && feature.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {feature.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{tasksProgress.done}</div>
                <div className="text-xs text-gray-600">Tasks Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{tasksProgress.total}</div>
                <div className="text-xs text-gray-600">Total Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{tasksProgress.percentage}%</div>
                <div className="text-xs text-gray-600">Progress</div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 space-y-6">
            {/* Acceptance Criteria */}
            {hasAcceptanceCriteria && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-green-600" />
                  Acceptance Criteria
                </h2>
                <div className="space-y-3">
                  {feature.acceptanceCriteria!.map((criterion, idx) => (
                    <label key={idx} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded transition">
                      <input
                        type="checkbox"
                        checked={criterion.done}
                        onChange={(e) => toggleAcceptanceCriteria(idx, e.target.checked)}
                        className="mt-1 h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                      <span className={criterion.done ? 'line-through text-gray-400' : 'text-gray-700'}>{criterion.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* AI Context Card */}
            {hasAIContext && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Zap size={20} className="text-yellow-600" />
                    AI Context
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">
                      Confidence: {Math.round(feature.aiContext.confidence)}%
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={regenerateAIContext}
                      disabled={regeneratingAI}
                      className="gap-2"
                    >
                      <RefreshCw size={14} className={regeneratingAI ? 'animate-spin' : ''} />
                      {regeneratingAI ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                  </div>
                </div>

                {/* Collapsible Reasoning */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={() => setAiContextExpanded(!aiContextExpanded)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600 transition w-full text-left"
                  >
                    {aiContextExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Reasoning
                  </button>
                  {aiContextExpanded && (
                    <div className="mt-3 text-sm text-gray-700 bg-gray-50 p-3 rounded leading-relaxed">
                      {feature.aiContext.reasoning}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} />
                  Generated by {feature.aiContext.model} at {formatDate(feature.aiContext.generatedAt)}
                </div>
              </div>
            )}

            {/* Dependency Mini-Map */}
            {feature.dependsOn && feature.dependsOn.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <GitBranch size={20} className="text-purple-600" />
                  Dependencies
                </h2>
                <div className="space-y-2">
                  {feature.dependsOn.map((dep, idx) => (
                    <div key={dep} className="flex items-center gap-2 text-sm text-gray-700">
                      {idx > 0 && <div className="text-gray-400">→</div>}
                      <span className="px-3 py-1 bg-purple-50 border border-purple-200 rounded text-purple-700 font-medium">
                        {dep}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-features Section */}
            {subFeaturesData && subFeaturesData.subFeatures.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <GitBranch size={20} className="text-blue-600" />
                    Sub-Features ({subFeaturesData.subFeatures.length})
                  </h2>
                  <Button size="sm" className="gap-2">
                    <Plus size={14} />
                    Add Sub-Feature
                  </Button>
                </div>

                <div className="space-y-3">
                  {subFeaturesData.subFeatures.map((subFeature) => {
                    const isExpanded = expandedSubFeatures.has(subFeature.id)
                    const subTasksProgress = getTasksProgress(subFeature.tasks)

                    return (
                      <div key={subFeature.id} className={`border rounded-lg transition ${getStatusBgColor(subFeature.status)}`}>
                        {/* Sub-feature Header */}
                        <button
                          onClick={() => toggleSubFeatureExpanded(subFeature.id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition"
                        >
                          <div className="flex items-center gap-3 flex-1 text-left">
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <div className="flex items-center gap-2 flex-1">
                              <span className={`w-2 h-2 rounded-full ${getStatusColor(subFeature.status).replace('text-', 'bg-')}`} />
                              <span className="font-medium text-gray-900">{subFeature.title}</span>
                              {subFeature.tags && subFeature.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {subFeature.tags.map((tag) => (
                                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>{subTasksProgress.done}/{subTasksProgress.total}</span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(subFeature.priority)}`}>
                              {subFeature.priority.toUpperCase()}
                            </span>
                          </div>
                        </button>

                        {/* Sub-feature Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-300 px-4 py-3 space-y-3 bg-white bg-opacity-50">
                            {subFeature.summary && (
                              <p className="text-sm text-gray-700">{subFeature.summary}</p>
                            )}

                            {/* Tasks Table */}
                            {subFeature.tasks && subFeature.tasks.length > 0 && (
                              <div className="mt-3 overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-300 text-left">
                                      <th className="px-3 py-2 font-semibold text-gray-700 w-8" />
                                      <th className="px-3 py-2 font-semibold text-gray-700">Task</th>
                                      <th className="px-3 py-2 font-semibold text-gray-700 w-20">Tag</th>
                                      <th className="px-3 py-2 font-semibold text-gray-700 w-16">Pri</th>
                                      <th className="px-3 py-2 font-semibold text-gray-700 w-24">Status</th>
                                      <th className="px-3 py-2 font-semibold text-gray-700 w-24">Assignee</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {subFeature.tasks.map((task) => (
                                      <tr
                                        key={task.id}
                                        className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition ${
                                          task.done ? 'opacity-60' : ''
                                        }`}
                                      >
                                        <td className="px-3 py-2">
                                          {task.done ? (
                                            <CheckCircle2 size={16} className="text-green-600" />
                                          ) : (
                                            <Circle size={16} className="text-gray-300" />
                                          )}
                                        </td>
                                        <td className={`px-3 py-2 ${task.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                          {task.title}
                                        </td>
                                        <td className="px-3 py-2">
                                          {task.tag && (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                              {task.tag}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                                            {task.priority.toUpperCase()}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 capitalize">
                                          {task.status.replace(/_/g, ' ')}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600">{task.assignee || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Add Task Button */}
                            <div className="pt-2">
                              <Button size="sm" variant="outline" className="gap-2 text-xs">
                                <Plus size={12} />
                                Add Task
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty State for Sub-features */}
            {subFeaturesData && subFeaturesData.subFeatures.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <div className="text-gray-400 mb-3">
                  <GitBranch size={32} className="mx-auto" />
                </div>
                <p className="text-gray-600 mb-4">No sub-features yet</p>
                <Button className="gap-2">
                  <Plus size={14} />
                  Create First Sub-Feature
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-auto flex flex-col">
        {/* Acceptance Criteria Summary (Sidebar) */}
        {hasAcceptanceCriteria && (
          <div className="border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              Acceptance Criteria
            </h3>
            <div className="space-y-2">
              {feature.acceptanceCriteria!.slice(0, 5).map((criterion, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={criterion.done}
                    onChange={(e) => toggleAcceptanceCriteria(idx, e.target.checked)}
                    className="mt-0.5 h-3 w-3 text-green-600 rounded"
                  />
                  <span className={criterion.done ? 'line-through text-gray-400' : 'text-gray-600'}>
                    {criterion.text.substring(0, 50)}
                    {criterion.text.length > 50 ? '...' : ''}
                  </span>
                </div>
              ))}
              {feature.acceptanceCriteria!.length > 5 && (
                <p className="text-xs text-gray-500 pt-2">
                  +{feature.acceptanceCriteria!.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Activity Feed */}
        <div className="flex-1 p-4 overflow-auto">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Activity Feed</h3>
          <div className="space-y-3 text-xs">
            {activity.length > 0 ? (
              activity.map((entry) => (
                <div key={entry.id} className="pb-3 border-b border-gray-100">
                  <div className="text-gray-600">
                    <span className="font-medium text-gray-900">{entry.actor}</span> {entry.text}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">{formatTimeAgo(entry.at)}</div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No activity yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
