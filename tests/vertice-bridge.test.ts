import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { authorizeVertice, handleVerticeBridge } from '../server/vertice-bridge.js'
const credential = 'fixture-vertice-credential-32-characters'
const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
afterEach(() => { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv) })
test('credencial comercial aislada por organización', () => {
  process.env.SYNAPSE_VERTICE_CLIENTS = JSON.stringify({ a: credential })
  assert.equal(authorizeVertice(`Bearer ${credential}`, 'a'), true)
  assert.equal(authorizeVertice(`Bearer ${credential}`, 'b'), false)
  assert.equal(authorizeVertice('Bearer wrong', 'a'), false)
  assert.equal(authorizeVertice(`Bearer ${credential}`, '__proto__'), false)
})
test('devuelve una acción sin habilitar herramientas ni cargar memoria personal', async () => {
  Object.assign(process.env, { SYNAPSE_VERTICE_CLIENTS: JSON.stringify({ a: credential }), SYNAPSE_VERTICE_LLM_URL: 'https://llm.example.test/v1', SYNAPSE_VERTICE_LLM_TOKEN: 'fixture', SYNAPSE_VERTICE_MODEL: 'fixture-model' })
  let calls = 0
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    calls++
    const body = JSON.parse(String(init.body))
    assert.equal(body.tool_choice, 'none')
    assert.deepEqual(body.tools, [])
    assert.equal(body.messages.length, 2)
    return Response.json({ choices: [{ message: { content: JSON.stringify({ action: 'reply', text: 'Respuesta comercial' }) } }] })
  }) as typeof fetch
  const req = Readable.from([JSON.stringify({ organizationId: 'a', conversationId: 'c', specialistId: 'ventas', messages: [{ role: 'user', content: 'Precio' }] })]) as unknown as IncomingMessage
  req.method = 'POST'; req.headers = { authorization: `Bearer ${credential}`, 'content-type': 'application/json' }
  let status = 0; let payload = ''
  const res = { writeHead(code: number) { status = code }, end(data: string) { payload = data } } as unknown as ServerResponse
  await handleVerticeBridge(req, res)
  assert.equal(status, 200); assert.equal(calls, 1)
  assert.deepEqual(JSON.parse(payload), { organizationId: 'a', conversationId: 'c', specialistId: 'ventas', action: { action: 'reply', text: 'Respuesta comercial' } })
})
