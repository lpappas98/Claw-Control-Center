import { bridgeAdapter } from '../adapters/bridgeAdapter'
import { mockAdapter } from '../adapters/mockAdapter'
import { firestoreAdapter } from '../adapters/firestoreAdapter'
import type { Adapter } from '../adapters/adapter'

const KEY = 'tars.operatorHub.adapter'

export type AdapterConfig =
  | { kind: 'mock' }
  | { kind: 'bridge'; baseUrl: string }
  | { kind: 'firestore' }

export function loadAdapterConfig(): AdapterConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { kind: 'firestore' } // Default to Firestore
    const parsed = JSON.parse(raw) as AdapterConfig
    if (parsed.kind === 'firestore') {
      return { kind: 'firestore' }
    }
    if (parsed.kind === 'bridge' && typeof parsed.baseUrl === 'string') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      if (host && host !== 'localhost' && /localhost:8787/.test(parsed.baseUrl)) {
        return { kind: 'bridge', baseUrl: `http://${host}:8787` }
      }
      return parsed
    }
    return { kind: 'firestore' }
  } catch {
    return { kind: 'firestore' }
  }
}

export function saveAdapterConfig(cfg: AdapterConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function toAdapter(cfg: AdapterConfig): Adapter {
  if (cfg.kind === 'firestore') return firestoreAdapter
  if (cfg.kind === 'bridge') return bridgeAdapter({ baseUrl: cfg.baseUrl })
  return mockAdapter
}
