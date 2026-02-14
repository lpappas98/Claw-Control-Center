import { useEffect, useMemo, useState } from 'react'
import type { Adapter } from '../adapters/adapter'
import type { ModelInfo } from '../types'
import { Button } from '@/components/ui/button'

function isGpt(m: ModelInfo) {
  const key = (m.key ?? '').toLowerCase()
  const name = (m.name ?? '').toLowerCase()
  return key.includes('gpt') || name.includes('gpt')
}

export function Config({ adapter }: { adapter: Adapter }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [pending, setPending] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await adapter.listModels()
      setModels(res.models ?? [])
      setDefaultModel(res.defaultModel ?? '')
      setPending(res.defaultModel ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter])

  const gptModels = useMemo(() => models.filter(isGpt).filter((m) => m.available !== false), [models])

  const dirty = pending && pending !== defaultModel

  async function save() {
    setSaving(true)
    setSavedMsg(null)
    setError(null)
    try {
      const res = await adapter.setDefaultModel(pending)
      if (!res.ok) throw new Error(res.message || 'model update failed')
      setDefaultModel(res.defaultModel ?? pending)
      setPending(res.defaultModel ?? pending)
      setSavedMsg(res.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Config</h2>
            <div className="muted">Instance settings (local). Model changes affect new runs.</div>
          </div>
          <div className="stack-h">
            <Button variant="ghost" type="button" onClick={refresh} disabled={loading || saving}>
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="callout warn">
            <strong>Config error:</strong> {error}
          </div>
        )}
        {savedMsg && <div className="callout">{savedMsg}</div>}

        <div className="stack">
          <div className="stat-card">
            <div className="stat-title">Default model</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {defaultModel || (loading ? 'loading…' : '—')}
            </div>
          </div>

          <label className="field">
            <div className="muted">Choose model (GPT)</div>
            <select value={pending} onChange={(e) => setPending(e.target.value)} disabled={loading || saving}>
              {gptModels.length === 0 && <option value="">No GPT models available</option>}
              {gptModels.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name ? `${m.name} — ${m.key}` : m.key}
                </option>
              ))}
            </select>
          </label>

          <div className="stack-h">
            <Button variant="default" type="button" onClick={save} disabled={!dirty || saving || loading}>
              {saving ? 'Applying…' : 'Apply model'}
            </Button>
            <div className="muted" style={{ fontSize: 12 }}>
              Tip: if a model hits rate limits, switch to another GPT entry here.
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
