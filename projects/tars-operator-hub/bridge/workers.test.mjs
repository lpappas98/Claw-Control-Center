import test from 'node:test'
import assert from 'node:assert/strict'
import { computeWorkerStatus, normalizeWorkers } from './workers.mjs'

test('computeWorkerStatus: missing/invalid → offline', () => {
  assert.equal(computeWorkerStatus(undefined, 0), 'offline')
  assert.equal(computeWorkerStatus(null, 0), 'offline')
  assert.equal(computeWorkerStatus('not-a-date', 0), 'offline')
})

test('computeWorkerStatus: active/waiting/stale/offline thresholds', () => {
  const now = Date.parse('2026-02-10T00:00:00.000Z')

  assert.equal(computeWorkerStatus(new Date(now - 10_000).toISOString(), now), 'active')
  assert.equal(computeWorkerStatus(new Date(now - 60_000).toISOString(), now), 'waiting')
  assert.equal(computeWorkerStatus(new Date(now - 10 * 60_000).toISOString(), now), 'stale')
  assert.equal(computeWorkerStatus(new Date(now - 31 * 60_000).toISOString(), now), 'offline')
})

test('normalizeWorkers: supports array and object forms', () => {
  const now = Date.parse('2026-02-10T00:00:00.000Z')
  const at = new Date(now - 1_000).toISOString()

  const arr = normalizeWorkers([{ slot: 'hub-dev-slot-1', task: 'x', lastBeatAt: at, beats: [{ at }] }], now)
  assert.equal(arr.length, 1)
  assert.equal(arr[0].slot, 'hub-dev-slot-1')
  assert.equal(arr[0].status, 'active')
  assert.equal(arr[0].lastBeatAt, at)
  assert.equal(arr[0].beats.length, 1)

  const obj = normalizeWorkers({ workers: [{ id: 's2', beats: [{ at }] }] }, now)
  assert.equal(obj.length, 1)
  assert.equal(obj[0].slot, 's2')
  assert.equal(obj[0].status, 'active')
})

test('normalizeWorkers: falls back to beats[0].at when lastBeatAt missing', () => {
  const now = Date.parse('2026-02-10T00:00:00.000Z')
  const at = new Date(now - 1_000).toISOString()
  const ws = normalizeWorkers([{ slot: 's', beats: [{ at }] }], now)
  assert.equal(ws[0].lastBeatAt, at)
  assert.equal(ws[0].status, 'active')
})
