import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgendaItem } from '../src/main'
import { buildLifeReview, dayKey, isOverdue, scheduledOn } from '../src/features/life-dashboard/model'

const now = new Date('2026-10-19T02:00:00Z') // Oct 18, 21:00 in Bogota.
const item = (fields: Partial<AgendaItem> = {}): AgendaItem => ({
  id: 'task', kind: 'request', requestId: 'task', commitmentId: null, title: 'Fixture',
  agentId: 'secretaria', domain: 'agency', projectId: null, priority: 'normal', status: 'pending',
  riskLevel: 'low', requiresApproval: false, approvalConfirmed: false, startsAt: null, dueAt: null,
  nextAction: '', sourcePath: null, sourceDriveFolder: null,
  eisenhower: { quadrant: null, urgency: null, importance: null, urgencyReason: null, importanceReason: null, sourceTopic: null },
  createdAt: '2026-10-18T10:00:00Z', updatedAt: '2026-10-19T01:00:00Z', ...fields,
})

test('Bogota date boundaries and date-only deadlines preserve the calendar day', () => {
  assert.equal(dayKey('2026-10-19T02:00:00Z'), '2026-10-18')
  assert.equal(dayKey('2026-10-19T05:00:00Z'), '2026-10-19')
  assert.equal(dayKey('2026-10-18'), '2026-10-18')
  assert.equal(dayKey('invalid'), null)
  assert.equal(dayKey('2026-02-31'), null)
  assert.equal(isOverdue(item({ dueAt: '2026-10-18' }), now), false)
  assert.equal(isOverdue(item({ dueAt: '2026-10-17' }), now), true)
  assert.equal(isOverdue(item({ status: 'done', dueAt: '2026-10-17' }), now), false)
  assert.equal(isOverdue(item({ dueAt: 'invalid' }), now), false)
})

test('day agenda includes spanning tasks, respects Bogota and ignores unassigned dates', () => {
  assert.equal(scheduledOn(item({ startsAt: '2026-10-17', dueAt: '2026-10-19' }), '2026-10-18'), true)
  assert.equal(scheduledOn(item({ dueAt: '2026-10-19T02:00:00Z' }), '2026-10-18'), true)
  assert.equal(scheduledOn(item(), '2026-10-18'), false)
})

test('review scopes by domain, prioritizes blockers and counts creation rather than edits/completions', () => {
  const result = buildLifeReview([
    item({ id: 'old', status: 'done', createdAt: '2025-01-01T10:00:00Z' }),
    item({ id: 'late', dueAt: '2026-10-16' }),
    item({ id: 'block', status: 'blocked' }),
    item({ id: 'hidden', domain: 'personal', status: 'done' }),
    item({ id: 'cancel', status: 'cancelled', dueAt: '2026-10-18' }),
    item({ id: 'scheduled', startsAt: '2026-10-18' }),
  ], { domain: 'agency', selectedDay: '2026-10-18', range: 7, now })
  assert.equal(result.scope.length, 5)
  assert.equal(result.counts.done, 1)
  assert.equal(result.createdInPeriod, 4)
  assert.equal(result.overdue, 1)
  assert.equal(result.attention[0].id, 'block')
  assert.deepEqual(result.scheduled.map((entry) => entry.id), ['scheduled'])
  assert.equal(result.days[0].day, '2026-10-12')
})

test('empty review returns a full zero series and no inferred score', () => {
  const result = buildLifeReview([], { domain: 'all', selectedDay: '2026-10-18', range: 30, now })
  assert.equal(result.days.length, 30)
  assert.equal(result.createdInPeriod, 0)
  assert.equal(result.attention.length, 0)
  assert.equal(result.open, 0)
})

test('day agenda is chronological while attention still prioritizes blockers', () => {
  const result = buildLifeReview([
    item({ id: 'blocked', status: 'blocked', startsAt: '2026-10-18T17:00:00-05:00' }),
    item({ id: 'early', startsAt: '2026-10-18T10:00:00-05:00' }),
    item({ id: 'middle', startsAt: '2026-10-18T11:00:00-05:00' }),
  ], { domain: 'all', selectedDay: '2026-10-18', range: 7, now })
  assert.deepEqual(result.scheduled.map((entry) => entry.id), ['early', 'middle', 'blocked'])
  assert.equal(result.attention[0].id, 'blocked')
})
