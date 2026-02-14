import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { BoardLane, Priority, Task } from '../types'
import { CopyButton } from './CopyButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftLane, setDraftLane] = useState<BoardLane>(task.lane)
  const [draftPriority, setDraftPriority] = useState<Priority>(task.priority)
  const [draftOwner, setDraftOwner] = useState(task.owner ?? '')
  const [draftProblem, setDraftProblem] = useState(task.problem ?? '')
  const [draftScope, setDraftScope] = useState(task.scope ?? '')
  const [draftAcceptanceRaw, setDraftAcceptanceRaw] = useState((task.acceptanceCriteria ?? []).join('\n'))

  useEffect(() => {
    setDraftTitle(task.title)
    setDraftLane(task.lane)
    setDraftPriority(task.priority)
    setDraftOwner(task.owner ?? '')
    setDraftProblem(task.problem ?? '')
    setDraftScope(task.scope ?? '')
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

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0f1e] border-[#2a3a5a]">
        <DialogHeader className="border-b border-[#2a3a5a] pb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded ${
                task.priority === 'P0' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                task.priority === 'P1' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                task.priority === 'P2' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              }`}>
                {task.priority}
              </span>
              <code className="text-xs text-slate-400 bg-[#141927] px-2 py-1 rounded border border-[#2a3a5a]">
                {task.id}
              </code>
            </div>
            <DialogTitle className="text-xl font-semibold text-white">
              {task.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-sm text-red-300">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Basic Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Title</label>
                <Input 
                  value={draftTitle} 
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="bg-[#161b2f] border-[#3a4a6a] text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Owner</label>
                <Input
                  value={draftOwner}
                  onChange={(e) => setDraftOwner(e.target.value)}
                  placeholder="Unassigned"
                  className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Status</label>
                <select
                  value={draftLane}
                  onChange={(e) => setDraftLane(e.target.value as BoardLane)}
                  className="h-10 w-full px-3 py-2 rounded-md border border-[#3a4a6a] bg-[#161b2f] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {LANES.map((l) => (
                    <option value={l} key={l} className="bg-[#161b2f]">
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Priority</label>
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value as Priority)}
                  className="h-10 w-full px-3 py-2 rounded-md border border-[#3a4a6a] bg-[#161b2f] text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {PRIORITIES.map((p) => (
                    <option value={p} key={p} className="bg-[#161b2f]">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Details</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Problem</label>
              <Textarea
                value={draftProblem}
                onChange={(e) => setDraftProblem(e.target.value)}
                rows={3}
                placeholder="Why does this task exist?"
                className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Scope</label>
              <Textarea
                value={draftScope}
                onChange={(e) => setDraftScope(e.target.value)}
                rows={3}
                placeholder="What is in/out of scope?"
                className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Acceptance Criteria</label>
              <Textarea
                value={draftAcceptanceRaw}
                onChange={(e) => setDraftAcceptanceRaw(e.target.value)}
                rows={5}
                placeholder="One criterion per line"
                className="bg-[#161b2f] border-[#3a4a6a] text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none font-mono text-sm"
              />
            </div>
          </div>

          {/* Metadata Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Metadata</h3>
            <div className="bg-[#141927] border border-[#2a3a5a] rounded-lg p-4 text-xs text-slate-400 space-y-1">
              <div>Created: {fmtWhen(task.createdAt)}</div>
              <div>Updated: {fmtWhen(task.updatedAt)}</div>
              <div>History: {task.statusHistory?.length ?? 0} events</div>
            </div>
          </div>

          {/* History Section */}
          {(task.statusHistory?.length ?? 0) > 0 && (
            <details className="space-y-3">
              <summary className="text-sm font-semibold text-slate-300 uppercase tracking-wide cursor-pointer hover:text-slate-200">
                Status History ({task.statusHistory?.length})
              </summary>
              <div className="space-y-2 mt-3">
                {(task.statusHistory ?? []).map((h, idx) => (
                  <div key={`${h.at}-${idx}`} className="bg-[#141927] border border-[#2a3a5a] rounded-lg p-3 text-sm">
                    <div className="font-medium text-white">
                      {h.to}
                      {h.from && <span className="text-slate-400 font-normal"> ← {h.from}</span>}
                    </div>
                    {h.note && <div className="text-slate-400 mt-1 text-xs">{h.note}</div>}
                    <div className="text-xs text-slate-500 mt-1">{fmtWhen(h.at)}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="border-t border-[#2a3a5a] pt-4">
          <div className="w-full flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </div>
            <div className="flex gap-2">
              <CopyButton label="Copy JSON" text={JSON.stringify(task, null, 2)} />
              <Button
                variant="default"
                onClick={save}
                disabled={busy || !dirty}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {busy ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
