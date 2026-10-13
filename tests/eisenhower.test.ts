import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inferQuadrant } from '../server/eisenhower.js'

test('inferQuadrant classifies urgent and important work deterministically', () => {
  assert.equal(inferQuadrant({ priority: 'urgent', riskLevel: 'low', requiresApproval: false, projectId: null, domain: 'personal', dueAt: null }), 'Q1')
  assert.equal(inferQuadrant({ priority: 'normal', riskLevel: 'low', requiresApproval: false, projectId: 'synapse', domain: 'technology', dueAt: null }), 'Q2')
  assert.equal(inferQuadrant({ priority: 'normal', riskLevel: 'low', requiresApproval: false, projectId: null, domain: 'personal', dueAt: new Date().toISOString() }), 'Q3')
  assert.equal(inferQuadrant({ priority: 'low', riskLevel: 'low', requiresApproval: false, projectId: null, domain: 'personal', dueAt: null }), 'Q4')
})
