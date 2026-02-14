/**
 * Parse `openclaw gateway status` output into a coarse health + short summary.
 *
 * The CLI output can vary by environment (systemd present/absent, container, etc).
 * Prefer signals that indicate the gateway is actually reachable (RPC probe).
 */

/**
 * @param {string} text
 * @returns {{ health: 'ok'|'warn'|'down'|'unknown', summary: string, signals?: string[] }}
 */
export function parseGatewayStatus(text) {
  const raw = (text ?? '').toString()
  const t = raw.toLowerCase()
  const signals = []

  // Strongest signal: explicit RPC probe status.
  const rpcLine = raw
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^rpc probe\s*:/i.test(l))

  if (rpcLine) {
    signals.push(rpcLine)
    if (/\bok\b/i.test(rpcLine)) {
      const runtimeUnknown = /runtime:\s*unknown/i.test(raw)
      return {
        health: runtimeUnknown ? 'warn' : 'ok',
        summary: runtimeUnknown ? 'probe ok (runtime unknown)' : 'probe ok',
        signals,
      }
    }
    if (/(fail|error|timeout|refused|unreachable)/i.test(rpcLine)) {
      return { health: 'down', summary: 'probe failed', signals }
    }
  }

  // Secondary signals.
  if (/\blistening\s*:/i.test(raw) || t.includes('dashboard: http')) {
    signals.push('listening')
    return { health: 'ok', summary: 'listening', signals }
  }

  if (/(not running|inactive|stopped)/i.test(raw)) {
    signals.push('not running')
    return { health: 'down', summary: 'stopped', signals }
  }

  if (/(config issue|looks out of date|doctor --repair|service config)/i.test(raw)) {
    signals.push('config issue')
    return { health: 'warn', summary: 'config issue', signals }
  }

  const first = raw.split('\n')[0]?.trim()
  return { health: 'unknown', summary: (first || 'unknown').slice(0, 120), signals }
}
