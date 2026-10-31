import { randomUUID } from 'node:crypto'
import { database, listPermissions } from './db.js'
import type { Domain } from './types.js'

const db = database()
db.exec(`
  CREATE TABLE IF NOT EXISTS account_health_sources (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    reference TEXT,
    updated_at TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    last_error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_health_sources_account ON account_health_sources(account_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS account_health_reviews (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('rojo', 'amarillo', 'verde')),
    reason TEXT NOT NULL,
    signals_json TEXT NOT NULL,
    uncertainties_json TEXT NOT NULL DEFAULT '[]',
    actions_json TEXT NOT NULL,
    source_ids_json TEXT NOT NULL DEFAULT '[]',
    generated_by TEXT NOT NULL,
    rules_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_health_reviews_account ON account_health_reviews(account_id, created_at DESC);
`)

export type AccountHealthActor = { actorId?: string; allowDomain: (domain: Domain) => boolean }
export type AccountHealthSource = { id: string; accountId: string; type: string; name: string; reference: string | null; updatedAt: string | null; status: string; lastError: string | null; createdAt: string }
export type AccountHealthSignal = { label: string; value: string; target?: string | null; severity?: 'red' | 'yellow' | 'green' | 'unknown'; sourceId?: string | null }
export type AccountHealthAction = { description: string; owner: string; dueAt: string; signal: string; status: 'pending' | 'in_progress' | 'done' | 'cancelled' }
export type AccountHealthReview = { id: string; accountId: string; status: 'rojo' | 'amarillo' | 'verde'; reason: string; signals: AccountHealthSignal[]; uncertainties: string[]; actions: AccountHealthAction[]; sourceIds: string[]; generatedBy: string; rulesVersion: string; createdAt: string }

export class AccountHealthError extends Error { constructor(message: string, public statusCode = 400) { super(message) } }

function text(value: unknown, name: string, max = 500, required = true): string | null {
  if (value === null || value === undefined || value === '') { if (required) throw new AccountHealthError(`${name} es obligatorio.`); return null }
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AccountHealthError(`${name} no válido.`)
  return value.trim()
}
function date(value: unknown, name: string, required = false): string | null {
  const result = text(value, name, 80, required)
  if (!result) return null
  if (Number.isNaN(Date.parse(result))) throw new AccountHealthError(`${name} debe ser una fecha válida.`)
  return new Date(result).toISOString()
}
function accountAllowed(accountId: string, actor: AccountHealthActor): boolean {
  const row = db.prepare('SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL').get(accountId) as { id: string } | undefined
  if (!row) throw new AccountHealthError('Cuenta no encontrada.', 404)
  if (!actor.allowDomain('agency') && !actor.allowDomain('sales')) throw new AccountHealthError('No tienes acceso a la salud de cuentas.', 403)
  return true
}
function sourceFromRow(row: Record<string, unknown>): AccountHealthSource { return { id: String(row.id), accountId: String(row.account_id), type: String(row.type), name: String(row.name), reference: row.reference ? String(row.reference) : null, updatedAt: row.updated_at ? String(row.updated_at) : null, status: String(row.status), lastError: row.last_error ? String(row.last_error) : null, createdAt: String(row.created_at) } }
function reviewFromRow(row: Record<string, unknown>): AccountHealthReview { return { id: String(row.id), accountId: String(row.account_id), status: row.status as AccountHealthReview['status'], reason: String(row.reason), signals: JSON.parse(String(row.signals_json)) as AccountHealthSignal[], uncertainties: JSON.parse(String(row.uncertainties_json)) as string[], actions: JSON.parse(String(row.actions_json)) as AccountHealthAction[], sourceIds: JSON.parse(String(row.source_ids_json)) as string[], generatedBy: String(row.generated_by), rulesVersion: String(row.rules_version), createdAt: String(row.created_at) } }

export function listAccountHealth(actor: AccountHealthActor) {
  if (!actor.allowDomain('agency') && !actor.allowDomain('sales')) return []
  const clients = db.prepare("SELECT id, name, status FROM clients WHERE deleted_at IS NULL AND status = 'active' ORDER BY name COLLATE NOCASE").all() as Record<string, unknown>[]
  const rank = (status: unknown) => status === 'rojo' ? 0 : status === 'amarillo' ? 1 : status === 'verde' ? 2 : 3
  return clients.map((client) => {
    const review = db.prepare('SELECT * FROM account_health_reviews WHERE account_id = ? ORDER BY created_at DESC LIMIT 1').get(String(client.id)) as Record<string, unknown> | undefined
    const sources = db.prepare('SELECT COUNT(*) AS count FROM account_health_sources WHERE account_id = ?').get(String(client.id)) as { count: number }
    return { id: String(client.id), name: String(client.name), status: review?.status ?? null, reason: review?.reason ?? null, lastReviewAt: review?.created_at ? String(review.created_at) : null, sourceCount: Number(sources.count), actionsOpen: review ? (JSON.parse(String(review.actions_json)) as AccountHealthAction[]).filter((action) => action.status !== 'done' && action.status !== 'cancelled').length : 0 }
  }).sort((left, right) => rank(left.status) - rank(right.status) || left.name.localeCompare(right.name, 'es'))
}

export function getAccountHealth(accountId: string, actor: AccountHealthActor) {
  accountAllowed(accountId, actor)
  const account = db.prepare('SELECT id, name, status, industry FROM clients WHERE id = ? AND deleted_at IS NULL').get(accountId) as Record<string, unknown>
  return { account: { id: String(account.id), name: String(account.name), status: String(account.status), industry: account.industry ? String(account.industry) : null }, sources: (db.prepare('SELECT * FROM account_health_sources WHERE account_id = ? ORDER BY created_at DESC').all(accountId) as Record<string, unknown>[]).map(sourceFromRow), reviews: (db.prepare('SELECT * FROM account_health_reviews WHERE account_id = ? ORDER BY created_at DESC').all(accountId) as Record<string, unknown>[]).map(reviewFromRow) }
}

export function addAccountHealthSource(accountId: string, input: Record<string, unknown>, actor: AccountHealthActor) {
  accountAllowed(accountId, actor)
  const now = new Date().toISOString(); const id = randomUUID()
  const source = { id, accountId, type: text(input.type, 'type', 80)!, name: text(input.name, 'name', 200)!, reference: text(input.reference, 'reference', 1000, false), updatedAt: date(input.updatedAt, 'updatedAt'), status: text(input.status ?? 'available', 'status', 40)!, lastError: text(input.lastError, 'lastError', 500, false), createdAt: now }
  db.prepare('INSERT INTO account_health_sources (id, account_id, type, name, reference, updated_at, status, last_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(source.id, source.accountId, source.type, source.name, source.reference, source.updatedAt, source.status, source.lastError, source.createdAt)
  return source
}

export function classifyAccountHealth(signals: AccountHealthSignal[], uncertainties: string[]): AccountHealthReview['status'] {
  if (signals.some((signal) => signal.severity === 'red')) return 'rojo'
  if (signals.some((signal) => signal.severity === 'yellow' || signal.severity === 'unknown') || uncertainties.length) return 'amarillo'
  return 'verde'
}
export function createAccountHealthReview(accountId: string, input: Record<string, unknown>, actor: AccountHealthActor) {
  accountAllowed(accountId, actor)
  if (!Array.isArray(input.signals) || input.signals.length === 0) throw new AccountHealthError('Registra al menos una señal verificable; no se puede inventar una clasificación.')
  if (!Array.isArray(input.actions) || input.actions.length !== 2) throw new AccountHealthError('Cada revisión debe tener exactamente dos acciones prioritarias.')
  const signals = input.signals.map((raw) => { if (!raw || typeof raw !== 'object') throw new AccountHealthError('Señal no válida.'); const item = raw as Record<string, unknown>; const severity = item.severity ?? 'unknown'; if (!['red', 'yellow', 'green', 'unknown'].includes(String(severity))) throw new AccountHealthError('severity no válido.'); return { label: text(item.label, 'label', 160)!, value: text(item.value, 'value', 500)!, target: text(item.target, 'target', 200, false), severity: severity as AccountHealthSignal['severity'], sourceId: text(item.sourceId, 'sourceId', 100, false) } })
  const actions = input.actions.map((raw) => { if (!raw || typeof raw !== 'object') throw new AccountHealthError('Acción no válida.'); const item = raw as Record<string, unknown>; const status = item.status ?? 'pending'; if (!['pending', 'in_progress', 'done', 'cancelled'].includes(String(status))) throw new AccountHealthError('Estado de acción no válido.'); return { description: text(item.description, 'description', 500)!, owner: text(item.owner, 'owner', 160)!, dueAt: date(item.dueAt, 'dueAt', true)!, signal: text(item.signal, 'signal', 300)!, status: status as AccountHealthAction['status'] } })
  const uncertainties = Array.isArray(input.uncertainties) ? input.uncertainties.map((item) => text(item, 'uncertainty', 300)!).filter(Boolean) : []
  const reason = text(input.reason, 'reason', 500)!
  const review: AccountHealthReview = { id: randomUUID(), accountId, status: classifyAccountHealth(signals, uncertainties), reason, signals, uncertainties, actions, sourceIds: Array.isArray(input.sourceIds) ? input.sourceIds.map((item) => text(item, 'sourceId', 100)!) : [], generatedBy: actor.actorId ?? 'manual', rulesVersion: 'account-health-v1', createdAt: new Date().toISOString() }
  db.prepare('INSERT INTO account_health_reviews (id, account_id, status, reason, signals_json, uncertainties_json, actions_json, source_ids_json, generated_by, rules_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(review.id, review.accountId, review.status, review.reason, JSON.stringify(review.signals), JSON.stringify(review.uncertainties), JSON.stringify(review.actions), JSON.stringify(review.sourceIds), review.generatedBy, review.rulesVersion, review.createdAt)
  return review
}
