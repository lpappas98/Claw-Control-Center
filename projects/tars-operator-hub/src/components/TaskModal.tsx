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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              task <code className="bg-slate-100 px-2 py-1 rounded">{task.id}</code>
            </div>
            <DialogTitle>{task.title}</DialogTitle>
          </div>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            <strong>Task error:</strong> {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Lane</label>
              <select
                value={draftLane}
                onChange={(e) => setDraftLane(e.target.value as BoardLane)}
                className="h-10 w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              >
                {LANES.map((l) => (
                  <option value={l} key={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Priority</label>
              <select
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value as Priority)}
                className="h-10 w-full px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option value={p} key={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Owner</label>
              <Input
                value={draftOwner}
                onChange={(e) => setDraftOwner(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Problem</label>
            <Textarea
              value={draftProblem}
              onChange={(e) => setDraftProblem(e.target.value)}
              rows={3}
              placeholder="why does this task exist?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Scope</label>
            <Textarea
              value={draftScope}
              onChange={(e) => setDraftScope(e.target.value)}
              rows={4}
              placeholder="what is in/out?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Acceptance criteria (one per line)</label>
            <Textarea
              value={draftAcceptanceRaw}
              onChange={(e) => setDraftAcceptanceRaw(e.target.value)}
              rows={6}
            />
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded">
            created: {fmtWhen(task.createdAt)} · updated: {fmtWhen(task.updatedAt)} · history: {task.statusHistory?.length ?? 0} events
          </div>

          <details className="space-y-2" open>
            <summary className="font-medium text-sm cursor-pointer">Status history</summary>
            <div className="space-y-2 mt-2">
              {(task.statusHistory ?? []).map((h, idx) => (
                <div key={`${h.at}-${idx}`} className="border border-slate-200 rounded p-2 text-sm">
                  <div className="font-medium">
                    {h.to}
                    {h.from ? <span className="text-slate-500 font-normal"> (from {h.from})</span> : null}
                  </div>
                  <div className="text-slate-600">{h.note ?? '—'}</div>
                  <div className="text-xs text-slate-500">{fmtWhen(h.at)}</div>
                </div>
              ))}
              {(task.statusHistory?.length ?? 0) === 0 && (
                <div className="text-slate-500 text-sm">No history recorded.</div>
              )}
            </div>
          </details>
        </div>

        <DialogFooter>
          <div className="w-full">
            <div className="text-xs text-slate-500 mb-3">
              Saving lane changes will append a history entry.
            </div>
            <div className="flex gap-2 justify-end">
              <CopyButton label="Copy JSON" text={JSON.stringify(task, null, 2)} />
              <Button
                variant="default"
                onClick={save}
                disabled={busy || !dirty}
              >
                {busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
