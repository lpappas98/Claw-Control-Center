import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { BoardLane, Priority, Task } from '../types'
import { CopyButton } from './CopyButton'
import { Button } from '@/components/ui/button'

const LANES: BoardLane[] = ['proposed', 'queued', 'development', 'review', 'blocked', 'done']
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3']

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function normalizeLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: string }) => {
  const styles: { [key: string]: string } = {
    p0: 'bg-red-500/15 text-red-400 border border-red-500/20',
    epic: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
    default: 'bg-slate-700/50 text-slate-300 border border-slate-600/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${styles[variant] || styles.default}`}>
      {children}
    </span>
  )
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</label>
)

const TextArea = ({ label, placeholder, rows = 3, value, onChange }: { label: string; placeholder?: string; rows?: number; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) => (
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

const Select = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <div className="relative">
      <select 
        value={value} 
        onChange={onChange}
        className="w-full appearance-none bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 pr-8 transition-all cursor-pointer"
      >
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

const Input = ({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
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

export function TaskModal({
  adapter,
  task,
  onClose,
  onSaved,
}: {
  adapter: Adapter
  task: Task
  onClose: () => void
  onSaved: (t: Task) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details')

  const [draftTitle, setDraftTitle] = useState(String(task.title ?? ''))
  const [draftLane, setDraftLane] = useState<BoardLane>(task.lane)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftOwner, setDraftOwner] = useState(String(task.owner ?? ''))
  const [draftProblem, setDraftProblem] = useState(String(task.problem ?? ''))
  const [draftScope, setDraftScope] = useState(String(task.scope ?? ''))
  const [draftAcceptanceRaw, setDraftAcceptanceRaw] = useState((task.acceptanceCriteria ?? []).join('\n'))

  useEffect(() => {
    setDraftTitle(String(task.title ?? ''))
    setDraftLane(task.lane)
    setDraftPriority(task.priority)
    setDraftOwner(String(task.owner ?? ''))
    setDraftProblem(String(task.problem ?? ''))
    setDraftScope(String(task.scope ?? ''))
    setDraftAcceptanceRaw((task.acceptanceCriteria ?? []).join('\n'))
  }, [task])

  const dirty =
    draftTitle !== task.title ||
    draftLane !== task.lane ||
    draftPriority !== task.priority ||
    draftOwner !== (task.owner ?? '') ||
    draftProblem !== (task.problem ?? '') ||
    draftScope !== (task.scope ?? '') ||
    draftAcceptanceRaw.trim() !== (task.acceptanceCriteria ?? []).join('\n').trim()

  const acceptanceCriteria = useMemo(() => normalizeLines(draftAcceptanceRaw), [draftAcceptanceRaw])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await adapter.updateTask({
        id: task.id,
        title: draftTitle.trim() || task.title,
        lane: draftLane,
        priority: draftPriority,
        owner: draftOwner.trim() || undefined,
        problem: draftProblem.trim() || undefined,
        scope: draftScope.trim() || undefined,
        acceptanceCriteria,
      })
      onSaved(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const getPriorityVariant = (priority: Priority) => {
    return priority === 'P0' ? 'p0' : 'default'
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
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-700/40 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
              <span className="text-xs text-slate-500 font-mono">{task.id}</span>
            </div>
            <input 
              type="text" 
              value={draftTitle} 
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full text-lg font-semibold text-slate-100 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-slate-500"
              placeholder="Enter title..."
            />
          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-700/40 flex-shrink-0">
          {(['details', 'history'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-sm text-red-300 mb-5">
              <strong className="font-semibold">Error:</strong> {error}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <Select 
                  label="Status" 
                  value={draftLane} 
                  options={LANES.map(l => l.charAt(0).toUpperCase() + l.slice(1))}
                  onChange={(e) => {
                    const lane = LANES[LANES.findIndex(l => l.charAt(0).toUpperCase() + l.slice(1) === e.target.value)]
                    setDraftLane(lane)
                  }}
                />
                <Select 
                  label="Priority" 
                  value={draftPriority} 
                  options={PRIORITIES}
                  onChange={(e) => setDraftPriority(e.target.value as Priority)}
                />
                <Input 
                  label="Owner" 
                  value={draftOwner} 
                  placeholder="Assign owner..."
                  onChange={(e) => setDraftOwner(e.target.value)}
                />
              </div>

              <div className="border-t border-slate-700/30" />

              <TextArea 
                label="Problem" 
                placeholder="Why does this task exist?" 
                rows={3}
                value={draftProblem}
                onChange={(e) => setDraftProblem(e.target.value)}
              />

              <TextArea 
                label="Scope" 
                placeholder="What is in/out of scope?" 
                rows={3}
                value={draftScope}
                onChange={(e) => setDraftScope(e.target.value)}
              />

              <TextArea 
                label="Acceptance Criteria" 
                placeholder="One criterion per line" 
                rows={4}
                value={draftAcceptanceRaw}
                onChange={(e) => setDraftAcceptanceRaw(e.target.value)}
              />

              <div className="border-t border-slate-700/30" />

              <div className="flex items-center gap-6 text-xs text-slate-500">
                <span>Created <span className="text-slate-400">{fmtWhen(task.createdAt)}</span></span>
                <span>Updated <span className="text-slate-400">{fmtWhen(task.updatedAt)}</span></span>
                <span><span className="text-slate-400">{task.statusHistory?.length ?? 0}</span> event{(task.statusHistory?.length ?? 0) !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {(task.statusHistory?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  {(task.statusHistory ?? []).map((h, idx) => (
                    <div key={`${h.at}-${idx}`} className="bg-slate-800/50 border border-slate-700/40 rounded-lg p-3 text-sm">
                      <div className="font-medium text-white">
                        {h.to}
                        {h.from && <span className="text-slate-400 font-normal"> ← {h.from}</span>}
                      </div>
                      {h.note && <div className="text-slate-400 mt-1 text-xs">{h.note}</div>}
                      <div className="text-xs text-slate-500 mt-1">{fmtWhen(h.at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">
                  <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No history yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/40 bg-slate-900/80 flex-shrink-0">
          <CopyButton label="Copy JSON" text={JSON.stringify(task, null, 2)} />
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={save}
              disabled={busy || !dirty}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
            >
              {busy ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        `}</style>
      </div>
    </div>
  )
}
