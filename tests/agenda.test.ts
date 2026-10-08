import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dataDir = mkdtempSync(path.join(tmpdir(), 'synapse-agenda-test-'))
const base = 'http://127.0.0.1:3055'
let child: ChildProcess
let cookie = ''
const envKey = (...parts: string[]) => parts.join('_')
const env = { ...process.env, NODE_ENV: 'test', PORT: '3055', SYNAPSE_DATA_DIR: dataDir, SYNAPSE_OWNER_USERNAME: 'fixture-owner', [envKey('SYNAPSE', 'OWNER', 'PASSWORD')]: ['fixture', 'credential'].join('-'), [envKey('SYNAPSE', 'SESSION', 'SECRET')]: ['fixture', 'session', 'key'].join('-'), [envKey('SYNAPSE', 'MCP', 'TOKEN')]: '', [envKey('SYNAPSE', 'MCP', 'READ', 'TOKEN')]: ['fixture', 'read'].join('-'), [envKey('SYNAPSE', 'MCP', 'WRITE', 'TOKEN')]: ['fixture', 'write'].join('-'), SYNAPSE_MCP_WRITE_DOMAINS: 'agency,technology', HERMES_API_URL: '' }

async function start() {
  child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout?.on('data', (chunk) => { output += String(chunk) })
  child.stderr?.on('data', (chunk) => { output += String(chunk) })
  for (let count = 0; count < 400; count++) {
    if (child.exitCode !== null) throw new Error(output)
    try { if ((await fetch(`${base}/api/health`)).ok) return } catch { /* Wait for server startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Startup timed out: ${output}`)
}
async function stop() {
  if (child.exitCode !== null) return
  await new Promise<void>((resolve) => { child.once('exit', () => resolve()); child.kill() })
}
async function login() {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ username: env.SYNAPSE_OWNER_USERNAME, [envKey('password')]: env[envKey('SYNAPSE', 'OWNER', 'PASSWORD')] }) })
  assert.equal(response.status, 200)
  cookie = response.headers.get('set-cookie')!.split(';')[0]
  const status = await api('/api/auth/session')
  if (!status.data.termsAccepted) assert.equal((await api('/api/profile')).status, 403)
  const acceptance = await fetch(`${base}/api/account/terms-acceptance`, { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted: true }) })
  assert.equal(acceptance.status, 200)
}
async function api(route: string, method = 'GET', body?: unknown, authenticated = true, origin = base) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(authenticated ? { Cookie: cookie } : {}), Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() as any }
}
async function mcp(name: string, args: unknown, scope = 'write') {
  const response = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer fixture-${scope}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
  return await response.json() as any
}
before(async () => { await start(); await login() })
after(async () => { await stop(); rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }) })

test('data deletion requests are visible to their owner and to an admin without creating duplicates', async () => {
  const invalid = await api('/api/account/data-deletion-request', 'POST', { confirmation: 'no' })
  assert.equal(invalid.status, 400)
  const first = await api('/api/account/data-deletion-request', 'POST', { confirmation: 'SOLICITAR BORRADO' })
  assert.equal(first.status, 202)
  const repeated = await api('/api/account/data-deletion-request', 'POST', { confirmation: 'SOLICITAR BORRADO' })
  assert.equal(repeated.data.request.id, first.data.request.id)
  const own = await api('/api/account/data-deletion-request')
  assert.equal(own.data.request.id, first.data.request.id)
  const pending = await api('/api/admin/data-deletion-requests')
  assert.equal(pending.data.requests.some((item: { id: string }) => item.id === first.data.request.id), true)
})

test('sensitive domains require an independently verified guardian authorization for a regular account', async () => {
  const fixturePassword = ['fixture', 'guardian', 'credential'].join('-')
  const created = await api('/api/admin/users', 'POST', { username: 'guardian-fixture', name: 'Guardian Fixture', password: fixturePassword, role: 'viewer', domains: ['family'] })
  assert.equal(created.status, 201)
  const familyItem = await api('/api/commitments', 'POST', { title: 'Prueba de acceso familiar', domain: 'family' })
  assert.equal(familyItem.status, 201)
  const loginResponse = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'guardian-fixture', password: fixturePassword }) })
  assert.equal(loginResponse.status, 200)
  const userCookie = loginResponse.headers.get('set-cookie')!.split(';')[0]
  const asGuardian = async (route: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}${route}`, { method, headers: { Cookie: userCookie, Origin: base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, data: await response.json() as any }
  }
  assert.equal((await asGuardian('/api/agents')).status, 403)
  assert.equal((await asGuardian('/api/account/terms-acceptance', 'POST', { accepted: true })).status, 200)
  assert.equal((await asGuardian('/api/commitments?domain=family')).status, 403)
  assert.equal((await asGuardian('/api/account/guardian-authorization', 'POST', { guardianName: 'Test Guardian', relationship: 'padre', authorized: false })).status, 400)
  assert.equal((await asGuardian('/api/account/guardian-authorization', 'POST', { guardianName: 'Test Guardian', relationship: 'padre', authorized: true })).status, 202)
  assert.equal((await asGuardian('/api/commitments?domain=family')).status, 403)
  const pending = await api('/api/admin/guardian-authorizations')
  assert.equal(pending.data.requests.some((item: { userId: string }) => item.userId === created.data.user.id), true)
  assert.equal((await asGuardian('/api/admin/guardian-authorizations/verify', 'POST', { userId: created.data.user.id, evidenceReference: 'case-12345' })).status, 403)
  assert.equal((await api('/api/admin/guardian-authorizations/verify', 'POST', { userId: created.data.user.id, evidenceReference: 'case-12345' })).status, 200)
  assert.equal((await asGuardian('/api/account/guardian-authorization')).data.authorization.verifiedAt !== null, true)
  assert.equal((await asGuardian('/api/commitments?domain=family')).data.commitments.some((item: { id: string }) => item.id === familyItem.data.commitment.id), true)
  assert.equal((await asGuardian('/api/account/guardian-authorization', 'DELETE')).status, 200)
  assert.equal((await asGuardian('/api/commitments?domain=family')).status, 403)
})

test('owner can edit and delete the duplicate while preserving the newer commitment and history after restart', async () => {
  const duplicate = (await api('/api/commitments', 'POST', { title: 'Grabar video de verificación para permiso faltante de Instagram en Facebook Developers', domain: 'agency', startsAt: '2026-09-25T04:00:00-05:00', dueAt: '2026-09-25T04:30:00-05:00' })).data.commitment
  const newer = (await api('/api/commitments', 'POST', { title: 'Grabar video faltante permiso mensajes de Instagram', domain: 'technology' })).data.commitment
  const id = `commitment:${duplicate.id}`
  const route = `/api/operational-agenda/items/${encodeURIComponent(id)}`
  assert.equal((await api(`${route}/details`, 'PATCH', { title: 'Updated' }, false)).status, 401)
  assert.equal((await api(`${route}/details`, 'PATCH', { title: 'Updated' }, true, 'https://untrusted.example')).status, 403)
  assert.equal((await api(`${route}/details`, 'PATCH', { dueAt: '2026-09-24T01:00:00Z' })).status, 400)
  assert.equal((await api(`${route}/details`, 'PATCH', { startsAt: null, dueAt: null })).status, 200)
  assert.equal((await api(route, 'PATCH', { status: 'in_progress', comment: 'Keep this history' })).status, 200)
  assert.equal((await api(route, 'DELETE', { expectedTitle: newer.title })).status, 409)
  assert.equal((await api(route, 'DELETE', { expectedTitle: duplicate.title }, false)).status, 401)
  assert.equal((await api(route, 'DELETE', { expectedTitle: duplicate.title })).data.deleted, true)
  assert.equal((await api(route, 'DELETE', { expectedTitle: duplicate.title })).status, 404)
  await stop(); await start(); await login()
  const commitments = (await api('/api/commitments')).data.commitments
  assert.equal(commitments.some((item: any) => item.id === duplicate.id), false)
  assert.deepEqual(commitments.find((item: any) => item.id === newer.id), newer)
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(path.join(dataDir, 'synapse.sqlite'))
  assert.ok(db.prepare('SELECT deleted_at FROM commitments WHERE id = ?').get(duplicate.id)?.deleted_at)
  assert.equal(db.prepare('SELECT comment FROM agenda_status_history WHERE item_id = ?').get(id)?.comment, 'Keep this history')
  db.close()
})

test('Lucia MCP can edit/delete commitments with write scope, exact title and permitted domain', async () => {
  const commitment = (await api('/api/commitments', 'POST', { title: 'MCP deletion fixture', domain: 'agency' })).data.commitment
  assert.equal((await mcp('synapse_delete_commitment', { id: commitment.id, expectedTitle: commitment.title }, 'read')).error.code, -32003)
  assert.ok((await mcp('synapse_update_commitment', { id: commitment.id, changes: { domain: 'health' } })).error)
  assert.ok((await mcp('synapse_update_commitment', { id: commitment.id, changes: { title: '' } })).error)
  const edit = await mcp('synapse_update_commitment', { id: commitment.id, changes: { title: 'MCP updated fixture', startsAt: '2026-10-01T10:00:00-05:00', people: ['Diego'] } })
  assert.equal(edit.result.structuredContent.commitment.title, 'MCP updated fixture')
  assert.ok((await mcp('synapse_delete_commitment', { id: commitment.id, expectedTitle: commitment.title })).error)
  assert.equal((await mcp('synapse_delete_commitment', { id: commitment.id, expectedTitle: 'MCP updated fixture' })).result.structuredContent.deleted, true)
  const privateTask = (await api('/api/commitments', 'POST', { title: 'Private fixture', domain: 'health' })).data.commitment
  assert.ok((await mcp('synapse_delete_task', { id: privateTask.id, expectedTitle: privateTask.title })).error)
})

test('Hermes cronjob sync updates one agenda commitment by external job ID without duplicates', async () => {
  const payload = { title: 'Día de la Sonrisa de Lucía', domain: 'agency', startsAt: '2026-10-02T07:30:00-05:00', dueAt: '2026-10-02T14:30:00-05:00', externalId: 'hermes-cron:b485a638267c' }
  const first = await mcp('synapse_create_commitment', payload)
  assert.equal(first.result.structuredContent.commitment.source, 'cronjob')
  const second = await mcp('synapse_create_commitment', { ...payload, title: 'Día de la Sonrisa Lucía, ropa amarilla o blanca' })
  assert.equal(second.result.structuredContent.commitment.id, first.result.structuredContent.commitment.id)
  assert.equal(second.result.structuredContent.commitment.title, 'Día de la Sonrisa Lucía, ropa amarilla o blanca')
  const listed = await mcp('synapse_list_commitments', { domain: 'agency' })
  assert.equal(listed.result.structuredContent.commitments.filter((item: { externalId?: string }) => item.externalId === payload.externalId).length, 1)
})

test('editing tasks preserves approval and deleted seeded tasks do not reappear', async () => {
  const task = (await api('/api/operational-agenda/items', 'POST', { title: 'Approval fixture', domain: 'technology', agentId: 'tecnico', requiresApproval: true })).data.item
  const route = `/api/operational-agenda/items/${task.id}`
  assert.equal((await api(`${route}/details`, 'PATCH', { requiresApproval: false })).status, 400)
  assert.equal((await api(`${route}/details`, 'PATCH', { status: 'done' })).status, 409)
  assert.equal((await api(`/api/requests/${task.id}/approve`, 'POST')).status, 200)
  const edit = await mcp('synapse_update_task', { id: task.id, changes: { title: 'Changed approved work', projectId: 'fixture', nextAction: 'Review' } })
  assert.equal(edit.result.structuredContent.request.approvalConfirmed, false)
  assert.equal(edit.result.structuredContent.request.status, 'waiting_approval')
  assert.equal((await mcp('synapse_delete_task', { id: task.id, expectedTitle: 'Changed approved work' })).result.structuredContent.deleted, true)
  const seed = (await api('/api/operational-agenda')).data.items.find((item: any) => item.kind === 'request' && item.id.startsWith('agenda-'))
  assert.ok(seed)
  assert.equal((await api(`/api/operational-agenda/items/${seed.id}`, 'DELETE', { expectedTitle: seed.title })).status, 200)
  await stop(); await start(); await login()
  assert.equal((await api('/api/operational-agenda')).data.items.some((item: any) => item.id === seed.id), false)
  assert.equal((await api(`${route}/details`, 'PATCH', { title: 'Resurrect' })).status, 404)
})
