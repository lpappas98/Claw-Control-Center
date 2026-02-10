import { useCallback, useMemo, useState } from 'react'
import './App.css'
import { MissionControl } from './pages/MissionControl'
import { Projects } from './pages/Projects'
import { Activity } from './pages/Activity'
import { Rules } from './pages/Rules'
import { loadAdapterConfig, saveAdapterConfig, toAdapter, type AdapterConfig } from './lib/adapterState'

type NavTab = 'Mission Control' | 'Projects' | 'Activity' | 'Rules' | 'Docs'

const tabs: NavTab[] = ['Mission Control', 'Projects', 'Activity', 'Rules', 'Docs']

const NAV_TAB_KEY = 'tars.operatorHub.navTab'

function loadNavTab(): NavTab {
  try {
    const raw = localStorage.getItem(NAV_TAB_KEY)
    if (raw && (tabs as readonly string[]).includes(raw)) return raw as NavTab
  } catch {
    // ignore storage errors (private mode, disabled, etc.)
  }
  return 'Mission Control'
}

function saveNavTab(tab: NavTab) {
  try {
    localStorage.setItem(NAV_TAB_KEY, tab)
  } catch {
    // ignore
  }
}

export default function App() {
  const [tab, setTab] = useState<NavTab>(() => loadNavTab())
  const [cfg, setCfg] = useState<AdapterConfig>(() => loadAdapterConfig())

  const adapter = useMemo(() => toAdapter(cfg), [cfg])

  const updateCfg = useCallback((next: AdapterConfig) => {
    setCfg(next)
    saveAdapterConfig(next)
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">TARS Operator Hub</div>
          <div className="brand-sub">single-user local mode</div>
        </div>

        <nav className="nav-tabs" aria-label="Primary">
          {tabs.map((t) => (
            <button
              className={`tab ${t === tab ? 'active' : ''}`}
              key={t}
              onClick={() => {
                setTab(t)
                saveNavTab(t)
              }}
              type="button"
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <div className="adapter-pill" title="Data source adapter">
            <span className="muted">Adapter:</span> <strong>{adapter.name}</strong>
          </div>
          <button
            className="btn ghost"
            onClick={() => {
              if (cfg.kind === 'bridge') updateCfg({ kind: 'mock' })
              else updateCfg({ kind: 'bridge', baseUrl: 'http://localhost:8787' })
            }}
            type="button"
            title="Toggle between mock data and local bridge"
          >
            Toggle
          </button>
        </div>
      </header>

      {tab === 'Mission Control' && <MissionControl adapter={adapter} cfg={cfg} onCfg={updateCfg} />}
      {tab === 'Projects' && <Projects adapter={adapter} />}
      {tab === 'Activity' && <Activity adapter={adapter} />}
      {tab === 'Rules' && <Rules adapter={adapter} />}
      {tab === 'Docs' && (
        <main className="main-grid">
          <section className="panel span-4">
            <h2>Docs</h2>
            <p className="muted">
              Run the optional local bridge for live status + controls.
            </p>
            <pre className="code">
              {`# terminal 1\ncd ~/.openclaw/workspace/projects/tars-operator-hub\nnpm run bridge\n\n# terminal 2\ncd ~/.openclaw/workspace/projects/tars-operator-hub\nnpm run dev\n`}
            </pre>
            <p className="muted">Bridge defaults to http://localhost:8787</p>
          </section>
        </main>
      )}
    </div>
  )
}
