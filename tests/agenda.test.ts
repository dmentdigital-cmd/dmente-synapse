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
  for (let count = 0; count < 80; count++) {
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
after(async () => { await stop(); rmSync(dataDir, { recursive: true, force: true }) })

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
