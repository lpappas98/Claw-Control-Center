import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = ['Mission Control', 'Projects', 'Activity', 'Kanban', 'System', 'Config'] as const

const routeMap: Record<typeof NAV_ITEMS[number], string> = {
  'Mission Control': '/',
  'Projects': '/projects',
  'Activity': '/activity',
  'Kanban': '/kanban',
  'System': '/system',
  'Config': '/config',
}

const reverseRouteMap: Record<string, typeof NAV_ITEMS[number]> = {}
for (const [name, path] of Object.entries(routeMap)) {
  reverseRouteMap[path] = name as typeof NAV_ITEMS[number]
}

export function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine active nav from current path
  const activeNav = reverseRouteMap[location.pathname] ??
    (location.pathname.startsWith('/projects') ? 'Projects' : 'Mission Control')

  return (
    <header style={{
      borderBottom: '1px solid rgba(30,41,59,0.7)',
      background: 'rgba(8,12,22,0.95)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32, flexShrink: 0 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Claw Control</span>
          <span style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>local</span>
        </div>
        <nav style={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1 }}>
          {NAV_ITEMS.map(n => (
            <button
              key={n}
              onClick={() => navigate(routeMap[n])}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                background: activeNav === n ? 'rgba(30,41,59,0.7)' : 'transparent',
                color: activeNav === n ? '#f1f5f9' : '#64748b',
                transition: 'all 0.15s',
                fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {n}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
