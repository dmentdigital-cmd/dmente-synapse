import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AgendaSync } from '../src/agenda-sync'

test('polling reads before or during a save cannot overwrite the saved quadrant', async () => {
  const sync = new AgendaSync()
  const before = sync.capture()
  assert.equal(sync.canApply(before), true)
  let finish!: () => void
  const saving = sync.mutate(() => new Promise<void>((resolve) => { finish = resolve }))
  const during = sync.capture()
  assert.equal(during, null)
  assert.equal(sync.canApply(before), false)
  finish()
  await saving
  assert.equal(sync.canApply(before), false)
  assert.equal(sync.canApply(during), false)
  assert.equal(sync.canApply(sync.capture()), true)
})

test('failed and overlapping mutations release polling only when all saves finish', async () => {
  const sync = new AgendaSync()
  let finish!: () => void
  const saving = sync.mutate(() => new Promise<void>((resolve) => { finish = resolve }))
  await assert.rejects(sync.mutate(async () => { throw new Error('HTTP failure') }))
  assert.equal(sync.capture(), null)
  finish()
  await saving
  assert.equal(sync.canApply(sync.capture()), true)
})
