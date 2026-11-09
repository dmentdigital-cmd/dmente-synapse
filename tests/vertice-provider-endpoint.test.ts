import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedCommercialEndpoint } from '../server/vertice-bridge.js'

test('reutiliza solo el origen privado existente de Hermes en producción', () => {
  const before = { node: process.env.NODE_ENV, hermes: process.env.HERMES_API_URL, commercial: process.env.SYNAPSE_VERTICE_LLM_URL }
  try {
    process.env.NODE_ENV = 'production'
    process.env.HERMES_API_URL = 'http://10.0.1.1:8642/v1'
    delete process.env.SYNAPSE_VERTICE_LLM_URL
    assert.equal(allowedCommercialEndpoint(new URL('http://10.0.1.1:8642/v1/chat/completions')), true)
    assert.equal(allowedCommercialEndpoint(new URL('http://10.0.1.2:8642/v1/chat/completions')), false)
    assert.equal(allowedCommercialEndpoint(new URL('http://10.0.1.1:9000/v1/chat/completions')), false)
    assert.equal(allowedCommercialEndpoint(new URL('http://provider.example.test/v1/chat/completions')), false)
    assert.equal(allowedCommercialEndpoint(new URL('https://provider.example.test/v1/chat/completions')), true)
    process.env.SYNAPSE_VERTICE_LLM_URL = 'http://10.0.1.1:8642/v1'
    assert.equal(allowedCommercialEndpoint(new URL('http://10.0.1.1:8642/v1/chat/completions')), false)
  } finally {
    for (const [key, value] of Object.entries({ NODE_ENV: before.node, HERMES_API_URL: before.hermes, SYNAPSE_VERTICE_LLM_URL: before.commercial })) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
})
