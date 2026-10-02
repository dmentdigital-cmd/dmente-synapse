import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { URL } from 'node:url'
import { accessFromRequest, authConfigured, authStatus, beginTotpSetup, clearSession, clearSessionCookie, confirmTotpSetup, disableTotp, hashPassword, login, loginBlocked, mfaEnabledForUser, mfaManagedForUser, revokeUserSessions, sessionFromRequest, setSessionCookie, totpEncryptionConfigured, validateProductionSecurityConfiguration } from './auth.js'
import { addAudit, addMessage, closeDatabase, confirmRequestApproval, createCommitment, createRequest, createUserAccount, findUserById, findUserByUsername, getLatestAgendaStatusComment, getLocalProfile, getRequest, listAgents, listCommitments, listMessages, listPermissions, listRequests, listUserAccounts, recordAgendaStatusChange, updateCommitmentStatus, updateRequestSources, updateRequestStatus, updateUserAccount } from './db.js'
import { buildReply, routeRequest } from './orchestrator.js'
import { authorizedWriteForDomain, handleMcp } from './mcp.js'
import { getHermesStatus, isHermesConfigured, requestHermesReply } from './hermes.js'
import { allowApiRequest, applySecurityHeaders, clientAddress, readJsonBody, sameOriginMutation } from './security.js'
import type { Domain, UserRole } from './types.js'
import { editAgendaRecord, removeAgendaRecord } from './agenda-mutations.js'

const port = Number(process.env.PORT ?? 3010)
const host = process.env.SYNAPSE_HOST ?? '127.0.0.1'
const distDir = path.resolve(process.cwd(), 'dist')
const validDomains: Domain[] = ['agency', 'personal', 'family', 'health', 'education', 'church', 'learning', 'wellbeing', 'projects', 'technology', 'finance', 'knowledge', 'product', 'messaging', 'sales', 'marketing', 'legal']
const validRoles: UserRole[] = ['viewer', 'operator', 'approver', 'admin']

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value.trim() : fallback }

function requireSession(req: IncomingMessage, res: ServerResponse, allowedRoles: UserRole[] = ['viewer', 'operator', 'approver', 'admin'], allowMfaEnrollment = false): NonNullable<ReturnType<typeof accessFromRequest>> | null {
  if (!authConfigured()) { send(res, 503, { error: 'Configura la autenticación de Synapse para consultar datos operativos.' }); return null }
  const session = accessFromRequest(req)
  if (!session) { send(res, 401, { error: 'Inicia sesión para consultar datos operativos.' }); return null }
  if (!allowedRoles.includes(session.role)) { send(res, 403, { error: 'Tu rol no permite esta acción.' }); return null }
  if (process.env.NODE_ENV === 'production' && session.role === 'admin' && !mfaEnabledForUser(session.userId) && !allowMfaEnrollment) {
    send(res, 403, { error: 'Activa la autenticación de dos pasos para habilitar el acceso administrativo.' }); return null
  }
  return session
}

function inDomain(session: NonNullable<ReturnType<typeof accessFromRequest>>, domain: Domain): boolean { return session.role === 'admin' || session.domains.includes(domain) }

function agendaItemFromRequest(request: ReturnType<typeof listRequests>[number]) {
  return { id: request.id, kind: 'request' as const, requestId: request.id, commitmentId: null, title: request.title, domain: request.domain, projectId: request.projectId, agentId: request.agentId, status: request.status, priority: request.priority, riskLevel: request.riskLevel, requiresApproval: request.requiresApproval, approvalConfirmed: request.approvalConfirmed, startsAt: request.startsAt, dueAt: request.dueAt, nextAction: request.nextAction, sourcePath: request.sourcePath, sourceDriveFolder: request.sourceDriveFolder, createdAt: request.createdAt, updatedAt: request.updatedAt, lastStatusComment: getLatestAgendaStatusComment(request.id) }
}

function agendaItemFromCommitment(commitment: ReturnType<typeof listCommitments>[number]) {
  const agentsByDomain: Partial<Record<Domain, string>> = { health: 'salud-familiar', family: 'salud-familiar', sales: 'ventas', marketing: 'marketing', learning: 'educacion-aprendizaje', projects: 'pmo', technology: 'tecnico', agency: 'pmo' }
  const status = commitment.status === 'done' ? 'done' : commitment.status === 'cancelled' ? 'cancelled' : commitment.status === 'in_progress' || commitment.status === 'confirmed' ? 'in_progress' : commitment.status === 'waiting_approval' ? 'waiting_approval' : commitment.status === 'blocked' ? 'blocked' : 'pending'
  return { id: `commitment:${commitment.id}`, kind: 'commitment' as const, requestId: null, commitmentId: commitment.id, title: commitment.title, domain: commitment.domain, projectId: null, agentId: agentsByDomain[commitment.domain] ?? 'secretaria', status, priority: 'normal' as const, riskLevel: 'low' as const, requiresApproval: false, approvalConfirmed: false, startsAt: commitment.startsAt, dueAt: commitment.dueAt, nextAction: '', sourcePath: null, sourceDriveFolder: null, createdAt: commitment.createdAt, updatedAt: commitment.updatedAt, lastStatusComment: getLatestAgendaStatusComment(`commitment:${commitment.id}`) }
}

async function completeWithHermes(input: { requestId: string; conversationAgentId: Parameters<typeof addMessage>[0]['agentId']; decision: ReturnType<typeof routeRequest> }): Promise<void> {
  try {
    const reply = await requestHermesReply({
      requestId: input.requestId,
      conversationAgentId: input.conversationAgentId,
      assignedAgentId: input.decision.agentId,
      domain: input.decision.domain,
      projectId: input.decision.projectId,
      priority: input.decision.priority,
      riskLevel: input.decision.riskLevel,
      requiresApproval: input.decision.requiresApproval,
      nextAction: input.decision.nextAction,
      obsidianNote: getRequest(input.requestId)?.obsidianNote,
      sourcePath: getRequest(input.requestId)?.sourcePath,
      sourceDriveFolder: getRequest(input.requestId)?.sourceDriveFolder,
      history: listMessages(input.conversationAgentId, [input.decision.domain]),
    })
    addMessage({ requestId: input.requestId, agentId: input.conversationAgentId, domain: input.decision.domain, direction: 'agent', text: reply })
    addAudit({ requestId: input.requestId, action: 'hermes_reply_created', summary: reply.slice(0, 120), source: 'hermes-api-server' })
  } catch (error) {
    console.error(`[Hermes] Fallo al procesar la solicitud ${input.requestId}`)
    const failure = 'No pude activar LuciaBot en Hermes para esta solicitud. El caso quedó registrado y puede revisarse desde Solicitudes.'
    addMessage({ requestId: input.requestId, agentId: input.conversationAgentId, domain: input.decision.domain, direction: 'agent', text: failure })
    addAudit({ requestId: input.requestId, action: 'hermes_reply_failed', summary: 'Fallo al procesar respuesta de Hermes', source: 'synapse-api' })
  }
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' } as Record<string, string>)[extension] ?? 'application/octet-stream'
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const decoded = decodeURIComponent(pathname)
  const requested = path.resolve(distDir, `.${decoded === '/' ? '/index.html' : decoded}`)
  if (requested !== distDir && !requested.startsWith(`${distDir}${path.sep}`)) { res.writeHead(403); res.end('Forbidden'); return }
  let filePath = requested
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('not a file')
  } catch {
    filePath = path.join(distDir, 'index.html')
  }
  try {
    const file = await readFile(filePath)
    const isEntryPoint = filePath.endsWith('index.html') || filePath.endsWith('sw.js')
    const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`)
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': isEntryPoint ? 'no-cache' : isHashedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' })
    res.end(file)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
}

const server = createServer(async (req, res) => {
  applySecurityHeaders(res)
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if ((url.pathname.startsWith('/api/') || url.pathname === '/mcp') && !allowApiRequest(req)) return send(res, 429, { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' })
    if (url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '') && !sameOriginMutation(req)) return send(res, 403, { error: 'Origen de solicitud no permitido.' })
    if (url.pathname === '/mcp') return handleMcp(req, res)
    if (req.method === 'GET' && url.pathname === '/api/health') {
      if (!sessionFromRequest(req)) return send(res, 200, { ok: true, service: 'dmente-synapse-api' })
      if (!requireSession(req, res)) return
      const hermes = await getHermesStatus()
      return send(res, 200, { ok: true, service: 'dmente-synapse-api', hermesAutomaticReplies: hermes.configured, hermesReachable: hermes.reachable, hermesLastError: hermes.lastError, time: new Date().toISOString() })
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/session') return send(res, 200, authStatus(req))
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await readJsonBody(req)
      const address = clientAddress(req)
      const token = login(text(input.username), typeof input.password === 'string' ? input.password : '', address, text(input.mfaCode))
      if (!token && loginBlocked(address)) return send(res, 429, { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' })
      if (!token) return send(res, 401, { error: 'Credenciales inválidas o autenticación no configurada' })
      setSessionCookie(res, token)
      const account = findUserByUsername(text(input.username))
      return send(res, 200, { authenticated: true, userId: account?.id, role: account?.role, domains: account?.domains, mfaEnabled: account ? mfaEnabledForUser(account.id) : false, mfaManaged: account ? mfaManagedForUser(account.id) : false })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      clearSession(req)
      clearSessionCookie(res)
      return send(res, 200, { authenticated: false })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/mfa/setup') {
      const session = requireSession(req, res, ['viewer', 'operator', 'approver', 'admin'], true); if (!session) return
      if (!totpEncryptionConfigured()) return send(res, 503, { error: 'Configura SYNAPSE_TOTP_ENCRYPTION_KEY con al menos 32 caracteres aleatorios antes de activar MFA.' })
      const input = await readJsonBody(req)
      const setup = beginTotpSetup(session.userId, text(input.currentCode))
      if (!setup) return send(res, 400, { error: mfaEnabledForUser(session.userId) ? 'Código MFA actual incorrecto.' : 'No se pudo preparar la configuración MFA.' })
      return send(res, 200, setup)
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/mfa/confirm') {
      const session = requireSession(req, res, ['viewer', 'operator', 'approver', 'admin'], true); if (!session) return
      const input = await readJsonBody(req)
      if (!confirmTotpSetup(session.userId, text(input.code))) return send(res, 400, { error: 'Código inválido o configuración vencida. Inicia de nuevo.' })
      addAudit({ action: 'user_mfa_enabled', summary: 'MFA individual activado', source: 'manual', actorId: session.userId })
      return send(res, 200, { mfaEnabled: true })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/mfa/disable') {
      const session = requireSession(req, res, ['viewer', 'operator', 'approver', 'admin'], true); if (!session) return
      const input = await readJsonBody(req)
      if (!disableTotp(session.userId, text(input.password), text(input.code))) return send(res, 400, { error: 'Contraseña o código incorrectos.' })
      addAudit({ action: 'user_mfa_disabled', summary: 'MFA individual desactivado', source: 'manual', actorId: session.userId })
      return send(res, 200, { mfaEnabled: false })
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/users') {
      if (!requireSession(req, res, ['admin'])) return
      return send(res, 200, { users: listUserAccounts() })
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/users') {
      const session = requireSession(req, res, ['admin']); if (!session) return
      const input = await readJsonBody(req)
      const username = text(input.username)
      const name = text(input.name)
      const password = typeof input.password === 'string' ? input.password : ''
      const role = text(input.role) as UserRole
      const domains = Array.isArray(input.domains) ? input.domains.filter((domain): domain is Domain => typeof domain === 'string' && validDomains.includes(domain as Domain)) : []
      if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username) || !name || name.length > 120) return send(res, 400, { error: 'Usuario o nombre no válido.' })
      if (password.length < 12 || password.length > 256) return send(res, 400, { error: 'La contraseña debe tener entre 12 y 256 caracteres.' })
      if (!validRoles.includes(role) || !Array.isArray(input.domains) || domains.length !== input.domains.length || domains.length === 0) return send(res, 400, { error: 'Rol o dominios no válidos.' })
      const credentials = hashPassword(password)
      const created = createUserAccount({ id: randomUUID(), username, name, role, domains, ...credentials })
      if (!created) return send(res, 409, { error: 'Ya existe una cuenta con ese usuario.' })
      addAudit({ action: 'user_account_created', summary: `Cuenta ${username}, rol ${role}`, source: 'admin', actorId: session.userId })
      return send(res, 201, { user: listUserAccounts().find((user) => user.username.toLowerCase() === username.toLowerCase()) })
    }
    const userAdminMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
    if (req.method === 'PATCH' && userAdminMatch) {
      const session = requireSession(req, res, ['admin']); if (!session) return
      const userId = decodeURIComponent(userAdminMatch[1])
      const current = findUserById(userId)
      if (!current) return send(res, 404, { error: 'Cuenta no encontrada.' })
      const input = await readJsonBody(req)
      if (input.name !== undefined && (!text(input.name) || text(input.name).length > 120)) return send(res, 400, { error: 'Nombre no válido.' })
      const nextRole = input.role === undefined ? current.role : text(input.role) as UserRole
      const nextActive = input.active === undefined ? current.active : input.active === true
      if (input.role !== undefined && !validRoles.includes(nextRole)) return send(res, 400, { error: 'Rol no válido.' })
      if (input.active !== undefined && typeof input.active !== 'boolean') return send(res, 400, { error: 'active debe ser booleano.' })
      let domains: Domain[] | undefined
      if (input.domains !== undefined) {
        if (!Array.isArray(input.domains) || input.domains.length === 0 || input.domains.some((domain) => typeof domain !== 'string' || !validDomains.includes(domain as Domain))) return send(res, 400, { error: 'Dominios no válidos.' })
        domains = input.domains as Domain[]
      }
      const password = input.password === undefined ? '' : typeof input.password === 'string' ? input.password : '\u0000'
      if (input.password !== undefined && (password.length < 12 || password.length > 256)) return send(res, 400, { error: 'La contraseña debe tener entre 12 y 256 caracteres.' })
      const admins = listUserAccounts().filter((user) => user.role === 'admin' && user.active)
      if (current.role === 'admin' && current.active && (nextRole !== 'admin' || !nextActive) && admins.length <= 1) return send(res, 409, { error: 'Debe quedar al menos una cuenta admin activa.' })
      const credentials = password ? hashPassword(password) : {}
      updateUserAccount(userId, { name: input.name === undefined ? undefined : text(input.name).slice(0, 120), role: nextRole, active: nextActive, domains, ...credentials })
      if (password) revokeUserSessions(userId)
      addAudit({ action: 'user_account_updated', summary: `Cuenta ${current.username} actualizada`, source: 'admin', actorId: session.userId })
      return send(res, 200, { user: listUserAccounts().find((user) => user.id === userId) })
    }
    if (req.method === 'GET' && url.pathname === '/api/profile') {
      const session = requireSession(req, res); if (!session) return
      const account = findUserById(session.userId)
      return send(res, 200, { profile: { id: session.userId, name: account?.name ?? getLocalProfile().name, role: session.role }, permissions: listPermissions().filter((permission) => inDomain(session, permission.domain)) })
    }
    if (req.method === 'GET' && url.pathname === '/api/agents') {
      const session = requireSession(req, res); if (!session) return
      return send(res, 200, { agents: listAgents().filter((agent) => inDomain(session, agent.domain)) })
    }
    if (req.method === 'GET' && url.pathname === '/api/commitments') {
      const session = requireSession(req, res); if (!session) return
      const requestedDomain = (url.searchParams.get('domain') as Domain | null) ?? undefined
      if (requestedDomain && !inDomain(session, requestedDomain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
      return send(res, 200, { commitments: listCommitments(requestedDomain).filter((item) => inDomain(session, item.domain)) })
    }
    if (req.method === 'GET' && url.pathname === '/api/requests') {
      const session = requireSession(req, res); if (!session) return
      return send(res, 200, { requests: listRequests().filter((item) => inDomain(session, item.domain)) })
    }
    if (req.method === 'GET' && url.pathname === '/api/operational-agenda') {
      const session = requireSession(req, res); if (!session) return
      const items = [...listRequests().filter((item) => inDomain(session, item.domain)).map(agendaItemFromRequest), ...listCommitments().filter((item) => inDomain(session, item.domain)).map(agendaItemFromCommitment)]
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const filtered = items.filter((item) => {
        const date = item.startsAt ?? item.dueAt
        if (!date) return !from && !to
        const day = date.slice(0, 10)
        return (!from || day >= from) && (!to || day <= to)
      }).sort((left, right) => (left.startsAt ?? left.dueAt ?? '').localeCompare(right.startsAt ?? right.dueAt ?? ''))
      return send(res, 200, { items: filtered })
    }
    if (req.method === 'POST' && url.pathname === '/api/operational-agenda/items') {
      const session = requireSession(req, res, ['operator', 'approver', 'admin']); if (!session) return
      const input = await readJsonBody(req)
      const title = text(input.title)
      const agentId = text(input.agentId)
      const domain = text(input.domain) as Domain
      const priority = text(input.priority, 'normal')
      const riskLevel = text(input.riskLevel, 'low')
      const startsAtValue = text(input.startsAt)
      const dueAtValue = text(input.dueAt)
      const startsAt = startsAtValue ? new Date(startsAtValue) : null
      const dueAt = dueAtValue ? new Date(dueAtValue) : null
      if (!title) return send(res, 400, { error: 'Escribe un título para la tarea.' })
      const assignedAgent = listAgents().find((agent) => agent.id === agentId)
      if (!assignedAgent || assignedAgent.domain !== domain) return send(res, 400, { error: 'El agente debe corresponder al dominio seleccionado.' })
      if (!listPermissions().some((permission) => permission.domain === domain)) return send(res, 400, { error: 'Selecciona un dominio válido.' })
      if (!inDomain(session, domain)) return send(res, 403, { error: 'No tienes permiso para operar en ese dominio.' })
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) return send(res, 400, { error: 'Selecciona una prioridad válida.' })
      if (!['low', 'medium', 'high'].includes(riskLevel)) return send(res, 400, { error: 'Selecciona un nivel de riesgo válido.' })
      if ((startsAtValue && (!startsAt || Number.isNaN(startsAt.getTime()))) || (dueAtValue && (!dueAt || Number.isNaN(dueAt.getTime())))) return send(res, 400, { error: 'Revisa las fechas y horas de la tarea.' })
      if (startsAt && dueAt && startsAt.getTime() > dueAt.getTime()) return send(res, 400, { error: 'La fecha de vencimiento debe ser posterior al inicio.' })
      const request = createRequest({ agentId: agentId as Parameters<typeof createRequest>[0]['agentId'], domain, title: title.slice(0, 200), projectId: text(input.projectId).slice(0, 120) || null, priority: priority as 'low' | 'normal' | 'high' | 'urgent', riskLevel: riskLevel as 'low' | 'medium' | 'high', requiresApproval: input.requiresApproval === true, initialStatus: 'pending', startsAt: startsAt?.toISOString() ?? null, dueAt: dueAt?.toISOString() ?? null, nextAction: text(input.nextAction) || 'Definir siguiente acción' })
      addAudit({ requestId: request.id, action: 'agenda_item_created', summary: request.title, source: 'agenda-operativa' })
      return send(res, 201, { item: agendaItemFromRequest(request) })
    }
    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const session = requireSession(req, res); if (!session) return
      const agentId = text(url.searchParams.get('agentId')) as Parameters<typeof listMessages>[0]
      if (!agentId) return send(res, 400, { error: 'agentId es obligatorio' })
      const agent = listAgents().find((item) => item.id === agentId)
      if (!agent) return send(res, 404, { error: 'agentId no encontrado' })
      if (!inDomain(session, agent.domain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
      return send(res, 200, { messages: listMessages(agentId, session.role === 'admin' ? undefined : session.domains) })
    }
    if (req.method === 'POST' && url.pathname === '/api/hermes/reply') {
      const input = await readJsonBody(req)
      const requestId = text(input.requestId)
      const agentId = text(input.agentId) as Parameters<typeof addMessage>[0]['agentId']
      const messageText = text(input.text)
      if (!requestId || !agentId || !messageText) return send(res, 400, { error: 'requestId, agentId y text son obligatorios' })
      const request = getRequest(requestId)
      if (!request) return send(res, 404, { error: 'request not found' })
      const agent = listAgents().find((item) => item.id === agentId)
      if (!agent) return send(res, 400, { error: 'agentId no encontrado' })
      if (!authorizedWriteForDomain(req, request.domain) || !authorizedWriteForDomain(req, agent.domain)) return send(res, 401, { error: 'MCP no autorizado para este dominio' })
      if (messageText.length > 10_000) return send(res, 413, { error: 'El mensaje excede el máximo de 10000 caracteres.' })
      const message = addMessage({ requestId, agentId, domain: request.domain, direction: 'agent', text: messageText })
      addAudit({ requestId, action: 'hermes_reply_created', summary: messageText.slice(0, 120), source: 'hermes-mcp' })
      return send(res, 201, { message })
    }
    if (req.method === 'POST' && url.pathname === '/api/commitments') {
      const session = requireSession(req, res, ['operator', 'approver', 'admin']); if (!session) return
      const input = await readJsonBody(req)
      const title = text(input.title)
      if (!title) return send(res, 400, { error: 'title es obligatorio' })
      if (title.length > 200) return send(res, 400, { error: 'title excede el máximo de 200 caracteres' })
      const domain = text(input.domain, 'personal') as Domain
      if (!listPermissions().some((permission) => permission.domain === domain)) return send(res, 400, { error: 'Selecciona un dominio válido.' })
      if (!inDomain(session, domain)) return send(res, 403, { error: 'No tienes permiso para operar en ese dominio.' })
      const startsAtValue = text(input.startsAt)
      const dueAtValue = text(input.dueAt)
      const startsAt = startsAtValue ? new Date(startsAtValue) : null
      const dueAt = dueAtValue ? new Date(dueAtValue) : null
      if ((startsAtValue && (!startsAt || Number.isNaN(startsAt.getTime()))) || (dueAtValue && (!dueAt || Number.isNaN(dueAt.getTime())))) return send(res, 400, { error: 'Revisa las fechas y horas del compromiso.' })
      if (startsAt && dueAt && startsAt.getTime() > dueAt.getTime()) return send(res, 400, { error: 'La fecha de vencimiento debe ser posterior al inicio.' })
      const people = Array.isArray(input.people) ? input.people.filter((item): item is string => typeof item === 'string').slice(0, 20).map((person) => person.trim().slice(0, 120)).filter(Boolean) : []
      const commitment = createCommitment({ title, domain, people, source: 'manual', startsAt: startsAt?.toISOString() ?? null, dueAt: dueAt?.toISOString() ?? null })
      addAudit({ action: 'commitment_created', summary: commitment.title, source: 'api' })
      return send(res, 201, { commitment })
    }
    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const session = requireSession(req, res, ['operator', 'approver', 'admin']); if (!session) return
      const input = await readJsonBody(req)
      const message = text(input.text)
      if (!message) return send(res, 400, { error: 'text es obligatorio' })
      if (message.length > 10_000) return send(res, 413, { error: 'El mensaje excede el máximo de 10000 caracteres.' })
      const decision = routeRequest(message)
      const requestedAgentId = text(input.agentId) as Parameters<typeof addMessage>[0]['agentId']
      const conversationAgentId = requestedAgentId && listAgents().some((agent) => agent.id === requestedAgentId) ? requestedAgentId : decision.agentId
      if (!inDomain(session, decision.domain)) return send(res, 403, { error: 'No tienes permiso para operar en ese dominio.' })
      const conversationAgent = listAgents().find((agent) => agent.id === conversationAgentId)
      if (!conversationAgent || !inDomain(session, conversationAgent.domain)) return send(res, 403, { error: 'No tienes permiso para usar ese agente.' })
      const request = createRequest({ agentId: decision.agentId, domain: decision.domain, title: message.slice(0, 120), projectId: decision.projectId, priority: decision.priority, riskLevel: decision.riskLevel, requiresApproval: decision.requiresApproval, nextAction: decision.nextAction })
      addMessage({ requestId: request.id, agentId: conversationAgentId, domain: decision.domain, direction: 'user', text: message })
      if (isHermesConfigured()) {
        void completeWithHermes({ requestId: request.id, conversationAgentId, decision })
        addAudit({ requestId: request.id, action: 'hermes_reply_queued', summary: `${decision.agentId}/${decision.domain}`, source: 'synapse-api' })
        return send(res, 202, { request, decision, conversationAgentId, processing: true })
      }
      const reply = buildReply(decision, message)
      addMessage({ requestId: request.id, agentId: conversationAgentId, domain: decision.domain, direction: 'agent', text: reply })
      addAudit({ requestId: request.id, action: 'request_routed', summary: `${decision.agentId}/${decision.domain}`, source: 'local-decision-provider' })
      return send(res, 201, { request, decision, conversationAgentId, reply })
    }
    const approvalMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/(approve|reject)$/)
    if (req.method === 'POST' && approvalMatch) {
      const session = requireSession(req, res, ['approver', 'admin']); if (!session) return
      const existing = getRequest(approvalMatch[1])
      if (existing && !inDomain(session, existing.domain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
      const request = approvalMatch[2] === 'approve'
        ? confirmRequestApproval(approvalMatch[1])
        : updateRequestStatus(approvalMatch[1], 'cancelled')
      if (!request) return send(res, 404, { error: 'request not found' })
      addAudit({ requestId: request.id, action: approvalMatch[2] === 'approve' ? 'approval_confirmed' : 'request_cancelled', summary: request.title, source: 'manual', actorId: session.userId })
      return send(res, 200, { request })
    }
    const agendaEditMatch = url.pathname.match(/^\/api\/operational-agenda\/items\/([^/]+)\/details$/)
    if (req.method === 'PATCH' && agendaEditMatch) {
      const session = requireSession(req, res, ['admin']); if (!session) return
      const result = editAgendaRecord(decodeURIComponent(agendaEditMatch[1]), await readJsonBody(req), 'agenda-operativa', (domain) => inDomain(session, domain))
      return send(res, 200, { item: result.kind === 'commitment' ? agendaItemFromCommitment(result.record as Parameters<typeof agendaItemFromCommitment>[0]) : agendaItemFromRequest(result.record as Parameters<typeof agendaItemFromRequest>[0]) })
    }
    const commitmentEditMatch = url.pathname.match(/^\/api\/commitments\/([^/]+)$/)
    if ((req.method === 'PATCH' || req.method === 'DELETE') && commitmentEditMatch) {
      const session = requireSession(req, res, ['admin']); if (!session) return
      const input = await readJsonBody(req)
      const id = decodeURIComponent(commitmentEditMatch[1])
      const allowDomain = (domain: Domain) => inDomain(session, domain)
      if (req.method === 'DELETE') return send(res, 200, removeAgendaRecord(id, input.expectedTitle, 'agenda-operativa', allowDomain, true))
      return send(res, 200, { commitment: editAgendaRecord(id, input, 'agenda-operativa', allowDomain, true).record })
    }
    const agendaStatusMatch = url.pathname.match(/^\/api\/operational-agenda\/items\/([^/]+)$/)
    if (req.method === 'DELETE' && agendaStatusMatch) {
      const session = requireSession(req, res, ['admin']); if (!session) return
      const input = await readJsonBody(req)
      return send(res, 200, removeAgendaRecord(decodeURIComponent(agendaStatusMatch[1]), input.expectedTitle, 'agenda-operativa', (domain) => inDomain(session, domain)))
    }
    if (req.method === 'PATCH' && agendaStatusMatch) {
      const session = requireSession(req, res, ['operator', 'approver', 'admin']); if (!session) return
      const input = await readJsonBody(req)
      const status = text(input.status)
      const comment = text(input.comment)
      if (comment.length > 2000) return send(res, 413, { error: 'El comentario no puede superar 2000 caracteres.' })
      if (!['pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled'].includes(status)) return send(res, 400, { error: 'Estado no válido' })
      const id = decodeURIComponent(agendaStatusMatch[1])
      if (id.startsWith('commitment:')) {
        const current = listCommitments().find((item) => `commitment:${item.id}` === id)
        if (!current) return send(res, 404, { error: 'compromiso no encontrado' })
        if (!inDomain(session, current.domain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
        const commitmentStatus = status === 'in_progress' ? 'in_progress' : status === 'waiting_approval' ? 'waiting_approval' : status === 'blocked' ? 'blocked' : status
        const commitment = updateCommitmentStatus(id.slice('commitment:'.length), commitmentStatus as 'pending' | 'in_progress' | 'waiting_approval' | 'blocked' | 'done' | 'cancelled')
        if (!commitment) return send(res, 404, { error: 'compromiso no encontrado' })
        recordAgendaStatusChange({ itemId: id, fromStatus: current.status, toStatus: commitment.status, comment })
        addAudit({ action: 'agenda_commitment_status_updated', summary: `${commitment.title}: ${commitment.status}`, source: 'agenda-operativa' })
        return send(res, 200, { item: agendaItemFromCommitment(commitment) })
      }
      const current = getRequest(id)
      if (!current) return send(res, 404, { error: 'tarea no encontrada' })
      if (!inDomain(session, current.domain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
      const request = updateRequestStatus(id, status as 'pending' | 'in_progress' | 'waiting_approval' | 'blocked' | 'done' | 'cancelled')
      if (!request) return send(res, 409, { error: 'Confirma la aprobación antes de marcar esta tarea como hecha.' })
      recordAgendaStatusChange({ itemId: id, fromStatus: current.status, toStatus: request.status, comment })
      addAudit({ requestId: request.id, action: 'agenda_status_updated', summary: `${request.title}: ${request.status}`, source: 'agenda-operativa' })
      return send(res, 200, { item: agendaItemFromRequest(request) })
    }
    const sourcesMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/sources$/)
    if (req.method === 'POST' && sourcesMatch) {
      const session = requireSession(req, res, ['operator', 'approver', 'admin']); if (!session) return
      const existing = getRequest(sourcesMatch[1])
      if (existing && !inDomain(session, existing.domain)) return send(res, 403, { error: 'No tienes acceso a ese dominio.' })
      const input = await readJsonBody(req)
      const request = updateRequestSources(sourcesMatch[1], {
        obsidianNote: input.obsidianNote === null ? null : text(input.obsidianNote) || undefined,
        sourcePath: input.sourcePath === null ? null : text(input.sourcePath) || undefined,
        sourceDriveFolder: input.sourceDriveFolder === null ? null : text(input.sourceDriveFolder) || undefined,
      })
      if (!request) return send(res, 404, { error: 'request not found' })
      addAudit({ requestId: request.id, action: 'request_sources_updated', summary: 'Referencias documentales actualizadas', source: 'api' })
      return send(res, 200, { request })
    }
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      await serveStatic(url.pathname, res)
      return
    }
    return send(res, 404, { error: 'not found' })
  } catch (error) {
    const statusCode = error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    if (statusCode >= 500) console.error('[Synapse API] Error de solicitud')
    return send(res, statusCode, { error: statusCode >= 500 ? 'Error interno. Intenta de nuevo o revisa los registros del servidor.' : error instanceof Error ? error.message : 'Solicitud inválida.' })
  }
})

validateProductionSecurityConfiguration()
server.listen(port, host, () => console.log(`Dmente Synapse API: http://${host}:${port}`))
process.on('SIGINT', () => { closeDatabase(); server.close(() => process.exit(0)) })
process.on('SIGTERM', () => { closeDatabase(); server.close(() => process.exit(0)) })
