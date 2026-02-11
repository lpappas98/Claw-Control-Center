import { useState, useEffect } from 'react'
import { doc, setDoc, serverTimestamp, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'
import type { Adapter } from '../adapters/adapter'
import type { ConnectedInstance } from '../types'

function generateToken(): string {
  // Generate a 6-character alphanumeric token (easy to type/say)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars (0,O,1,I)
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

type ConnectProps = {
  adapter: Adapter
}

export function Connect({ adapter }: ConnectProps) {
  const { user } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'generating' | 'waiting' | 'connected' | 'error'>('idle')
  const [connectedInstance, setConnectedInstance] = useState<{ name: string; url?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(300) // 5 minutes
  const [connectedInstances, setConnectedInstances] = useState<ConnectedInstance[]>([])
  const [loadingInstances, setLoadingInstances] = useState(true)

  // Load connected instances
  useEffect(() => {
    if (!user || adapter.name !== 'firestore') return
    
    const loadInstances = async () => {
      try {
        const instances = await adapter.listConnectedInstances()
        setConnectedInstances(instances)
      } catch (err) {
        console.error('Failed to load connected instances:', err)
      } finally {
        setLoadingInstances(false)
      }
    }
    
    loadInstances()
    const interval = setInterval(loadInstances, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [user, adapter])

  // Generate a new connection token
  const generateConnectionToken = async () => {
    if (!user || adapter.name !== 'firestore') return
    
    setTokenStatus('generating')
    setError(null)
    
    try {
      const newToken = generateToken()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      
      // Write to global connectionTokens collection for validation
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
    } catch (err: any) {
      console.error('Failed to generate token:', err)
      setError(err.message || 'Failed to generate connection token')
      setTokenStatus('error')
    }
  }

  // Listen for token usage (when OpenClaw connects)
  useEffect(() => {
    if (!token || tokenStatus !== 'waiting' || !user) return

    const unsubscribe = onSnapshot(doc(db, 'connectionTokens', token), async (snap) => {
      if (!snap.exists()) {
        setTokenStatus('error')
        setError('Token expired or removed')
        return
      }
      
      const data = snap.data()
      
      // Check if OpenClaw has marked the token as used (with instance info)
      if (data.used && data.instanceName) {
        setTokenStatus('connected')
        
        // Create the connectedInstance document (we have auth!)
        const instanceId = data.instanceId || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
        const now = new Date().toISOString()
        
        const instanceData: ConnectedInstance = {
          id: instanceId,
          userId: user.uid,
          name: data.instanceName,
          connectedAt: now,
          lastSeenAt: now,
          status: 'active',
          metadata: data.instanceMetadata || {},
        }
        
        try {
          // Write the connected instance to user's collection
          await setDoc(
            doc(db, 'users', user.uid, 'connectedInstances', instanceId),
            instanceData
          )
          
          // Update token with the instanceId if not already set
          if (!data.instanceId) {
            await setDoc(doc(db, 'connectionTokens', token), { instanceId }, { merge: true })
          }
          
          setConnectedInstance({
            name: instanceData.name,
            url: instanceData.metadata?.version,
          })
          
          // Refresh the instances list
          if (adapter.name === 'firestore') {
            const instances = await adapter.listConnectedInstances()
            setConnectedInstances(instances)
          }
        } catch (err) {
          console.error('Failed to create connected instance:', err)
        }
        
        // Auto-reset after 3 seconds to show the connected instances list
        setTimeout(() => {
          resetConnection()
        }, 3000)
      } else if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        setTokenStatus('error')
        setError('Connection token expired')
      }
    })

    return () => unsubscribe()
  }, [token, tokenStatus, adapter, user])

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
    setConnectedInstance(null)
    setError(null)
    setCountdown(300)
  }

  const handleDisconnect = async (instanceId: string) => {
    if (adapter.name !== 'firestore') return
    
    if (confirm('Are you sure you want to disconnect this instance?')) {
      try {
        await adapter.disconnectInstance(instanceId)
        const instances = await adapter.listConnectedInstances()
        setConnectedInstances(instances)
      } catch (err) {
        console.error('Failed to disconnect instance:', err)
        alert('Failed to disconnect instance')
      }
    }
  }

  if (adapter.name !== 'firestore') {
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

        {/* Show connected instances at the top (always visible) */}
        {!loadingInstances && connectedInstances.length > 0 && (
          <div className="connected-instances" style={{ marginBottom: '2rem' }}>
            <h3>Connected Instances ({connectedInstances.length})</h3>
            <div className="table-like">
              {connectedInstances.map((instance) => {
                const now = Date.now()
                const lastSeen = new Date(instance.lastSeenAt).getTime()
                const ageMinutes = Math.floor((now - lastSeen) / 60000)
                const isOnline = ageMinutes < 2 && instance.status === 'active'
                
                return (
                  <div key={instance.id} className="row">
                    <div className="row-main">
                      <div className="row-title">
                        <strong>{instance.name}</strong>
                        <span className={`pill ${isOnline ? 'sev-low' : 'sev-med'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                        {isOnline && (
                          <span className="muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                            Last seen {ageMinutes === 0 ? 'just now' : `${ageMinutes}m ago`}
                          </span>
                        )}
                      </div>
                      <div className="muted">
                        {instance.metadata?.version && `Version: ${instance.metadata.version}`}
                        {instance.metadata?.os && ` • OS: ${instance.metadata.os}`}
                        {instance.metadata?.node && ` • Node: ${instance.metadata.node}`}
                      </div>
                    </div>
                    <div className="row-side">
                      <span className="muted">
                        Connected {new Date(instance.connectedAt).toLocaleDateString()}
                      </span>
                      <button 
                        className="btn ghost small" 
                        onClick={() => handleDisconnect(instance.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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

          {tokenStatus === 'connected' && connectedInstance && (
            <div className="connect-success">
              <div className="connect-icon success">✅</div>
              <h3>Successfully Connected!</h3>
              <div className="connect-instance-info">
                <div className="stat-card">
                  <div className="stat-title">Instance Name</div>
                  <div className="stat-value">{connectedInstance.name}</div>
                </div>
                {connectedInstance.url && (
                  <div className="stat-card">
                    <div className="stat-title">Version</div>
                    <div className="stat-value" style={{ fontSize: '0.9rem' }}>{connectedInstance.url}</div>
                  </div>
                )}
              </div>
              <p className="muted" style={{ marginTop: '1rem' }}>
                Your instance will appear in the connected instances list above. 
                Check <strong>Mission Control</strong> to see it in action!
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

        {/* Add another instance button when already connected */}
        {tokenStatus === 'idle' && connectedInstances.length > 0 && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button className="btn" onClick={generateConnectionToken}>
              Connect Another Instance
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
