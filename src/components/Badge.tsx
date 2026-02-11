import type { Health, WorkerStatus } from '../types'

type Props = { kind: Health | WorkerStatus | string }

export function Badge({ kind }: Props) {
  const cls = String(kind).toLowerCase()
  return <span className={`badge ${cls}`}>{kind}</span>
}
