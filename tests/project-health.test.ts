import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeHealth, computeProgress, SILENCE_DAYS } from '../server/project-health.js'

const now = Date.parse('2026-10-06T12:00:00-05:00')
const day = 86_400_000
const at = (days: number) => new Date(now + days * day).toISOString()
const fresh = at(-1)

test('progress counts done milestones over the ones that still matter', () => {
  assert.equal(computeProgress([]), null)
  assert.equal(computeProgress([{ status: 'cancelled' }]), null)
  assert.equal(computeProgress([{ status: 'done' }, { status: 'pending' }, { status: 'in_progress' }, { status: 'cancelled' }]), 33)
  assert.equal(computeProgress([{ status: 'done' }, { status: 'done' }]), 100)
})

test('only proposals and running projects get a traffic light', () => {
  for (const status of ['por_clasificar', 'pausado', 'completado', 'facturado', 'cancelado'] as const) {
    assert.deepEqual(computeHealth({ status, milestones: [{ status: 'pending', dueAt: at(-30) }], openBlockers: 2, lastActivityAt: at(-90) }, now), { health: null, reasons: [], silentDays: null })
  }
})

test('an overdue milestone or an open blocker turns the project red', () => {
  const overdue = computeHealth({ status: 'en_curso', milestones: [{ status: 'in_progress', dueAt: at(-2) }, { status: 'pending', dueAt: at(20) }], openBlockers: 0, lastActivityAt: fresh }, now)
  assert.equal(overdue.health, 'rojo')
  assert.deepEqual(overdue.reasons, ['1 hito atrasado'])
  const blocked = computeHealth({ status: 'en_curso', milestones: [{ status: 'pending', dueAt: at(20) }], openBlockers: 2, lastActivityAt: fresh }, now)
  assert.equal(blocked.health, 'rojo')
  assert.deepEqual(blocked.reasons, ['2 bloqueos abiertos'])
  // Finished or cancelled work past its date is not late.
  assert.equal(computeHealth({ status: 'en_curso', milestones: [{ status: 'done', dueAt: at(-9) }, { status: 'cancelled', dueAt: at(-9) }, { status: 'in_progress', dueAt: at(30) }], openBlockers: 0, lastActivityAt: fresh }, now).health, 'verde')
})

test('yellow covers work about to slip, blocked milestones, no open milestones and silence', () => {
  const soon = computeHealth({ status: 'en_curso', milestones: [{ status: 'pending', dueAt: at(3) }], openBlockers: 0, lastActivityAt: fresh }, now)
  assert.equal(soon.health, 'amarillo')
  assert.match(soon.reasons[0], /vence en 7 días sin iniciar/)
  assert.equal(computeHealth({ status: 'en_curso', milestones: [{ status: 'in_progress', dueAt: at(3) }], openBlockers: 0, lastActivityAt: fresh }, now).health, 'verde')
  assert.equal(computeHealth({ status: 'en_curso', milestones: [{ status: 'pending', dueAt: at(8) }], openBlockers: 0, lastActivityAt: fresh }, now).health, 'verde')
  assert.deepEqual(computeHealth({ status: 'en_curso', milestones: [{ status: 'blocked', dueAt: at(30) }], openBlockers: 0, lastActivityAt: fresh }, now).reasons, ['1 hito bloqueado'])
  assert.deepEqual(computeHealth({ status: 'en_curso', milestones: [{ status: 'done', dueAt: at(-3) }], openBlockers: 0, lastActivityAt: fresh }, now).reasons, ['Sin hitos abiertos'])
  // A proposal has no schedule yet, so missing milestones and silence are not warnings.
  assert.equal(computeHealth({ status: 'propuesta', milestones: [], openBlockers: 0, lastActivityAt: at(-60) }, now).health, 'verde')
  const silent = computeHealth({ status: 'en_curso', milestones: [{ status: 'in_progress', dueAt: at(30) }], openBlockers: 0, lastActivityAt: at(-SILENCE_DAYS) }, now)
  assert.equal(silent.health, 'amarillo')
  assert.equal(silent.silentDays, SILENCE_DAYS)
  assert.equal(computeHealth({ status: 'en_curso', milestones: [{ status: 'in_progress', dueAt: at(30) }], openBlockers: 0, lastActivityAt: at(-SILENCE_DAYS + 1) }, now).silentDays, null)
})

test('red keeps the yellow reasons so nothing is hidden behind the worst one', () => {
  const result = computeHealth({ status: 'en_curso', milestones: [{ status: 'pending', dueAt: at(-1) }, { status: 'pending', dueAt: at(2) }], openBlockers: 1, lastActivityAt: at(-10) }, now)
  assert.equal(result.health, 'rojo')
  assert.equal(result.reasons.length, 4)
})
