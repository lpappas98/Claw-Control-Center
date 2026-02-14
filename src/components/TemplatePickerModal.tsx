import { useState } from 'react'
import type { AgentTask } from '../types'

interface TaskTemplate {
  id: string
  name: string
  description: string
  tasks: Array<{
    title: string
    description?: string
    estimatedHours?: number
  }>
}

interface TemplatePickerModalProps {
  onSelect: (template: TaskTemplate) => void
  onClose: () => void
}

// Sample templates
const TEMPLATES: TaskTemplate[] = [
  {
    id: 'feature-development',
    name: 'Feature Development',
    description: 'Complete workflow for building a new feature',
    tasks: [
      { title: 'Design & Planning', description: 'Create design specs and requirements', estimatedHours: 4 },
      { title: 'Development', description: 'Implement feature', estimatedHours: 16 },
      { title: 'Unit Testing', description: 'Write and run unit tests', estimatedHours: 8 },
      { title: 'Code Review', description: 'Submit for peer review', estimatedHours: 2 },
      { title: 'Integration Testing', description: 'Test in staging environment', estimatedHours: 4 },
    ],
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Standard bug fix workflow',
    tasks: [
      { title: 'Reproduce Bug', description: 'Document steps to reproduce', estimatedHours: 2 },
      { title: 'Root Cause Analysis', description: 'Identify root cause', estimatedHours: 3 },
      { title: 'Implement Fix', description: 'Code the fix', estimatedHours: 4 },
      { title: 'Test Fix', description: 'Verify fix works', estimatedHours: 2 },
      { title: 'Deploy Fix', description: 'Deploy to production', estimatedHours: 1 },
    ],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Writing and publishing documentation',
    tasks: [
      { title: 'Outline', description: 'Create documentation outline', estimatedHours: 2 },
      { title: 'Write Content', description: 'Write documentation', estimatedHours: 8 },
      { title: 'Add Examples', description: 'Create code examples', estimatedHours: 4 },
      { title: 'Review & Publish', description: 'Review and publish docs', estimatedHours: 2 },
    ],
  },
  {
    id: 'release-cycle',
    name: 'Release Cycle',
    description: 'Full release management workflow',
    tasks: [
      { title: 'Create Release Branch', estimatedHours: 1 },
      { title: 'Update Changelog', estimatedHours: 2 },
      { title: 'Bump Version', estimatedHours: 1 },
      { title: 'Generate Release Notes', estimatedHours: 3 },
      { title: 'Build & Package', estimatedHours: 2 },
      { title: 'Test Release', estimatedHours: 4 },
      { title: 'Deploy Release', estimatedHours: 1 },
    ],
  },
]

export function TemplatePickerModal({ onSelect, onClose }: TemplatePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const filteredTemplates = TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId)

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate)
      onClose()
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
        aria-label="Select task template"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ margin: '6px 0 0' }}>Choose Task Template</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Start with a pre-built workflow template
            </div>
          </div>
          <button className="btn ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body" style={{ padding: 16 }}>
          <div className="stack" style={{ gap: 16 }}>
            {/* Search */}
            <div className="field">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Template List */}
            <div className="stack" style={{ gap: 12 }}>
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    style={{
                      padding: 12,
                      border: selectedTemplateId === template.id ? '2px solid #5f6dff' : '1px solid #242b45',
                      backgroundColor:
                        selectedTemplateId === template.id ? 'rgba(95, 109, 255, 0.1)' : '#0b0f1f',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: '#e2e8f0' }}>
                      {template.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                      {template.description}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {template.tasks.length} tasks
                      {template.tasks.some((t) => t.estimatedHours) &&
                        ` • ${template.tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)}h estimated`}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                  No templates found matching your search
                </div>
              )}
            </div>

            {/* Template Details */}
            {selectedTemplate && (
              <div
                className="panel"
                style={{
                  padding: 12,
                  backgroundColor: 'rgba(30, 41, 59, 0.5)',
                  marginTop: 12,
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Tasks in this template:</h4>
                <div className="stack" style={{ gap: 8 }}>
                  {selectedTemplate.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#e2e8f0' }}>
                        {idx + 1}. {task.title}
                      </div>
                      {task.description && (
                        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                          {task.description}
                        </div>
                      )}
                      {task.estimatedHours && (
                        <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                          ~{task.estimatedHours}h
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn ghost" onClick={onClose} type="button">
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleUseTemplate}
                disabled={!selectedTemplate}
                type="button"
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
