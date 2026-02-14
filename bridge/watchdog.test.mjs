import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

import { getHeartbeatDiagnostics } from './watchdog.mjs'

async function mkTmpDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'clawhub-watchdog-'))
}

test('getHeartbeatDiagnostics: no candidate file -> down', async () => {
  const dir = await mkTmpDir()
  const missing = path.join(dir, 'nope.json')
  const d = await getHeartbeatDiagnostics([missing], Date.parse('2026-02-10T00:00:00.000Z'))
  assert.equal(d.health, 'down')
  assert.match(d.summary, /no heartbeat file/i)
  assert.equal(d.heartbeatFile?.exists, false)
})

test('getHeartbeatDiagnostics: invalid JSON -> down with error', async () => {
  const dir = await mkTmpDir()
  const file = path.join(dir, 'worker-heartbeats.json')
  await fs.writeFile(file, '{not-json', 'utf8')

  const d = await getHeartbeatDiagnostics([file], Date.parse('2026-02-10T00:00:00.000Z'))
  assert.equal(d.health, 'down')
  assert.match(d.summary, /invalid/i)
  assert.equal(d.heartbeatFile?.exists, true)
  assert.equal(d.heartbeatFile?.parseOk, false)
  assert.ok(d.heartbeatFile?.error)
})

test('getHeartbeatDiagnostics: fresh file -> ok', async () => {
  const dir = await mkTmpDir()
  const file = path.join(dir, 'worker-heartbeats.json')
  await fs.writeFile(file, JSON.stringify({ workers: [{ slot: 's1' }, { slot: 's2' }] }), 'utf8')

  // Set mtime explicitly so the test is stable.
  const now = Date.parse('2026-02-10T00:00:00.000Z')
  const mtime = new Date(now - 10_000)
  await fs.utimes(file, mtime, mtime)

  const d = await getHeartbeatDiagnostics([file], now)
  assert.equal(d.health, 'ok')
  assert.match(d.summary, /fresh/i)
  assert.equal(d.heartbeatFile?.parseOk, true)
  assert.equal(d.heartbeatFile?.workerCount, 2)
  assert.equal(d.heartbeatFile?.path, file)
  assert.equal(d.heartbeatFile?.ageMs, 10_000)
})

test('getHeartbeatDiagnostics: delayed file -> warn', async () => {
  const dir = await mkTmpDir()
  const file = path.join(dir, 'worker-heartbeats.json')
  await fs.writeFile(file, JSON.stringify([]), 'utf8')

  const now = Date.parse('2026-02-10T00:00:00.000Z')
  const mtime = new Date(now - 2 * 60_000)
  await fs.utimes(file, mtime, mtime)

  const d = await getHeartbeatDiagnostics([file], now)
  assert.equal(d.health, 'warn')
  assert.match(d.summary, /delayed/i)
})

test('getHeartbeatDiagnostics: stale file -> down', async () => {
  const dir = await mkTmpDir()
  const file = path.join(dir, 'worker-heartbeats.json')
  await fs.writeFile(file, JSON.stringify([]), 'utf8')

  const now = Date.parse('2026-02-10T00:00:00.000Z')
  const mtime = new Date(now - 10 * 60_000)
  await fs.utimes(file, mtime, mtime)

  const d = await getHeartbeatDiagnostics([file], now)
  assert.equal(d.health, 'down')
  assert.match(d.summary, /stale/i)
})
