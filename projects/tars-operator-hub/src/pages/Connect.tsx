import { useState, useEffect } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import type { Adapter } from '../adapters/adapter'

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

interface ConnectionData {
  instanceId: string
  instanceName: string
  connectedAt: string
  lastHeartbeat: string
  status: 'active' | 'idle' | 'offline'
  metadata?: {
    version?: string
    os?: string
    node?: string
  }
}

type ConnectProps = {
  adapter: Adapter
}

export function Connect({ adapter: _adapter }: ConnectProps) {
  const { user } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'generating' | 'waiting' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(300)
  
  // Current connection state
  const [connection, setConnection] = useState<ConnectionData | null>(null)
  const [loadingConnection, setLoadingConnection] = useState(true)

  // Subscribe to connection document
  useEffect(() => {
    if (!user) {
      setLoadingConnection(false)
      return
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid, 'connection', 'current'),
      (snap) => {
        if (snap.exists()) {
          setConnection(snap.data() as ConnectionData)
        } else {
          setConnection(null)
        }
        setLoadingConnection(false)
      },
      (err) => {
        console.error('Connection subscription error:', err)
        setLoadingConnection(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  // Generate a new connection token
  const generateConnectionToken = async () => {
    if (!user) return
    
    setTokenStatus('generating')
    setError(null)
    
    try {
      const newToken = generateToken()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
      
      await setDoc(doc(db, 'connectionTokens', newToken), {
        token: newToken,
        userId: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        used: false,
      })
      
      setToken(newToken)
      setTokenStatus('waiting')
      setCountdown(300)
    } catch (err: unknown) {
      console.error('Failed to generate token:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate connection token')
      setTokenStatus('error')
    }
  }

  // Listen for token usage
  useEffect(() => {
    if (!token || tokenStatus !== 'waiting') return

    const unsubscribe = onSnapshot(doc(db, 'connectionTokens', token), (snap) => {
      if (!snap.exists()) {
        setTokenStatus('error')
        setError('Token expired or removed')
        return
      }
      
      const data = snap.data()
      
      if (data.used && data.instanceId) {
        setTokenStatus('connected')
        // Connection will be picked up by the connection subscription
        setTimeout(() => {
          setToken(null)
          setTokenStatus('idle')
        }, 3000)
      } else if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        setTokenStatus('error')
        setError('Connection token expired')
      }
    })

    return () => unsubscribe()
  }, [token, tokenStatus])

  // Countdown timer
  useEffect(() => {
    if (tokenStatus !== 'waiting') return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTokenStatus('error')
          setError('Connection token expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [tokenStatus])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const resetConnection = () => {
    setToken(null)
    setTokenStatus('idle')
    setError(null)
    setCountdown(300)
  }

  const handleDisconnect = async () => {
    if (!user || !connection) return
    
    if (confirm('Are you sure you want to disconnect this instance?')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'connection', 'current'))
      } catch (err) {
        console.error('Failed to disconnect:', err)
        alert('Failed to disconnect instance')
      }
    }
  }

  const formatTimeAgo = (isoString: string) => {
    const ms = Date.now() - new Date(isoString).getTime()
    if (ms < 60000) return 'just now'
    if (ms < 3600000) return `${Math.floor(ms / 60000)} minutes ago`
    if (ms < 86400000) return `${Math.floor(ms / 3600000)} hours ago`
    return new Date(isoString).toLocaleDateString()
  }

  const getStatusColor = (status: string, lastHeartbeat: string) => {
    const ageMs = Date.now() - new Date(lastHeartbeat).getTime()
    if (ageMs > 5 * 60 * 1000) return 'sev-high' // Offline if no heartbeat in 5 min
    if (status === 'active') return 'sev-low'
    if (status === 'idle') return 'sev-med'
    return 'sev-high'
  }

  const getDisplayStatus = (status: string, lastHeartbeat: string) => {
    const ageMs = Date.now() - new Date(lastHeartbeat).getTime()
    if (ageMs > 5 * 60 * 1000) return 'Offline'
    if (status === 'active') return 'Online'
    if (status === 'idle') return 'Idle'
    return 'Offline'
  }

  if (!user) {
    return (
      <main className="main-grid">
        <section className="panel span-4">
          <div className="panel-header">
            <h2>Connect OpenClaw Instance</h2>
            <p className="muted">Please log in to connect your OpenClaw instance</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main-grid">
      <section className="panel span-4">
        <div className="panel-header">
          <div>
            <h2>Connect OpenClaw Instance</h2>
            <p className="muted">Link your OpenClaw AI to this dashboard</p>
          </div>
        </div>

        {/* Show current connection */}
        {!loadingConnection && connection && (
          <div className="connection-status" style={{ marginBottom: '2rem' }}>
            <div className="connection-card" style={{
              background: 'var(--bg-card)',
              borderRadius: '8px',
              padding: '1.5rem',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🤖</span>
                  <div>
                    <h3 style={{ margin: 0 }}>{connection.instanceName}</h3>
                    <span className={`pill ${getStatusColor(connection.status, connection.lastHeartbeat)}`}>
                      {getDisplayStatus(connection.status, connection.lastHeartbeat)}
                    </span>
                  </div>
                </div>
                <button className="btn ghost" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </div>
              
              <div className="connection-details" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                fontSize: '0.9rem'
              }}>
                <div>
                  <div className="muted">Connected</div>
                  <div>{new Date(connection.connectedAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="muted">Last Heartbeat</div>
                  <div>{formatTimeAgo(connection.lastHeartbeat)}</div>
                </div>
                {connection.metadata?.version && (
                  <div>
                    <div className="muted">Version</div>
                    <div>{connection.metadata.version}</div>
                  </div>
                )}
                {connection.metadata?.os && (
                  <div>
                    <div className="muted">Platform</div>
                    <div>{connection.metadata.os} • Node {connection.metadata.node}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Show connection flow if not connected */}
        {!loadingConnection && !connection && (
          <div className="connect-content">
            {tokenStatus === 'idle' && (
              <div className="connect-start">
                <div className="connect-icon">🔗</div>
                <h3>Ready to Connect</h3>
                <p className="muted">
                  Generate a connection code, then tell your OpenClaw instance to connect using this code.
                </p>
                <button className="btn" onClick={generateConnectionToken}>
                  Generate Connection Code
                </button>
              </div>
            )}

            {tokenStatus === 'generating' && (
              <div className="connect-loading">
                <div className="connect-spinner">⏳</div>
                <p className="muted">Generating connection code...</p>
              </div>
            )}

            {tokenStatus === 'waiting' && token && (
              <div className="connect-waiting">
                <div className="connect-icon">📡</div>
                <h3>Waiting for Connection</h3>
                
                <div className="connect-token-display">
                  <div className="connect-token-label">Connection Code</div>
                  <div className="connect-token">{token}</div>
                  <div className="connect-token-timer">Expires in {formatCountdown(countdown)}</div>
                </div>

                <div className="connect-instructions">
                  <h4>Tell your OpenClaw:</h4>
                  <pre className="code connect-command">
                    Connect to Claw Control Center with code: {token}
                  </pre>
                  <p className="muted">
                    Your OpenClaw will use this code to securely link to your account.
                  </p>
                </div>

                <button className="btn ghost" onClick={resetConnection}>
                  Cancel
                </button>
              </div>
            )}

            {tokenStatus === 'connected' && (
              <div className="connect-success">
                <div className="connect-icon success">✅</div>
                <h3>Successfully Connected!</h3>
                <p className="muted">
                  Your instance is now linked. Check Mission Control to see it in action!
                </p>
              </div>
            )}

            {tokenStatus === 'error' && (
              <div className="connect-error">
                <div className="connect-icon error">❌</div>
                <h3>Connection Failed</h3>
                <p className="muted">{error || 'Something went wrong'}</p>
                <button className="btn" onClick={resetConnection}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {loadingConnection && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="muted">Loading connection status...</p>
          </div>
        )}
      </section>
    </main>
  )
}
