import type { Health, WorkerStatus } from '../types'
import { Badge as ShadcnBadge } from '@/components/ui/badge'

type Props = { kind: Health | WorkerStatus | string }

export function Badge({ kind }: Props) {
  const variant = getVariant(String(kind).toLowerCase())
  return <ShadcnBadge variant={variant}>{kind}</ShadcnBadge>
}

function getVariant(kind: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (kind) {
    case 'healthy':
    case 'online':
    case 'active':
    case 'ready':
      return 'default'
    case 'warning':
    case 'busy':
    case 'degraded':
      return 'secondary'
    case 'error':
    case 'unhealthy':
    case 'offline':
      return 'destructive'
    default:
      return 'outline'
  }
}
