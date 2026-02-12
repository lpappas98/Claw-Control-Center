import type { Adapter } from '../adapters/adapter'

type ConnectProps = {
  adapter: Adapter
}

export function Connect({ adapter }: ConnectProps) {
  return (
    <main className="main-grid">
      <section className="panel span-4">
        <h2>Local Bridge Connection</h2>
        <p className="muted">
          The Claw Control Center uses a local bridge adapter that reads data directly from your OpenClaw workspace.
        </p>

        <div className="callout info" style={{ marginTop: '2rem' }}>
          <h3>How It Works</h3>
          <ol style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
            <li>The bridge server runs locally on <code>http://localhost:8787</code></li>
            <li>It reads data from <code>~/.openclaw/workspace/</code> JSON files</li>
            <li>Workers appear automatically based on heartbeat files</li>
            <li>No authentication or cloud connection required</li>
          </ol>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Current Adapter</h3>
          <div className="callout" style={{ marginTop: '1rem' }}>
            <strong>Adapter:</strong> {adapter.name}
          </div>
          
          {adapter.name.includes('Bridge') && (
            <div className="callout success" style={{ marginTop: '1rem' }}>
              ✓ Bridge adapter active - reading from local workspace
            </div>
          )}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Setup Instructions</h3>
          <pre className="code" style={{ marginTop: '1rem' }}>
{`# Terminal 1: Start the bridge server
npm run bridge

# Terminal 2: Start the UI dev server
npm run dev

# Your OpenClaw instance will automatically
# write heartbeat files that the bridge reads`}
          </pre>
        </div>
      </section>
    </main>
  )
}
