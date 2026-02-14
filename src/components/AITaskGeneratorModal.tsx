import { useState } from 'react'
import type { AgentTask, TaskPriority } from '../types'

interface GeneratedTask {
  title: string
  description?: string
  estimatedHours?: number
  priority?: TaskPriority
}

interface AITaskGeneratorModalProps {
  onCreateTasks: (tasks: GeneratedTask[]) => Promise<void>
  onClose: () => void
}

export function AITaskGeneratorModal({ onCreateTasks, onClose }: AITaskGeneratorModalProps) {
  const [prompt, setPrompt] = useState('')
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe what you want to build')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedTasks([])

    try {
      // Simulate AI generation by parsing the prompt
      // In a real app, this would call an AI API
      const tasks = simulateAIGeneration(prompt)
      setGeneratedTasks(tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tasks')
    } finally {
      setLoading(false)
    }
  }

  const simulateAIGeneration = (description: string): GeneratedTask[] => {
    // Simple simulation that breaks down the description into tasks
    const keywords = description.toLowerCase()
    const tasks: GeneratedTask[] = []

    // Generate tasks based on common patterns
    tasks.push({
      title: 'Design & Planning',
      description: 'Create design specifications and requirements',
      estimatedHours: 4,
      priority: 'P1',
    })

    if (
      keywords.includes('build') ||
      keywords.includes('implement') ||
      keywords.includes('create') ||
      keywords.includes('develop')
    ) {
      tasks.push({
        title: 'Development',
        description: `Implement: ${description}`,
        estimatedHours: 8,
        priority: 'P0',
      })
    }

    if (keywords.includes('test') || keywords.includes('testing') || !keywords.includes('no test')) {
      tasks.push({
        title: 'Testing',
        description: 'Write and run comprehensive tests',
        estimatedHours: 4,
        priority: 'P1',
      })
    }

    if (keywords.includes('document') || keywords.includes('doc')) {
      tasks.push({
        title: 'Documentation',
        description: 'Write documentation and examples',
        estimatedHours: 3,
        priority: 'P2',
      })
    }

    tasks.push({
      title: 'Review & Deployment',
      description: 'Code review and deploy to production',
      estimatedHours: 2,
      priority: 'P1',
    })

    return tasks
  }

  const handleRemoveTask = (index: number) => {
    setGeneratedTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleEditTask = (index: number, field: keyof GeneratedTask, value: unknown) => {
    setGeneratedTasks((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleCreateAll = async () => {
    if (generatedTasks.length === 0) {
      setError('No tasks to create')
      return
    }

    setCreatingTasks(true)
    setError(null)

    try {
      await onCreateTasks(generatedTasks)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks')
    } finally {
      setCreatingTasks(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Generate tasks with AI"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ margin: '6px 0 0' }}>Generate Tasks with AI</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Describe what you want to build, AI will break it down into tasks
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={onClose} disabled={loading || creatingTasks}>
            Close
          </button>
        </div>

        <div className="modal-body" style={{ padding: 16 }}>
          <div className="stack" style={{ gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: 10,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 6,
                  color: '#ef4444',
                  fontSize: 12,
                  border: '1px solid #7b2f2f',
                }}
              >
                {error}
              </div>
            )}

            {/* Prompt Input */}
            <div className="field">
              <label className="muted">Describe what you want to build</label>
              <textarea
                className="input"
                placeholder="e.g., Build a real-time chat feature with notifications and message history..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading || creatingTasks}
                rows={4}
                style={{ width: '100%' }}
              />
            </div>

            {/* Generate Button */}
            {generatedTasks.length === 0 ? (
              <button
                className="btn"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                type="button"
                style={{ alignSelf: 'flex-start' }}
              >
                {loading ? 'Generating...' : '✨ Generate Tasks'}
              </button>
            ) : null}

            {/* Generated Tasks */}
            {generatedTasks.length > 0 && (
              <div
                className="panel"
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(30, 41, 59, 0.5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>Generated Tasks ({generatedTasks.length})</h4>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setGeneratedTasks([])
                      setEditingTaskIndex(null)
                    }}
                    type="button"
                    style={{ fontSize: 12 }}
                  >
                    Generate New
                  </button>
                </div>

                <div className="stack" style={{ gap: 10 }}>
                  {generatedTasks.map((task, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 8,
                        border: '1px solid #242b45',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingTaskIndex === idx ? (
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => handleEditTask(idx, 'title', e.target.value)}
                              className="input"
                              style={{ width: '100%', marginBottom: 6 }}
                            />
                          ) : (
                            <div style={{ fontWeight: 500, color: '#e2e8f0', marginBottom: 4 }}>
                              {idx + 1}. {task.title}
                            </div>
                          )}

                          {editingTaskIndex === idx ? (
                            <textarea
                              value={task.description || ''}
                              onChange={(e) => handleEditTask(idx, 'description', e.target.value)}
                              className="input"
                              rows={2}
                              style={{ width: '100%', fontSize: 12, marginBottom: 6 }}
                            />
                          ) : task.description ? (
                            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                              {task.description}
                            </div>
                          ) : null}

                          {editingTaskIndex === idx && (
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, marginBottom: 6 }}>
                              <div style={{ flex: 1 }}>
                                <label className="muted">Est. Hours</label>
                                <input
                                  type="number"
                                  value={task.estimatedHours || ''}
                                  onChange={(e) =>
                                    handleEditTask(idx, 'estimatedHours', e.target.value ? parseFloat(e.target.value) : undefined)
                                  }
                                  className="input"
                                  min="0"
                                  step="0.5"
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label className="muted">Priority</label>
                                <select
                                  value={task.priority || 'P1'}
                                  onChange={(e) => handleEditTask(idx, 'priority', e.target.value as TaskPriority)}
                                  className="input"
                                >
                                  <option value="P0">P0</option>
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                  <option value="P3">P3</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {editingTaskIndex !== idx && (
                            <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#64748b' }}>
                              {task.estimatedHours && <span>~{task.estimatedHours}h</span>}
                              {task.priority && <span>•</span>}
                              {task.priority && <span>{task.priority}</span>}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                          <button
                            className="btn ghost"
                            onClick={() => setEditingTaskIndex(editingTaskIndex === idx ? null : idx)}
                            type="button"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            {editingTaskIndex === idx ? 'Done' : 'Edit'}
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => handleRemoveTask(idx)}
                            type="button"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              color: '#ef4444',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                className="btn ghost"
                onClick={onClose}
                type="button"
                disabled={loading || creatingTasks}
              >
                Cancel
              </button>
              {generatedTasks.length > 0 && (
                <button
                  className="btn"
                  onClick={handleCreateAll}
                  disabled={creatingTasks || generatedTasks.length === 0}
                  type="button"
                >
                  {creatingTasks ? 'Creating...' : `Create All Tasks (${generatedTasks.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
