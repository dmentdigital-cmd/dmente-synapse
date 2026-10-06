import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const dataDir = mkdtempSync(path.join(tmpdir(), 'synapse-projects-test-'))
const base = 'http://127.0.0.1:3057'
let child: ChildProcess
let cookie = ''
const envKey = (...parts: string[]) => parts.join('_')
const fixtureCredential = ['fixture', 'credential'].join('-')
const env = { ...process.env, NODE_ENV: 'test', PORT: '3057', SYNAPSE_DATA_DIR: dataDir, SYNAPSE_OWNER_USERNAME: 'fixture-owner', [envKey('SYNAPSE', 'OWNER', 'PASSWORD')]: fixtureCredential, [envKey('SYNAPSE', 'SESSION', 'SECRET')]: ['fixture', 'session', 'key'].join('-'), [envKey('SYNAPSE', 'MCP', 'TOKEN')]: '', [envKey('SYNAPSE', 'MCP', 'READ', 'TOKEN')]: ['fixture', 'read'].join('-'), [envKey('SYNAPSE', 'MCP', 'WRITE', 'TOKEN')]: ['fixture', 'write'].join('-'), SYNAPSE_MCP_READ_DOMAINS: 'agency,technology,projects', SYNAPSE_MCP_WRITE_DOMAINS: 'agency,technology', HERMES_API_URL: '' }
const day = 86_400_000
const at = (days: number) => new Date(Date.now() + days * day).toISOString()

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
async function signIn(username: string) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ username, [envKey('password')]: fixtureCredential }) })
  assert.equal(response.status, 200)
  return response.headers.get('set-cookie')!.split(';')[0]
}
// The API allows 100 requests a minute per address; a restart clears that in-memory window.
async function restart() { await stop(); await start(); cookie = await signIn(env.SYNAPSE_OWNER_USERNAME) }
async function api(route: string, method = 'GET', body?: unknown, options: { cookie?: string | null; origin?: string } = {}) {
  const session = options.cookie === undefined ? cookie : options.cookie
  const response = await fetch(`${base}${route}`, { method, headers: { ...(session ? { Cookie: session } : {}), Origin: options.origin ?? base, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() as any }
}
async function rpc(method: string, params: unknown, scope = 'write') {
  const response = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer fixture-${scope}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  return await response.json() as any
}
const mcp = (name: string, args: unknown, scope = 'write') => rpc('tools/call', { name, arguments: args }, scope)
async function database() {
  const { DatabaseSync } = await import('node:sqlite')
  return new DatabaseSync(path.join(dataDir, 'synapse.sqlite'))
}
before(async () => { await start(); cookie = await signIn(env.SYNAPSE_OWNER_USERNAME) })
after(async () => { await stop(); rmSync(dataDir, { recursive: true, force: true }) })

test('project ids already used by tasks appear as unclassified projects, once, and stay out of the traffic light', async () => {
  assert.equal((await api('/api/projects', 'GET', undefined, { cookie: null })).status, 401)
  const first = (await api('/api/projects')).data.projects
  const seeded = first.find((project: any) => project.id === 'corpav-diplomado-steam-ia')
  assert.equal(seeded.status, 'por_clasificar')
  assert.equal(seeded.origin, 'auto')
  assert.equal(seeded.health, null)
  assert.equal(seeded.openTasks, 1)
  assert.equal(first.find((project: any) => project.id === 'familia-lucia').domain, 'health')
  // A task created later with a new free-text id registers its project on the next read.
  const task = (await api('/api/operational-agenda/items', 'POST', { title: 'Free text project fixture', domain: 'technology', agentId: 'tecnico', projectId: 'legacy_Free Text' })).data.item
  const discovered = (await api('/api/projects')).data.projects.filter((project: any) => project.id === 'legacy_Free Text')
  assert.equal(discovered.length, 1)
  assert.equal(discovered[0].name, 'Legacy Free Text')
  const detail = await api(`/api/projects/${encodeURIComponent('legacy_Free Text')}`)
  assert.equal(detail.status, 200)
  assert.deepEqual(detail.data.tasks.map((item: any) => item.id), [task.id])
  await restart()
  const afterRestart = (await api('/api/projects')).data.projects
  assert.equal(afterRestart.length, new Set(afterRestart.map((project: any) => project.id)).size)
  assert.equal(afterRestart.filter((project: any) => project.id === 'corpav-diplomado-steam-ia').length, 1)
})

test('creating and editing a project validates identity, domain, dates and origin', async () => {
  const valid = { name: 'Implementación CRM Ñandú', domain: 'agency', code: 'crm01', startsAt: at(-10), dueAt: at(60), nextAction: 'Agendar kickoff' }
  assert.equal((await api('/api/projects', 'POST', valid, { cookie: null })).status, 401)
  assert.equal((await api('/api/projects', 'POST', valid, { origin: 'https://untrusted.example' })).status, 403)
  assert.equal((await api('/api/projects', 'POST', { ...valid, id: 'Has Spaces' })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, domain: 'nowhere' })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, startsAt: '2026-10-01T10:00:00' })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, startsAt: at(61) })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, ownerAgentId: 'nobody' })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, budget: 1 })).status, 400)
  assert.equal((await api('/api/projects', 'POST', { ...valid, clientId: 'missing' })).status, 400)
  const created = await api('/api/projects', 'POST', valid)
  assert.equal(created.status, 201)
  assert.equal(created.data.project.id, 'implementacion-crm-nandu')
  assert.equal(created.data.project.code, 'CRM01')
  assert.equal(created.data.project.status, 'en_curso')
  assert.equal(created.data.project.ownerAgentId, 'pmo')
  assert.equal(created.data.project.origin, 'manual')
  assert.equal(created.data.project.progress, null)
  assert.equal((await api('/api/projects', 'POST', valid)).status, 409)
  assert.equal((await api('/api/projects', 'POST', { name: 'Otro proyecto', domain: 'agency', code: 'CRM01' })).status, 409)
  const route = '/api/projects/implementacion-crm-nandu'
  assert.equal((await api(route, 'PATCH', {})).status, 400)
  assert.equal((await api(route, 'PATCH', { id: 'renamed' })).status, 400)
  assert.equal((await api(route, 'PATCH', { status: 'archivado' })).status, 400)
  const paused = await api(route, 'PATCH', { status: 'pausado', comment: 'Cliente pidió esperar' })
  assert.equal(paused.status, 200)
  assert.equal(paused.data.project.health, null)
  assert.equal((await api(route, 'PATCH', { status: 'en_curso', code: null })).data.project.code, null)
  assert.equal((await api('/api/projects/does-not-exist')).status, 404)
  assert.equal((await api('/api/projects?status=nope')).status, 400)
  assert.deepEqual((await api('/api/projects?status=en_curso')).data.projects.map((project: any) => project.id), ['implementacion-crm-nandu'])
  const db = await database()
  assert.equal(db.prepare("SELECT comment FROM agenda_status_history WHERE item_id = 'project:implementacion-crm-nandu' AND to_status = 'pausado'").get()?.comment, 'Cliente pidió esperar')
  const audit = db.prepare("SELECT actor_type, actor_id, summary FROM audit_events WHERE action = 'project_created'").get() as any
  assert.equal(audit.actor_type, 'human')
  assert.ok(audit.actor_id)
  assert.equal(audit.summary, '[redacted; SHA-256 recorded]')
  db.close()
})

test('milestones drive progress, the traffic light and the agenda, where they are read-only', async () => {
  const route = '/api/projects/implementacion-crm-nandu'
  assert.equal((await api(`${route}/milestones`, 'POST', { title: 'Sin fecha' })).status, 400)
  assert.equal((await api(`${route}/milestones`, 'POST', { title: 'Fechas cruzadas', startsAt: at(5), dueAt: at(1) })).status, 400)
  assert.equal((await api('/api/projects/does-not-exist/milestones', 'POST', { title: 'Huérfano', dueAt: at(1) })).status, 404)
  const kickoff = (await api(`${route}/milestones`, 'POST', { title: 'Kickoff', phase: 'Descubrimiento', dueAt: at(-3), ownerName: 'Diego' })).data.milestone
  const design = (await api(`${route}/milestones`, 'POST', { title: 'Diseño aprobado', phase: 'Diseño', dueAt: at(20), ownerAgentId: 'tecnico' })).data.milestone
  assert.deepEqual([kickoff.sortOrder, design.sortOrder], [0, 1])
  let project = (await api(route)).data.project
  assert.equal(project.health, 'rojo')
  assert.deepEqual(project.healthReasons, ['1 hito atrasado'])
  assert.equal(project.progress, 0)
  assert.equal(project.nextMilestone.id, kickoff.id)
  assert.equal(project.nextMilestone.daysLate, 3)
  assert.deepEqual(project.milestoneCounts, { total: 2, done: 0, open: 2, overdue: 1 })

  const agenda = (await api('/api/operational-agenda')).data.items
  const item = agenda.find((entry: any) => entry.id === `milestone:${kickoff.id}`)
  assert.equal(item.kind, 'milestone')
  assert.equal(item.projectId, 'implementacion-crm-nandu')
  assert.equal(agenda.find((entry: any) => entry.id === `milestone:${design.id}`).agentId, 'tecnico')
  const agendaRoute = `/api/operational-agenda/items/${encodeURIComponent(item.id)}`
  assert.equal((await api(`${agendaRoute}/details`, 'PATCH', { title: 'Changed from agenda' })).status, 404)
  assert.equal((await api(agendaRoute, 'PATCH', { status: 'done' })).status, 404)
  assert.equal((await api(agendaRoute, 'DELETE', { expectedTitle: 'Kickoff' })).status, 404)

  assert.equal((await api(`${route}/milestones/${kickoff.id}`, 'PATCH', { status: 'finished' })).status, 400)
  assert.equal((await api(`${route}/milestones/${kickoff.id}`, 'PATCH', { projectId: 'other' })).status, 400)
  const done = (await api(`${route}/milestones/${kickoff.id}`, 'PATCH', { status: 'done', comment: 'Reunión realizada' })).data.milestone
  assert.ok(done.completedAt)
  project = (await api(route)).data.project
  assert.equal(project.progress, 50)
  assert.equal(project.health, 'verde')
  assert.equal(project.nextMilestone.id, design.id)
  assert.equal((await api(`${route}/milestones/${kickoff.id}`, 'PATCH', { status: 'in_progress' })).data.milestone.completedAt, null)

  assert.equal((await api(`${route}/milestones/${design.id}`, 'DELETE', { expectedTitle: 'Otro título' })).status, 409)
  assert.equal((await api(`${route}/milestones/${design.id}`, 'DELETE', { expectedTitle: 'Diseño aprobado' })).data.deleted, true)
  assert.equal((await api(`${route}/milestones/${design.id}`, 'PATCH', { title: 'Revivir' })).status, 404)
  assert.equal((await api('/api/operational-agenda')).data.items.some((entry: any) => entry.id === `milestone:${design.id}`), false)
  const db = await database()
  assert.equal(db.prepare('SELECT comment FROM agenda_status_history WHERE item_id = ? AND to_status = ?').get(`milestone:${kickoff.id}`, 'done')?.comment, 'Reunión realizada')
  assert.ok(db.prepare('SELECT deleted_at FROM project_milestones WHERE id = ?').get(design.id)?.deleted_at)
  db.close()
})

test('tasks and commitments attach to a project, and blockers raise and clear the alert', async () => {
  await restart()
  const route = '/api/projects/implementacion-crm-nandu'
  const task = (await api('/api/operational-agenda/items', 'POST', { title: 'Configurar embudo', domain: 'technology', agentId: 'tecnico', projectId: 'implementacion-crm-nandu' })).data.item
  const commitment = (await api('/api/commitments', 'POST', { title: 'Reunión de seguimiento', domain: 'agency', projectId: 'implementacion-crm-nandu' })).data.commitment
  assert.equal(commitment.projectId, 'implementacion-crm-nandu')
  assert.equal((await api('/api/operational-agenda')).data.items.find((entry: any) => entry.id === `commitment:${commitment.id}`).projectId, 'implementacion-crm-nandu')
  let detail = (await api(route)).data
  assert.deepEqual(detail.tasks.map((entry: any) => entry.id).sort(), [task.id, `commitment:${commitment.id}`].sort())
  assert.equal(detail.project.openTasks, 2)
  const moved = await api(`/api/operational-agenda/items/${encodeURIComponent(`commitment:${commitment.id}`)}/details`, 'PATCH', { projectId: null })
  assert.equal(moved.status, 200)
  assert.equal((await api(route)).data.project.openTasks, 1)

  assert.equal((await api(`${route}/updates`, 'POST', { kind: 'chisme', text: 'x' })).status, 400)
  assert.equal((await api(`${route}/updates`, 'POST', { kind: 'avance' })).status, 400)
  const progress = (await api(`${route}/updates`, 'POST', { kind: 'avance', text: 'Embudo configurado al 60 %' })).data.update
  assert.equal(progress.source, 'manual')
  const blocker = (await api(`${route}/updates`, 'POST', { kind: 'bloqueo', text: 'Falta acceso al dominio del cliente' })).data.update
  detail = (await api(route)).data
  assert.equal(detail.project.openBlockers, 1)
  assert.equal(detail.project.health, 'rojo')
  assert.ok(detail.project.healthReasons.includes('1 bloqueo abierto'))
  assert.equal(detail.updates[0].id, blocker.id)
  assert.equal((await api(`${route}/updates/${progress.id}/resolve`, 'POST', {})).status, 400)
  const resolved = await api(`${route}/updates/${blocker.id}/resolve`, 'POST', { resolution: 'El cliente compartió el acceso' })
  assert.equal(resolved.status, 200)
  assert.ok(resolved.data.update.resolvedAt)
  assert.equal((await api(`${route}/updates/${blocker.id}/resolve`, 'POST', {})).status, 409)
  assert.equal((await api(route)).data.project.openBlockers, 0)
})

test('domain permissions hide projects, and clients need agency or sales access', async () => {
  assert.equal((await api('/api/admin/users', 'POST', { username: 'marketing-operator', name: 'Marketing', [envKey('password')]: fixtureCredential, role: 'operator', domains: ['marketing'] })).status, 201)
  assert.equal((await api('/api/admin/users', 'POST', { username: 'agency-viewer', name: 'Viewer', [envKey('password')]: fixtureCredential, role: 'viewer', domains: ['agency'] })).status, 201)
  const marketing = { cookie: await signIn('marketing-operator') }
  const viewer = { cookie: await signIn('agency-viewer') }
  const route = '/api/projects/implementacion-crm-nandu'
  assert.equal((await api('/api/projects', 'GET', undefined, marketing)).data.projects.some((project: any) => project.domain !== 'marketing'), false)
  assert.equal((await api(route, 'GET', undefined, marketing)).status, 403)
  assert.equal((await api(`${route}/milestones`, 'POST', { title: 'Intruso', dueAt: at(2) }, marketing)).status, 403)
  assert.equal((await api('/api/projects', 'POST', { name: 'Fuera de dominio', domain: 'agency' }, marketing)).status, 403)
  assert.equal((await api('/api/projects', 'POST', { name: 'Campaña de marca', domain: 'marketing' }, marketing)).status, 201)
  assert.equal((await api('/api/projects/campana-de-marca', 'PATCH', { domain: 'agency' }, marketing)).status, 403)
  assert.equal((await api('/api/projects/campana-de-marca', 'DELETE', { expectedName: 'Campaña de marca' }, marketing)).status, 403)
  assert.equal((await api('/api/clients', 'GET', undefined, marketing)).status, 403)
  assert.equal((await api('/api/project-digest', 'GET', undefined, marketing)).data.totals.tracked, 1)
  // A viewer reads but never writes. Tasks in a domain they lack stay out of the project they can see.
  const seen = await api(route, 'GET', undefined, viewer)
  assert.equal(seen.status, 200)
  assert.equal(seen.data.tasks.some((task: any) => task.domain === 'technology'), false)
  assert.equal((await api(route, 'PATCH', { nextAction: 'x' }, viewer)).status, 403)
  assert.equal((await api(`${route}/updates`, 'POST', { kind: 'avance', text: 'x' }, viewer)).status, 403)
  assert.equal((await api('/api/clients', 'POST', { name: 'X' }, viewer)).status, 403)

  assert.equal((await api('/api/clients', 'POST', { name: 'Hotel Bahía', email: 'not-an-email' })).status, 400)
  const client = (await api('/api/clients', 'POST', { name: 'Hotel Bahía', industry: 'Turismo', email: 'reservas@example.com' })).data.client
  assert.equal((await api(`/api/clients/${client.id}`, 'PATCH', { status: 'inactive' })).data.client.status, 'inactive')
  assert.equal((await api('/api/clients/missing', 'PATCH', { name: 'x' })).status, 404)
  assert.equal((await api(route, 'PATCH', { clientId: client.id })).data.project.clientName, 'Hotel Bahía')
  assert.deepEqual((await api(`/api/projects?clientId=${client.id}`)).data.projects.map((project: any) => project.id), ['implementacion-crm-nandu'])
  assert.equal((await api('/api/clients', 'GET', undefined, viewer)).data.clients.length, 1)
})

test('Lucia MCP reads with either scope and writes only with write scope inside its domains', async () => {
  await restart()
  const tools = (await rpc('tools/list', {})).result.tools.map((tool: any) => tool.name)
  for (const name of ['synapse_list_projects', 'synapse_get_project', 'synapse_projects_digest', 'synapse_create_project', 'synapse_update_project', 'synapse_create_milestone', 'synapse_update_milestone', 'synapse_add_project_update', 'synapse_resolve_blocker']) assert.ok(tools.includes(name), name)
  assert.equal(tools.some((name: string) => /delete_project/.test(name)), false)

  const listed = (await mcp('synapse_list_projects', {}, 'read')).result.structuredContent.projects
  assert.ok(listed.some((project: any) => project.id === 'implementacion-crm-nandu'))
  assert.equal(listed.some((project: any) => !['agency', 'technology', 'projects'].includes(project.domain)), false)
  assert.equal((await mcp('synapse_create_project', { name: 'Solo lectura', domain: 'agency' }, 'read')).error.code, -32003)
  assert.ok((await mcp('synapse_get_project', { projectId: 'familia-lucia' }, 'read')).error)
  assert.ok((await mcp('synapse_create_project', { name: 'Salud privada', domain: 'health' })).error)
  assert.ok((await mcp('synapse_update_project', { projectId: 'ples-crm-marcas', changes: { status: 'en_curso' } })).error, 'projects domain is read-only for the write token')

  const created = (await mcp('synapse_create_project', { name: 'Vertical Hoteles', domain: 'agency', code: 'HOTEL' })).result.structuredContent.project
  assert.equal(created.id, 'vertical-hoteles')
  assert.equal(created.origin, 'mcp')
  const payload = { projectId: 'vertical-hoteles', title: 'Reunión con aliados', dueAt: at(-1), externalId: 'hermes-cron:hoteles-1' }
  const first = (await mcp('synapse_create_milestone', payload)).result.structuredContent.milestone
  const second = (await mcp('synapse_create_milestone', { ...payload, title: 'Reunión con aliados (reprogramada)', dueAt: at(4) })).result.structuredContent.milestone
  assert.equal(second.id, first.id)
  assert.equal(second.title, 'Reunión con aliados (reprogramada)')
  assert.ok((await mcp('synapse_create_milestone', { ...payload, projectId: 'implementacion-crm-nandu' })).error)
  assert.equal((await mcp('synapse_get_project', { projectId: 'vertical-hoteles' }, 'read')).result.structuredContent.milestones.length, 1)
  assert.equal((await mcp('synapse_update_milestone', { projectId: 'vertical-hoteles', milestoneId: first.id, changes: { status: 'in_progress', dueAt: at(-2) } })).result.structuredContent.milestone.status, 'in_progress')

  const blocker = (await mcp('synapse_add_project_update', { projectId: 'vertical-hoteles', kind: 'bloqueo', text: 'Aliado sin confirmar fecha', externalId: 'bitacora:42' })).result.structuredContent.update
  assert.equal(blocker.source, 'mcp')
  assert.equal((await mcp('synapse_add_project_update', { projectId: 'vertical-hoteles', kind: 'bloqueo', text: 'Reintento', externalId: 'bitacora:42' })).result.structuredContent.update.id, blocker.id)
  const digest = (await mcp('synapse_projects_digest', {}, 'read')).result.structuredContent
  assert.equal(digest.timezone, 'America/Bogota')
  assert.deepEqual(digest.overdueMilestones.filter((milestone: any) => milestone.projectId === 'vertical-hoteles').map((milestone: any) => [milestone.title, milestone.daysLate]), [['Reunión con aliados (reprogramada)', 2]])
  assert.ok(digest.overdueMilestones.every((milestone: any) => milestone.projectName && milestone.dueAt))
  assert.deepEqual(digest.openBlockers.map((entry: any) => entry.updateId), [blocker.id])
  assert.ok(digest.attention.some((entry: any) => entry.projectId === 'vertical-hoteles' && entry.health === 'rojo'))
  assert.ok(digest.totals.porClasificar > 0)
  assert.equal((await mcp('synapse_resolve_blocker', { projectId: 'vertical-hoteles', updateId: blocker.id, resolution: 'Fecha confirmada' })).result.structuredContent.update.resolution, 'Fecha confirmada')
  assert.equal((await mcp('synapse_projects_digest', {}, 'read')).result.structuredContent.openBlockers.length, 0)
  const linked = (await mcp('synapse_create_commitment', { title: 'Llamada con hotel', domain: 'agency', projectId: 'vertical-hoteles', externalId: 'hermes-cron:hotel-call' })).result.structuredContent.commitment
  assert.equal(linked.projectId, 'vertical-hoteles')
  // Re-syncing the same event without a project keeps the link.
  assert.equal((await mcp('synapse_create_commitment', { title: 'Llamada con hotel', domain: 'agency', externalId: 'hermes-cron:hotel-call' })).result.structuredContent.commitment.projectId, 'vertical-hoteles')
})

test('deleting a project needs the exact name, keeps its tasks and survives a restart', async () => {
  const route = '/api/projects/vertical-hoteles'
  assert.equal((await api(route, 'DELETE', { expectedName: 'Otro nombre' })).status, 409)
  assert.equal((await api(route, 'DELETE', { expectedName: 'Vertical Hoteles' }, { cookie: null })).status, 401)
  assert.equal((await api(route, 'DELETE', { expectedName: 'Vertical Hoteles' })).data.deleted, true)
  assert.equal((await api(route)).status, 404)
  assert.equal((await api('/api/operational-agenda')).data.items.some((item: any) => item.kind === 'milestone' && item.projectId === 'vertical-hoteles'), false)
  assert.equal((await api('/api/projects', 'POST', { id: 'vertical-hoteles', name: 'Reuso del id', domain: 'agency' })).status, 409)
  await restart()
  assert.equal((await api('/api/projects')).data.projects.some((project: any) => project.id === 'vertical-hoteles'), false)
  // The commitment linked to it is still on the agenda and did not recreate the project.
  assert.ok((await api('/api/operational-agenda')).data.items.some((item: any) => item.kind === 'commitment' && item.projectId === 'vertical-hoteles'))
  const db = await database()
  assert.ok(db.prepare("SELECT deleted_at FROM projects WHERE id = 'vertical-hoteles'").get()?.deleted_at)
  assert.equal((db.prepare("SELECT COUNT(*) AS total FROM audit_events WHERE action = 'project_deleted'").get() as any).total, 1)
  db.close()
})
