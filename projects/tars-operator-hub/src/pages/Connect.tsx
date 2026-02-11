import { useState, useEffect } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'

type ConnectionToken = {
  token: string
  userId: string
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'connected' | 'expired'
  instanceName?: string
  gatewayUrl?: string
}

function generateToken(): string {
  // Generate a 6-character alphanumeric token (easy to type/say)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars (0,O,1,I)
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export function Connect() {
  const { user, profile } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'generating' | 'waiting' | 'connected' | 'error'>('idle')
  const [connectedInstance, setConnectedInstance] = useState<{ name: string; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(300) // 5 minutes

  // Generate a new connection token
  const generateConnectionToken = async () => {
    if (!user) return
    
    setTokenStatus('generating')
    setError(null)
    
    try {
      const newToken = generateToken()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      
      await setDoc(doc(db, 'connectionTokens', newToken), {
        token: newToken,
        userId: user.uid,
        createdAt: serverTimestamp(),
        expiresAt,
        status: 'pending',
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

  // Listen for token status changes
  useEffect(() => {
    if (!token || tokenStatus !== 'waiting') return

    const unsubscribe = onSnapshot(doc(db, 'connectionTokens', token), (snap) => {
      if (!snap.exists()) {
        setTokenStatus('error')
        setError('Token expired or not found')
        return
      }
      
      const data = snap.data() as ConnectionToken
      
      if (data.status === 'connected') {
        setTokenStatus('connected')
        setConnectedInstance({
          name: data.instanceName || 'Unknown Instance',
          url: data.gatewayUrl || '',
        })
        // Clean up the token after successful connection
        deleteDoc(doc(db, 'connectionTokens', token))
      } else if (data.status === 'expired') {
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
    setConnectedInstance(null)
    setError(null)
    setCountdown(300)
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
                    <div className="stat-title">Gateway URL</div>
                    <div className="stat-value" style={{ fontSize: '0.9rem' }}>{connectedInstance.url}</div>
                  </div>
                )}
              </div>
              <button className="btn" onClick={resetConnection}>
                Connect Another Instance
              </button>
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

        {/* Show connected instances */}
        {profile?.connectedInstances && profile.connectedInstances.length > 0 && (
          <div className="connected-instances">
            <h3>Connected Instances</h3>
            <div className="table-like">
              {profile.connectedInstances.map((instance) => (
                <div key={instance.id} className="row">
                  <div className="row-main">
                    <div className="row-title">
                      <strong>{instance.name}</strong>
                      <span className="pill sev-low">Connected</span>
                    </div>
                    <div className="muted">{instance.gatewayUrl}</div>
                  </div>
                  <div className="row-side">
                    <span className="muted">
                      Connected {new Date(instance.connectedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
