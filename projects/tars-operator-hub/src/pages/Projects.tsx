import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'
import type { FeatureNode, IntakeProject, IntakeProjectUpdate, IntakeQuestion, IntakeRepo, Priority } from '../types'

function fmtAgo(iso?: string) {
  if (!iso) return '—'
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

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function fromLines(lines: string[] | undefined): string {
  return (lines ?? []).join('\n')
}

const HEAVY_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'Pods', 'DerivedData'])

function shouldIgnoreRelPath(relPath: string): boolean {
  const segs = relPath.split(/[/\\]+/g).filter(Boolean)
  return segs.some((s) => HEAVY_DIRS.has(s))
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // chunked to avoid stack overflow on large arrays
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

type ImportFile = { relPath: string; file: File; size: number }

type WebkitFsEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (onFile: (file: File) => void, onError: (err: unknown) => void) => void
  createReader?: () => { readEntries: (onEntries: (entries: WebkitFsEntry[]) => void, onError: (err: unknown) => void) => void }
}

async function fileListFromDirectoryDrop(ev: React.DragEvent): Promise<ImportFile[]> {
  const items = Array.from(ev.dataTransfer.items ?? [])
  const out: ImportFile[] = []

  const walkEntry = async (entry: WebkitFsEntry | null | undefined, prefix: string) => {
    if (!entry) return
    if (entry.isFile && entry.file) {
      const file: File = await new Promise((resolve, reject) => entry.file?.(resolve, reject))
      const relPath = `${prefix}${file.name}`
      out.push({ relPath, file, size: file.size })
    } else if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader()
      const entries: WebkitFsEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
      for (const e of entries) await walkEntry(e, `${prefix}${entry.name}/`)
    }
  }

  for (const it of items) {
    const withGetter = it as unknown as { webkitGetAsEntry?: () => WebkitFsEntry | null }
    const entry = withGetter.webkitGetAsEntry?.()
    if (entry) await walkEntry(entry, '')
  }

  return out
}

function FeatureTreeView({ nodes, onSelect }: { nodes: FeatureNode[]; onSelect?: (n: FeatureNode) => void }) {
  if (!nodes.length) return <div className="muted">No feature tree yet.</div>

  const walk = (n: FeatureNode, depth: number) => {
    return (
      <div key={n.id} style={{ marginLeft: depth ? depth * 12 : 0, paddingLeft: depth ? 12 : 0, borderLeft: depth ? '1px solid var(--border)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn ghost"
            style={{ padding: 0, border: 'none', background: 'transparent', color: 'inherit', fontWeight: 800, cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => (onSelect ? onSelect(n) : null)}
            disabled={!onSelect}
            title={onSelect ? 'Open feature details' : ''}
          >
            {n.title}
          </button>
          <Badge kind={n.priority} />
        </div>
        {n.description && <div className="muted">{n.description}</div>}
        {n.acceptanceCriteria?.length ? (
          <ul className="muted" style={{ marginTop: 6 }}>
            {n.acceptanceCriteria.map((ac, idx) => (
              <li key={idx}>{ac}</li>
            ))}
          </ul>
        ) : null}
        {n.children?.length ? <div style={{ marginTop: 6 }}>{n.children.map((c) => walk(c, depth + 1))}</div> : null}
      </div>
    )
  }

  return <div style={{ display: 'grid', gap: 10 }}>{nodes.map((n) => walk(n, 0))}</div>
}

function FeatureDetailModal({
  feature,
  onClose,
}: {
  feature: FeatureNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Feature details ${feature.title}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              feature <code>{feature.id}</code>
            </div>
            <h3 style={{ margin: '6px 0 0' }}>{feature.title}</h3>
          </div>
          <div className="stack-h">
            <button className="btn ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="stack">
            <div className="callout">
              <div className="stack-h">
                <strong>Priority</strong> <Badge kind={feature.priority} />
              </div>
              {feature.description ? <div className="muted" style={{ marginTop: 6 }}>{feature.description}</div> : null}
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <h4 style={{ marginTop: 0 }}>Story</h4>
              <div className="muted">As a user, I want {feature.title.toLowerCase()} so that I can accomplish the goal safely and quickly.</div>
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <h4 style={{ marginTop: 0 }}>Acceptance criteria</h4>
              {feature.acceptanceCriteria?.length ? (
                <ul className="muted">
                  {feature.acceptanceCriteria.map((ac, idx) => (
                    <li key={idx}>{ac}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No acceptance criteria yet.</div>
              )}
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <h4 style={{ marginTop: 0 }}>Notes / scope</h4>
              <div className="muted">(wireframe) Add product notes, scope boundaries, and edge cases here.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionEditor({ q, on }: { q: IntakeQuestion; on: (next: IntakeQuestion) => void }) {
  return (
    <div className="row" style={{ alignItems: 'stretch' }}>
      <div className="row-main">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{q.prompt}</strong>
          <span className="muted">· {q.category}</span>
          {q.required ? <Badge kind="required" /> : <Badge kind="optional" />}
        </div>
        <textarea
          className="input"
          rows={3}
          value={q.answer}
          onChange={(e) => on({ ...q, answer: e.target.value })}
          placeholder="Answer…"
          style={{ width: '100%', marginTop: 8, resize: 'vertical' }}
        />
      </div>
    </div>
  )
}

function RepoTabs({ repos, activeId, onSelect, onAdd }: { repos: IntakeRepo[]; activeId: string | null; onSelect: (id: string) => void; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {repos.map((r) => (
        <button
          key={r.id}
          className={`btn ghost ${activeId === r.id ? 'active' : ''}`}
          type="button"
          onClick={() => onSelect(r.id)}
          title={r.analysis?.summary ?? ''}
        >
          {r.name}
        </button>
      ))}
      <button className="btn" type="button" onClick={onAdd}>
        Add repo
      </button>
    </div>
  )
}

function RepoImportPanel({
  adapter,
  projectId,
  onImported,
  onCancel,
}: {
  adapter: Adapter
  projectId: string
  onImported: (nextProject: IntakeProject, repoId: string) => void
  onCancel: () => void
}) {
  const [repoName, setRepoName] = useState('')
  const [files, setFiles] = useState<ImportFile[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const addFiles = useCallback((incoming: ImportFile[]) => {
    const filtered = incoming
      .filter((f) => f.relPath && !shouldIgnoreRelPath(f.relPath))
      .sort((a, b) => a.relPath.localeCompare(b.relPath))

    // de-dupe by path
    const seen = new Set<string>()
    const merged = [...files, ...filtered].filter((f) => {
      if (seen.has(f.relPath)) return false
      seen.add(f.relPath)
      return true
    })

    setFiles(merged)
  }, [files])

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = Array.from(e.target.files ?? [])
      const mapped = list.map((f) => ({ relPath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f, size: f.size }))
      addFiles(mapped)
    },
    [addFiles],
  )

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setErr(null)
      try {
        const dropped = await fileListFromDirectoryDrop(e)
        if (!dropped.length) {
          const asFiles = Array.from(e.dataTransfer.files ?? []).map((f) => ({ relPath: f.name, file: f, size: f.size }))
          addFiles(asFiles)
        } else {
          addFiles(dropped)
        }
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : String(ex))
      }
    },
    [addFiles],
  )

  const totalBytes = useMemo(() => files.reduce((acc, f) => acc + (f.size ?? 0), 0), [files])

  const startImport = useCallback(async () => {
    setErr(null)
    const name = repoName.trim() || 'repo'
    if (!files.length) {
      setErr('Pick a folder (or drop a folder) first.')
      return
    }

    setBusy(true)
    setProgress({ done: 0, total: files.length })
    try {
      const start = await adapter.startIntakeRepoImport(projectId, name)

      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        const buf = await f.file.arrayBuffer()
        const b64 = arrayBufferToBase64(buf)
        await adapter.uploadIntakeRepoFile(start.sessionId, f.relPath, b64)
        setProgress({ done: i + 1, total: files.length })
      }

      const nextProject = await adapter.finishIntakeRepoImport(start.sessionId)
      onImported(nextProject, start.repo.id)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setBusy(false)
    }
  }, [adapter, files, onImported, projectId, repoName])

  return (
    <div className="panel" style={{ padding: 14, border: '1px dashed var(--border)', background: 'var(--panel2)' }}>
      <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Import repo folder</h3>
          <p className="muted" style={{ margin: 0 }}>
            Uploads a local folder into <code>~/.openclaw/workspace/.clawhub/imports/&lt;projectId&gt;/&lt;repoId&gt;/</code> and generates a starter tree.
          </p>
        </div>
        <div className="right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
            Close
          </button>
          <button className="btn" type="button" onClick={startImport} disabled={busy}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>

      {err && <div className="callout warn">{err}</div>}

      <label className="muted">Repo name</label>
      <input className="input" value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="e.g. web, api, mobile" />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{ marginTop: 10, padding: 14, borderRadius: 10, border: '1px dashed var(--border)', background: 'var(--panel)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <strong>Drop a folder here</strong>
            <div className="muted">Ignored folders: {Array.from(HEAVY_DIRS).join(', ')}</div>
          </div>
          <label className="btn ghost" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
            Pick folder…
            {/* @ts-expect-error webkitdirectory is non-standard */}
            <input type="file" multiple webkitdirectory="true" style={{ display: 'none' }} onChange={onPick} disabled={busy} />
          </label>
        </div>

        <div className="muted" style={{ marginTop: 10 }}>
          {files.length ? (
            <>
              Selected: <strong>{files.length}</strong> files · {(totalBytes / 1_000_000).toFixed(2)} MB
              {progress ? ` · uploaded ${progress.done}/${progress.total}` : ''}
            </>
          ) : (
            'No files selected.'
          )}
        </div>

        {files.length ? (
          <div className="muted" style={{ marginTop: 10, maxHeight: 140, overflow: 'auto', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {files.slice(0, 200).map((f) => (
              <div key={f.relPath} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                {f.relPath}
              </div>
            ))}
            {files.length > 200 ? <div className="muted">…and {files.length - 200} more</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function RepoSection({
  adapter,
  draft,
  setDraft,
}: {
  adapter: Adapter
  draft: IntakeProject
  setDraft: (next: IntakeProject) => void
}) {
  const repos = draft.repos ?? []
  const [activeRepoId, setActiveRepoId] = useState<string | null>(repos[0]?.id ?? null)
  const [showImport, setShowImport] = useState(false)

  const effectiveActiveRepoId = activeRepoId && repos.some((r) => r.id === activeRepoId) ? activeRepoId : repos[0]?.id ?? null
  const activeRepo = repos.find((r) => r.id === effectiveActiveRepoId) ?? null

  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Repositories</h3>
          <p className="muted" style={{ margin: 0 }}>
            Attach one or more repos to this project. Each repo gets its own questions + starter feature tree.
          </p>
        </div>
        <div className="right">{repos.length ? <span className="muted">{repos.length} repo(s)</span> : null}</div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <RepoTabs
          repos={repos}
          activeId={effectiveActiveRepoId}
          onSelect={(id) => setActiveRepoId(id)}
          onAdd={() => setShowImport(true)}
        />

        {showImport ? (
          <RepoImportPanel
            adapter={adapter}
            projectId={draft.id}
            onCancel={() => setShowImport(false)}
            onImported={(nextProject, repoId) => {
              setDraft(nextProject)
              setActiveRepoId(repoId)
              setShowImport(false)
            }}
          />
        ) : null}

        {activeRepo ? (
          <div className="panel" style={{ padding: 14, background: 'var(--panel2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div>
                <h4 style={{ margin: 0 }}>{activeRepo.name}</h4>
                <div className="muted">{activeRepo.analysis?.summary ?? 'Imported repo (analysis pending)'}</div>
              </div>
              <div className="muted" title={activeRepo.updatedAt}>
                updated {fmtAgo(activeRepo.updatedAt)}
              </div>
            </div>

            {activeRepo.analysis?.readmeExcerpt ? (
              <details style={{ marginTop: 10 }}>
                <summary className="muted">README excerpt</summary>
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{activeRepo.analysis.readmeExcerpt}</pre>
              </details>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <h5 style={{ margin: '0 0 6px 0' }}>Repo questions</h5>
              {activeRepo.questions?.length ? (
                <div className="table-like">
                  {activeRepo.questions.map((q) => (
                    <QuestionEditor
                      key={q.id}
                      q={q}
                      on={(nextQ) => {
                        const nextRepo = { ...activeRepo, questions: activeRepo.questions.map((x) => (x.id === q.id ? nextQ : x)) }
                        const nextRepos = repos.map((r) => (r.id === activeRepo.id ? nextRepo : r))
                        setDraft({ ...draft, repos: nextRepos })
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="muted">No repo questions yet. Import a folder to generate them.</div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <h5 style={{ margin: '0 0 6px 0' }}>Repo feature tree</h5>
              <FeatureTreeView nodes={activeRepo.featureTree ?? []} />
            </div>
          </div>
        ) : (
          <div className="muted">No repos attached yet. Click “Add repo”.</div>
        )}
      </div>
    </div>
  )
}

function IntakeDetail({ adapter, id, onBack }: { adapter: Adapter; id: string; onBack: () => void }) {
  const load = useCallback(() => adapter.getIntakeProject(id), [adapter, id])
  const poll = usePoll(load, 10_000)

  const [draft, setDraft] = useState<IntakeProject | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (poll.data) setDraft(poll.data)
  }, [poll.data])

  const dirty = useMemo(() => {
    if (!draft || !poll.data) return false
    return JSON.stringify(draft) !== JSON.stringify(poll.data)
  }, [draft, poll.data])

  const exportMd = useCallback(async () => {
    const md = await adapter.exportIntakeMarkdown(id)
    await navigator.clipboard.writeText(md)
  }, [adapter, id])

  async function save(update?: IntakeProjectUpdate) {
    if (!draft) return
    setSaving(true)
    setActionError(null)
    try {
      const next =
        update !== undefined
          ? await adapter.updateIntakeProject(update)
          : await adapter.updateIntakeProject({
              id: draft.id,
              title: draft.title,
              idea: draft.idea,
              status: draft.status,
              tags: draft.tags,
              questions: draft.questions,
              scope: draft.scope,
              featureTree: draft.featureTree,
              repos: draft.repos,
            })
      setDraft(next)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function runGenerate(kind: 'questions' | 'scope') {
    setSaving(true)
    setActionError(null)
    try {
      const next = kind === 'questions' ? await adapter.generateIntakeQuestions(id) : await adapter.generateIntakeScope(id)
      setDraft(next)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (poll.error) return <div className="callout warn">{poll.error.message}</div>
  if (!draft) return <div className="muted">Loading…</div>

  const json = JSON.stringify(draft, null, 2)

  return (
    <section className="panel span-4">
      <div className="panel-header">
        <div>
          <h2 style={{ marginBottom: 4 }}>{draft.title}</h2>
          <div className="muted" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>
              status: <Badge kind={draft.status} />
            </span>
            <span title={draft.updatedAt}>updated {fmtAgo(draft.updatedAt)}</span>
            <span title={draft.createdAt}>created {fmtAgo(draft.createdAt)}</span>
          </div>
        </div>
        <div className="right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost" type="button" onClick={onBack}>
            Back
          </button>
          <CopyButton text={json} label="Copy JSON" />
          <button className="btn ghost" type="button" onClick={exportMd} title="Copies markdown to clipboard">
            Copy brief.md
          </button>
        </div>
      </div>

      {actionError && <div className="callout warn">{actionError}</div>}

      <div style={{ display: 'grid', gap: 14 }}>
        <RepoSection adapter={adapter} draft={draft} setDraft={setDraft} />
        <div className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <h3 style={{ margin: 0 }}>Idea</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => runGenerate('questions')} disabled={saving}>
                Generate questions
              </button>
              <button className="btn" type="button" onClick={() => runGenerate('scope')} disabled={saving}>
                Generate scope + tree
              </button>
              <button className="btn ghost" type="button" onClick={() => save()} disabled={!dirty || saving}>
                {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>

          <label className="muted" style={{ display: 'block', marginTop: 10 }}>
            Title
          </label>
          <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />

          <label className="muted" style={{ display: 'block', marginTop: 10 }}>
            Idea / problem statement
          </label>
          <textarea
            className="input"
            rows={5}
            value={draft.idea}
            onChange={(e) => setDraft({ ...draft, idea: e.target.value })}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Clarifying questions</h3>
              <p className="muted" style={{ margin: 0 }}>
                Answer what you can; regenerate if the idea changes.
              </p>
            </div>
          </div>

          {!draft.questions.length ? (
            <div className="muted">No questions yet. Click “Generate questions”.</div>
          ) : (
            <div className="table-like">
              {draft.questions.map((q) => (
                <QuestionEditor
                  key={q.id}
                  q={q}
                  on={(next) => {
                    setDraft({ ...draft, questions: draft.questions.map((x) => (x.id === q.id ? next : x)) })
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Scope draft</h3>
              <p className="muted" style={{ margin: 0 }}>
                Edit freely; treat as a v1 boundary contract.
              </p>
            </div>
          </div>

          {!draft.scope ? (
            <div className="muted">No scope yet. Click “Generate scope + tree”.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="muted">Summary</label>
              <textarea
                className="input"
                rows={3}
                value={draft.scope.summary}
                onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope!, summary: e.target.value } })}
                style={{ width: '100%', resize: 'vertical' }}
              />

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="muted">In scope (one per line)</label>
                  <textarea
                    className="input"
                    rows={6}
                    value={fromLines(draft.scope.inScope)}
                    onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope!, inScope: toLines(e.target.value) } })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="muted">Out of scope (one per line)</label>
                  <textarea
                    className="input"
                    rows={6}
                    value={fromLines(draft.scope.outOfScope)}
                    onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope!, outOfScope: toLines(e.target.value) } })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="muted">Assumptions (one per line)</label>
                  <textarea
                    className="input"
                    rows={5}
                    value={fromLines(draft.scope.assumptions)}
                    onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope!, assumptions: toLines(e.target.value) } })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label className="muted">Risks (one per line)</label>
                  <textarea
                    className="input"
                    rows={5}
                    value={fromLines(draft.scope.risks)}
                    onChange={(e) => setDraft({ ...draft, scope: { ...draft.scope!, risks: toLines(e.target.value) } })}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 14 }}>
          <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0 }}>Feature tree</h3>
              <p className="muted" style={{ margin: 0 }}>
                Generated starter breakdown (priorities + acceptance criteria drafts).
              </p>
            </div>
          </div>

          <FeatureTreeView nodes={draft.featureTree ?? []} />
        </div>
      </div>
    </section>
  )
}

const WIREFRAME_KEY = 'tars.operatorHub.projects.wireframe'

function loadWireframe(): boolean {
  try {
    return localStorage.getItem(WIREFRAME_KEY) === '1'
  } catch {
    return false
  }
}

function saveWireframe(v: boolean) {
  try {
    localStorage.setItem(WIREFRAME_KEY, v ? '1' : '0')
  } catch {
    // ignore
  }
}

function makeSampleFeature(id: string, title: string, priority: Priority, children: FeatureNode[] = []): FeatureNode {
  return {
    id,
    title,
    priority,
    description: 'Wireframe: product-level summary of the feature and why it matters.',
    acceptanceCriteria: ['AC1: Behavior is correct', 'AC2: Errors are handled', 'AC3: Telemetry is logged'],
    children,
  }
}

function sampleIntakeProject(): IntakeProject {
  const now = new Date().toISOString()
  return {
    id: 'ios-app',
    title: 'iOS App (imported)',
    idea: 'Nearly complete iOS app — import the repo(s), build feature tree, and manage work through the Hub.',
    status: 'scoped',
    tags: ['ios', 'app'],
    questions: [
      { id: 'q1', category: 'Goal', prompt: 'What is the primary user persona?', required: true, answer: '' },
      { id: 'q2', category: 'Workflow', prompt: 'Describe the happy-path flow end-to-end.', required: true, answer: '' },
    ],
    scope: {
      summary: 'Import + understand existing codebase; manage changes via tasks.',
      inScope: ['Repo import (folder + drag/drop)', 'Feature tree + details', 'Task generation + assignment'],
      outOfScope: ['Full monorepo conversion in v1'],
      assumptions: ['Local single-user usage'],
      risks: ['Large repos may need excludes'],
    },
    featureTree: [
      makeSampleFeature('f-auth', 'Authentication', 'P0', [
        makeSampleFeature('f-auth-login', 'Login', 'P0'),
        makeSampleFeature('f-auth-session', 'Session management', 'P1'),
      ]),
      makeSampleFeature('f-core', 'Core flows', 'P0', [
        makeSampleFeature('f-core-onboarding', 'Onboarding', 'P1'),
        makeSampleFeature('f-core-settings', 'Settings', 'P2'),
      ]),
      makeSampleFeature('f-ops', 'Observability', 'P1', [
        makeSampleFeature('f-ops-logging', 'Structured logging', 'P1'),
        makeSampleFeature('f-ops-metrics', 'Timing + metrics', 'P2'),
      ]),
    ],
    repos: [
      {
        id: 'repo-ios',
        name: 'iOS',
        importPath: '~/.openclaw/workspace/.clawhub/imports/ios-app/repo-ios',
        importedAt: now,
        updatedAt: now,
        questions: [
          { id: 'rq1', category: 'Build', prompt: 'How do we build/test (xcodebuild/fastlane)?', required: false, answer: '' },
        ],
        featureTree: [makeSampleFeature('rf1', 'UI screens', 'P1'), makeSampleFeature('rf2', 'Networking', 'P1')],
        analysis: { summary: 'Detected Swift targets + tests. (wireframe)', readmeExcerpt: 'README excerpt…' },
      },
      {
        id: 'repo-api',
        name: 'Backend',
        importPath: '~/.openclaw/workspace/.clawhub/imports/ios-app/repo-api',
        importedAt: now,
        updatedAt: now,
        questions: [],
        featureTree: [makeSampleFeature('bf1', 'API endpoints', 'P1'), makeSampleFeature('bf2', 'Auth middleware', 'P0')],
        analysis: { summary: 'Detected Node/TS backend. (wireframe)' },
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

function ProjectsWireframe() {
  const [selected] = useState<IntakeProject>(() => sampleIntakeProject())
  const [activeRepoId, setActiveRepoId] = useState<string>(selected.repos?.[0]?.id ?? 'repo-ios')
  const [openFeature, setOpenFeature] = useState<FeatureNode | null>(null)

  const repos: IntakeRepo[] = selected.repos ?? []
  const activeRepo = repos.find((r) => r.id === activeRepoId) ?? repos[0] ?? null

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Projects</h2>
            <p className="muted">Wireframe mode (no data connections).</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          <aside className="panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Projects</strong>
              <button className="btn" type="button">
                New
              </button>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Import repos, define scope, and manage features.
            </div>

            <div className="table-like" style={{ marginTop: 10 }}>
              <div className="row">
                <div className="row-main">
                  <div className="row-title">
                    <strong>{selected.title}</strong>
                    <Badge kind={selected.status} />
                  </div>
                  <div className="muted">{selected.idea}</div>
                </div>
              </div>
            </div>
          </aside>

          <section className="panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>{selected.title}</h2>
                <div className="muted" style={{ marginTop: 4 }}>
                  Multiple repos · feature tree · story-level details
                </div>
              </div>
              <div className="stack-h">
                <button className="btn ghost" type="button">
                  Import codebase…
                </button>
                <button className="btn" type="button">
                  Generate tree
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <div className="panel" style={{ padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Repos</h3>
                <RepoTabs repos={repos} activeId={activeRepoId} onSelect={setActiveRepoId} onAdd={() => null} />
                {activeRepo ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    {activeRepo.analysis?.summary ?? 'Repo summary…'}
                  </div>
                ) : null}
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Feature tree</h3>
                <div className="muted" style={{ marginBottom: 8 }}>
                  Click a feature to open story/product details.
                </div>
                <FeatureTreeView nodes={activeRepo?.featureTree ?? selected.featureTree} onSelect={(n) => setOpenFeature(n)} />
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Clarifying questions</h3>
                <div className="table-like">
                  {(activeRepo?.questions ?? selected.questions).map((q: IntakeQuestion) => (
                    <QuestionEditor key={q.id} q={q} on={() => null} />
                  ))}
                </div>
              </div>

              <div className="panel" style={{ padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>Scope</h3>
                <div className="muted">Summary: {selected.scope?.summary}</div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {openFeature ? <FeatureDetailModal feature={openFeature} onClose={() => setOpenFeature(null)} /> : null}
    </main>
  )
}

export function Projects({ adapter }: { adapter: Adapter }) {
  const [wireframe, setWireframe] = useState(() => loadWireframe())
  const [subtab, setSubtab] = useState<'Workspace' | 'Intake'>('Workspace')
  const [selectedIntake, setSelectedIntake] = useState<string | null>(null)

  const projectsFn = useCallback(() => (wireframe ? Promise.resolve([]) : adapter.listProjects()), [adapter, wireframe])
  const projectsPoll = usePoll(projectsFn, 10_000)

  const intakeFn = useCallback(() => (wireframe ? Promise.resolve([]) : adapter.listIntakeProjects()), [adapter, wireframe])
  const intakePoll = usePoll(intakeFn, 10_000)

  const [createTitle, setCreateTitle] = useState('')
  const [createIdea, setCreateIdea] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function create() {
    setCreateError(null)
    const title = createTitle.trim()
    const idea = createIdea.trim()
    if (!title || !idea) {
      setCreateError('Title and idea are required.')
      return
    }
    setCreating(true)
    try {
      const next = await adapter.createIntakeProject({ title, idea })
      setCreateTitle('')
      setCreateIdea('')
      setSelectedIntake(next.id)
      setSubtab('Intake')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Projects</h2>
            <p className="muted">Workspace projects + PM/PO intake (idea → questions → scope → feature tree).</p>
          </div>
          <div className="right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={`btn ghost ${wireframe ? 'active' : ''}`}
              type="button"
              onClick={() => {
                const next = !wireframe
                setWireframe(next)
                saveWireframe(next)
              }}
              title="Toggle wireframe mode (no data connections)"
            >
              {wireframe ? 'Exit wireframe' : 'Wireframe'}
            </button>
            {!wireframe && (
              <>
                <button className={`btn ghost ${subtab === 'Workspace' ? 'active' : ''}`} type="button" onClick={() => setSubtab('Workspace')}>
                  Workspace
                </button>
                <button className={`btn ghost ${subtab === 'Intake' ? 'active' : ''}`} type="button" onClick={() => setSubtab('Intake')}>
                  Intake
                </button>
              </>
            )}
          </div>
        </div>

        {wireframe && <ProjectsWireframe />}

        {!wireframe && subtab === 'Workspace' && (
          <>
            {projectsPoll.error && <div className="callout warn">{projectsPoll.error.message}</div>}

            <div className="table-like">
              {(projectsPoll.data ?? []).map((p) => {
                const cd = `cd ${p.path}`
                const gitBits = [p.git?.branch ? `on ${p.git.branch}` : null, p.git?.dirty ? 'dirty' : null]
                  .filter(Boolean)
                  .join(' • ')
                const sync =
                  p.git && (typeof p.git.ahead === 'number' || typeof p.git.behind === 'number')
                    ? `↑${p.git.ahead ?? 0} ↓${p.git.behind ?? 0}`
                    : null

                return (
                  <div className="row" key={p.id}>
                    <div className="row-main">
                      <div className="row-title">
                        <strong>{p.name}</strong> <Badge kind={p.status} />
                      </div>

                      <div className="muted" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{p.path}</span>
                        <CopyButton text={cd} label="Copy cd" />
                      </div>

                      {(p.git || p.node?.hasPackageJson || p.notes) && (
                        <div className="muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          {p.git && (
                            <span>
                              git: {gitBits || 'repo'}
                              {sync ? ` (${sync})` : ''}
                              {p.git.lastCommitAt ? ` • last commit ${fmtAgo(p.git.lastCommitAt)}` : ''}
                            </span>
                          )}
                          {p.node?.hasPackageJson && (
                            <span>
                              node: {p.node.packageName ? p.node.packageName : 'package.json'}
                              {p.node.scripts?.length
                                ? ` • scripts: ${p.node.scripts.slice(0, 6).join(', ')}${p.node.scripts.length > 6 ? '…' : ''}`
                                : ''}
                            </span>
                          )}
                          {p.notes && <span>note: {p.notes}</span>}
                        </div>
                      )}
                    </div>

                    <div className="row-side">
                      <div className="muted" title={p.lastUpdatedAt ?? ''}>
                        {p.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!projectsPoll.loading && (projectsPoll.data?.length ?? 0) === 0 && <div className="muted">No projects reported.</div>}
            </div>
          </>
        )}

        {!wireframe && subtab === 'Intake' && (
          <>
            {selectedIntake ? (
              <IntakeDetail
                adapter={adapter}
                id={selectedIntake}
                onBack={() => {
                  setSelectedIntake(null)
                }}
              />
            ) : (
              <>
                {intakePoll.error && <div className="callout warn">{intakePoll.error.message}</div>}

                <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
                  <h3 style={{ marginTop: 0 }}>New intake project</h3>
                  {createError && <div className="callout warn">{createError}</div>}

                  <label className="muted">Title</label>
                  <input className="input" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Self-serve onboarding improvements" />

                  <label className="muted" style={{ display: 'block', marginTop: 10 }}>
                    Idea / problem statement
                  </label>
                  <textarea
                    className="input"
                    rows={4}
                    value={createIdea}
                    onChange={(e) => setCreateIdea(e.target.value)}
                    placeholder="What is the idea? Who is it for? Why now?"
                    style={{ width: '100%', resize: 'vertical' }}
                  />

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn" type="button" onClick={create} disabled={creating}>
                      {creating ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </div>

                <div className="panel" style={{ padding: 14 }}>
                  <div className="panel-header" style={{ padding: 0, marginBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Intake projects</h3>
                      <p className="muted" style={{ margin: 0 }}>
                        Stored locally via bridge-backed files in <code>~/.openclaw/workspace/.clawhub/</code>.
                      </p>
                    </div>
                    <div className="right muted">poll: 10s</div>
                  </div>

                  <div className="table-like">
                    {(intakePoll.data ?? []).map((p) => (
                      <div className="row" key={p.id}>
                        <div className="row-main">
                          <div className="row-title" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn ghost" type="button" onClick={() => setSelectedIntake(p.id)}>
                              Open
                            </button>
                            <strong>{p.title}</strong>
                            <Badge kind={p.status} />
                          </div>
                          <div className="muted">{p.idea.length > 160 ? `${p.idea.slice(0, 157)}…` : p.idea}</div>
                        </div>
                        <div className="row-side">
                          <div className="muted" title={p.updatedAt}>
                            {fmtAgo(p.updatedAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {!intakePoll.loading && (intakePoll.data?.length ?? 0) === 0 && (
                      <div className="muted">No intake projects yet. Create one above.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}
