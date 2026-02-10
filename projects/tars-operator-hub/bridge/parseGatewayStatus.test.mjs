import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGatewayStatus } from './parseGatewayStatus.mjs'

test('parseGatewayStatus: RPC probe ok => ok', () => {
  const out = `Service: systemd\nRPC probe: ok\nListening: *:18789`
  assert.deepEqual(parseGatewayStatus(out), {
    health: 'ok',
    summary: 'probe ok',
    signals: ['RPC probe: ok'],
  })
})

test('parseGatewayStatus: runtime unknown + probe ok => warn', () => {
  const out = `Runtime: unknown (Error: ...)\nRPC probe: ok`
  assert.deepEqual(parseGatewayStatus(out), {
    health: 'warn',
    summary: 'probe ok (runtime unknown)',
    signals: ['RPC probe: ok'],
  })
})

test('parseGatewayStatus: probe failed => down', () => {
  const out = `RPC probe: failed (ECONNREFUSED)`
  assert.deepEqual(parseGatewayStatus(out), {
    health: 'down',
    summary: 'probe failed',
    signals: ['RPC probe: failed (ECONNREFUSED)'],
  })
})

test('parseGatewayStatus: listening => ok (fallback)', () => {
  const out = `Dashboard: http://127.0.0.1:1234/\nListening: *:1234`
  const res = parseGatewayStatus(out)
  assert.equal(res.health, 'ok')
  assert.equal(res.summary, 'listening')
})

test('parseGatewayStatus: stopped/inactive => down', () => {
  const out = `Gateway is not running (inactive)`
  const res = parseGatewayStatus(out)
  assert.equal(res.health, 'down')
  assert.equal(res.summary, 'stopped')
})
