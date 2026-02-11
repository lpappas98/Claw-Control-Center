import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import { usePoll } from '../lib/usePoll'
import { Badge } from '../components/Badge'
import { CopyButton } from '../components/CopyButton'
import type { FeatureNode, IntakeProject, IntakeProjectUpdate, IntakeQuestion } from '../types'

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

function FeatureTreeView({ nodes }: { nodes: FeatureNode[] }) {
  if (!nodes.length) return <div className="muted">No feature tree yet.</div>

  const walk = (n: FeatureNode, depth: number) => {
    return (
      <div key={n.id} style={{ marginLeft: depth ? depth * 12 : 0, paddingLeft: depth ? 12 : 0, borderLeft: depth ? '1px solid var(--border)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>{n.title}</strong>
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

export function Projects({ adapter }: { adapter: Adapter }) {
  const [subtab, setSubtab] = useState<'Workspace' | 'Intake'>('Workspace')
  const [selectedIntake, setSelectedIntake] = useState<string | null>(null)

  const projectsFn = useCallback(() => adapter.listProjects(), [adapter])
  const projectsPoll = usePoll(projectsFn, 10_000)

  const intakeFn = useCallback(() => adapter.listIntakeProjects(), [adapter])
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
          <div className="right" style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ghost ${subtab === 'Workspace' ? 'active' : ''}`} type="button" onClick={() => setSubtab('Workspace')}>
              Workspace
            </button>
            <button className={`btn ghost ${subtab === 'Intake' ? 'active' : ''}`} type="button" onClick={() => setSubtab('Intake')}>
              Intake
            </button>
          </div>
        </div>

        {subtab === 'Workspace' && (
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

        {subtab === 'Intake' && (
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
