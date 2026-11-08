import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { authorizeVertice } from '../server/vertice-bridge.js'
test('una credencial derivada de Vértice no sirve para otra empresa', () => {
  const before = process.env.SYNAPSE_VERTICE_SHARED_SECRET
  try {
    const secret = 'fixture-shared-secret-with-more-than-32-characters'
    process.env.SYNAPSE_VERTICE_SHARED_SECRET = secret
    const credential = createHmac('sha256', secret).update('company-a').digest('hex')
    assert.equal(authorizeVertice(`Bearer ${credential}`, 'company-a'), true)
    assert.equal(authorizeVertice(`Bearer ${credential}`, 'company-b'), false)
    assert.equal(authorizeVertice(`Bearer ${secret}`, 'company-a'), false)
  } finally { if (before === undefined) delete process.env.SYNAPSE_VERTICE_SHARED_SECRET; else process.env.SYNAPSE_VERTICE_SHARED_SECRET = before }
})
