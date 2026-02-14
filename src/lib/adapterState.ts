import { bridgeAdapter } from '../adapters/bridgeAdapter'
import type { Adapter } from '../adapters/adapter'

export type AdapterConfig = { kind: 'bridge'; baseUrl: string }

function defaultBridgeUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8787'
  const host = window.location.hostname || 'localhost'
  return `http://${host}:8787`
}

export function loadAdapterConfig(): AdapterConfig {
  // Always use bridge adapter
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  return { kind: 'bridge', baseUrl: `http://${host}:8787` }
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  return bridgeAdapter({ baseUrl: cfg.baseUrl })
}
