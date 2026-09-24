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
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    requires_approval INTEGER NOT NULL,
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

const seedAgents: Agent[] = [
  { id: 'secretaria', name: 'Secretaria', role: 'Coordina la operación', domain: 'personal' },
  { id: 'legal', name: 'Legal', role: 'Analiza riesgos y contratos', domain: 'agency' },
  { id: 'marketing', name: 'Marketing', role: 'Diseña crecimiento y campañas', domain: 'agency' },
  { id: 'ventas', name: 'Ventas', role: 'Gestiona oportunidades', domain: 'agency' },
  { id: 'gerente', name: 'LuciaBot', role: 'Gerente y orquestadora', domain: 'personal' },
]

const seed = db.prepare('INSERT OR IGNORE INTO agents (id, name, role, domain) VALUES (?, ?, ?, ?)')
for (const agent of seedAgents) seed.run(agent.id, agent.name, agent.role, agent.domain)

const localProfile: Profile = { id: 'diego-local', name: 'Diego', role: 'owner' }
db.prepare('INSERT OR IGNORE INTO profiles (id, name, role) VALUES (?, ?, ?)').run(localProfile.id, localProfile.name, localProfile.role)
const domains: Domain[] = ['agency', 'personal', 'family', 'health', 'education', 'church', 'learning', 'wellbeing']
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
    startsAt: input.startsAt ?? null, dueAt: input.dueAt ?? null, status: 'captured', createdAt: new Date().toISOString(),
  }
  db.prepare('INSERT INTO commitments (id, title, domain, people_json, source, starts_at, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(commitment.id, commitment.title, commitment.domain, JSON.stringify(commitment.people), commitment.source, commitment.startsAt, commitment.dueAt, commitment.status, commitment.createdAt)
  return commitment
}

export function listCommitments(domain?: Domain): Commitment[] {
  const rows = domain
    ? db.prepare('SELECT * FROM commitments WHERE domain = ? ORDER BY COALESCE(starts_at, due_at, created_at)').all(domain)
    : db.prepare('SELECT * FROM commitments ORDER BY COALESCE(starts_at, due_at, created_at)').all()
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), title: String(row.title), domain: row.domain as Domain, people: JSON.parse(String(row.people_json)), source: row.source as Commitment['source'],
    startsAt: row.starts_at ? String(row.starts_at) : null, dueAt: row.due_at ? String(row.due_at) : null, status: row.status as Commitment['status'], createdAt: String(row.created_at),
  }))
}

export function createRequest(input: { agentId: AgentId; domain: Domain; title: string; riskLevel: RequestRecord['riskLevel']; requiresApproval: boolean }): RequestRecord {
  const now = new Date().toISOString()
  const request: RequestRecord = { id: randomUUID(), agentId: input.agentId, domain: input.domain, title: input.title, status: input.requiresApproval ? 'waiting_approval' : 'in_progress', riskLevel: input.riskLevel, requiresApproval: input.requiresApproval, createdAt: now, updatedAt: now }
  db.prepare('INSERT INTO requests (id, agent_id, domain, title, status, risk_level, requires_approval, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(request.id, request.agentId, request.domain, request.title, request.status, request.riskLevel, request.requiresApproval ? 1 : 0, now, now)
  return request
}

export function updateRequestStatus(id: string, status: RequestStatus): RequestRecord | null {
  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE requests SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id)
  return getRequest(id)
}

export function getRequest(id: string): RequestRecord | null {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return { id: String(row.id), agentId: row.agent_id as AgentId, domain: row.domain as Domain, title: String(row.title), status: row.status as RequestStatus, riskLevel: row.risk_level as RequestRecord['riskLevel'], requiresApproval: Boolean(row.requires_approval), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

export function listRequests(): RequestRecord[] {
  const rows = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map((row) => ({ id: String(row.id), agentId: row.agent_id as AgentId, domain: row.domain as Domain, title: String(row.title), status: row.status as RequestStatus, riskLevel: row.risk_level as RequestRecord['riskLevel'], requiresApproval: Boolean(row.requires_approval), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }))
}

export function addMessage(input: { requestId?: string; agentId: AgentId; direction: 'user' | 'agent'; text: string }): void {
  db.prepare('INSERT INTO messages (id, request_id, agent_id, direction, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), input.requestId ?? null, input.agentId, input.direction, input.text, new Date().toISOString())
}

export function listMessages(agentId: AgentId): MessageRecord[] {
  const rows = db.prepare('SELECT id, request_id, agent_id, direction, text, created_at FROM messages WHERE agent_id = ? ORDER BY created_at ASC').all(agentId) as Record<string, unknown>[]
  return rows.map((row) => ({ id: String(row.id), requestId: row.request_id ? String(row.request_id) : null, agentId: row.agent_id as AgentId, direction: row.direction as MessageRecord['direction'], text: String(row.text), createdAt: String(row.created_at) }))
}

export function addAudit(input: { requestId?: string; action: string; summary: string; source: string }): void {
  db.prepare('INSERT INTO audit_events (id, request_id, action, summary, source, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), input.requestId ?? null, input.action, input.summary, input.source, new Date().toISOString())
}

export function closeDatabase(): void { db.close() }
