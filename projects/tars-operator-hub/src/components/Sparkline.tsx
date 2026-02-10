type Point = { at: string }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function Sparkline({ points, width = 180, height = 26 }: { points: Point[]; width?: number; height?: number }) {
  if (!points.length) return <div className="sparkline empty">—</div>

  const times = points.map((p) => new Date(p.at).getTime()).sort((a, b) => a - b)
  const min = times[0]
  const max = times[times.length - 1]
  const span = Math.max(1, max - min)

  const ys = times.map((t) => {
    // newer beats closer to baseline (lower y)
    const norm = (t - min) / span
    return (1 - norm) * (height - 4) + 2
  })

  const xs = times.map((t) => {
    const norm = (t - min) / span
    return clamp(norm * (width - 4) + 2, 2, width - 2)
  })

  const d = xs
    .map((x, i) => {
      const y = ys[i]
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="heartbeat sparkline">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.85" />
    </svg>
  )
}
