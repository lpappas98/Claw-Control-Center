import { useEffect, useState, useRef, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: any) => void
  reconnectDelay?: number
  enabled?: boolean
}

export function useWebSocket({ url, onMessage, reconnectDelay = 3000, enabled = true }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('[WebSocket] Connected to', url)
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
      }

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        setConnected(false)
        wsRef.current = null

        // Auto-reconnect
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Reconnecting...')
            connect()
          }, reconnectDelay)
        }
      }

      wsRef.current = ws
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err)
    }
  }, [url, onMessage, reconnectDelay, enabled])

  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect, enabled])

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('[WebSocket] Not connected, cannot send data')
    }
  }, [])

  return { connected, send }
}
