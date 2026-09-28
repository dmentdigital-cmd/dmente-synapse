import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Agent, AgentId, Commitment, Domain, MessageRecord, Permission, Profile, ProfileRole, RequestRecord, RequestStatus } from './types.js'

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
    created_at TEXT NOT NULL
  );
`)

const commitmentColumns = new Set((db.prepare('PRAGMA table_info(commitments)').all() as { name: string }[]).map((column) => column.name))
if (!commitmentColumns.has('updated_at')) db.exec("ALTER TABLE commitments ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")

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

export function listPermissions(profileId = localProfile.id): Permission[] {
  const rows = db.prepare('SELECT profile_id, domain, can_read, can_write, requires_approval FROM profile_permissions WHERE profile_id = ? ORDER BY domain').all(profileId) as Record<string, unknown>[]
  return rows.map((row) => ({ profileId: String(row.profile_id), domain: row.domain as Domain, canRead: Boolean(row.can_read), canWrite: Boolean(row.can_write), requiresApproval: Boolean(row.requires_approval) }))
}

export function createCommitment(input: { title: string; domain: Domain; people?: string[]; source?: Commitment['source']; startsAt?: string | null; dueAt?: string | null }): Commitment {
  const commitment: Commitment = {
    id: randomUUID(), title: input.title.trim(), domain: input.domain, people: input.people ?? [], source: input.source ?? 'manual',
    startsAt: input.startsAt ?? null, dueAt: input.dueAt ?? null, status: 'captured', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  db.prepare('INSERT INTO commitments (id, title, domain, people_json, source, starts_at, due_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(commitment.id, commitment.title, commitment.domain, JSON.stringify(commitment.people), commitment.source, commitment.startsAt, commitment.dueAt, commitment.status, commitment.createdAt, commitment.updatedAt)
  return commitment
}

export function listCommitments(domain?: Domain): Commitment[] {
  const rows = domain
    ? db.prepare('SELECT * FROM commitments WHERE domain = ? ORDER BY COALESCE(starts_at, due_at, created_at)').all(domain)
    : db.prepare('SELECT * FROM commitments ORDER BY COALESCE(starts_at, due_at, created_at)').all()
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), title: String(row.title), domain: row.domain as Domain, people: JSON.parse(String(row.people_json)), source: row.source as Commitment['source'],
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
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return requestFromRow(row)
}

export function listRequests(): RequestRecord[] {
  const rows = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(requestFromRow)
}

export function addMessage(input: { requestId?: string; agentId: AgentId; direction: 'user' | 'agent'; text: string }): MessageRecord {
  const message: MessageRecord = { id: randomUUID(), requestId: input.requestId ?? null, agentId: input.agentId, direction: input.direction, text: input.text, createdAt: new Date().toISOString() }
  db.prepare('INSERT INTO messages (id, request_id, agent_id, direction, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(message.id, message.requestId, message.agentId, message.direction, message.text, message.createdAt)
  return message
}

export function listMessages(agentId: AgentId): MessageRecord[] {
  const rows = db.prepare('SELECT id, request_id, agent_id, direction, text, created_at FROM messages WHERE agent_id = ? ORDER BY created_at ASC').all(agentId) as Record<string, unknown>[]
  return rows.map((row) => ({ id: String(row.id), requestId: row.request_id ? String(row.request_id) : null, agentId: row.agent_id as AgentId, direction: row.direction as MessageRecord['direction'], text: String(row.text), createdAt: String(row.created_at) }))
}

export function addAudit(input: { requestId?: string; action: string; summary: string; source: string }): void {
  db.prepare('INSERT INTO audit_events (id, request_id, action, summary, source, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), input.requestId ?? null, input.action, input.summary, input.source, new Date().toISOString())
}

export function closeDatabase(): void { db.close() }
