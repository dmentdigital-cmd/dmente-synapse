import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, test } from 'node:test'

const dataDir = mkdtempSync(path.join(tmpdir(), 'synapse-leads-test-'))
const base = 'http://127.0.0.1:3056'
const token = 'fixture-leads-token-with-at-least-32-characters'
const fixturePassword = 'YOUR-TEST-PASSWORD'
const fixtureSessionSecret = 'YOUR-TEST-SESSION-SECRET-FOR-LEAD-TESTS-01'
const env = {
  ...process.env, NODE_ENV: 'test', PORT: '3056', SYNAPSE_DATA_DIR: dataDir,
  SYNAPSE_LEADS_INGEST_TOKEN: token, SYNAPSE_TRUSTED_PROXY_HOPS: '1',
  SYNAPSE_OWNER_USERNAME: 'fixture-owner', SYNAPSE_OWNER_PASSWORD: fixturePassword, SYNAPSE_SESSION_SECRET: fixtureSessionSecret,
  LEADS_DEFAULT_PIPELINE: 'comercial', LEADS_DEFAULT_STAGE: 'entrada', LEADS_DEFAULT_OWNER_ID: 'ventas-test',
  HERMES_API_URL: '',
}
let child: ChildProcess
let db: DatabaseSync

const sample = {
  name: 'Laura Gómez', email: 'LAURA@EXAMPLE.COM', whatsapp: '+57 300 123 4567',
  company: 'Empresa Ejemplo', service: 'Automatización con IA', message: 'Quiero agendar una llamada.',
  language: 'es', origin: { utm_source: 'google', utm_campaign: 'x', page: 'https://dmentedigital.co/' },
}

async function submit(body: unknown, options: { authorization?: string | null; key?: string; address?: string; origin?: string } = {}) {
  const response = await fetch(`${base}/api/public/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': options.address ?? '198.51.100.10',
      ...(options.authorization === null ? {} : { Authorization: options.authorization ?? `Bearer ${token}` }),
      ...(options.key ? { 'Idempotency-Key': options.key } : {}),
      ...(options.origin ? { Origin: options.origin } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() as Record<string, any>, headers: response.headers }
}

before(async () => {
  child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout?.on('data', (chunk) => { output += String(chunk) })
  child.stderr?.on('data', (chunk) => { output += String(chunk) })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(output)
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        db = new DatabaseSync(path.join(dataDir, 'synapse.sqlite'))
        return
      }
    } catch { /* Wait for startup. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Startup timed out: ${output}`)
})

after(async () => {
  db?.close()
  if (child && child.exitCode === null) await new Promise<void>((resolve) => { child.once('exit', resolve); child.kill() })
  rmSync(dataDir, { recursive: true, force: true })
})

test('creates a normalized lead with configured routing and no CORS headers', async () => {
  const result = await submit(sample, { key: 'landing-submission-1', origin: 'https://dmentedigital.co' })
  assert.equal(result.status, 201)
  assert.match(result.data.id, /^[a-f0-9-]{36}$/)
  assert.equal(result.data.submissionCount, 1)
  assert.equal(result.headers.get('access-control-allow-origin'), null)
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.data.id) as Record<string, any>
  assert.equal(row.email, 'laura@example.com')
  assert.equal(row.phone, '+573001234567')
  assert.equal(row.pipeline, 'comercial')
  assert.equal(row.stage, 'entrada')
  assert.equal(row.owner_id, 'ventas-test')
  assert.equal(row.status, 'new')
  assert.equal(row.utm_source, 'google')
  const preflight = await fetch(`${base}/api/public/leads`, { method: 'OPTIONS', headers: { Origin: 'https://dmentedigital.co', 'Access-Control-Request-Method': 'POST' } })
  assert.equal(preflight.headers.get('access-control-allow-origin'), null)
  const otherMutation = await fetch(`${base}/api/commitments`, { method: 'POST', headers: { Origin: 'https://dmentedigital.co', 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(otherMutation.status, 403)
})

test('rejects missing required fields, unknown fields and invalid values', async () => {
  for (const [body, field] of [
    [{ whatsapp: '+573001234569' }, 'name'],
    [{ name: 'Ana' }, 'whatsapp'],
    [{ ...sample, whatsapp: '3001234567' }, 'whatsapp'],
    [{ ...sample, unknown: 'x' }, 'unknown'],
    [{ ...sample, origin: { other: 'x' } }, 'origin.other'],
    [{ ...sample, language: 'fr' }, 'language'],
  ] as const) {
    const result = await submit(body)
    assert.equal(result.status, 400)
    assert.equal(result.data.field, field)
  }
})

test('rejects missing, wrong and MCP credentials', async () => {
  for (const authorization of [null, 'Bearer incorrect', 'Bearer fixture-write']) {
    const result = await submit(sample, { authorization })
    assert.equal(result.status, 401)
  }
})

test('deduplicates by phone, updates message and increments count', async () => {
  const result = await submit({ ...sample, email: 'new@example.com', whatsapp: '+57 (300) 123-4567', message: 'Segundo mensaje.' }, { key: 'landing-submission-2' })
  assert.equal(result.status, 200)
  assert.equal(result.data.submissionCount, 2)
  const rows = db.prepare('SELECT * FROM leads').all() as Record<string, any>[]
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, result.data.id)
  assert.equal(rows[0].message, 'Segundo mensaje.')
})

test('deduplicates by email when phone changes', async () => {
  const result = await submit({ ...sample, email: 'NEW@EXAMPLE.COM', whatsapp: '+573119876543', message: 'Tercer mensaje.' }, { key: 'landing-submission-3' })
  assert.equal(result.status, 200)
  assert.equal(result.data.submissionCount, 3)
  assert.equal((db.prepare('SELECT phone FROM leads WHERE id = ?').get(result.data.id) as { phone: string }).phone, '+573119876543')
  assert.equal((db.prepare('SELECT COUNT(*) AS total FROM leads').get() as { total: number }).total, 1)
})

test('identical retry returns the same ID without incrementing, including after a newer submission', async () => {
  const retry = await submit(sample, { key: 'landing-submission-1' })
  assert.equal(retry.status, 200)
  assert.equal(retry.data.submissionCount, 3)
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(retry.data.id) as Record<string, any>
  assert.equal(row.message, 'Tercer mensaje.')
  const latestRetry = await submit({ ...sample, email: 'NEW@EXAMPLE.COM', whatsapp: '+573119876543', message: 'Tercer mensaje.' })
  assert.equal(latestRetry.status, 200)
  assert.equal(latestRetry.data.submissionCount, 3)
  const reused = await submit({ ...sample, message: 'Cambio con clave vieja' }, { key: 'landing-submission-1' })
  assert.equal(reused.status, 409)
})

test('partial duplicate retains optional contact data and does not recount an identical retry', async () => {
  const partial = { name: 'Laura Gómez', whatsapp: '+573119876543', message: 'Consulta adicional.' }
  const first = await submit(partial, { address: '198.51.100.11' })
  assert.equal(first.status, 200)
  assert.equal(first.data.submissionCount, 4)
  const row = db.prepare('SELECT email, company, message FROM leads WHERE id = ?').get(first.data.id) as Record<string, any>
  assert.equal(row.email, 'new@example.com')
  assert.equal(row.company, 'Empresa Ejemplo')
  assert.equal(row.message, 'Consulta adicional.')
  const retry = await submit(partial, { address: '198.51.100.11' })
  assert.equal(retry.status, 200)
  assert.equal(retry.data.submissionCount, 4)
})

test('rejects ambiguous match between two different existing leads', async () => {
  const other = await submit({ name: 'Carlos', email: 'carlos@example.com', whatsapp: '+573221234567' }, { address: '198.51.100.12' })
  assert.equal(other.status, 201)
  const conflict = await submit({ name: 'Persona', email: 'carlos@example.com', whatsapp: '+573119876543' }, { address: '198.51.100.12' })
  assert.equal(conflict.status, 409)
  assert.equal((db.prepare('SELECT COUNT(*) AS total FROM leads').get() as { total: number }).total, 2)
})

test('authenticated sales read is paginated and a user without sales access is denied', async () => {
  const anonymous = await fetch(`${base}/api/leads`)
  assert.equal(anonymous.status, 401)
  const loginResponse = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ username: env.SYNAPSE_OWNER_USERNAME, password: env.SYNAPSE_OWNER_PASSWORD }) })
  assert.equal(loginResponse.status, 200)
  const adminCookie = loginResponse.headers.get('set-cookie')!.split(';')[0]
  const first = await fetch(`${base}/api/leads?limit=1&offset=0`, { headers: { Cookie: adminCookie } })
  assert.equal(first.status, 200)
  const firstPage = await first.json() as { leads: Array<{ id: string }>; total: number }
  assert.equal(firstPage.total, 2)
  assert.equal(firstPage.leads.length, 1)
  const second = await fetch(`${base}/api/leads?limit=1&offset=1`, { headers: { Cookie: adminCookie } })
  const secondPage = await second.json() as { leads: Array<{ id: string }> }
  assert.equal(secondPage.leads.length, 1)
  assert.notEqual(secondPage.leads[0].id, firstPage.leads[0].id)
  const invalid = await fetch(`${base}/api/leads?limit=101`, { headers: { Cookie: adminCookie } })
  assert.equal(invalid.status, 400)

  const user = await fetch(`${base}/api/admin/users`, { method: 'POST', headers: { Cookie: adminCookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'marketing-viewer', name: 'Marketing', password: fixturePassword, role: 'viewer', domains: ['marketing'] }) })
  assert.equal(user.status, 201)
  const viewerLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'marketing-viewer', password: fixturePassword }) })
  assert.equal(viewerLogin.status, 200)
  const viewerCookie = viewerLogin.headers.get('set-cookie')!.split(';')[0]
  const forbidden = await fetch(`${base}/api/leads`, { headers: { Cookie: viewerCookie } })
  assert.equal(forbidden.status, 403)
})

test('route has its own rate limit in addition to the general API limit', async () => {
  let limited = false
  for (let count = 0; count < 21; count += 1) {
    const result = await submit({}, { authorization: null, address: '198.51.100.99' })
    if (count < 20) assert.equal(result.status, 401)
    else {
      assert.equal(result.status, 429)
      limited = true
    }
  }
  assert.equal(limited, true)
})
