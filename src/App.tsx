import { useCallback, useMemo, useState } from 'react'
import './App.css'
import { MissionControl } from './pages/MissionControl'
import { Projects } from './pages/Projects'
import { Activity } from './pages/Activity'
import { Rules } from './pages/Rules'
import { Config } from './pages/Config'
import { Connect } from './pages/Connect'
import { loadAdapterConfig, saveAdapterConfig, toAdapter, type AdapterConfig } from './lib/adapterState'

type NavTab = 'Mission Control' | 'Projects' | 'Activity' | 'Rules' | 'Config' | 'Connect' | 'Docs'

const tabs: NavTab[] = ['Mission Control', 'Projects', 'Activity', 'Rules', 'Config', 'Connect', 'Docs']

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
          <div className="brand-title">Claw Control Center</div>
          <div className="brand-sub">Operator Hub</div>
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
      </header>

      {tab === 'Mission Control' && <MissionControl adapter={adapter} cfg={cfg} onCfg={updateCfg} />}
      {tab === 'Projects' && <Projects adapter={adapter} />}
      {tab === 'Activity' && <Activity adapter={adapter} />}
      {tab === 'Rules' && <Rules adapter={adapter} />}
      {tab === 'Config' && <Config adapter={adapter} />}
      {tab === 'Connect' && <Connect adapter={adapter} />}
      {tab === 'Docs' && (
        <main className="main-grid">
          <section className="panel span-4">
            <h2>Docs</h2>
            <p className="muted">
              Connect your OpenClaw instance to this hub.
            </p>
            <pre className="code">
              {`# In your OpenClaw chat, say:\n"Connect to Claw Control Center"\n\n# The bot will guide you through the connection process.`}
            </pre>
          </section>
        </main>
      )}
    </div>
  )
}
