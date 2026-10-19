import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupOpenAgenda, agendaQuadrant } from '../src/eisenhower'
import type { AgendaItem } from '../src/main'

const item = (id: string, fields: Partial<AgendaItem> = {}): AgendaItem => ({ id, kind: 'request', requestId: id, commitmentId: null, title: 'Fixture', domain: 'agency', projectId: null, agentId: 'secretaria', priority: 'urgent', status: 'pending', riskLevel: 'high', requiresApproval: false, approvalConfirmed: false, startsAt: null, dueAt: null, nextAction: '', sourcePath: null, sourceDriveFolder: null, createdAt: '2026-10-19', updatedAt: '2026-10-19', eisenhower: { quadrant: 'Q4', urgency: null, importance: null, urgencyReason: null, importanceReason: null, sourceTopic: null }, ...fields })

test('daily matrix respects canonical quadrants, never re-infers, and excludes closed items and milestones', () => {
  const tasks = [item('manual-q4'), item('done', { status: 'done' }), item('archived', { status: 'cancelled' }), item('milestone', { kind: 'milestone' }), item('without', { eisenhower: { quadrant: null, urgency: null, importance: null, urgencyReason: null, importanceReason: null, sourceTopic: null } })]
  const result = groupOpenAgenda(tasks)
  assert.deepEqual(result.groups.Q4.map(value => value.id), ['manual-q4'])
  assert.equal(result.groups.Q1.length, 0)
  assert.deepEqual(result.unclassified.map(value => value.id), ['without'])
  assert.equal(tasks[0].eisenhower.quadrant, 'Q4')
})
test('agenda links accept only the existing Eisenhower quadrant identifiers', () => {
  for (const quadrant of ['Q1', 'Q2', 'Q3', 'Q4']) assert.equal(agendaQuadrant(`#agenda/eisenhower/${quadrant}`), quadrant)
  for (const hash of ['#agenda', '#agenda/eisenhower/Q5', '#life', '#agenda/eisenhower/Q1/extra']) assert.equal(agendaQuadrant(hash), null)
})
