import { bridgeAdapter } from '../adapters/bridgeAdapter'
import { mockAdapter } from '../adapters/mockAdapter'
import type { Adapter } from '../adapters/adapter'

const KEY = 'tars.operatorHub.adapter'

export type AdapterConfig =
  | { kind: 'mock' }
  | { kind: 'bridge'; baseUrl: string }

function defaultBridgeUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8787'
  const host = window.location.hostname || 'localhost'
  return `http://${host}:8787`
}

export function loadAdapterConfig(): AdapterConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { kind: 'bridge', baseUrl: defaultBridgeUrl() }
    const parsed = JSON.parse(raw) as AdapterConfig
    if (parsed.kind === 'bridge' && typeof parsed.baseUrl === 'string') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      if (host && host !== 'localhost' && /localhost:8787/.test(parsed.baseUrl)) {
        return { kind: 'bridge', baseUrl: `http://${host}:8787` }
      }
      return parsed
    }
    return { kind: 'mock' }
  } catch {
    return { kind: 'bridge', baseUrl: defaultBridgeUrl() }
  }
}

export function saveAdapterConfig(cfg: AdapterConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  if (cfg.kind === 'bridge') return bridgeAdapter({ baseUrl: cfg.baseUrl })
  return mockAdapter
}
