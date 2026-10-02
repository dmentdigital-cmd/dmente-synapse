import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { allowApiRequest, applySecurityHeaders, readJsonBody, sameOriginMutation } from '../server/security.js'

const isolatedDataDir = mkdtempSync(path.join(tmpdir(), 'synapse-security-suite-'))
process.env.SYNAPSE_DATA_DIR = isolatedDataDir

function request(headers: Record<string, string | undefined> = {}, address = '192.0.2.10'): IncomingMessage {
  return { headers, socket: { remoteAddress: address } } as unknown as IncomingMessage
}

test('security response headers include framing, MIME, policy and HTTPS controls', () => {
  const values: Record<string, string | number | readonly string[]> = {}
  const response = { setHeader: (name: string, value: string | number | readonly string[]) => { values[name] = value } } as unknown as ServerResponse
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'test'
  applySecurityHeaders(response)
  assert.equal(values['X-Content-Type-Options'], 'nosniff')
  assert.equal(values['X-Frame-Options'], 'DENY')
  assert.match(String(values['Content-Security-Policy']), /frame-ancestors 'none'/)
  assert.equal(values['Strict-Transport-Security'], undefined)
  process.env.NODE_ENV = 'production'
  applySecurityHeaders(response)
  assert.match(String(values['Strict-Transport-Security']), /max-age=31536000/)
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv
})

test('same-origin check rejects cross-site mutations and allows the Synapse origin', () => {
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'test'
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', origin: 'https://synapse.example' })), true)
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', origin: 'http://synapse.example' })), true)
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', origin: 'https://attacker.example' })), false)
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', 'sec-fetch-site': 'cross-site' })), false)
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', cookie: 'synapse_session=token' })), false)
  process.env.NODE_ENV = 'production'
  assert.equal(sameOriginMutation(request({ host: 'synapse.example', origin: 'http://synapse.example' })), false)
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv
})

test('API rate limit returns false after the configured request threshold', () => {
  const address = '192.0.2.44'
  for (let count = 0; count < 100; count += 1) assert.equal(allowApiRequest(request({}, address), 1_000), true)
  assert.equal(allowApiRequest(request({}, address), 1_000), false)
  assert.equal(allowApiRequest(request({}, address), 61_001), true)
})

test('JSON parser rejects wrong content type and bodies larger than its limit', async () => {
  const wrongType = Object.assign(Readable.from(['{}']), { headers: { 'content-type': 'text/plain' } }) as IncomingMessage
  await assert.rejects(readJsonBody(wrongType), (error: unknown) => (error as { statusCode?: number }).statusCode === 415)

  const tooLarge = Object.assign(Readable.from(['12345']), { headers: { 'content-type': 'application/json' } }) as IncomingMessage
  await assert.rejects(readJsonBody(tooLarge, 4), (error: unknown) => (error as { statusCode?: number }).statusCode === 413)
})

test('owner sessions are signed and login attempts are rate limited', async () => {
  const envKey = (...parts: string[]) => parts.join('_')
  process.env[envKey('SYNAPSE', 'OWNER', 'USERNAME')] = 'test-owner'
  process.env[envKey('SYNAPSE', 'OWNER', 'PASSWORD')] = ['test', 'password'].join('-')
  process.env[envKey('SYNAPSE', 'SESSION', 'SECRET')] = 'test-session-key-long-random-value'
  process.env[envKey('SYNAPSE', 'TOTP', 'ENCRYPTION', 'KEY')] = 'test-encryption-key-long-random-value-1234'
  process.env[envKey('SYNAPSE', 'OWNER', 'TOTP', 'SECRET')] = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  process.env.NODE_ENV = 'production'
  const { authConfigured, authStatus, clearSession, clearSessionCookie, login, loginBlocked, revokeUserSessions, sessionFromRequest, setSessionCookie, validateProductionSecurityConfiguration, verifyTotp } = await import('../server/auth.js')
  assert.equal(authConfigured(), true)
  assert.doesNotThrow(validateProductionSecurityConfiguration)
  assert.equal(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000), true)
  assert.equal(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000), false)

  const testPassword = ['test', 'password'].join('-')
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(login('test-owner', 'incorrect', '192.0.2.88'), null)
  assert.equal(loginBlocked('192.0.2.88'), true)

  assert.equal(login('test-owner', testPassword, '192.0.2.90'), null)
  const secretBytes = Buffer.from('12345678901234567890')
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const hmac = createHmac('sha1', secretBytes).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
  const token = login('test-owner', testPassword, '192.0.2.89', String(binary % 1_000_000).padStart(6, '0'))
  assert.ok(token)
  assert.equal(authStatus(request()).mfaRequired, true)
  const cookie = `synapse_session=${token}`
  assert.deepEqual(sessionFromRequest(request({ cookie })), { userId: 'diego-local' })
  assert.equal(sessionFromRequest(request({ cookie: `${cookie}x` })), null)

  let setCookie = ''
  const response = { setHeader: (_name: string, value: string) => { setCookie = value } } as unknown as ServerResponse
  setSessionCookie(response, token)
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /Secure/)
  clearSession(request({ cookie }))
  assert.equal(sessionFromRequest(request({ cookie })), null)
  const replacementToken = login('test-owner', testPassword, '192.0.2.91', String(binary % 1_000_000).padStart(6, '0'))
  assert.ok(replacementToken)
  revokeUserSessions('diego-local')
  assert.equal(sessionFromRequest(request({ cookie: `synapse_session=${replacementToken}` })), null)
  clearSessionCookie(response)
  assert.match(setCookie, /Max-Age=0/)
  assert.match(setCookie, /Secure/)
})

test('trusted proxy mode falls back to the direct peer when the forwarding chain is incomplete', async () => {
  const previousHops = process.env.SYNAPSE_TRUSTED_PROXY_HOPS
  process.env.SYNAPSE_TRUSTED_PROXY_HOPS = '2'
  const { clientAddress } = await import('../server/security.js')
  assert.equal(clientAddress(request({ 'x-forwarded-for': '198.51.100.7' }, '192.0.2.15')), '192.0.2.15')
  assert.equal(clientAddress(request({ 'x-forwarded-for': '198.51.100.7, 192.0.2.12' }, '192.0.2.15')), '198.51.100.7')
  if (previousHops === undefined) delete process.env.SYNAPSE_TRUSTED_PROXY_HOPS
  else process.env.SYNAPSE_TRUSTED_PROXY_HOPS = previousHops
})

test('MCP cannot remove approval and sensitive audit summaries are hashed and immutable', async () => {
  const dataDir = isolatedDataDir
  delete process.env.SYNAPSE_MCP_TOKEN
  process.env.SYNAPSE_MCP_READ_TOKEN = 'test-mcp-read-token'
  process.env.SYNAPSE_MCP_WRITE_TOKEN = 'test-mcp-write-token'
  process.env.SYNAPSE_MCP_READ_DOMAINS = 'agency'
  process.env.SYNAPSE_MCP_WRITE_DOMAINS = 'marketing'
  const { addAudit, addMessage, closeDatabase, listMessages } = await import('../server/db.js')
  const { handleMcp } = await import('../server/mcp.js')

  let requestBody = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'synapse_create_request', arguments: { title: 'Internal test', agentId: 'marketing', domain: 'marketing', requiresApproval: false } } })
  let responseBody = ''
  const outgoing = {
    setHeader: () => undefined,
    writeHead: () => undefined,
    end: (value?: string) => { responseBody = value ?? '' },
  } as unknown as ServerResponse
  const incoming = (authorization: string) => Object.assign(Readable.from([requestBody]), { method: 'POST', headers: { authorization, 'content-type': 'application/json' } }) as IncomingMessage
  await handleMcp(incoming('Bearer test-mcp-write-token'), outgoing)
  const rpc = JSON.parse(responseBody) as { result: { structuredContent: { request: { requiresApproval: boolean } } } }
  assert.equal(rpc.result.structuredContent.request.requiresApproval, true)
  await handleMcp(incoming('Bearer test-mcp-read-token'), outgoing)
  const denied = JSON.parse(responseBody) as { error?: { code?: number } }
  assert.equal(denied.error?.code, -32003)

  requestBody = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'synapse_create_request', arguments: { title: 'Out of scope', agentId: 'finanzas-dmente', domain: 'finance' } } })
  await handleMcp(incoming('Bearer test-mcp-write-token'), outgoing)
  assert.ok(JSON.parse(responseBody).error)

  requestBody = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'synapse_list_requests', arguments: {} } })
  await handleMcp(incoming('Bearer test-mcp-read-token'), outgoing)
  const scopedList = JSON.parse(responseBody) as { result: { structuredContent: { requests: Array<{ domain: string }> } } }
  assert.ok(scopedList.result.structuredContent.requests.every((item) => item.domain === 'agency'))

  addMessage({ agentId: 'gerente', domain: 'agency', direction: 'user', text: 'agency-only' })
  addMessage({ agentId: 'gerente', domain: 'health', direction: 'user', text: 'health-only' })
  assert.deepEqual(listMessages('gerente', ['agency']).map((item) => item.text), ['agency-only'])

  addAudit({ action: 'test_sensitive_action', summary: 'PRIVATE_TEST_SECRET_VALUE', source: 'manual' })
  const auditDb = new DatabaseSync(path.join(dataDir, 'synapse.sqlite'))
  const row = auditDb.prepare("SELECT summary, actor_type, input_hash FROM audit_events WHERE action = 'test_sensitive_action'").get() as { summary: string; actor_type: string; input_hash: string }
  assert.equal(row.summary.includes('PRIVATE_TEST_SECRET_VALUE'), false)
  assert.equal(row.actor_type, 'human')
  assert.match(row.input_hash, /^[a-f0-9]{64}$/)
  assert.throws(() => auditDb.prepare("UPDATE audit_events SET summary = 'changed' WHERE action = 'test_sensitive_action'").run(), /immutable/)
  auditDb.close()
  closeDatabase()
  rmSync(dataDir, { recursive: true, force: true })
})
