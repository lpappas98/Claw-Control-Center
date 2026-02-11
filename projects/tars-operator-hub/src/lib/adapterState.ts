import { bridgeAdapter } from '../adapters/bridgeAdapter'
import { mockAdapter } from '../adapters/mockAdapter'
import { firestoreAdapter } from '../adapters/firestoreAdapter'
import type { Adapter } from '../adapters/adapter'

const KEY = 'tars.operatorHub.adapter'

export type AdapterConfig =
  | { kind: 'mock' }
  | { kind: 'bridge'; baseUrl: string }
  | { kind: 'firestore'; userId: string }

export function loadAdapterConfig(): AdapterConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { kind: 'mock' } // Default to mock until user logs in
    const parsed = JSON.parse(raw) as AdapterConfig
    if (parsed.kind === 'firestore' && typeof parsed.userId === 'string') {
      return parsed
    }
    if (parsed.kind === 'bridge' && typeof parsed.baseUrl === 'string') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      if (host && host !== 'localhost' && /localhost:8787/.test(parsed.baseUrl)) {
        return { kind: 'bridge', baseUrl: `http://${host}:8787` }
      }
      return parsed
    }
    return { kind: 'mock' }
  } catch {
    return { kind: 'mock' }
  }
}

export function saveAdapterConfig(cfg: AdapterConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  if (cfg.kind === 'firestore') return firestoreAdapter({ userId: cfg.userId })
  if (cfg.kind === 'bridge') return bridgeAdapter({ baseUrl: cfg.baseUrl })
  return mockAdapter
}
