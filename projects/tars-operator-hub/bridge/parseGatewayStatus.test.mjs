import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGatewayStatus } from './parseGatewayStatus.mjs'

test('parseGatewayStatus: rpc probe ok → ok', () => {
  const out = `Gateway Service\nRPC probe: OK\nRuntime: node@22\n`
  assert.deepEqual(parseGatewayStatus(out), {
    health: 'ok',
    summary: 'probe ok',
    signals: ['RPC probe: OK'],
  })
})

test('parseGatewayStatus: rpc probe ok but runtime unknown → warn', () => {
  const out = `RPC probe: OK\nRuntime: unknown\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'warn')
  assert.equal(parsed.summary, 'probe ok (runtime unknown)')
})

test('parseGatewayStatus: rpc probe failed → down', () => {
  const out = `RPC probe: timeout after 2s\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'down')
  assert.equal(parsed.summary, 'probe failed')
})

test('parseGatewayStatus: listening without probe → ok', () => {
  const out = `listening: 127.0.0.1:7777\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'ok')
  assert.equal(parsed.summary, 'listening')
})

test('parseGatewayStatus: stopped/inactive → down', () => {
  const out = `Service: inactive (dead)\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'down')
  assert.equal(parsed.summary, 'stopped')
})

test('parseGatewayStatus: config issue → warn', () => {
  const out = `Gateway status\nConfig issue detected: looks out of date.\nRun: openclaw doctor --repair\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'warn')
  assert.equal(parsed.summary, 'config issue')
})

test('parseGatewayStatus: unknown falls back to first line', () => {
  const out = `Some weird output\nMore info\n`
  const parsed = parseGatewayStatus(out)
  assert.equal(parsed.health, 'unknown')
  assert.equal(parsed.summary, 'Some weird output')
})
