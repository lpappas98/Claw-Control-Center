import { useMemo, useState } from 'react'
import './App.css'
import { MissionControl } from './pages/MissionControl'
import { Projects } from './pages/Projects'
import { Activity } from './pages/Activity'
import { Config } from './pages/Config'
import { KanbanPage } from './pages/KanbanPage'
import { RecurringTasksPage } from './pages/RecurringTasksPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { SystemStatusPage } from './pages/SystemStatusPage'
import { loadAdapterConfig, toAdapter } from './lib/adapterState'

type NavTab = 'Mission Control' | 'Projects' | 'Activity' | 'Kanban' | 'Recurring' | 'Integrations' | 'System Status' | 'Config' | 'Docs'

const tabs: NavTab[] = ['Mission Control', 'Projects', 'Activity', 'Kanban', 'Recurring', 'Integrations', 'System Status', 'Config', 'Docs']

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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const cfg = useMemo(() => loadAdapterConfig(), [])
  const adapter = useMemo(() => toAdapter(cfg), [cfg])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">Claw Control Center</div>
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
      </header>

      {tab === 'Mission Control' && <MissionControl adapter={adapter} />}
      {tab === 'Projects' && <Projects adapter={adapter} />}
      {tab === 'Activity' && <Activity adapter={adapter} />}
      {tab === 'Kanban' && <KanbanPage selectedAgentId={selectedAgentId} />}
      {tab === 'Recurring' && <RecurringTasksPage />}
      {tab === 'Integrations' && <IntegrationsPage />}
      {tab === 'System Status' && <SystemStatusPage />}
      {tab === 'Config' && <Config adapter={adapter} />}
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
