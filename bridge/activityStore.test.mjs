import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

import { loadActivity, makeDebouncedSaver, saveActivity } from './activityStore.mjs'

test('activityStore: loadActivity missing file => []', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-activity-'))
  const file = path.join(dir, 'missing.json')
  const a = await loadActivity(file)
  assert.deepEqual(a, [])
})

test('activityStore: saveActivity then loadActivity roundtrips + caps to 500', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-activity-'))
  const file = path.join(dir, 'activity.json')

  const list = Array.from({ length: 700 }, (_, i) => ({ id: String(i), at: new Date().toISOString(), level: 'info', source: 't', message: 'm' }))
  await saveActivity(file, list)

  const got = await loadActivity(file)
  assert.equal(got.length, 500)
  assert.equal(got[0].id, '0')
  assert.equal(got[499].id, '499')
})

test('activityStore: makeDebouncedSaver triggers once for many triggers', async () => {
  let calls = 0
  const saver = makeDebouncedSaver(async () => {
    calls += 1
  })

  saver.trigger()
  saver.trigger()
  saver.trigger()

  await saver.flush()
  assert.equal(calls, 1)

  // no pending changes => no extra calls
  await saver.flush()
  assert.equal(calls, 1)
})
