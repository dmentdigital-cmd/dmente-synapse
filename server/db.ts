import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Agent, AgentId, Commitment, Domain, MessageRecord, Permission, Profile, ProfileRole, RequestRecord, RequestStatus, UserAccount, UserRole } from './types.js'

const dataDir = process.env.SYNAPSE_DATA_DIR ?? path.resolve(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(path.join(dataDir, 'synapse.sqlite'))
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    domain TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'approver', 'admin')),
    domains_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    totp_secret_enc TEXT,
    totp_pending_enc TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profile_permissions (
    profile_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    can_read INTEGER NOT NULL,
    can_write INTEGER NOT NULL,
    requires_approval INTEGER NOT NULL,
    PRIMARY KEY (profile_id, domain),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );
  CREATE TABLE IF NOT EXISTS commitments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    people_json TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,
    starts_at TEXT,
    due_at TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
    ,external_id TEXT UNIQUE
  );
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    project_id TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    requires_approval INTEGER NOT NULL,
    approval_confirmed INTEGER NOT NULL DEFAULT 0,
    approved_at TEXT,
    starts_at TEXT,
    due_at TEXT,
    next_action TEXT NOT NULL DEFAULT 'Revisar solicitud',
    obsidian_note TEXT,
    source_path TEXT,
    source_drive_folder TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    agent_id TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'personal',
    direction TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'system',
    actor_id TEXT,
    project_id TEXT,
    tool_name TEXT,
    scope TEXT NOT NULL DEFAULT 'internal',
    input_hash TEXT,
    output_hash TEXT,
    approved_by TEXT,
    approved_at TEXT,
    result TEXT NOT NULL DEFAULT 'recorded'
  );
  CREATE TABLE IF NOT EXISTS agenda_status_history (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS agenda_status_history_item_created ON agenda_status_history (item_id, created_at DESC);
`)

const accountColumns = new Set((db.prepare('PRAGMA table_info(user_accounts)').all() as { name: string }[]).map((column) => column.name))
if (!accountColumns.has('totp_secret_enc')) db.exec('ALTER TABLE user_accounts ADD COLUMN totp_secret_enc TEXT')
if (!accountColumns.has('totp_pending_enc')) db.exec('ALTER TABLE user_accounts ADD COLUMN totp_pending_enc TEXT')

const messageColumns = new Set((db.prepare('PRAGMA table_info(messages)').all() as { name: string }[]).map((column) => column.name))
if (!messageColumns.has('domain')) {
  db.exec("ALTER TABLE messages ADD COLUMN domain TEXT NOT NULL DEFAULT 'personal'")
  db.exec("UPDATE messages SET domain = COALESCE((SELECT domain FROM requests WHERE requests.id = messages.request_id), (SELECT domain FROM agents WHERE agents.id = messages.agent_id), 'personal')")
}

const auditColumns = new Set((db.prepare('PRAGMA table_info(audit_events)').all() as { name: string }[]).map((column) => column.name))
for (const [name, declaration] of Object.entries({ actor_type: "TEXT NOT NULL DEFAULT 'system'", actor_id: 'TEXT', project_id: 'TEXT', tool_name: 'TEXT', scope: "TEXT NOT NULL DEFAULT 'internal'", input_hash: 'TEXT', output_hash: 'TEXT', approved_by: 'TEXT', approved_at: 'TEXT', result: "TEXT NOT NULL DEFAULT 'recorded'" })) {
  if (!auditColumns.has(name)) db.exec(`ALTER TABLE audit_events ADD COLUMN ${name} ${declaration}`)
}
db.exec(`
  CREATE TRIGGER IF NOT EXISTS audit_events_immutable_update BEFORE UPDATE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS audit_events_immutable_delete BEFORE DELETE ON audit_events
  BEGIN SELECT RAISE(ABORT, 'audit events are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS agenda_status_history_immutable_update BEFORE UPDATE ON agenda_status_history
  BEGIN SELECT RAISE(ABORT, 'agenda status history is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS agenda_status_history_immutable_delete BEFORE DELETE ON agenda_status_history
  BEGIN SELECT RAISE(ABORT, 'agenda status history is immutable'); END;
`)

const commitmentColumns = new Set((db.prepare('PRAGMA table_info(commitments)').all() as { name: string }[]).map((column) => column.name))
if (!commitmentColumns.has('updated_at')) db.exec("ALTER TABLE commitments ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
if (!commitmentColumns.has('external_id')) db.exec('ALTER TABLE commitments ADD COLUMN external_id TEXT')

const requestColumns = new Set((db.prepare('PRAGMA table_info(requests)').all() as { name: string }[]).map((column) => column.name))
if (!requestColumns.has('project_id')) db.exec('ALTER TABLE requests ADD COLUMN project_id TEXT')
if (!requestColumns.has('priority')) db.exec("ALTER TABLE requests ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'")
if (!requestColumns.has('next_action')) db.exec("ALTER TABLE requests ADD COLUMN next_action TEXT NOT NULL DEFAULT 'Revisar solicitud'")
if (!requestColumns.has('obsidian_note')) db.exec('ALTER TABLE requests ADD COLUMN obsidian_note TEXT')
if (!requestColumns.has('source_path')) db.exec('ALTER TABLE requests ADD COLUMN source_path TEXT')
if (!requestColumns.has('source_drive_folder')) db.exec('ALTER TABLE requests ADD COLUMN source_drive_folder TEXT')
if (!requestColumns.has('approval_confirmed')) db.exec('ALTER TABLE requests ADD COLUMN approval_confirmed INTEGER NOT NULL DEFAULT 0')
if (!requestColumns.has('approved_at')) db.exec('ALTER TABLE requests ADD COLUMN approved_at TEXT')
if (!requestColumns.has('starts_at')) db.exec('ALTER TABLE requests ADD COLUMN starts_at TEXT')
if (!requestColumns.has('due_at')) db.exec('ALTER TABLE requests ADD COLUMN due_at TEXT')

const seedAgents: Agent[] = [
  { id: 'gerente', name: 'LuciaBot', role: 'Gerente y orquestadora', domain: 'personal' },
  { id: 'secretaria', name: 'Secretaria', role: 'Agenda y administración', domain: 'personal' },
  { id: 'colegio-lucia', name: 'Colegio Lucía', role: 'Educación y eventos escolares', domain: 'education' },
  { id: 'salud-familiar', name: 'Salud Familiar', role: 'Citas y seguimiento privado', domain: 'health' },
  { id: 'finanzas-familiares', name: 'Finanzas Familiares', role: 'Pagos y presupuesto familiar', domain: 'finance' },
  { id: 'educacion-aprendizaje', name: 'Educación y Aprendizaje', role: 'Aprendizaje aplicado', domain: 'learning' },
  { id: 'conocimiento-obsidian', name: 'Conocimiento', role: 'Memoria y documentación', domain: 'knowledge' },
  { id: 'pmo', name: 'PMO', role: 'Proyectos y prioridades', domain: 'projects' },
  { id: 'tecnico', name: 'Técnico', role: 'Código, integraciones y QA', domain: 'technology' },
  { id: 'ventas', name: 'Ventas', role: 'Pipeline y oportunidades', domain: 'sales' },
  { id: 'marketing', name: 'Marketing', role: 'Crecimiento y campañas', domain: 'marketing' },
  { id: 'legal', name: 'Legal', role: 'Riesgos y cumplimiento', domain: 'legal' },
  { id: 'finanzas-dmente', name: 'Finanzas Dmente', role: 'Cobros y rentabilidad', domain: 'finance' },
  { id: 'producto-vertice', name: 'Producto Vértice', role: 'CRM y automatizaciones', domain: 'product' },
  { id: 'producto-synapse', name: 'Producto Synapse', role: 'Oficina, agentes y MCP', domain: 'product' },
  { id: 'whatsapp-conversaciones', name: 'WhatsApp', role: 'Conversaciones y prospectos', domain: 'messaging' },
]

const seed = db.prepare('INSERT INTO agents (id, name, role, domain) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, domain = excluded.domain')
for (const agent of seedAgents) seed.run(agent.id, agent.name, agent.role, agent.domain)

const seedAgenda = [
  { id: 'agenda-corpav-20260928', agentId: 'pmo', domain: 'agency', title: 'Preparar propuesta corta para CORPAV', projectId: 'corpav-diplomado-steam-ia', priority: 'high', risk: 'medium', approval: 1, startsAt: '2026-09-28T05:00:00-05:00', dueAt: '2026-09-28T08:00:00-05:00', nextAction: 'Preparar propuesta que beneficie a Dmente Digital; incluir 3 opciones de negociación, dejar claro que CORPAV ofrece $150.000 COP por 6 horas y recomendar aceptar solo como alianza estratégica/embudo B2B con marca, opt-in, diagnóstico, pitch final, agenda y revenue share. No enviar sin aprobación de Diego.', sourcePath: '/home/diego/proyectos/corpav/investigacion_precios_estrategias_venta_diplomado_steam_ia_2026-09-27.md' },
  { id: 'agenda-con-agentes-20260929', agentId: 'ventas', domain: 'sales', title: 'Coordinar reunión con Sebastián de Con Agentes y Gregorio Quintero', projectId: 'con-agentes-hoteles', priority: 'high', risk: 'low', approval: 1, startsAt: '2026-09-29T09:00:00-05:00', dueAt: '2026-10-03T18:00:00-05:00', nextAction: 'Coordinar reunión esta semana para alianza/vertical hoteles; preparar objetivo, material necesario, preguntas y siguiente paso. No enviar mensajes externos sin aprobación.', sourcePath: null },
  { id: 'agenda-instagram-review-20260928', agentId: 'tecnico', domain: 'technology', title: 'Grabar video para permiso faltante de Instagram', projectId: 'instagram-saas-app-review', priority: 'high', risk: 'medium', approval: 1, startsAt: '2026-09-28T09:00:00-05:00', dueAt: '2026-09-28T23:00:00-05:00', nextAction: 'Preparar/grabar video para el permiso faltante de Instagram App Review, mostrando envío/recepción nativa según requisito. No reenviar a Meta sin revisión de Diego.', sourcePath: null },
  { id: 'agenda-skool-capi-20260929', agentId: 'educacion-aprendizaje', domain: 'learning', title: 'Terminar curso de Skool sobre API de Conversiones', projectId: 'circulo-vocero-vibe-community', priority: 'normal', risk: 'low', approval: 0, startsAt: '2026-09-29T06:00:00-05:00', dueAt: '2026-10-05T20:00:00-05:00', nextAction: 'Terminar el curso de Skool de Kevin Belier/Vibe Community sobre API de Conversiones y convertirlo en aprendizaje aplicable para CAPI/Vértice/Can & Friends.', sourcePath: null },
  { id: 'agenda-ples-20260929', agentId: 'pmo', domain: 'projects', title: 'Reanudar proyecto PLES / CRM Marcas y buscar mejoras', projectId: 'ples-crm-marcas', priority: 'high', risk: 'medium', approval: 1, startsAt: '2026-09-29T09:00:00-05:00', dueAt: '2026-10-03T18:00:00-05:00', nextAction: 'Leer estado actual del proyecto, revisar bloqueos y proponer mejoras concretas. No tocar producción/repos/campañas sin aprobación.', sourcePath: '/home/diego/proyectos/ples_crmtania' },
  { id: 'agenda-can-friends-20260928', agentId: 'marketing', domain: 'marketing', title: 'Continuar campaña Can & Friends y resolver tracking/UTM', projectId: 'can-friends-grooming-studio', priority: 'high', risk: 'medium', approval: 1, startsAt: '2026-09-28T09:00:00-05:00', dueAt: '2026-10-03T18:00:00-05:00', nextAction: 'Continuar campaña de Can & Friends; revisar estado de anuncios, UTM en Parámetros de URL de Meta Ads Manager, GA4/Paid Social, y próximos pasos. No modificar anuncios ni pauta sin aprobación.', sourcePath: '/home/diego/proyectos/can_friends/estado_can_friends.md' },
  { id: 'agenda-salud-lucia-20260928', agentId: 'salud-familiar', domain: 'health', title: 'Reclamar medicina de Lucía', projectId: 'familia-lucia', priority: 'urgent', risk: 'medium', approval: 0, startsAt: '2026-09-28T07:45:00-05:00', dueAt: '2026-09-28T08:15:00-05:00', nextAction: 'Recordar a Diego reclamar la medicina de Lucía. Mantener detalles médicos privados; no registrar dosis ni diagnóstico en la vista general.', sourcePath: null },
] as const
const seedAgendaRequest = db.prepare(`INSERT OR IGNORE INTO requests
  (id, agent_id, domain, title, project_id, priority, status, risk_level, requires_approval, approval_confirmed, starts_at, due_at, next_action, source_path, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?, ?, ?, ?, ?, ?)`)
for (const item of seedAgenda) {
  const now = new Date().toISOString()
  seedAgendaRequest.run(item.id, item.agentId, item.domain, item.title, item.projectId, item.priority, item.risk, item.approval, item.startsAt, item.dueAt, item.nextAction, item.sourcePath, now, now)
}

const localProfile: Profile = { id: 'diego-local', name: 'Diego', role: 'owner' }
db.prepare('INSERT OR IGNORE INTO profiles (id, name, role) VALUES (?, ?, ?)').run(localProfile.id, localProfile.name, localProfile.role)
const domains: Domain[] = ['agency', 'personal', 'family', 'health', 'education', 'church', 'learning', 'wellbeing', 'projects', 'technology', 'finance', 'knowledge', 'product', 'messaging', 'sales', 'marketing', 'legal']
const permissionSeed = db.prepare('INSERT OR IGNORE INTO profile_permissions (profile_id, domain, can_read, can_write, requires_approval) VALUES (?, ?, ?, ?, ?)')
for (const domain of domains) permissionSeed.run(localProfile.id, domain, 1, 1, 0)

export function listAgents(): Agent[] {
  return db.prepare('SELECT id, name, role, domain FROM agents ORDER BY id').all() as unknown as Agent[]
}

export function getLocalProfile(): Profile {
  const row = db.prepare('SELECT id, name, role FROM profiles WHERE id = ?').get(localProfile.id) as Record<string, unknown>
  return { id: String(row.id), name: String(row.name), role: row.role as ProfileRole }
}

function accountFromRow(row: Record<string, unknown>): UserAccount {
  return { id: String(row.id), username: String(row.username), name: String(row.name), role: row.role as UserRole, domains: JSON.parse(String(row.domains_json)) as Domain[], active: Boolean(row.active), passwordHash: String(row.password_hash), passwordSalt: String(row.password_salt), totpSecretEncrypted: row.totp_secret_enc ? String(row.totp_secret_enc) : null, totpPendingEncrypted: row.totp_pending_enc ? String(row.totp_pending_enc) : null }
}

export function updateUserTotp(id: string, input: { secretEncrypted: string | null; pendingEncrypted: string | null }): boolean {
  const result = db.prepare('UPDATE user_accounts SET totp_secret_enc = ?, totp_pending_enc = ?, updated_at = ? WHERE id = ?').run(input.secretEncrypted, input.pendingEncrypted, new Date().toISOString(), id)
  return Number(result.changes) > 0
}

export function findUserByUsername(username: string): UserAccount | null {
  const row = db.prepare('SELECT * FROM user_accounts WHERE username = ? COLLATE NOCASE').get(username) as Record<string, unknown> | undefined
  return row ? accountFromRow(row) : null
}

export function findUserById(id: string): UserAccount | null {
  const row = db.prepare('SELECT * FROM user_accounts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? accountFromRow(row) : null
}

export function listUserAccounts(): Omit<UserAccount, 'passwordHash' | 'passwordSalt' | 'totpSecretEncrypted' | 'totpPendingEncrypted'>[] {
  const rows = db.prepare('SELECT id, username, name, role, domains_json, active FROM user_accounts ORDER BY name COLLATE NOCASE').all() as Record<string, unknown>[]
  return rows.map((row) => ({ id: String(row.id), username: String(row.username), name: String(row.name), role: row.role as UserRole, domains: JSON.parse(String(row.domains_json)) as Domain[], active: Boolean(row.active) }))
}

export function createUserAccount(input: { id: string; username: string; name: string; role: UserRole; domains: Domain[]; passwordHash: string; passwordSalt: string }): boolean {
  const now = new Date().toISOString()
  try {
    db.prepare('INSERT INTO user_accounts (id, username, name, role, domains_json, active, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)')
      .run(input.id, input.username, input.name, input.role, JSON.stringify(input.domains), input.passwordHash, input.passwordSalt, now, now)
    return true
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return false
    throw error
  }
}

export function updateUserAccount(id: string, input: { name?: string; role?: UserRole; domains?: Domain[]; active?: boolean; passwordHash?: string; passwordSalt?: string }): boolean {
  const current = findUserById(id)
  if (!current) return false
  const now = new Date().toISOString()
  db.prepare('UPDATE user_accounts SET name = ?, role = ?, domains_json = ?, active = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
    .run(input.name ?? current.name, input.role ?? current.role, JSON.stringify(input.domains ?? current.domains), input.active === undefined ? Number(current.active) : Number(input.active), input.passwordHash ?? current.passwordHash, input.passwordSalt ?? current.passwordSalt, now, id)
  return true
}

export function listPermissions(profileId = localProfile.id): Permission[] {
  const rows = db.prepare('SELECT profile_id, domain, can_read, can_write, requires_approval FROM profile_permissions WHERE profile_id = ? ORDER BY domain').all(profileId) as Record<string, unknown>[]
  return rows.map((row) => ({ profileId: String(row.profile_id), domain: row.domain as Domain, canRead: Boolean(row.can_read), canWrite: Boolean(row.can_write), requiresApproval: Boolean(row.requires_approval) }))
}

export function createCommitment(input: { title: string; domain: Domain; people?: string[]; source?: Commitment['source']; startsAt?: string | null; dueAt?: string | null; externalId?: string | null }): Commitment {
  const externalId = input.externalId?.trim() || null
  if (externalId && externalId.length > 200) throw new Error('externalId excede el máximo de 200 caracteres')
  if (externalId) {
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO commitments (id, title, domain, people_json, source, starts_at, due_at, status, created_at, updated_at, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'captured', ?, ?, ?)
      ON CONFLICT(external_id) DO UPDATE SET title = excluded.title, domain = excluded.domain, people_json = excluded.people_json,
      source = excluded.source, starts_at = excluded.starts_at, due_at = excluded.due_at, updated_at = excluded.updated_at, deleted_at = NULL`)
      .run(randomUUID(), input.title.trim(), input.domain, JSON.stringify(input.people ?? []), input.source ?? 'manual', input.startsAt ?? null, input.dueAt ?? null, now, now, externalId)
    const row = db.prepare('SELECT * FROM commitments WHERE external_id = ? AND deleted_at IS NULL').get(externalId) as Record<string, unknown>
    return commitmentFromRow(row)
  }
  const commitment: Commitment = {
    id: randomUUID(), title: input.title.trim(), domain: input.domain, people: input.people ?? [], source: input.source ?? 'manual',
    startsAt: input.startsAt ?? null, dueAt: input.dueAt ?? null, status: 'captured', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), externalId: null,
  }
  db.prepare('INSERT INTO commitments (id, title, domain, people_json, source, starts_at, due_at, status, created_at, updated_at, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run(commitment.id, commitment.title, commitment.domain, JSON.stringify(commitment.people), commitment.source, commitment.startsAt, commitment.dueAt, commitment.status, commitment.createdAt, commitment.updatedAt)
  return commitment
}

function commitmentFromRow(row: Record<string, unknown>): Commitment {
  return {
    id: String(row.id), title: String(row.title), domain: row.domain as Domain, people: JSON.parse(String(row.people_json)), source: row.source as Commitment['source'], externalId: row.external_id ? String(row.external_id) : null,
    startsAt: row.starts_at ? String(row.starts_at) : null, dueAt: row.due_at ? String(row.due_at) : null, status: row.status as Commitment['status'], createdAt: String(row.created_at), updatedAt: String(row.updated_at || row.created_at),
  }
}

// Tombstones retain history and keep seeded tasks from reappearing after restart.
for (const table of ['commitments', 'requests']) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((column) => column.name === 'deleted_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`)
}

export function getCommitment(id: string): Commitment | null {
  const row = db.prepare('SELECT * FROM commitments WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined
  return row ? commitmentFromRow(row) : null
}

export function updateCommitment(id: string, patch: Partial<Commitment>): Commitment | null {
  const current = getCommitment(id)
  if (!current) return null
  const next = { ...current, ...patch }
  db.prepare('UPDATE commitments SET title = ?, domain = ?, people_json = ?, starts_at = ?, due_at = ?, status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(next.title, next.domain, JSON.stringify(next.people), next.startsAt, next.dueAt, next.status, new Date().toISOString(), id)
  return getCommitment(id)
}

export function deleteCommitment(id: string): boolean {
  return Number(db.prepare('UPDATE commitments SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(new Date().toISOString(), new Date().toISOString(), id).changes) > 0
}

export function updateRequest(id: string, patch: Partial<RequestRecord>): RequestRecord | null {
  const current = getRequest(id)
  if (!current) return null
  const next = { ...current, ...patch }
  const changedApprovedWork = current.approvalConfirmed && Object.entries(patch).some(([key, value]) => key !== 'status' && value !== current[key as keyof RequestRecord])
  if (changedApprovedWork || (!current.requiresApproval && next.requiresApproval)) {
    next.approvalConfirmed = false
    next.approvedAt = null
    next.status = 'waiting_approval'
  }
  db.prepare('UPDATE requests SET title = ?, domain = ?, agent_id = ?, project_id = ?, priority = ?, risk_level = ?, next_action = ?, requires_approval = ?, approval_confirmed = ?, approved_at = ?, status = ?, starts_at = ?, due_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(next.title, next.domain, next.agentId, next.projectId, next.priority, next.riskLevel, next.nextAction ?? '', Number(next.requiresApproval), Number(next.approvalConfirmed), next.approvedAt, next.status, next.startsAt, next.dueAt, new Date().toISOString(), id)
  return getRequest(id)
}

export function deleteRequest(id: string): boolean {
  return Number(db.prepare('UPDATE requests SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(new Date().toISOString(), new Date().toISOString(), id).changes) > 0
}

export function listCommitments(domain?: Domain): Commitment[] {
  const rows = domain
    ? db.prepare('SELECT * FROM commitments WHERE domain = ? AND deleted_at IS NULL ORDER BY COALESCE(starts_at, due_at, created_at)').all(domain)
    : db.prepare('SELECT * FROM commitments WHERE deleted_at IS NULL ORDER BY COALESCE(starts_at, due_at, created_at)').all()
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), title: String(row.title), domain: row.domain as Domain, people: JSON.parse(String(row.people_json)), source: row.source as Commitment['source'], externalId: row.external_id ? String(row.external_id) : null,
    startsAt: row.starts_at ? String(row.starts_at) : null, dueAt: row.due_at ? String(row.due_at) : null, status: row.status as Commitment['status'], createdAt: String(row.created_at), updatedAt: String(row.updated_at || row.created_at),
  }))
}

export function updateCommitmentStatus(id: string, status: Commitment['status']): Commitment | null {
  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE commitments SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id)
  return listCommitments().find((commitment) => commitment.id === id) ?? null
}

export function createRequest(input: { agentId: AgentId; domain: Domain; title: string; projectId?: string | null; priority?: RequestRecord['priority']; riskLevel: RequestRecord['riskLevel']; requiresApproval: boolean; initialStatus?: RequestStatus; startsAt?: string | null; dueAt?: string | null; nextAction?: string; obsidianNote?: string | null; sourcePath?: string | null; sourceDriveFolder?: string | null }): RequestRecord {
  const now = new Date().toISOString()
  const request: RequestRecord = { id: randomUUID(), agentId: input.agentId, domain: input.domain, title: input.title, projectId: input.projectId ?? null, priority: input.priority ?? 'normal', status: input.requiresApproval ? 'waiting_approval' : input.initialStatus ?? 'in_progress', riskLevel: input.riskLevel, requiresApproval: input.requiresApproval, approvalConfirmed: false, approvedAt: null, nextAction: input.nextAction ?? 'Revisar solicitud', startsAt: input.startsAt ?? null, dueAt: input.dueAt ?? null, obsidianNote: input.obsidianNote ?? null, sourcePath: input.sourcePath ?? null, sourceDriveFolder: input.sourceDriveFolder ?? null, createdAt: now, updatedAt: now }
  db.prepare('INSERT INTO requests (id, agent_id, domain, title, project_id, priority, status, risk_level, requires_approval, approval_confirmed, starts_at, due_at, next_action, obsidian_note, source_path, source_drive_folder, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(request.id, request.agentId, request.domain, request.title, request.projectId, request.priority, request.status, request.riskLevel, request.requiresApproval ? 1 : 0, request.startsAt, request.dueAt, request.nextAction, request.obsidianNote, request.sourcePath, request.sourceDriveFolder, now, now)
  return request
}

export function updateRequestStatus(id: string, status: RequestStatus): RequestRecord | null {
  const current = getRequest(id)
  if (!current || (status === 'done' && current.requiresApproval && !current.approvalConfirmed)) return null
  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id)
  return getRequest(id)
}

export function recordAgendaStatusChange(input: { itemId: string; fromStatus: string; toStatus: string; comment: string }): { comment: string; createdAt: string } {
  const createdAt = new Date().toISOString()
  db.prepare('INSERT INTO agenda_status_history (id, item_id, from_status, to_status, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), input.itemId, input.fromStatus, input.toStatus, input.comment || null, createdAt)
  return { comment: input.comment, createdAt }
}

export function getLatestAgendaStatusComment(itemId: string): { comment: string | null; createdAt: string } | null {
  const row = db.prepare('SELECT comment, created_at FROM agenda_status_history WHERE item_id = ? ORDER BY created_at DESC LIMIT 1').get(itemId) as { comment: string | null; created_at: string } | undefined
  return row ? { comment: row.comment, createdAt: row.created_at } : null
}

export function confirmRequestApproval(id: string): RequestRecord | null {
  const current = getRequest(id)
  if (!current || !current.requiresApproval || current.status === 'done' || current.status === 'cancelled') return null
  const approvedAt = new Date().toISOString()
  db.prepare("UPDATE requests SET approval_confirmed = 1, approved_at = ?, status = 'in_progress', updated_at = ? WHERE id = ?")
    .run(approvedAt, approvedAt, id)
  return getRequest(id)
}

export function updateRequestSchedule(id: string, schedule: { startsAt: string | null; dueAt: string | null }): RequestRecord | null {
  if (!getRequest(id)) return null
  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE requests SET starts_at = ?, due_at = ?, updated_at = ? WHERE id = ?').run(schedule.startsAt, schedule.dueAt, updatedAt, id)
  return getRequest(id)
}

export function updateRequestSources(id: string, sources: { obsidianNote?: string | null; sourcePath?: string | null; sourceDriveFolder?: string | null }): RequestRecord | null {
  if (!getRequest(id)) return null
  const current = getRequest(id)!
  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE requests SET obsidian_note = ?, source_path = ?, source_drive_folder = ?, updated_at = ? WHERE id = ?')
    .run(sources.obsidianNote === undefined ? current.obsidianNote : sources.obsidianNote, sources.sourcePath === undefined ? current.sourcePath : sources.sourcePath, sources.sourceDriveFolder === undefined ? current.sourceDriveFolder : sources.sourceDriveFolder, updatedAt, id)
  return getRequest(id)
}

function requestFromRow(row: Record<string, unknown>): RequestRecord {
  return { id: String(row.id), agentId: row.agent_id as AgentId, domain: row.domain as Domain, title: String(row.title), projectId: row.project_id ? String(row.project_id) : null, priority: (row.priority ?? 'normal') as RequestRecord['priority'], status: row.status as RequestStatus, riskLevel: row.risk_level as RequestRecord['riskLevel'], requiresApproval: Boolean(row.requires_approval), approvalConfirmed: Boolean(row.approval_confirmed), approvedAt: row.approved_at ? String(row.approved_at) : null, nextAction: String(row.next_action ?? 'Revisar solicitud'), startsAt: row.starts_at ? String(row.starts_at) : null, dueAt: row.due_at ? String(row.due_at) : null, obsidianNote: row.obsidian_note ? String(row.obsidian_note) : null, sourcePath: row.source_path ? String(row.source_path) : null, sourceDriveFolder: row.source_drive_folder ? String(row.source_drive_folder) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

export function getRequest(id: string): RequestRecord | null {
  const row = db.prepare('SELECT * FROM requests WHERE id = ? AND deleted_at IS NULL').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return requestFromRow(row)
}

export function listRequests(): RequestRecord[] {
  const rows = db.prepare('SELECT * FROM requests WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(requestFromRow)
}

export function addMessage(input: { requestId?: string; agentId: AgentId; domain: Domain; direction: 'user' | 'agent'; text: string }): MessageRecord {
  const message: MessageRecord = { id: randomUUID(), requestId: input.requestId ?? null, agentId: input.agentId, domain: input.domain, direction: input.direction, text: input.text, createdAt: new Date().toISOString() }
  db.prepare('INSERT INTO messages (id, request_id, agent_id, domain, direction, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(message.id, message.requestId, message.agentId, message.domain, message.direction, message.text, message.createdAt)
  return message
}

export function listMessages(agentId: AgentId, allowedDomains?: Domain[]): MessageRecord[] {
  if (allowedDomains && !allowedDomains.length) return []
  const rows = allowedDomains
    ? db.prepare(`SELECT id, request_id, agent_id, domain, direction, text, created_at FROM messages WHERE agent_id = ? AND domain IN (${allowedDomains.map(() => '?').join(',')}) ORDER BY created_at ASC`).all(agentId, ...allowedDomains)
    : db.prepare('SELECT id, request_id, agent_id, domain, direction, text, created_at FROM messages WHERE agent_id = ? ORDER BY created_at ASC').all(agentId)
  return (rows as Record<string, unknown>[]).map((row) => ({ id: String(row.id), requestId: row.request_id ? String(row.request_id) : null, agentId: row.agent_id as AgentId, domain: row.domain as Domain, direction: row.direction as MessageRecord['direction'], text: String(row.text), createdAt: String(row.created_at) }))
}

export function addAudit(input: { requestId?: string; action: string; summary: string; source: string; actorId?: string }): void {
  const createdAt = new Date().toISOString()
  const inputHash = createHash('sha256').update(input.summary).digest('hex')
  const actorType = /^(hermes|mcp)/i.test(input.source) ? 'agent' : input.source === 'manual' || input.source === 'admin' ? 'human' : 'system'
  const approved = input.action === 'approval_confirmed'
  db.prepare(`INSERT INTO audit_events
    (id, request_id, action, summary, source, created_at, actor_type, actor_id, tool_name, scope, input_hash, approved_by, approved_at, result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'internal', ?, ?, ?, 'recorded')`)
    .run(randomUUID(), input.requestId ?? null, input.action, '[redacted; SHA-256 recorded]', input.source, createdAt, actorType, input.actorId ?? (actorType === 'human' ? 'diego-local' : input.source), input.action, inputHash, approved ? input.actorId ?? 'diego-local' : null, approved ? createdAt : null)
}

export function closeDatabase(): void { db.close() }
