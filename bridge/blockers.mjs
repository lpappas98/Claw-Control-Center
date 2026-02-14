import path from 'node:path'

/**
 * Pure blocker computation used by the bridge API.
 *
 * @param {object} input
 * @param {{gateway?: {health?: string}}} input.status
 * @param {Array<{slot: string, status: string}>} input.workers
 * @param {string} input.workspace
 * @param {Date} [input.now]
 * @returns {import('../src/types').Blocker[]}
 */
export function computeBlockersFrom({ status, workers, workspace, now = new Date() }) {
  /** @type {import('../src/types').Blocker[]} */
  const blockers = []

  const gatewayHealth = status?.gateway?.health
  const detectedAt = now.toISOString()

  if (gatewayHealth === 'down' || gatewayHealth === 'unknown') {
    blockers.push({
      id: 'gateway-not-ok',
      title: gatewayHealth === 'down' ? 'Gateway stopped' : 'Gateway status unknown',
      severity: gatewayHealth === 'down' ? 'High' : 'Medium',
      detectedAt,
      details: 'Gateway must be running for nodes, browser relay, and automation to function.',
      remediation: [
        { label: 'Gateway status', command: 'openclaw gateway status' },
        { label: 'Restart gateway', command: 'openclaw gateway restart', action: { kind: 'gateway.restart' } },
        { label: 'Start gateway', command: 'openclaw gateway start', action: { kind: 'gateway.start' } },
      ],
    })
  }

  const stale = (workers ?? []).filter((w) => w.status === 'stale')
  const offline = (workers ?? []).filter((w) => w.status === 'offline')
  if (stale.length || offline.length) {
    blockers.push({
      id: 'workers-unhealthy',
      title: offline.length ? 'Some workers are offline' : 'Some workers are stale',
      severity: offline.length ? 'High' : 'Medium',
      detectedAt,
      details: [
        stale.length ? `stale: ${stale.map((w) => w.slot).join(', ')}` : null,
        offline.length ? `offline: ${offline.map((w) => w.slot).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      remediation: [
        {
          label: 'Inspect heartbeat file',
          command: `ls -la "${workspace}" && ls -la "${path.join(workspace, '.clawhub')}"`,
        },
        { label: 'Restart gateway (may restart workers)', command: 'openclaw gateway restart', action: { kind: 'gateway.restart' } },
      ],
    })
  }

  return blockers
}
