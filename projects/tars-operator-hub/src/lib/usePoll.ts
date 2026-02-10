import { useEffect, useRef, useState } from 'react'

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let timer: number | undefined

    async function tick() {
      setLoading(true)
      try {
        const next = await fn()
        if (!alive.current) return
        setData(next)
        setError(null)
      } catch (e) {
        if (!alive.current) return
        setError(e instanceof Error ? e : new Error(String(e)))
      }

      if (!alive.current) return
      setLoading(false)
      timer = window.setTimeout(tick, intervalMs)
    }

    tick()
    return () => {
      alive.current = false
      if (timer) window.clearTimeout(timer)
    }
  }, [fn, intervalMs])

  return { data, error, loading }
}
