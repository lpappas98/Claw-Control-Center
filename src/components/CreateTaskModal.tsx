import { useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { Priority, BoardLane } from '../types'
import { Button } from '@/components/ui/button'

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']
const OWNERS = ['pm', 'dev-1', 'dev-2', 'architect', 'qa']
const TASK_TYPES = ['feature', 'bugfix', 'refactor', 'doc', 'test', 'epic', 'design']
const TAGS = ['frontend', 'backend', 'api', 'database', 'infra', 'ui', 'perf', 'security']

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</label>
)

const TextArea = ({ 
  label, 
  placeholder, 
  rows = 3, 
  value, 
  onChange 
}: { 
  label: string
  placeholder?: string
  rows?: number
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void 
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <textarea 
      placeholder={placeholder} 
      rows={rows}
      value={value}
      onChange={onChange}
      className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 resize-none transition-all"
    />
  </div>
)

const Input = ({ 
  label, 
  value, 
  placeholder, 
  onChange 
}: { 
  label: string
  value: string
  placeholder?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <input 
      type="text" 
      value={value} 
      onChange={onChange}
      placeholder={placeholder} 
      className="w-full bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
    />
  </div>
)

const Select = ({ 
  label, 
  value, 
  options, 
  onChange 
}: { 
  label: string
  value: string
  options: string[]
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void 
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <div className="relative">
      <select 
        value={value} 
        onChange={onChange}
        className="w-full appearance-none bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 pr-8 transition-all cursor-pointer"
      >
        <option value="">Select {label.toLowerCase()}…</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
)

const TagCheckbox = ({ 
  tag, 
  checked, 
  onChange 
}: { 
  tag: string
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void 
}) => (
  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer transition-all">
    <input 
      type="checkbox" 
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded accent-blue-500"
    />
    <span className="text-xs text-slate-300">{tag}</span>
  </label>
)

export function CreateTaskModal({
  adapter,
  onClose,
  onCreated,
}: {
  adapter: Adapter
  onClose: () => void
  onCreated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [priority, setPriority] = useState<Priority>('P2')
  const [status, setStatus] = useState<BoardLane>('queued')
  const [owner, setOwner] = useState('')
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>(
    TAGS.reduce((acc, tag) => ({ ...acc, [tag]: false }), {})
  )
  const [problem, setProblem] = useState('')
  const [scope, setScope] = useState('')
  const [criteria, setCriteria] = useState('')

  const canSubmit = title.trim().length > 0 && !busy

  const handleTagChange = (tag: string) => {
    setSelectedTags(prev => ({ ...prev, [tag]: !prev[tag] }))
  }

  async function handleSubmit() {
    if (!canSubmit) return

    setBusy(true)
    setError(null)

    try {
      const tagsArray = Object.entries(selectedTags)
        .filter(([_, checked]) => checked)
        .map(([tag]) => tag)

      const acceptanceCriteria = criteria
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)

      const payload: Record<string, unknown> = {
        title: title.trim(),
        priority,
        lane: status,
        type: type || undefined,
        problem: problem.trim() || undefined,
        scope: scope.trim() || undefined,
        acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
        owner: owner || undefined,
      }

      if (tagsArray.length > 0) {
        payload.tags = tagsArray
      }

      // POST to /api/tasks
      const response = await fetch('http://localhost:8787/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.text()
        throw new Error(errData || `HTTP ${response.status}`)
      }

      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" 
        onClick={onClose}
        style={{ animation: "fadeIn 0.15s ease-out" }}
      />
      
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: "slideUp 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700/40 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">Create New Task</h2>
          <button 
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-sm text-red-300 mb-5">
              <strong className="font-semibold">Error:</strong> {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title */}
            <Input 
              label="Title" 
              value={title} 
              placeholder="What needs to be done?"
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-4">
              <Select 
                label="Type" 
                value={type} 
                options={TASK_TYPES}
                onChange={(e) => setType(e.target.value)}
              />
              <Select 
                label="Priority" 
                value={priority} 
                options={PRIORITIES}
                onChange={(e) => setPriority(e.target.value as Priority)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select 
                label="Status" 
                value={status} 
                options={['queued', 'development', 'review', 'blocked', 'done']}
                onChange={(e) => setStatus(e.target.value as BoardLane)}
              />
              <Select 
                label="Owner" 
                value={owner} 
                options={OWNERS}
                onChange={(e) => setOwner(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div>
              <FieldLabel>Tags (optional)</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <TagCheckbox 
                    key={tag}
                    tag={tag}
                    checked={selectedTags[tag]}
                    onChange={() => handleTagChange(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Advanced section */}
            <div className="border-t border-slate-700/30 pt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
              >
                <svg 
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Advanced
              </button>

              {showAdvanced && (
                <div className="space-y-4">
                  <TextArea 
                    label="Problem" 
                    placeholder="Why does this task exist?" 
                    rows={3}
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                  />

                  <TextArea 
                    label="Scope" 
                    placeholder="What is in/out of scope?" 
                    rows={3}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  />

                  <TextArea 
                    label="Acceptance Criteria" 
                    placeholder="One criterion per line" 
                    rows={4}
                    value={criteria}
                    onChange={(e) => setCriteria(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-700/40 bg-slate-900/80 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
          >
            {busy ? 'Creating…' : 'Create Task'}
          </Button>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `}</style>
      </div>
    </div>
  )
}
