import { useMemo } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { NavBar } from './components/NavBar'
import { MissionControl } from './pages/MissionControl'
import ProjectsPage from './pages/Projects'
import { FeatureDetailPage } from './pages/FeatureDetailPage'
import { Activity } from './pages/Activity'
import { Config } from './pages/Config'
import { KanbanPage } from './pages/KanbanPage'
import { RecurringTasksPage } from './pages/RecurringTasksPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { SystemStatusPage } from './pages/SystemStatusPage'
import { loadAdapterConfig, toAdapter } from './lib/adapterState'

function AppContent() {
  const [selectedAgentId] = [null] as const

  const cfg = useMemo(() => loadAdapterConfig(), [])
  const adapter = useMemo(() => toAdapter(cfg), [cfg])

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: '#080c16', color: '#e2e8f0', fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>
      <NavBar />
      <Routes>
        <Route path="/projects/:projectId/features/:featureId" element={<FeatureDetailPage />} />
        <Route path="/projects/:projectId" element={<ProjectsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/activity" element={<Activity adapter={adapter} />} />
        <Route path="/kanban" element={<KanbanPage selectedAgentId={selectedAgentId} />} />
        <Route path="/recurring" element={<RecurringTasksPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/system" element={<SystemStatusPage />} />
        <Route path="/config" element={<Config adapter={adapter} />} />
        <Route path="/docs" element={
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
        } />
        <Route path="/" element={<MissionControl adapter={adapter} />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
