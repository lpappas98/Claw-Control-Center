import { useEffect, useRef, useState } from 'react'

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null)

  const alive = useRef(true)
  const inFlight = useRef(false)
  const errStreak = useRef(0)
  const hasData = useRef(false)

  useEffect(() => {
    alive.current = true
    let timer: number | undefined

    function scheduleNext() {
      const pow = Math.min(6, errStreak.current)
      const backoff = errStreak.current ? Math.min(60_000, intervalMs * Math.pow(2, pow)) : intervalMs
      timer = window.setTimeout(tick, backoff)
    }

    async function tick() {
      if (!alive.current) return
      if (inFlight.current) return scheduleNext()

      inFlight.current = true
      const firstLoad = !hasData.current
      if (firstLoad) setLoading(true)
      else setRefreshing(true)

      try {
        const next = await fn()
        if (!alive.current) return
        errStreak.current = 0
        hasData.current = true
        setData(next)
        setError(null)
        setLastSuccessAt(new Date().toISOString())
      } catch (e) {
        if (!alive.current) return
        errStreak.current += 1
        setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        inFlight.current = false
      }

      if (!alive.current) return
      setLoading(false)
      setRefreshing(false)
      scheduleNext()
    }

    tick()
    return () => {
      alive.current = false
      if (timer) window.clearTimeout(timer)
    }
  }, [fn, intervalMs])

  return { data, error, loading, refreshing, lastSuccessAt }
}
