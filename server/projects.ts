import { createHash, randomUUID } from 'node:crypto'
import { addAudit, database, getLatestAgendaStatusComment, listAgents, listCommitments, listPermissions, listRequests, recordAgendaStatusChange } from './db.js'
import { computeHealth, computeProgress, isOpenMilestone, isOverdue, UPCOMING_DAYS } from './project-health.js'
import { parseProjectState, type ParsedProjectState, type ProjectStateSections } from './project-state.js'
import type { AgentId, Client, Domain, Milestone, MilestoneStatus, Project, ProjectHealth, ProjectStatus, ProjectUpdate, ProjectUpdateKind } from './types.js'

// Projects, their milestone schedule and their running log. Requests and commitments keep pointing
// at a project through the same free-text project_id they always used, so nothing is migrated.
const db = database()
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    industry TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    client_id TEXT,
    domain TEXT NOT NULL,
    owner_agent_id TEXT NOT NULL DEFAULT 'pmo',
    status TEXT NOT NULL,
    starts_at TEXT,
    due_at TEXT,
    next_action TEXT,
    source_path TEXT,
    source_drive_folder TEXT,
    obsidian_note TEXT,
    origin TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS projects_code_unique ON projects(code) WHERE code IS NOT NULL AND deleted_at IS NULL;
  CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    phase TEXT,
    owner_agent_id TEXT,
    owner_name TEXT,
    starts_at TEXT,
    due_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sort_order INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    notes TEXT,
    external_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS project_milestones_project_due ON project_milestones(project_id, due_at);
  CREATE TABLE IF NOT EXISTS project_updates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT UNIQUE,
    resolved_at TEXT,
    resolution TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS project_updates_project_created ON project_updates(project_id, created_at DESC);
`)

export class ProjectError extends Error {
  constructor(message: string, public statusCode = 400) { super(message) }
}

/** Who is acting. `allowDomain` carries the session or MCP token's domain permissions. */
export type ProjectActor = { source: string; actorId?: string; allowDomain: (domain: Domain) => boolean }

export const PROJECT_STATUSES: ProjectStatus[] = ['por_clasificar', 'propuesta', 'en_curso', 'pausado', 'completado', 'facturado', 'cancelado']
export const MILESTONE_STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'blocked', 'done', 'cancelled']
export const UPDATE_KINDS: ProjectUpdateKind[] = ['avance', 'bloqueo', 'riesgo', 'decision', 'leccion']
const CLIENT_STATUSES: Client['status'][] = ['active', 'inactive', 'archived']
const DAY_MS = 86_400_000

export type MilestoneBrief = { id: string; title: string; dueAt: string; status: MilestoneStatus; ownerAgentId: AgentId | null; ownerName: string | null; daysLate: number }
export type TaskBrief = { id: string; kind: 'request' | 'commitment'; title: string; domain: Domain; agentId: AgentId | null; status: string; priority: string | null; startsAt: string | null; dueAt: string | null; nextAction: string }
export type ProjectSummary = Project & {
  clientName: string | null
  progress: number | null
  milestoneCounts: { total: number; done: number; open: number; overdue: number }
  nextMilestone: MilestoneBrief | null
  overdueMilestones: MilestoneBrief[]
  openTasks: number
  openBlockers: number
  lastActivityAt: string
  silentDays: number | null
  health: ProjectHealth | null
  healthReasons: string[]
  /** Where `progress` comes from: the milestones when there are any, otherwise the status file. */
  progressSource: 'hitos' | 'estado' | null
  stateFile: { generalStatus: string | null; updatedLabel: string | null; changedAt: string } | null
}

// ---------- rows ----------

const nullable = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value))

function clientFromRow(row: Record<string, unknown>): Client {
  return { id: String(row.id), name: String(row.name), contactName: nullable(row.contact_name), email: nullable(row.email), phone: nullable(row.phone), industry: nullable(row.industry), status: row.status as Client['status'], notes: nullable(row.notes), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function projectFromRow(row: Record<string, unknown>): Project {
  return { id: String(row.id), code: nullable(row.code), name: String(row.name), clientId: nullable(row.client_id), domain: row.domain as Domain, ownerAgentId: row.owner_agent_id as AgentId, status: row.status as ProjectStatus, startsAt: nullable(row.starts_at), dueAt: nullable(row.due_at), nextAction: nullable(row.next_action), sourcePath: nullable(row.source_path), sourceDriveFolder: nullable(row.source_drive_folder), obsidianNote: nullable(row.obsidian_note), origin: row.origin as Project['origin'], createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function milestoneFromRow(row: Record<string, unknown>): Milestone {
  return { id: String(row.id), projectId: String(row.project_id), title: String(row.title), phase: nullable(row.phase), ownerAgentId: nullable(row.owner_agent_id) as AgentId | null, ownerName: nullable(row.owner_name), startsAt: nullable(row.starts_at), dueAt: String(row.due_at), status: row.status as MilestoneStatus, sortOrder: Number(row.sort_order), completedAt: nullable(row.completed_at), notes: nullable(row.notes), externalId: nullable(row.external_id), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
}

function updateFromRow(row: Record<string, unknown>): ProjectUpdate {
  return { id: String(row.id), projectId: String(row.project_id), kind: row.kind as ProjectUpdateKind, text: String(row.text), author: String(row.author), source: row.source as ProjectUpdate['source'], externalId: nullable(row.external_id), resolvedAt: nullable(row.resolved_at), resolution: nullable(row.resolution), createdAt: String(row.created_at) }
}

const rows = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as Record<string, unknown>[]
const row = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).get(...params) as Record<string, unknown> | undefined

function getProjectRow(id: string): Project | null {
  const found = row('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL', id)
  return found ? projectFromRow(found) : null
}

function getMilestoneRow(projectId: string, milestoneId: string): Milestone | null {
  const found = row('SELECT * FROM project_milestones WHERE id = ? AND project_id = ? AND deleted_at IS NULL', milestoneId, projectId)
  return found ? milestoneFromRow(found) : null
}

const milestoneOrder = 'ORDER BY sort_order ASC, due_at ASC, created_at ASC'

// ---------- discovery ----------

function humanize(id: string): string {
  const words = id.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id
}

/**
 * Registers a project for every project_id already used by a task. Synapse let agents and the
 * bridge write any text there, so rejecting unknown ids would break them; instead the id shows up
 * as "por clasificar" until Diego decides whether it is a real project. Deleted projects keep
 * their row, so they are not registered again.
 */
export function syncProjectsFromTasks(): string[] {
  const found = rows(`
    SELECT project_id AS id, domain FROM (
      SELECT project_id, domain, updated_at FROM requests WHERE project_id IS NOT NULL AND TRIM(project_id) <> '' AND deleted_at IS NULL
      UNION ALL
      SELECT project_id, domain, updated_at FROM commitments WHERE project_id IS NOT NULL AND TRIM(project_id) <> '' AND deleted_at IS NULL
    ) WHERE project_id NOT IN (SELECT id FROM projects) ORDER BY updated_at DESC`)
  const created: string[] = []
  const insert = db.prepare("INSERT OR IGNORE INTO projects (id, name, domain, owner_agent_id, status, origin, created_at, updated_at) VALUES (?, ?, ?, 'pmo', 'por_clasificar', 'auto', ?, ?)")
  for (const item of found) {
    const id = String(item.id)
    if (created.includes(id)) continue // rows arrive newest first, so the first domain seen wins
    const now = new Date().toISOString()
    if (Number(insert.run(id, humanize(id).slice(0, 200), String(item.domain), now, now).changes) > 0) {
      created.push(id)
      addAudit({ action: 'project_auto_registered', summary: id, source: 'synapse-projects' })
    }
  }
  return created
}
syncProjectsFromTasks()

// ---------- validation ----------

function clean(value: unknown, name: string, max: number, options: { required?: boolean } = {}): string | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    if (options.required) throw new ProjectError(`${name} es obligatorio.`)
    return null
  }
  if (typeof value !== 'string' || value.trim().length > max) throw new ProjectError(`${name} no válido (máximo ${max} caracteres).`)
  return value.trim()
}

function dateValue(value: unknown, name: string, required = false): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ProjectError(`${name} es obligatorio.`)
    return null
  }
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) throw new ProjectError('Revisa las fechas e incluye la zona horaria.')
  return new Date(value).toISOString()
}

function oneOf<T extends string>(value: unknown, options: readonly T[], name: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new ProjectError(`${name} no válido.`)
  return value as T
}

function onlyKnownKeys(input: Record<string, unknown>, allowed: string[]): void {
  const keys = Object.keys(input)
  if (!keys.length) throw new ProjectError('No hay cambios para guardar.')
  const unknown = keys.find((key) => !allowed.includes(key))
  if (unknown) throw new ProjectError(`Campo no permitido: ${unknown}.`)
}

function agentValue(value: unknown, name: string, required: boolean): AgentId | null {
  const id = clean(value, name, 120, { required })
  if (id && !listAgents().some((agent) => agent.id === id)) throw new ProjectError('Selecciona un agente válido.')
  return id as AgentId | null
}

function domainValue(value: unknown, actor: ProjectActor): Domain {
  if (typeof value !== 'string' || !listPermissions().some((permission) => permission.domain === value)) throw new ProjectError('Selecciona un dominio válido.')
  if (!actor.allowDomain(value as Domain)) throw new ProjectError('No tienes acceso al dominio de destino.', 403)
  return value as Domain
}

function checkDateOrder(startsAt: string | null, dueAt: string | null): void {
  if (startsAt && dueAt && Date.parse(startsAt) > Date.parse(dueAt)) throw new ProjectError('La fecha de vencimiento debe ser posterior al inicio.')
}

function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

const origin = (actor: ProjectActor): 'mcp' | 'manual' => (/^(hermes|mcp)/i.test(actor.source) ? 'mcp' : 'manual')
const canSeeClients = (actor: ProjectActor) => actor.allowDomain('agency') || actor.allowDomain('sales')

// ---------- clients ----------

const CLIENT_FIELDS = ['name', 'contactName', 'email', 'phone', 'industry', 'status', 'notes']

function parseClient(input: Record<string, unknown>, current?: Client): Omit<Client, 'id' | 'createdAt' | 'updatedAt'> {
  onlyKnownKeys(input, CLIENT_FIELDS)
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  const email = has('email') ? clean(input.email, 'email', 200) : current?.email ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ProjectError('email no válido.')
  return {
    name: has('name') || !current ? clean(input.name, 'name', 200, { required: true })! : current.name,
    contactName: has('contactName') ? clean(input.contactName, 'contactName', 120) : current?.contactName ?? null,
    email,
    phone: has('phone') ? clean(input.phone, 'phone', 40) : current?.phone ?? null,
    industry: has('industry') ? clean(input.industry, 'industry', 100) : current?.industry ?? null,
    status: has('status') ? oneOf(input.status, CLIENT_STATUSES, 'status') : current?.status ?? 'active',
    notes: has('notes') ? clean(input.notes, 'notes', 2000) : current?.notes ?? null,
  }
}

function requireClientAccess(actor: ProjectActor): void {
  if (!canSeeClients(actor)) throw new ProjectError('No tienes acceso a los clientes.', 403)
}

export function listClients(actor: ProjectActor): Client[] {
  requireClientAccess(actor)
  return rows('SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE').map(clientFromRow)
}

export function createClient(input: Record<string, unknown>, actor: ProjectActor): Client {
  requireClientAccess(actor)
  const client = parseClient(input)
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO clients (id, name, contact_name, email, phone, industry, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, client.name, client.contactName, client.email, client.phone, client.industry, client.status, client.notes, now, now)
  addAudit({ action: 'client_created', summary: `${id}: ${client.name}`, source: actor.source, actorId: actor.actorId })
  return clientFromRow(row('SELECT * FROM clients WHERE id = ?', id)!)
}

export function updateClient(id: string, input: Record<string, unknown>, actor: ProjectActor): Client {
  requireClientAccess(actor)
  const found = row('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL', id)
  if (!found) throw new ProjectError('Cliente no encontrado.', 404)
  const client = parseClient(input, clientFromRow(found))
  db.prepare('UPDATE clients SET name = ?, contact_name = ?, email = ?, phone = ?, industry = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?')
    .run(client.name, client.contactName, client.email, client.phone, client.industry, client.status, client.notes, new Date().toISOString(), id)
  addAudit({ action: 'client_updated', summary: `${id}: ${client.name}`, source: actor.source, actorId: actor.actorId })
  return clientFromRow(row('SELECT * FROM clients WHERE id = ?', id)!)
}

// ---------- summaries ----------

function brief(milestone: Milestone, now: number): MilestoneBrief {
  // Whole days elapsed since the due date; anything late by less than a day still counts as one.
  const late = isOverdue(milestone, now) ? Math.max(1, Math.floor((now - Date.parse(milestone.dueAt)) / DAY_MS)) : 0
  return { id: milestone.id, title: milestone.title, dueAt: milestone.dueAt, status: milestone.status, ownerAgentId: milestone.ownerAgentId, ownerName: milestone.ownerName, daysLate: late }
}

function tasksByProject(actor: ProjectActor): { visible: Map<string, TaskBrief[]>; lastTouch: Map<string, string> } {
  const visible = new Map<string, TaskBrief[]>()
  const lastTouch = new Map<string, string>()
  const add = (projectId: string | null | undefined, task: TaskBrief, updatedAt: string) => {
    if (!projectId) return
    if (updatedAt > (lastTouch.get(projectId) ?? '')) lastTouch.set(projectId, updatedAt)
    if (!actor.allowDomain(task.domain)) return
    visible.set(projectId, [...(visible.get(projectId) ?? []), task])
  }
  for (const request of listRequests()) add(request.projectId, { id: request.id, kind: 'request', title: request.title, domain: request.domain, agentId: request.agentId, status: request.status, priority: request.priority, startsAt: request.startsAt, dueAt: request.dueAt, nextAction: request.nextAction }, request.updatedAt)
  for (const commitment of listCommitments()) add(commitment.projectId, { id: `commitment:${commitment.id}`, kind: 'commitment', title: commitment.title, domain: commitment.domain, agentId: null, status: commitment.status, priority: null, startsAt: commitment.startsAt, dueAt: commitment.dueAt, nextAction: '' }, commitment.updatedAt)
  return { visible, lastTouch }
}

const isOpenTask = (task: TaskBrief) => task.status !== 'done' && task.status !== 'cancelled'

function summarize(projects: Project[], actor: ProjectActor, now: number): ProjectSummary[] {
  if (!projects.length) return []
  const group = <T extends { projectId: string }>(items: T[]) => items.reduce((map, item) => map.set(item.projectId, [...(map.get(item.projectId) ?? []), item]), new Map<string, T[]>())
  const milestones = group(rows(`SELECT * FROM project_milestones WHERE deleted_at IS NULL ${milestoneOrder}`).map(milestoneFromRow))
  const updates = group(rows('SELECT * FROM project_updates').map(updateFromRow))
  const clients = new Map(rows('SELECT id, name FROM clients WHERE deleted_at IS NULL').map((client) => [String(client.id), String(client.name)]))
  const tasks = tasksByProject(actor)
  const states = new Map(rows('SELECT project_id, general_status, updated_label, progress, changed_at FROM project_states').map((state) => [String(state.project_id), state]))
  return projects.map((project) => {
    const state = states.get(project.id)
    const own = milestones.get(project.id) ?? []
    const log = updates.get(project.id) ?? []
    const open = own.filter((milestone) => isOpenMilestone(milestone.status)).sort((left, right) => left.dueAt.localeCompare(right.dueAt))
    const overdue = open.filter((milestone) => isOverdue(milestone, now))
    const openBlockers = log.filter((update) => update.kind === 'bloqueo' && !update.resolvedAt).length
    const lastActivityAt = [project.updatedAt, state ? String(state.changed_at) : '', tasks.lastTouch.get(project.id) ?? '', ...own.map((milestone) => milestone.updatedAt), ...log.flatMap((update) => [update.createdAt, update.resolvedAt ?? ''])].reduce((latest, value) => (value > latest ? value : latest), '')
    const health = computeHealth({ status: project.status, milestones: own, openBlockers, lastActivityAt, hasStateFile: Boolean(state) }, now)
    const byMilestones = computeProgress(own)
    const byState = state && state.progress !== null && state.progress !== undefined ? Number(state.progress) : null
    return {
      ...project,
      clientName: project.clientId ? clients.get(project.clientId) ?? null : null,
      progress: byMilestones ?? byState,
      progressSource: byMilestones !== null ? 'hitos' as const : byState !== null ? 'estado' as const : null,
      stateFile: state ? { generalStatus: nullable(state.general_status), updatedLabel: nullable(state.updated_label), changedAt: String(state.changed_at) } : null,
      milestoneCounts: { total: own.filter((milestone) => milestone.status !== 'cancelled').length, done: own.filter((milestone) => milestone.status === 'done').length, open: open.length, overdue: overdue.length },
      nextMilestone: open[0] ? brief(open[0], now) : null,
      overdueMilestones: overdue.map((milestone) => brief(milestone, now)),
      openTasks: (tasks.visible.get(project.id) ?? []).filter(isOpenTask).length,
      openBlockers,
      lastActivityAt,
      silentDays: health.silentDays,
      health: health.health,
      healthReasons: health.reasons,
    }
  })
}

const healthRank: Record<string, number> = { rojo: 0, amarillo: 1, verde: 2 }

export function listProjects(actor: ProjectActor, filters: { status?: string | null; clientId?: string | null } = {}, now = Date.now()): ProjectSummary[] {
  syncProjectsFromTasks()
  if (filters.status && !PROJECT_STATUSES.includes(filters.status as ProjectStatus)) throw new ProjectError('status no válido.')
  const projects = rows('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE').map(projectFromRow)
    .filter((project) => actor.allowDomain(project.domain) && (!filters.status || project.status === filters.status) && (!filters.clientId || project.clientId === filters.clientId))
  // Whatever needs attention first, then by the nearest milestone.
  return summarize(projects, actor, now).sort((left, right) => (healthRank[left.health ?? ''] ?? 3) - (healthRank[right.health ?? ''] ?? 3) || (left.nextMilestone?.dueAt ?? '9999').localeCompare(right.nextMilestone?.dueAt ?? '9999') || left.name.localeCompare(right.name, 'es'))
}

function requireProject(id: string, actor: ProjectActor): Project {
  const project = getProjectRow(id)
  if (!project) throw new ProjectError('Proyecto no encontrado.', 404)
  if (!actor.allowDomain(project.domain)) throw new ProjectError('No tienes acceso a ese dominio.', 403)
  return project
}

export function getProjectDetail(id: string, actor: ProjectActor, now = Date.now()) {
  syncProjectsFromTasks()
  const project = requireProject(id, actor)
  return {
    project: summarize([project], actor, now)[0],
    milestones: rows(`SELECT * FROM project_milestones WHERE project_id = ? AND deleted_at IS NULL ${milestoneOrder}`, id).map(milestoneFromRow),
    tasks: tasksByProject(actor).visible.get(id) ?? [],
    updates: rows('SELECT * FROM project_updates WHERE project_id = ? ORDER BY created_at DESC', id).map(updateFromRow),
    ...projectTracking(id, actor),
    state: projectStateFor(id),
  }
}

// ---------- projects ----------

const PROJECT_FIELDS = ['name', 'code', 'clientId', 'domain', 'ownerAgentId', 'status', 'startsAt', 'dueAt', 'nextAction', 'sourcePath', 'sourceDriveFolder', 'obsidianNote']

function parseProject(input: Record<string, unknown>, actor: ProjectActor, current?: Project): Omit<Project, 'id' | 'origin' | 'createdAt' | 'updatedAt'> {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  let code = current?.code ?? null
  if (has('code')) {
    code = clean(input.code, 'code', 20)?.toUpperCase() ?? null
    if (code && !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) throw new ProjectError('code debe tener de 2 a 20 letras, números, guiones o guiones bajos.')
    if (code && row('SELECT id FROM projects WHERE code = ? AND deleted_at IS NULL AND id <> ?', code, current?.id ?? '')) throw new ProjectError('Ya existe un proyecto con ese código.', 409)
  }
  let clientId = current?.clientId ?? null
  if (has('clientId')) {
    clientId = clean(input.clientId, 'clientId', 120)
    if (clientId && !row('SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL', clientId)) throw new ProjectError('Cliente no encontrado.')
  }
  const startsAt = has('startsAt') ? dateValue(input.startsAt, 'startsAt') : current?.startsAt ?? null
  const dueAt = has('dueAt') ? dateValue(input.dueAt, 'dueAt') : current?.dueAt ?? null
  checkDateOrder(startsAt, dueAt)
  return {
    name: has('name') || !current ? clean(input.name, 'name', 200, { required: true })! : current.name,
    code,
    clientId,
    domain: has('domain') || !current ? domainValue(input.domain, actor) : current.domain,
    ownerAgentId: has('ownerAgentId') ? agentValue(input.ownerAgentId, 'ownerAgentId', true)! : current?.ownerAgentId ?? 'pmo',
    status: has('status') ? oneOf(input.status, PROJECT_STATUSES, 'status') : current?.status ?? 'en_curso',
    startsAt,
    dueAt,
    nextAction: has('nextAction') ? clean(input.nextAction, 'nextAction', 2000) : current?.nextAction ?? null,
    sourcePath: has('sourcePath') ? clean(input.sourcePath, 'sourcePath', 1000) : current?.sourcePath ?? null,
    sourceDriveFolder: has('sourceDriveFolder') ? clean(input.sourceDriveFolder, 'sourceDriveFolder', 1000) : current?.sourceDriveFolder ?? null,
    obsidianNote: has('obsidianNote') ? clean(input.obsidianNote, 'obsidianNote', 500) : current?.obsidianNote ?? null,
  }
}

export function createProject(input: Record<string, unknown>, actor: ProjectActor): ProjectSummary {
  onlyKnownKeys(input, ['id', ...PROJECT_FIELDS])
  const project = parseProject(input, actor)
  const id = input.id === undefined || input.id === null || input.id === '' ? slugify(project.name) : String(input.id)
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(id)) throw new ProjectError('El identificador debe usar minúsculas, números y guiones (2 a 120 caracteres).')
  // Deleted projects keep their id so old tasks never attach to an unrelated new project.
  if (row('SELECT id FROM projects WHERE id = ?', id)) throw new ProjectError('Ya existe un proyecto con ese identificador.', 409)
  const now = new Date().toISOString()
  db.prepare('INSERT INTO projects (id, code, name, client_id, domain, owner_agent_id, status, starts_at, due_at, next_action, source_path, source_drive_folder, obsidian_note, origin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, project.code, project.name, project.clientId, project.domain, project.ownerAgentId, project.status, project.startsAt, project.dueAt, project.nextAction, project.sourcePath, project.sourceDriveFolder, project.obsidianNote, origin(actor), now, now)
  addAudit({ action: 'project_created', summary: `${id}: ${project.name}`, source: actor.source, actorId: actor.actorId })
  return summarize([getProjectRow(id)!], actor, Date.now())[0]
}

export function updateProject(id: string, input: Record<string, unknown>, actor: ProjectActor): ProjectSummary {
  const current = requireProject(id, actor)
  const comment = clean(input.comment, 'comment', 2000) ?? ''
  const { comment: _comment, ...changes } = input
  onlyKnownKeys(changes, PROJECT_FIELDS)
  const project = parseProject(changes, actor, current)
  db.prepare('UPDATE projects SET code = ?, name = ?, client_id = ?, domain = ?, owner_agent_id = ?, status = ?, starts_at = ?, due_at = ?, next_action = ?, source_path = ?, source_drive_folder = ?, obsidian_note = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(project.code, project.name, project.clientId, project.domain, project.ownerAgentId, project.status, project.startsAt, project.dueAt, project.nextAction, project.sourcePath, project.sourceDriveFolder, project.obsidianNote, new Date().toISOString(), id)
  if (project.status !== current.status) recordAgendaStatusChange({ itemId: `project:${id}`, fromStatus: current.status, toStatus: project.status, comment })
  addAudit({ action: 'project_updated', summary: `${id}: ${project.name}`, source: actor.source, actorId: actor.actorId })
  return summarize([getProjectRow(id)!], actor, Date.now())[0]
}

export function deleteProject(id: string, expectedName: unknown, actor: ProjectActor) {
  const project = requireProject(id, actor)
  if (expectedName !== project.name) throw new ProjectError('El nombre cambió. Recarga el proyecto antes de eliminarlo.', 409)
  const now = new Date().toISOString()
  db.prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id)
  addAudit({ action: 'project_deleted', summary: `${id}: ${project.name}`, source: actor.source, actorId: actor.actorId })
  return { deleted: true, id, name: project.name }
}

// ---------- milestones ----------

const MILESTONE_FIELDS = ['title', 'phase', 'ownerAgentId', 'ownerName', 'startsAt', 'dueAt', 'status', 'sortOrder', 'notes']

function parseMilestone(input: Record<string, unknown>, current?: Milestone): Pick<Milestone, 'title' | 'phase' | 'ownerAgentId' | 'ownerName' | 'startsAt' | 'dueAt' | 'status' | 'notes'> & { sortOrder: number | null } {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  const startsAt = has('startsAt') ? dateValue(input.startsAt, 'startsAt') : current?.startsAt ?? null
  const dueAt = has('dueAt') || !current ? dateValue(input.dueAt, 'dueAt', true)! : current.dueAt
  checkDateOrder(startsAt, dueAt)
  let sortOrder: number | null = current?.sortOrder ?? null
  if (has('sortOrder')) {
    if (typeof input.sortOrder !== 'number' || !Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 100_000) throw new ProjectError('sortOrder no válido.')
    sortOrder = input.sortOrder
  }
  return {
    title: has('title') || !current ? clean(input.title, 'title', 200, { required: true })! : current.title,
    phase: has('phase') ? clean(input.phase, 'phase', 80) : current?.phase ?? null,
    ownerAgentId: has('ownerAgentId') ? agentValue(input.ownerAgentId, 'ownerAgentId', false) : current?.ownerAgentId ?? null,
    ownerName: has('ownerName') ? clean(input.ownerName, 'ownerName', 120) : current?.ownerName ?? null,
    startsAt,
    dueAt,
    status: has('status') ? oneOf(input.status, MILESTONE_STATUSES, 'status') : current?.status ?? 'pending',
    sortOrder,
    notes: has('notes') ? clean(input.notes, 'notes', 2000) : current?.notes ?? null,
  }
}

function saveMilestone(current: Milestone, next: ReturnType<typeof parseMilestone>, comment: string, actor: ProjectActor): Milestone {
  const now = new Date().toISOString()
  const completedAt = next.status === 'done' ? current.completedAt ?? now : null
  db.prepare('UPDATE project_milestones SET title = ?, phase = ?, owner_agent_id = ?, owner_name = ?, starts_at = ?, due_at = ?, status = ?, sort_order = ?, completed_at = ?, notes = ?, updated_at = ?, deleted_at = NULL WHERE id = ?')
    .run(next.title, next.phase, next.ownerAgentId, next.ownerName, next.startsAt, next.dueAt, next.status, next.sortOrder ?? current.sortOrder, completedAt, next.notes, now, current.id)
  if (next.status !== current.status) recordAgendaStatusChange({ itemId: `milestone:${current.id}`, fromStatus: current.status, toStatus: next.status, comment })
  addAudit({ action: 'milestone_updated', summary: `${current.projectId}/${current.id}: ${next.title}`, source: actor.source, actorId: actor.actorId })
  return milestoneFromRow(row('SELECT * FROM project_milestones WHERE id = ?', current.id)!)
}

export function createMilestone(projectId: string, input: Record<string, unknown>, actor: ProjectActor): Milestone {
  requireProject(projectId, actor)
  const { externalId: rawExternalId, ...fields } = input
  const externalId = clean(rawExternalId, 'externalId', 200)
  onlyKnownKeys(fields, MILESTONE_FIELDS)
  if (externalId) {
    // Same external id means the same milestone: a retry updates it instead of duplicating it.
    const existing = row('SELECT * FROM project_milestones WHERE external_id = ?', externalId)
    if (existing) {
      const current = milestoneFromRow(existing)
      if (current.projectId !== projectId) throw new ProjectError('Ese externalId pertenece a un hito de otro proyecto.', 409)
      return saveMilestone(current, parseMilestone(fields, current), '', actor)
    }
  }
  const milestone = parseMilestone(fields)
  const id = randomUUID()
  const now = new Date().toISOString()
  const sortOrder = milestone.sortOrder ?? Number(row('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM project_milestones WHERE project_id = ? AND deleted_at IS NULL', projectId)!.next)
  db.prepare('INSERT INTO project_milestones (id, project_id, title, phase, owner_agent_id, owner_name, starts_at, due_at, status, sort_order, completed_at, notes, external_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, projectId, milestone.title, milestone.phase, milestone.ownerAgentId, milestone.ownerName, milestone.startsAt, milestone.dueAt, milestone.status, sortOrder, milestone.status === 'done' ? now : null, milestone.notes, externalId, now, now)
  addAudit({ action: 'milestone_created', summary: `${projectId}/${id}: ${milestone.title}`, source: actor.source, actorId: actor.actorId })
  return getMilestoneRow(projectId, id)!
}

export function updateMilestone(projectId: string, milestoneId: string, input: Record<string, unknown>, actor: ProjectActor): Milestone {
  requireProject(projectId, actor)
  const current = getMilestoneRow(projectId, milestoneId)
  if (!current) throw new ProjectError('Hito no encontrado.', 404)
  const comment = clean(input.comment, 'comment', 2000) ?? ''
  const { comment: _comment, ...changes } = input
  onlyKnownKeys(changes, MILESTONE_FIELDS)
  return saveMilestone(current, parseMilestone(changes, current), comment, actor)
}

export function deleteMilestone(projectId: string, milestoneId: string, expectedTitle: unknown, actor: ProjectActor) {
  requireProject(projectId, actor)
  const current = getMilestoneRow(projectId, milestoneId)
  if (!current) throw new ProjectError('Hito no encontrado.', 404)
  if (expectedTitle !== current.title) throw new ProjectError('El título cambió. Recarga el hito antes de eliminarlo.', 409)
  const now = new Date().toISOString()
  db.prepare('UPDATE project_milestones SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, milestoneId)
  addAudit({ action: 'milestone_deleted', summary: `${projectId}/${milestoneId}: ${current.title}`, source: actor.source, actorId: actor.actorId })
  return { deleted: true, id: milestoneId, title: current.title }
}

// ---------- updates and blockers ----------

export function addProjectUpdate(projectId: string, input: Record<string, unknown>, actor: ProjectActor): ProjectUpdate {
  requireProject(projectId, actor)
  onlyKnownKeys(input, ['kind', 'text', 'externalId'])
  const kind = oneOf(input.kind, UPDATE_KINDS, 'kind')
  const text = clean(input.text, 'text', 2000, { required: true })!
  const externalId = clean(input.externalId, 'externalId', 200)
  if (externalId) {
    const existing = row('SELECT * FROM project_updates WHERE external_id = ?', externalId)
    if (existing) {
      if (String(existing.project_id) !== projectId) throw new ProjectError('Ese externalId pertenece a una novedad de otro proyecto.', 409)
      return updateFromRow(existing) // the log is append-only: a retry returns what was recorded
    }
  }
  const id = randomUUID()
  db.prepare('INSERT INTO project_updates (id, project_id, kind, text, author, source, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, projectId, kind, text, actor.actorId ?? actor.source, origin(actor), externalId, new Date().toISOString())
  addAudit({ action: `project_${kind}_recorded`, summary: `${projectId}/${id}`, source: actor.source, actorId: actor.actorId })
  return updateFromRow(row('SELECT * FROM project_updates WHERE id = ?', id)!)
}

export function resolveBlocker(projectId: string, updateId: string, input: Record<string, unknown>, actor: ProjectActor): ProjectUpdate {
  requireProject(projectId, actor)
  const found = row('SELECT * FROM project_updates WHERE id = ? AND project_id = ?', updateId, projectId)
  if (!found) throw new ProjectError('Novedad no encontrada.', 404)
  const update = updateFromRow(found)
  if (update.kind !== 'bloqueo') throw new ProjectError('Solo los bloqueos se pueden resolver.')
  if (update.resolvedAt) throw new ProjectError('Ese bloqueo ya está resuelto.', 409)
  const resolution = clean(input.resolution, 'resolution', 2000)
  db.prepare('UPDATE project_updates SET resolved_at = ?, resolution = ? WHERE id = ?').run(new Date().toISOString(), resolution, updateId)
  addAudit({ action: 'project_blocker_resolved', summary: `${projectId}/${updateId}`, source: actor.source, actorId: actor.actorId })
  return updateFromRow(row('SELECT * FROM project_updates WHERE id = ?', updateId)!)
}

// ---------- coordination digest ----------

export function projectsDigest(actor: ProjectActor, now = Date.now()) {
  const projects = listProjects(actor, {}, now)
  const tracked = projects.filter((project) => project.health !== null)
  const names = new Map(projects.map((project) => [project.id, project.name]))
  const visible = projects.filter((project) => project.status !== 'cancelado' && project.status !== 'por_clasificar').map((project) => project.id)
  const openMilestones = rows(`SELECT * FROM project_milestones WHERE deleted_at IS NULL ${milestoneOrder}`).map(milestoneFromRow)
    .filter((milestone) => visible.includes(milestone.projectId) && isOpenMilestone(milestone.status))
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
  const withProject = (milestone: Milestone) => ({ projectId: milestone.projectId, projectName: names.get(milestone.projectId) ?? milestone.projectId, ...brief(milestone, now) })
  const blockers = rows("SELECT * FROM project_updates WHERE kind = 'bloqueo' AND resolved_at IS NULL ORDER BY created_at ASC").map(updateFromRow).filter((update) => visible.includes(update.projectId))
  return {
    generatedAt: new Date(now).toISOString(),
    timezone: 'America/Bogota',
    totals: {
      tracked: tracked.length,
      rojo: tracked.filter((project) => project.health === 'rojo').length,
      amarillo: tracked.filter((project) => project.health === 'amarillo').length,
      verde: tracked.filter((project) => project.health === 'verde').length,
      porClasificar: projects.filter((project) => project.status === 'por_clasificar').length,
    },
    attention: tracked.filter((project) => project.health !== 'verde').map((project) => ({ projectId: project.id, name: project.name, status: project.status, health: project.health, reasons: project.healthReasons, nextAction: project.nextAction })),
    overdueMilestones: openMilestones.filter((milestone) => isOverdue(milestone, now)).map(withProject),
    upcomingMilestones: openMilestones.filter((milestone) => !isOverdue(milestone, now) && Date.parse(milestone.dueAt) - now <= UPCOMING_DAYS * DAY_MS).map(withProject),
    openBlockers: blockers.map((update) => ({ projectId: update.projectId, projectName: names.get(update.projectId) ?? update.projectId, updateId: update.id, text: update.text, createdAt: update.createdAt, daysOpen: Math.floor((now - Date.parse(update.createdAt)) / DAY_MS) })),
    silentProjects: tracked.filter((project) => project.silentDays !== null).map((project) => ({ projectId: project.id, name: project.name, silentDays: project.silentDays, lastActivityAt: project.lastActivityAt })),
  }
}

// ---------- agenda ----------

/** Milestones in the shape the Agenda already renders. They are read-only there: editing goes through the project. */
export function agendaMilestoneItems(allowDomain: (domain: Domain) => boolean) {
  const projects = new Map(rows("SELECT * FROM projects WHERE deleted_at IS NULL AND status NOT IN ('cancelado', 'por_clasificar')").map(projectFromRow).filter((project) => allowDomain(project.domain)).map((project) => [project.id, project]))
  return rows('SELECT * FROM project_milestones WHERE deleted_at IS NULL').map(milestoneFromRow).filter((milestone) => projects.has(milestone.projectId)).map((milestone) => {
    const project = projects.get(milestone.projectId)!
    return { id: `milestone:${milestone.id}`, kind: 'milestone' as const, requestId: null, commitmentId: null, title: milestone.title, domain: project.domain, projectId: project.id, agentId: milestone.ownerAgentId ?? project.ownerAgentId, status: milestone.status, priority: 'normal' as const, riskLevel: 'low' as const, requiresApproval: false, approvalConfirmed: false, startsAt: milestone.startsAt, dueAt: milestone.dueAt, nextAction: milestone.notes ?? '', sourcePath: null, sourceDriveFolder: null, createdAt: milestone.createdAt, updatedAt: milestone.updatedAt, lastStatusComment: getLatestAgendaStatusComment(`milestone:${milestone.id}`) }
  })
}

// ---------- tracking: goals, budget, charges and the cut-off report ----------
// Goals follow the committee model (total, planned to date, achieved). Budget and charges follow
// the Dmente Hub model and are only visible with access to the finance domain.

const projectColumns = new Set((db.prepare('PRAGMA table_info(projects)').all() as { name: string }[]).map((column) => column.name))
if (!projectColumns.has('budget')) db.exec('ALTER TABLE projects ADD COLUMN budget REAL')
if (!projectColumns.has('actual_cost')) db.exec('ALTER TABLE projects ADD COLUMN actual_cost REAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS project_metrics (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT, target_total REAL NOT NULL,
    planned_to_date REAL, achieved REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS project_invoices (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, concept TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente',
    issued_at TEXT, due_at TEXT, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
`)

export type ProjectMetric = { id: string; projectId: string; name: string; unit: string | null; targetTotal: number; plannedToDate: number | null; achieved: number; updatedAt: string }
export type ProjectInvoice = { id: string; projectId: string; concept: string; amount: number; status: 'pendiente' | 'pagado' | 'anulado'; issuedAt: string | null; dueAt: string | null; paidAt: string | null; updatedAt: string }
export type ProjectFinance = { budget: number | null; actualCost: number | null; invoices: ProjectInvoice[]; totals: { invoiced: number; paid: number; pending: number } }
const INVOICE_STATUSES: ProjectInvoice['status'][] = ['pendiente', 'pagado', 'anulado']

const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value))
function amount(value: unknown, name: string, required = false): number | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ProjectError(`${name} es obligatorio.`)
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e13) throw new ProjectError(`${name} debe ser un número mayor o igual a cero.`)
  return value
}
function metricFromRow(found: Record<string, unknown>): ProjectMetric {
  return { id: String(found.id), projectId: String(found.project_id), name: String(found.name), unit: nullable(found.unit), targetTotal: Number(found.target_total), plannedToDate: numberOrNull(found.planned_to_date), achieved: Number(found.achieved), updatedAt: String(found.updated_at) }
}
function invoiceFromRow(found: Record<string, unknown>): ProjectInvoice {
  return { id: String(found.id), projectId: String(found.project_id), concept: String(found.concept), amount: Number(found.amount), status: found.status as ProjectInvoice['status'], issuedAt: nullable(found.issued_at), dueAt: nullable(found.due_at), paidAt: nullable(found.paid_at), updatedAt: String(found.updated_at) }
}
const listMetrics = (projectId: string) => rows('SELECT * FROM project_metrics WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC', projectId).map(metricFromRow)

/** Creates the goal or updates the one with the same name, so Lucía can report progress without tracking ids. */
export function setProjectMetric(projectId: string, input: Record<string, unknown>, actor: ProjectActor): ProjectMetric {
  requireProject(projectId, actor)
  onlyKnownKeys(input, ['name', 'unit', 'targetTotal', 'plannedToDate', 'achieved'])
  const name = clean(input.name, 'name', 120, { required: true })!
  const existing = row('SELECT * FROM project_metrics WHERE project_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL', projectId, name)
  const current = existing ? metricFromRow(existing) : null
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  const next = {
    unit: has('unit') ? clean(input.unit, 'unit', 40) : current?.unit ?? null,
    targetTotal: has('targetTotal') || !current ? amount(input.targetTotal, 'targetTotal', true)! : current.targetTotal,
    plannedToDate: has('plannedToDate') ? amount(input.plannedToDate, 'plannedToDate') : current?.plannedToDate ?? null,
    achieved: has('achieved') ? amount(input.achieved, 'achieved', true)! : current?.achieved ?? 0,
  }
  const now = new Date().toISOString()
  const id = current?.id ?? randomUUID()
  // The goal keeps the name it was created with; later reports only need to match it, in any casing.
  if (current) db.prepare('UPDATE project_metrics SET name = ?, unit = ?, target_total = ?, planned_to_date = ?, achieved = ?, updated_at = ? WHERE id = ?').run(current.name, next.unit, next.targetTotal, next.plannedToDate, next.achieved, now, id)
  else db.prepare('INSERT INTO project_metrics (id, project_id, name, unit, target_total, planned_to_date, achieved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, projectId, name, next.unit, next.targetTotal, next.plannedToDate, next.achieved, now, now)
  addAudit({ action: current ? 'project_metric_updated' : 'project_metric_created', summary: `${projectId}/${id}: ${name}`, source: actor.source, actorId: actor.actorId })
  return metricFromRow(row('SELECT * FROM project_metrics WHERE id = ?', id)!)
}

export function deleteProjectMetric(projectId: string, metricId: string, actor: ProjectActor) {
  requireProject(projectId, actor)
  const now = new Date().toISOString()
  if (!Number(db.prepare('UPDATE project_metrics SET deleted_at = ?, updated_at = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL').run(now, now, metricId, projectId).changes)) throw new ProjectError('Meta no encontrada.', 404)
  addAudit({ action: 'project_metric_deleted', summary: `${projectId}/${metricId}`, source: actor.source, actorId: actor.actorId })
  return { deleted: true, id: metricId }
}

function requireFinance(actor: ProjectActor): void {
  if (!actor.allowDomain('finance')) throw new ProjectError('No tienes acceso a la información financiera.', 403)
}

function financeFor(projectId: string): ProjectFinance {
  const project = row('SELECT budget, actual_cost FROM projects WHERE id = ?', projectId)!
  const invoices = rows('SELECT * FROM project_invoices WHERE project_id = ? ORDER BY COALESCE(issued_at, created_at) DESC', projectId).map(invoiceFromRow)
  const sum = (status: ProjectInvoice['status']) => invoices.filter((invoice) => invoice.status === status).reduce((total, invoice) => total + invoice.amount, 0)
  return { budget: numberOrNull(project.budget), actualCost: numberOrNull(project.actual_cost), invoices, totals: { invoiced: sum('pendiente') + sum('pagado'), paid: sum('pagado'), pending: sum('pendiente') } }
}

export function setProjectFinance(projectId: string, input: Record<string, unknown>, actor: ProjectActor): ProjectFinance {
  requireProject(projectId, actor)
  requireFinance(actor)
  onlyKnownKeys(input, ['budget', 'actualCost'])
  const current = financeFor(projectId)
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  db.prepare('UPDATE projects SET budget = ?, actual_cost = ?, updated_at = ? WHERE id = ?').run(has('budget') ? amount(input.budget, 'budget') : current.budget, has('actualCost') ? amount(input.actualCost, 'actualCost') : current.actualCost, new Date().toISOString(), projectId)
  addAudit({ action: 'project_finance_updated', summary: projectId, source: actor.source, actorId: actor.actorId })
  return financeFor(projectId)
}

/** Creates a charge, or updates it when `id` is given. Charges are never deleted: a wrong one is marked "anulado". */
export function saveProjectInvoice(projectId: string, input: Record<string, unknown>, actor: ProjectActor): ProjectFinance {
  requireProject(projectId, actor)
  requireFinance(actor)
  onlyKnownKeys(input, ['id', 'concept', 'amount', 'status', 'issuedAt', 'dueAt'])
  const id = clean(input.id, 'id', 120)
  const found = id ? row('SELECT * FROM project_invoices WHERE id = ? AND project_id = ?', id, projectId) : undefined
  if (id && !found) throw new ProjectError('Cobro no encontrado.', 404)
  const current = found ? invoiceFromRow(found) : null
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  const status = has('status') ? oneOf(input.status, INVOICE_STATUSES, 'status') : current?.status ?? 'pendiente'
  const next = {
    concept: has('concept') || !current ? clean(input.concept, 'concept', 200, { required: true })! : current.concept,
    amount: has('amount') || !current ? amount(input.amount, 'amount', true)! : current.amount,
    issuedAt: has('issuedAt') ? dateValue(input.issuedAt, 'issuedAt') : current?.issuedAt ?? null,
    dueAt: has('dueAt') ? dateValue(input.dueAt, 'dueAt') : current?.dueAt ?? null,
  }
  const now = new Date().toISOString()
  const paidAt = status === 'pagado' ? current?.paidAt ?? now : null
  if (current) db.prepare('UPDATE project_invoices SET concept = ?, amount = ?, status = ?, issued_at = ?, due_at = ?, paid_at = ?, updated_at = ? WHERE id = ?').run(next.concept, next.amount, status, next.issuedAt, next.dueAt, paidAt, now, current.id)
  else db.prepare('INSERT INTO project_invoices (id, project_id, concept, amount, status, issued_at, due_at, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), projectId, next.concept, next.amount, status, next.issuedAt, next.dueAt, paidAt, now, now)
  addAudit({ action: current ? 'project_invoice_updated' : 'project_invoice_created', summary: projectId, source: actor.source, actorId: actor.actorId })
  return financeFor(projectId)
}

/** Goals for everyone who can see the project; budget and charges only with finance access. */
export function projectTracking(projectId: string, actor: ProjectActor): { metrics: ProjectMetric[]; finance: ProjectFinance | null } {
  requireProject(projectId, actor)
  return { metrics: listMetrics(projectId), finance: actor.allowDomain('finance') ? financeFor(projectId) : null }
}

const STATUS_LABELS: Record<string, string> = { por_clasificar: 'Por clasificar', propuesta: 'Propuesta', en_curso: 'En curso', pausado: 'Pausado', completado: 'Completado', facturado: 'Facturado', cancelado: 'Cancelado', pending: 'Pendiente', in_progress: 'En progreso', blocked: 'Bloqueado', done: 'Cumplido', cancelled: 'Cancelado' }
const dayText = (value: string | null) => (value ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'sin fecha')
const money = (value: number | null) => (value === null ? 'sin dato' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value))
const figure = (value: number | null) => (value === null ? '—' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value))
const cell = (value: string | null) => (value ?? '—').replace(/\|/g, '/').replace(/\s+/g, ' ')
const bogotaDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))

/**
 * Cut-off report for one project and a date range (Colombia days), as Markdown. Every figure is
 * computed here, so whoever presents it — Diego or Lucía — only has to read it.
 */
export function projectReport(id: string, actor: ProjectActor, range: { from?: string | null; to?: string | null } = {}, now = Date.now()) {
  const { project, milestones, tasks, updates } = getProjectDetail(id, actor, now)
  const { metrics, finance } = projectTracking(id, actor)
  const to = range.to || bogotaDay(now)
  const from = range.from || bogotaDay(Date.parse(`${to}T12:00:00-05:00`) - 30 * DAY_MS)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || Number.isNaN(Date.parse(`${from}T00:00:00-05:00`)) || Number.isNaN(Date.parse(`${to}T00:00:00-05:00`)) || from > to) throw new ProjectError('Indica el rango como from=AAAA-MM-DD y to=AAAA-MM-DD.')
  const start = Date.parse(`${from}T00:00:00-05:00`)
  const end = Date.parse(`${to}T23:59:59-05:00`)
  const inRange = (value: string | null) => Boolean(value) && Date.parse(value!) >= start && Date.parse(value!) <= end
  const agentNames = new Map(listAgents().map((agent) => [agent.id as string, agent.name]))
  const owner = (milestone: Milestone) => milestone.ownerName ?? agentNames.get(milestone.ownerAgentId ?? project.ownerAgentId) ?? '—'
  const counted = milestones.filter((milestone) => milestone.status !== 'cancelled')
  const period = updates.filter((update) => inRange(update.createdAt))
  const list = (kind: ProjectUpdateKind) => period.filter((update) => update.kind === kind).map((update) => `- ${dayText(update.createdAt)}: ${update.text}`)
  const openBlockers = updates.filter((update) => update.kind === 'bloqueo' && !update.resolvedAt)
  const resolved = updates.filter((update) => update.kind === 'bloqueo' && inRange(update.resolvedAt))
  const section = (title: string, lines: string[], empty: string) => [`## ${title}`, '', ...(lines.length ? lines : [empty]), '']

  const lines = [
    `# Informe de seguimiento — ${project.name}`, '',
    `**Corte:** ${dayText(`${from}T12:00:00-05:00`)} a ${dayText(`${to}T12:00:00-05:00`)} · **Generado:** ${dayText(new Date(now).toISOString())} (hora Colombia)`, '',
    '## Estado', '',
    `- **Estado:** ${STATUS_LABELS[project.status]}${project.health ? ` · **Semáforo:** ${project.health}` : ''}`,
    ...(project.healthReasons.length ? [`- **Alertas:** ${project.healthReasons.join('; ')}`] : []),
    ...(project.stateFile?.generalStatus ? [`- **Estado general (archivo de estado${project.stateFile.updatedLabel ? `, ${project.stateFile.updatedLabel}` : ''}):** ${project.stateFile.generalStatus}`] : []),
    `- **Avance:** ${project.progress === null ? 'sin hitos definidos' : project.progressSource === 'estado' ? `${project.progress} % (según el archivo de estado)` : `${project.progress} % (${project.milestoneCounts.done} de ${project.milestoneCounts.total} hitos cumplidos)`}`,
    `- **Cliente:** ${project.clientName ?? 'sin cliente'} · **Responsable:** ${agentNames.get(project.ownerAgentId) ?? project.ownerAgentId}`,
    `- **Tareas abiertas:** ${project.openTasks} de ${tasks.length}`,
    ...(project.nextAction ? [`- **Siguiente acción:** ${project.nextAction}`] : []), '',
    ...section('Compromisos e hitos', counted.length ? ['| Hito | Fase | Responsable | Vence | Estado |', '|---|---|---|---|---|', ...counted.map((milestone) => {
      const late = isOverdue(milestone, now) ? ` (atrasado ${brief(milestone, now).daysLate} d)` : ''
      return `| ${cell(milestone.title)} | ${cell(milestone.phase)} | ${cell(owner(milestone))} | ${dayText(milestone.dueAt)} | ${STATUS_LABELS[milestone.status]}${late} |`
    })] : [], 'Sin hitos definidos.'),
    ...section('Metas', metrics.length ? ['| Meta | Unidad | Total | Planeada a la fecha | Alcanzada | % de la meta |', '|---|---|---|---|---|---|', ...metrics.map((metric) => `| ${cell(metric.name)} | ${cell(metric.unit)} | ${figure(metric.targetTotal)} | ${figure(metric.plannedToDate)} | ${figure(metric.achieved)} | ${metric.targetTotal > 0 ? `${Math.round((metric.achieved / metric.targetTotal) * 100)} %` : '—'} |`)] : [], 'Sin metas definidas.'),
    ...section('Bloqueos abiertos', openBlockers.map((update) => `- Desde ${dayText(update.createdAt)}: ${update.text}`), 'Ninguno.'),
    ...section('Avances del periodo', list('avance'), 'Sin avances registrados en el periodo.'),
    ...section('Bloqueos resueltos en el periodo', resolved.map((update) => `- ${update.text}${update.resolution ? ` — ${update.resolution}` : ''}`), 'Ninguno.'),
    ...section('Riesgos y retos', list('riesgo'), 'Sin riesgos registrados en el periodo.'),
    ...section('Decisiones', list('decision'), 'Sin decisiones registradas en el periodo.'),
    ...section('Lecciones aprendidas', list('leccion'), 'Sin lecciones registradas en el periodo.'),
    ...(finance ? section('Presupuesto y cobros', [
      `- **Presupuesto:** ${money(finance.budget)} · **Costo real:** ${money(finance.actualCost)}`,
      `- **Cobrado:** ${money(finance.totals.invoiced)} · **Pagado:** ${money(finance.totals.paid)} · **Por cobrar:** ${money(finance.totals.pending)}`,
    ], '') : []),
  ]
  return { projectId: project.id, from, to, markdown: lines.join('\n').trimEnd() + '\n' }
}

// ---------- status files ----------
// Each project keeps a status file on Diego's computer or Drive. Synapse stores the last version it
// was given, so the control center shows what the file says without anyone retyping it.

db.exec(`CREATE TABLE IF NOT EXISTS project_states (
  project_id TEXT PRIMARY KEY, title TEXT, updated_label TEXT, general_status TEXT, progress INTEGER, sections_json TEXT NOT NULL,
  source_path TEXT, source_drive_file TEXT, content_hash TEXT NOT NULL, changed_at TEXT NOT NULL, imported_at TEXT NOT NULL
)`)

export type ProjectStateRecord = { projectId: string; title: string | null; updatedLabel: string | null; generalStatus: string | null; progress: number | null; sections: ProjectStateSections; sourcePath: string | null; sourceDriveFile: string | null; changedAt: string; importedAt: string }

function projectStateFor(projectId: string): ProjectStateRecord | null {
  const found = row('SELECT * FROM project_states WHERE project_id = ?', projectId)
  if (!found) return null
  return { projectId, title: nullable(found.title), updatedLabel: nullable(found.updated_label), generalStatus: nullable(found.general_status), progress: numberOrNull(found.progress), sections: JSON.parse(String(found.sections_json)) as ProjectStateSections, sourcePath: nullable(found.source_path), sourceDriveFile: nullable(found.source_drive_file), changedAt: String(found.changed_at), importedAt: String(found.imported_at) }
}

/** A state already parsed by the sync script arrives as JSON; it is trusted no more than any other input. */
function sanitizeState(value: unknown): ParsedProjectState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProjectError('state debe ser un objeto.')
  const input = value as Record<string, unknown>
  const sections = (input.sections && typeof input.sections === 'object' ? input.sections : {}) as Record<string, unknown>
  const items = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 30).map((item) => item.trim().slice(0, 300)) : [])
  const progress = typeof input.progress === 'number' && Number.isFinite(input.progress) ? Math.max(0, Math.min(100, Math.round(input.progress))) : null
  return { title: clean(input.title, 'title', 200), projectId: clean(input.projectId, 'projectId', 120), updatedLabel: clean(input.updatedLabel, 'updatedLabel', 80), generalStatus: clean(input.generalStatus, 'generalStatus', 600), progress, nextAction: clean(input.nextAction, 'nextAction', 2000), mainBlocker: clean(input.mainBlocker, 'mainBlocker', 2000), sourceDriveFolder: clean(input.sourceDriveFolder, 'sourceDriveFolder', 1000), sourceDriveFile: clean(input.sourceDriveFile, 'sourceDriveFile', 1000), obsidianNote: clean(input.obsidianNote, 'obsidianNote', 500), sections: { completed: items(sections.completed), inProgress: items(sections.inProgress), pending: items(sections.pending), nextSteps: items(sections.nextSteps) } }
}

/**
 * Loads a project's status file. Creates the project when it is new, confirms it when it was only
 * "por clasificar", and keeps the next action and the main blocker in step with the file.
 */
export function importProjectState(input: Record<string, unknown>, actor: ProjectActor) {
  onlyKnownKeys(input, ['projectId', 'name', 'domain', 'markdown', 'state', 'sourcePath'])
  let parsed: ParsedProjectState
  if (typeof input.markdown === 'string' && input.markdown.trim()) {
    if (input.markdown.length > 400_000) throw new ProjectError('El archivo de estado excede el tamaño permitido.', 413)
    parsed = parseProjectState(input.markdown)
  } else if (input.state !== undefined) parsed = sanitizeState(input.state)
  else throw new ProjectError('Envía el contenido en markdown o el estado ya leído en state.')

  const requested = clean(input.projectId, 'projectId', 120) ?? parsed.projectId
  const name = clean(input.name, 'name', 200) ?? parsed.title
  const id = requested && row('SELECT id FROM projects WHERE id = ?', requested) ? requested : slugify(requested ?? name ?? '')
  if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(id)) throw new ProjectError('No se pudo identificar el proyecto: envía projectId o un archivo con título.')
  let created = false
  if (!getProjectRow(id)) {
    if (row('SELECT id FROM projects WHERE id = ?', id)) throw new ProjectError('Ese proyecto fue eliminado en Synapse; no se vuelve a crear desde el archivo.', 409)
    createProject({ id, name: name ?? humanize(id), domain: input.domain ?? 'agency', status: 'en_curso' }, actor)
    created = true
  }
  const project = requireProject(id, actor)
  const sourcePath = clean(input.sourcePath, 'sourcePath', 1000)
  const changes: Record<string, unknown> = {}
  if (project.status === 'por_clasificar') changes.status = 'en_curso'
  if (parsed.nextAction && parsed.nextAction !== project.nextAction) changes.nextAction = parsed.nextAction
  if (sourcePath && sourcePath !== project.sourcePath) changes.sourcePath = sourcePath
  if (parsed.sourceDriveFolder && parsed.sourceDriveFolder !== project.sourceDriveFolder) changes.sourceDriveFolder = parsed.sourceDriveFolder
  if (parsed.obsidianNote && parsed.obsidianNote !== project.obsidianNote) changes.obsidianNote = parsed.obsidianNote
  if (Object.keys(changes).length) updateProject(id, changes, actor)

  // The file names one main blocker. A different text replaces the previous one; no text clears it.
  const prefix = `estado:${id}:`
  const wanted = parsed.mainBlocker ? `${prefix}${createHash('sha256').update(parsed.mainBlocker).digest('hex').slice(0, 16)}` : null
  const now = new Date().toISOString()
  db.prepare("UPDATE project_updates SET resolved_at = ?, resolution = 'El archivo de estado dejó de reportarlo.' WHERE project_id = ? AND kind = 'bloqueo' AND resolved_at IS NULL AND substr(external_id, 1, ?) = ? AND external_id <> ?").run(now, id, prefix.length, prefix, wanted ?? '')
  if (wanted && parsed.mainBlocker) {
    if (row('SELECT id FROM project_updates WHERE external_id = ?', wanted)) db.prepare('UPDATE project_updates SET resolved_at = NULL, resolution = NULL WHERE external_id = ?').run(wanted)
    else addProjectUpdate(id, { kind: 'bloqueo', text: parsed.mainBlocker, externalId: wanted }, actor)
  }

  const stored = { title: parsed.title, updatedLabel: parsed.updatedLabel, generalStatus: parsed.generalStatus, progress: parsed.progress, sections: parsed.sections, nextAction: parsed.nextAction, mainBlocker: parsed.mainBlocker }
  const hash = createHash('sha256').update(JSON.stringify(stored)).digest('hex')
  const previous = row('SELECT content_hash, changed_at FROM project_states WHERE project_id = ?', id)
  const changed = !previous || String(previous.content_hash) !== hash
  db.prepare(`INSERT INTO project_states (project_id, title, updated_label, general_status, progress, sections_json, source_path, source_drive_file, content_hash, changed_at, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET title = excluded.title, updated_label = excluded.updated_label, general_status = excluded.general_status, progress = excluded.progress, sections_json = excluded.sections_json,
    source_path = COALESCE(excluded.source_path, project_states.source_path), source_drive_file = COALESCE(excluded.source_drive_file, project_states.source_drive_file), content_hash = excluded.content_hash, changed_at = excluded.changed_at, imported_at = excluded.imported_at`)
    .run(id, parsed.title, parsed.updatedLabel, parsed.generalStatus, parsed.progress, JSON.stringify(parsed.sections), sourcePath, parsed.sourceDriveFile, hash, changed ? now : String(previous!.changed_at), now)
  if (changed) addAudit({ action: 'project_state_imported', summary: id, source: actor.source, actorId: actor.actorId })
  return { project: summarize([getProjectRow(id)!], actor, Date.now())[0], state: projectStateFor(id), created, changed }
}
