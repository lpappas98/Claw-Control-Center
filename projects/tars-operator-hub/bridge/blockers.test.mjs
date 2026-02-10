import test from 'node:test'
import assert from 'node:assert/strict'

import { computeBlockersFrom } from './blockers.mjs'

test('computeBlockersFrom: gateway down -> gateway-not-ok High', () => {
  const now = new Date('2026-02-10T23:19:00.000Z')
  const blockers = computeBlockersFrom({
    status: { gateway: { health: 'down' } },
    workers: [],
    workspace: '/tmp/workspace',
    now,
  })

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].id, 'gateway-not-ok')
  assert.equal(blockers[0].severity, 'High')
  assert.equal(blockers[0].title, 'Gateway stopped')
  assert.equal(blockers[0].detectedAt, now.toISOString())
  assert.ok(blockers[0].remediation.some((r) => r.command === 'openclaw gateway restart'))
})

test('computeBlockersFrom: gateway unknown -> gateway-not-ok Medium', () => {
  const blockers = computeBlockersFrom({
    status: { gateway: { health: 'unknown' } },
    workers: [],
    workspace: '/tmp/workspace',
    now: new Date('2026-02-10T00:00:00.000Z'),
  })

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].id, 'gateway-not-ok')
  assert.equal(blockers[0].severity, 'Medium')
  assert.equal(blockers[0].title, 'Gateway status unknown')
})

test('computeBlockersFrom: workers stale/offline -> workers-unhealthy title/severity/details', () => {
  const blockers = computeBlockersFrom({
    status: { gateway: { health: 'ok' } },
    workers: [
      { slot: 'slot-1', status: 'stale' },
      { slot: 'slot-2', status: 'offline' },
      { slot: 'slot-3', status: 'offline' },
      { slot: 'slot-4', status: 'active' },
    ],
    workspace: '/w',
    now: new Date('2026-02-10T00:00:00.000Z'),
  })

  assert.equal(blockers.length, 1)
  const b = blockers[0]
  assert.equal(b.id, 'workers-unhealthy')
  assert.equal(b.severity, 'High')
  assert.equal(b.title, 'Some workers are offline')
  assert.match(b.details, /stale: slot-1/)
  assert.match(b.details, /offline: slot-2, slot-3/)
  assert.ok(b.remediation[0].command.includes('ls -la "/w"'))
  assert.ok(b.remediation[0].command.includes('ls -la "/w/.clawhub"'))
})

test('computeBlockersFrom: gateway down + unhealthy workers -> two blockers (stable ids)', () => {
  const blockers = computeBlockersFrom({
    status: { gateway: { health: 'down' } },
    workers: [{ slot: 'slot-9', status: 'offline' }],
    workspace: '/w',
    now: new Date('2026-02-10T00:00:00.000Z'),
  })

  assert.deepEqual(
    blockers.map((b) => b.id).sort(),
    ['gateway-not-ok', 'workers-unhealthy'].sort()
  )
})
