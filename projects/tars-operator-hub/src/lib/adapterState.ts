import { bridgeAdapter } from '../adapters/bridgeAdapter'
import { mockAdapter } from '../adapters/mockAdapter'
import type { Adapter } from '../adapters/adapter'

const KEY = 'tars.operatorHub.adapter'

export type AdapterConfig =
  | { kind: 'mock' }
  | { kind: 'bridge'; baseUrl: string }

export function loadAdapterConfig(): AdapterConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { kind: 'bridge', baseUrl: 'http://localhost:8787' }
    const parsed = JSON.parse(raw) as AdapterConfig
    if (parsed.kind === 'bridge' && typeof parsed.baseUrl === 'string') return parsed
    return { kind: 'mock' }
  } catch {
    return { kind: 'bridge', baseUrl: 'http://localhost:8787' }
  }
}

export function saveAdapterConfig(cfg: AdapterConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  if (cfg.kind === 'bridge') return bridgeAdapter({ baseUrl: cfg.baseUrl })
  return mockAdapter
}
