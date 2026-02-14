import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle } from 'lucide-react'

type Priority = 'p0' | 'p1' | 'p2'
type FeatureStatus = 'planned' | 'in_progress' | 'blocked' | 'done'

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

function findInTree(nodes: FeatureNode[] | undefined, id: string): FeatureNode | null {
  if (!nodes) return null
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = n.children ? findInTree(n.children, id) : null
    if (hit) return hit
  }
  return null
}

export function FeatureDetailPage() {
  const { projectId, featureId } = useParams<{ projectId: string; featureId: string }>()
  const navigate = useNavigate()

  const [feature, setFeature] = useState<FeatureNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFeature = async () => {
      if (!projectId || !featureId) {
        setError('Invalid project or feature ID')
        return
      }

      try {
        setLoading(true)
        const res = await fetch(`/api/pm/projects/${projectId}`)
        if (!res.ok) throw new Error('Failed to load project')
        const project = await res.json()

        const tree = project.tree || []
        const found = findInTree(tree, featureId)
        if (!found) throw new Error('Feature not found')

        setFeature(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load feature')
      } finally {
        setLoading(false)
      }
    }

    loadFeature()
  }, [projectId, featureId])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Loading feature...</div>
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600 text-center">
          <AlertCircle size={24} className="mx-auto mb-2" />
          {error}
          <div className="mt-4">
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!feature) {
    return <div className="flex items-center justify-center h-full text-gray-500">Feature not found</div>
  }

  return (
    <div className="h-full bg-gray-50 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-6 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2 mb-4"
          >
            <ArrowLeft size={16} />
            Back
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{feature.title}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(feature.priority)}`}>
                  {feature.priority.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(feature.status).replace('text-', 'bg-')}`} />
                <span className="capitalize">{feature.status.replace(/_/g, ' ')}</span>
              </div>
              {feature.summary && <p className="text-gray-700 mb-3">{feature.summary}</p>}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {feature.owner && (
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Owner</h3>
              <p className="text-gray-700">{feature.owner}</p>
            </div>
          )}

          {feature.tags && feature.tags.length > 0 && (
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {feature.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {feature.dependsOn && feature.dependsOn.length > 0 && (
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Dependencies</h3>
              <div className="space-y-1">
                {feature.dependsOn.map((dep) => (
                  <div key={dep} className="text-sm text-gray-700">
                    • {dep}
                  </div>
                ))}
              </div>
            </div>
          )}

          {feature.sources && feature.sources.length > 0 && (
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Sources</h3>
              <div className="space-y-1">
                {feature.sources.map((source) => (
                  <div key={`${source.kind}:${source.id}`} className="text-sm text-gray-700">
                    {source.kind}: <code className="bg-gray-100 px-1 rounded">{source.id}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {feature.children && feature.children.length > 0 && (
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Subtasks</h3>
              <div className="space-y-2">
                {feature.children.map((child) => (
                  <div key={child.id} className="p-3 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(child.status).replace('text-', 'bg-')}`} />
                      <span className="font-medium text-gray-900">{child.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(child.priority)}`}>
                        {child.priority.toUpperCase()}
                      </span>
                    </div>
                    {child.summary && <p className="text-sm text-gray-600 mt-1">{child.summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
