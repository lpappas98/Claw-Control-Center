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
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const defaultUrl = `http://${host}:8787`
    
    if (!raw) return { kind: 'bridge', baseUrl: defaultUrl }
    
    const parsed = JSON.parse(raw) as AdapterConfig
    if (parsed.kind === 'bridge' && typeof parsed.baseUrl === 'string') {
      // Auto-fix localhost URLs when accessed from another device
      if (host !== 'localhost' && /localhost:8787/.test(parsed.baseUrl)) {
        const fixed = { kind: 'bridge' as const, baseUrl: `http://${host}:8787` }
        saveAdapterConfig(fixed) // Persist the fix
        return fixed
      }
      return parsed
    }
    return { kind: 'bridge', baseUrl: defaultUrl }
  } catch {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    return { kind: 'bridge', baseUrl: `http://${host}:8787` }
  }
}

export function saveAdapterConfig(cfg: AdapterConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  if (cfg.kind === 'bridge') return bridgeAdapter({ baseUrl: cfg.baseUrl })
  return mockAdapter
}
