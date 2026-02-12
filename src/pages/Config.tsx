import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { ModelInfo, Rule, RuleChange } from '../types'
import { CopyButton } from '../components/CopyButton'

function isGpt(m: ModelInfo) {
  const key = (m.key ?? '').toLowerCase()
  const name = (m.name ?? '').toLowerCase()
  return key.includes('gpt') || name.includes('gpt')
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function Config({ adapter }: { adapter: Adapter }) {
  const [tab, setTab] = useState<'models' | 'rules'>('models')

  // Model state
  const [modelLoading, setModelLoading] = useState(true)
  const [modelError, setModelError] = useState<string | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [pending, setPending] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Rules state
  const [rules, setRules] = useState<Rule[] | null>(null)
  const [history, setHistory] = useState<RuleChange[] | null>(null)
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createId, setCreateId] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createContent, setCreateContent] = useState('')
  const [createEnabled, setCreateEnabled] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => (rules ?? []).find((r) => r.id === selectedId) ?? null, [rules, selectedId])

  const [draftTitle, setDraftTitle] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftContent, setDraftContent] = useState('')

  async function refreshModels() {
    setModelLoading(true)
    setModelError(null)
    try {
      const res = await adapter.listModels()
      setModels(res.models ?? [])
      setDefaultModel(res.defaultModel ?? '')
      setPending(res.defaultModel ?? '')
    } catch (e) {
      setModelError(e instanceof Error ? e.message : String(e))
    } finally {
      setModelLoading(false)
    }
  }

  useEffect(() => {
    refreshModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter])

  const gptModels = useMemo(() => models.filter(isGpt).filter((m) => m.available !== false), [models])

  const dirty = pending && pending !== defaultModel

  async function saveModel() {
    setSaving(true)
    setSavedMsg(null)
    setModelError(null)
    try {
      const res = await adapter.setDefaultModel(pending)
      if (!res.ok) throw new Error(res.message || 'model update failed')
      setDefaultModel(res.defaultModel ?? pending)
      setPending(res.defaultModel ?? pending)
      setSavedMsg(res.message)
    } catch (e) {
      setModelError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const refreshRules = useCallback(async () => {
    setRulesLoading(true)
    setRulesError(null)
    try {
      const [r, h] = await Promise.all([adapter.listRules(), adapter.listRuleHistory(200)])
      setRules(r)
      setHistory(h)
      if (!selectedId && r.length) setSelectedId(r[0].id)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e))
    } finally {
      setRulesLoading(false)
    }
  }, [adapter, selectedId])

  useEffect(() => {
    if (tab === 'rules') {
      refreshRules()
    }
  }, [tab, refreshRules])

  useEffect(() => {
    if (!selected) return
    setDraftTitle(selected.title)
    setDraftDesc(selected.description ?? '')
    setDraftContent(selected.content)
  }, [selected])

  async function toggleRule(rule: Rule) {
    setBusyId(rule.id)
    setRulesError(null)
    try {
      const updated = await adapter.toggleRule(rule.id, !rule.enabled)
      setRules((prev) => (prev ? prev.map((r) => (r.id === rule.id ? updated : r)) : prev))
      const h = await adapter.listRuleHistory(200)
      setHistory(h)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function saveRule() {
    if (!selected) return
    setBusyId(selected.id)
    setRulesError(null)
    try {
      const updated = await adapter.updateRule({
        id: selected.id,
        title: draftTitle,
        description: draftDesc,
        content: draftContent,
      })
      setRules((prev) => (prev ? prev.map((r) => (r.id === selected.id ? updated : r)) : prev))
      const h = await adapter.listRuleHistory(200)
      setHistory(h)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function createRule() {
    if (!createTitle.trim()) return
    setBusyId('__create__')
    setRulesError(null)
    try {
      const next = await adapter.createRule({
        id: createId.trim() || undefined,
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        content: createContent,
        enabled: createEnabled,
      })
      setRules((prev) => (prev ? [...prev, next] : [next]))
      setSelectedId(next.id)
      setCreateId('')
      setCreateTitle('')
      setCreateDesc('')
      setCreateContent('')
      setCreateEnabled(true)
      setCreateOpen(false)
      const h = await adapter.listRuleHistory(200)
      setHistory(h)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function removeSelected() {
    if (!selected) return
    if (!confirm(`Delete rule "${selected.title}" (${selected.id})? This cannot be undone.`)) return
    setBusyId(selected.id)
    setRulesError(null)
    try {
      await adapter.deleteRule(selected.id)
      setRules((prev) => {
        const remaining = prev ? prev.filter((r) => r.id !== selected.id) : prev
        setSelectedId((sel) => {
          if (sel !== selected.id) return sel
          return remaining && remaining.length ? remaining[0].id : null
        })
        return remaining
      })
      const h = await adapter.listRuleHistory(200)
      setHistory(h)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const ruleDirty = !!selected && (draftTitle !== selected.title || draftDesc !== (selected.description ?? '') || draftContent !== selected.content)

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Configuration</h2>
            <nav className="stack-h" style={{ marginTop: '1rem', gap: '0.5rem' }}>
              <button 
                className={`btn ${tab === 'models' ? '' : 'ghost'}`} 
                onClick={() => setTab('models')}
              >
                Model Settings
              </button>
              <button 
                className={`btn ${tab === 'rules' ? '' : 'ghost'}`} 
                onClick={() => setTab('rules')}
              >
                Rules
              </button>
            </nav>
          </div>
        </div>

        {tab === 'models' && (
          <div className="stack">
            <div className="panel-header">
              <div>
                <h3>Model Settings</h3>
                <div className="muted">Instance settings (local). Model changes affect new runs.</div>
              </div>
              <div className="stack-h">
                <button className="btn ghost" type="button" onClick={refreshModels} disabled={modelLoading || saving}>
                  Refresh
                </button>
              </div>
            </div>

            {modelError && (
              <div className="callout warn">
                <strong>Config error:</strong> {modelError}
              </div>
            )}
            {savedMsg && <div className="callout">{savedMsg}</div>}

            <div className="stack">
              <div className="stat-card">
                <div className="stat-title">Default model</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {defaultModel || (modelLoading ? 'loading…' : '—')}
                </div>
              </div>

              <label className="field">
                <div className="muted">Choose model (available models only)</div>
                <select value={pending} onChange={(e) => setPending(e.target.value)} disabled={modelLoading || saving}>
                  {gptModels.length === 0 && <option value="">No models available</option>}
                  {gptModels.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name ? `${m.name} — ${m.key}` : m.key}
                    </option>
                  ))}
                </select>
              </label>

              <div className="stack-h">
                <button className="btn" type="button" onClick={saveModel} disabled={!dirty || saving || modelLoading}>
                  {saving ? 'Applying…' : 'Apply model'}
                </button>
                <div className="muted" style={{ fontSize: 12 }}>
                  Tip: if a model hits rate limits, switch to another entry here.
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'rules' && (
          <>
            <section className="panel span-2" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <div className="panel-header">
                <div>
                  <h3>Rules</h3>
                  <p className="muted">
                    View, add, delete, toggle, and edit operator rules. Rules are read by the PM agent and enforced automatically.
                  </p>
                </div>
                <div className="right stack-h">
                  <button className="btn" onClick={() => setCreateOpen((v) => !v)} type="button" disabled={rulesLoading}>
                    {createOpen ? 'Close' : 'New rule'}
                  </button>
                  <button className="btn ghost" onClick={refreshRules} type="button" disabled={rulesLoading}>
                    {rulesLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>

              {createOpen && (
                <div className="callout">
                  <div className="stack">
                    <div className="stack-h" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Create rule</strong>
                      <button className="btn" type="button" onClick={createRule} disabled={busyId === '__create__' || !createTitle.trim()}>
                        {busyId === '__create__' ? 'Creating…' : 'Create'}
                      </button>
                    </div>

                    <label className="field">
                      <div className="muted">ID (optional)</div>
                      <input value={createId} onChange={(e) => setCreateId(e.target.value)} placeholder="leave blank to auto-generate" />
                    </label>

                    <label className="field">
                      <div className="muted">Title</div>
                      <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} />
                    </label>

                    <label className="field">
                      <div className="muted">Description</div>
                      <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} placeholder="optional" />
                    </label>

                    <label className="field">
                      <div className="muted">Body</div>
                      <textarea value={createContent} onChange={(e) => setCreateContent(e.target.value)} rows={8} />
                    </label>

                    <label className="field">
                      <div className="muted">Status</div>
                      <select value={createEnabled ? 'enabled' : 'disabled'} onChange={(e) => setCreateEnabled(e.target.value === 'enabled')}>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {rulesError && (
                <div className="callout warn">
                  <strong>Rules error:</strong> {rulesError}
                </div>
              )}

              <div className="table-like">
                {(rules ?? []).map((r) => (
                  <div className="row" key={r.id}>
                    <div className="row-main">
                      <div className="row-title">
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: '4px 8px' }}
                          onClick={() => setSelectedId(r.id)}
                          title={r.id}
                        >
                          <strong>{r.title}</strong>
                        </button>
                        <span className={`pill ${r.enabled ? 'sev-low' : ''}`} title={r.enabled ? 'enabled' : 'disabled'}>
                          {r.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="muted">{r.description ?? '—'}</div>
                    </div>
                    <div className="row-side">
                      <div className="muted">updated: {fmtWhen(r.updatedAt)}</div>
                      <button className="btn" type="button" onClick={() => toggleRule(r)} disabled={busyId === r.id}>
                        {busyId === r.id ? 'Working…' : r.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                ))}
                {!rulesLoading && (rules?.length ?? 0) === 0 && <div className="muted">No rules configured.</div>}
              </div>
            </section>

            <section className="panel span-2" style={{ gridColumn: 'span 2' }}>
              <div className="panel-header">
                <div>
                  <h3>Rule editor</h3>
                  <p className="muted">Edit the selected rule (title/description/body). Changes are recorded in history.</p>
                </div>
              </div>

              {!selected && <div className="muted">Select a rule to edit.</div>}

              {selected && (
                <div className="stack">
                  <div className="stack-h" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="muted">
                      id: <code>{selected.id}</code>
                    </div>
                    <div className="stack-h">
                      <button className="btn" type="button" onClick={removeSelected} disabled={busyId === selected.id}>
                        Delete
                      </button>
                      <CopyButton text={selected.content} label="Copy body" />
                      <button className="btn" type="button" disabled={!ruleDirty || busyId === selected.id} onClick={saveRule}>
                        {busyId === selected.id ? 'Saving…' : ruleDirty ? 'Save' : 'Saved'}
                      </button>
                    </div>
                  </div>

                  <label className="field">
                    <div className="muted">Title</div>
                    <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                  </label>

                  <label className="field">
                    <div className="muted">Description</div>
                    <input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder="optional" />
                  </label>

                  <label className="field">
                    <div className="muted">Body</div>
                    <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} rows={14} />
                  </label>

                  <div className="muted" style={{ fontSize: 12 }}>
                    last updated: {fmtWhen(selected.updatedAt)} · status: {selected.enabled ? 'enabled' : 'disabled'}
                  </div>
                </div>
              )}
            </section>

            <section className="panel span-4" style={{ gridColumn: 'span 4' }}>
              <div className="panel-header">
                <div>
                  <h3>Change history</h3>
                  <p className="muted">Most recent rule changes (toggle + edits).</p>
                </div>
              </div>

              <div className="table-like">
                {(history ?? []).map((h) => (
                  <div className="row" key={h.id}>
                    <div className="row-main">
                      <div className="row-title">
                        <strong>{h.action}</strong>
                        <span className="muted">· {h.summary}</span>
                      </div>
                      <div className="muted">
                        rule: <code>{h.ruleId}</code> · {fmtWhen(h.at)}
                        {h.source ? ` · ${h.source}` : ''}
                      </div>
                    </div>
                    <div className="row-side">
                      <details>
                        <summary className="muted">diff</summary>
                        <pre className="code">{JSON.stringify({ before: h.before, after: h.after }, null, 2)}</pre>
                      </details>
                    </div>
                  </div>
                ))}
                {!rulesLoading && (history?.length ?? 0) === 0 && <div className="muted">No history yet.</div>}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}
