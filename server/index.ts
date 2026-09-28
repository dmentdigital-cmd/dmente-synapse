import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { URL } from 'node:url'
import { authConfigured, authStatus, clearSession, clearSessionCookie, login, sessionFromRequest, setSessionCookie } from './auth.js'
import { addAudit, addMessage, closeDatabase, confirmRequestApproval, createCommitment, createRequest, getLocalProfile, getRequest, listAgents, listCommitments, listMessages, listPermissions, listRequests, updateCommitmentStatus, updateRequestSources, updateRequestStatus } from './db.js'
import { buildReply, routeRequest } from './orchestrator.js'
import { authorized, handleMcp } from './mcp.js'
import { getHermesStatus, isHermesConfigured, requestHermesReply } from './hermes.js'
import type { Domain } from './types.js'

const port = Number(process.env.PORT ?? 3010)
const host = process.env.SYNAPSE_HOST ?? '127.0.0.1'
const distDir = path.resolve(process.cwd(), 'dist')

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://127.0.0.1:5173', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
  res.end(JSON.stringify(payload))
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) as Record<string, unknown> : {}
}

function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value.trim() : fallback }

function requireOwnerSession(req: IncomingMessage, res: ServerResponse): boolean {
  if (!authConfigured()) { send(res, 503, { error: 'Configura la autenticación de Synapse para consultar datos operativos.' }); return false }
  if (!sessionFromRequest(req)) { send(res, 401, { error: 'Inicia sesión para consultar datos operativos.' }); return false }
  return true
}

function agendaItemFromRequest(request: ReturnType<typeof listRequests>[number]) {
  return { id: request.id, kind: 'request' as const, requestId: request.id, commitmentId: null, title: request.title, domain: request.domain, projectId: request.projectId, agentId: request.agentId, status: request.status, priority: request.priority, riskLevel: request.riskLevel, requiresApproval: request.requiresApproval, approvalConfirmed: request.approvalConfirmed, startsAt: request.startsAt, dueAt: request.dueAt, nextAction: request.nextAction, sourcePath: request.sourcePath, sourceDriveFolder: request.sourceDriveFolder, createdAt: request.createdAt, updatedAt: request.updatedAt }
}

function agendaItemFromCommitment(commitment: ReturnType<typeof listCommitments>[number]) {
  const agentsByDomain: Partial<Record<Domain, string>> = { health: 'salud-familiar', family: 'salud-familiar', sales: 'ventas', marketing: 'marketing', learning: 'educacion-aprendizaje', projects: 'pmo', technology: 'tecnico', agency: 'pmo' }
  const status = commitment.status === 'done' ? 'done' : commitment.status === 'cancelled' ? 'cancelled' : commitment.status === 'in_progress' || commitment.status === 'confirmed' ? 'in_progress' : commitment.status === 'waiting_approval' ? 'waiting_approval' : commitment.status === 'blocked' ? 'blocked' : 'pending'
  return { id: `commitment:${commitment.id}`, kind: 'commitment' as const, requestId: null, commitmentId: commitment.id, title: commitment.title, domain: commitment.domain, projectId: null, agentId: agentsByDomain[commitment.domain] ?? 'secretaria', status, priority: 'normal' as const, riskLevel: 'low' as const, requiresApproval: false, approvalConfirmed: false, startsAt: commitment.startsAt, dueAt: commitment.dueAt, nextAction: '', sourcePath: null, sourceDriveFolder: null, createdAt: commitment.createdAt, updatedAt: commitment.updatedAt }
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
      history: listMessages(input.conversationAgentId),
    })
    addMessage({ requestId: input.requestId, agentId: input.conversationAgentId, direction: 'agent', text: reply })
    addAudit({ requestId: input.requestId, action: 'hermes_reply_created', summary: reply.slice(0, 120), source: 'hermes-api-server' })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    console.error(`[Hermes] Solicitud ${input.requestId}: ${detail}`)
    const failure = 'No pude activar LuciaBot en Hermes para esta solicitud. El caso quedó registrado y puede revisarse desde Solicitudes.'
    addMessage({ requestId: input.requestId, agentId: input.conversationAgentId, direction: 'agent', text: failure })
    addAudit({ requestId: input.requestId, action: 'hermes_reply_failed', summary: detail.slice(0, 240), source: 'synapse-api' })
  }
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' } as Record<string, string>)[extension] ?? 'application/octet-stream'
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const decoded = decodeURIComponent(pathname)
  const requested = path.resolve(distDir, `.${decoded === '/' ? '/index.html' : decoded}`)
  if (!requested.startsWith(distDir)) { res.writeHead(403); res.end('Forbidden'); return }
  let filePath = requested
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('not a file')
  } catch {
    filePath = path.join(distDir, 'index.html')
  }
  try {
    const file = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
    res.end(file)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (url.pathname === '/mcp') return handleMcp(req, res)
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const hermes = await getHermesStatus()
      return send(res, 200, { ok: true, service: 'dmente-synapse-api', hermesAutomaticReplies: hermes.configured, hermesReachable: hermes.reachable, hermesLastError: hermes.lastError, time: new Date().toISOString() })
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/session') return send(res, 200, authStatus(req))
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await body(req)
      const token = login(text(input.username), text(input.password))
      if (!token) return send(res, 401, { error: 'Credenciales inválidas o autenticación no configurada' })
      setSessionCookie(res, token)
      return send(res, 200, { authenticated: true, userId: 'diego-local' })
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      clearSession(req)
      clearSessionCookie(res)
      return send(res, 200, { authenticated: false })
    }
    if (req.method === 'GET' && url.pathname === '/api/profile') return send(res, 200, { profile: getLocalProfile(), permissions: listPermissions() })
    if (req.method === 'GET' && url.pathname === '/api/agents') return send(res, 200, { agents: listAgents() })
    if (req.method === 'GET' && url.pathname === '/api/commitments') {
      if (!requireOwnerSession(req, res)) return
      return send(res, 200, { commitments: listCommitments((url.searchParams.get('domain') as Domain | null) ?? undefined) })
    }
    if (req.method === 'GET' && url.pathname === '/api/requests') {
      if (!requireOwnerSession(req, res)) return
      return send(res, 200, { requests: listRequests() })
    }
    if (req.method === 'GET' && url.pathname === '/api/operational-agenda') {
      if (!requireOwnerSession(req, res)) return
      const items = [...listRequests().map(agendaItemFromRequest), ...listCommitments().map(agendaItemFromCommitment)]
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
      if (!requireOwnerSession(req, res)) return
      const input = await body(req)
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
      if (!listAgents().some((agent) => agent.id === agentId)) return send(res, 400, { error: 'Selecciona un agente válido.' })
      if (!listPermissions().some((permission) => permission.domain === domain)) return send(res, 400, { error: 'Selecciona un dominio válido.' })
      if (!['low', 'normal', 'high', 'urgent'].includes(priority)) return send(res, 400, { error: 'Selecciona una prioridad válida.' })
      if (!['low', 'medium', 'high'].includes(riskLevel)) return send(res, 400, { error: 'Selecciona un nivel de riesgo válido.' })
      if ((startsAtValue && (!startsAt || Number.isNaN(startsAt.getTime()))) || (dueAtValue && (!dueAt || Number.isNaN(dueAt.getTime())))) return send(res, 400, { error: 'Revisa las fechas y horas de la tarea.' })
      if (startsAt && dueAt && startsAt.getTime() > dueAt.getTime()) return send(res, 400, { error: 'La fecha de vencimiento debe ser posterior al inicio.' })
      const request = createRequest({ agentId: agentId as Parameters<typeof createRequest>[0]['agentId'], domain, title: title.slice(0, 200), projectId: text(input.projectId).slice(0, 120) || null, priority: priority as 'low' | 'normal' | 'high' | 'urgent', riskLevel: riskLevel as 'low' | 'medium' | 'high', requiresApproval: input.requiresApproval === true, initialStatus: 'pending', startsAt: startsAt?.toISOString() ?? null, dueAt: dueAt?.toISOString() ?? null, nextAction: text(input.nextAction) || 'Definir siguiente acción' })
      addAudit({ requestId: request.id, action: 'agenda_item_created', summary: request.title, source: 'agenda-operativa' })
      return send(res, 201, { item: agendaItemFromRequest(request) })
    }
    if (req.method === 'GET' && url.pathname === '/api/messages') {
      if (!requireOwnerSession(req, res)) return
      const agentId = text(url.searchParams.get('agentId')) as Parameters<typeof listMessages>[0]
      if (!agentId) return send(res, 400, { error: 'agentId es obligatorio' })
      return send(res, 200, { messages: listMessages(agentId) })
    }
    if (req.method === 'POST' && url.pathname === '/api/hermes/reply') {
      if (!authorized(req)) return send(res, 401, { error: 'MCP no autorizado' })
      const input = await body(req)
      const requestId = text(input.requestId)
      const agentId = text(input.agentId) as Parameters<typeof addMessage>[0]['agentId']
      const messageText = text(input.text)
      const source = text(input.source, 'hermes-lucia')
      if (!requestId || !agentId || !messageText) return send(res, 400, { error: 'requestId, agentId y text son obligatorios' })
      if (!getRequest(requestId)) return send(res, 404, { error: 'request not found' })
      if (!listAgents().some((agent) => agent.id === agentId)) return send(res, 400, { error: 'agentId no encontrado' })
      const message = addMessage({ requestId, agentId, direction: 'agent', text: messageText })
      addAudit({ requestId, action: 'hermes_reply_created', summary: messageText.slice(0, 120), source })
      return send(res, 201, { message })
    }
    if (req.method === 'POST' && url.pathname === '/api/commitments') {
      if (!requireOwnerSession(req, res)) return
      const input = await body(req)
      const title = text(input.title)
      if (!title) return send(res, 400, { error: 'title es obligatorio' })
      const commitment = createCommitment({ title, domain: (text(input.domain, 'personal') as Domain), people: Array.isArray(input.people) ? input.people.filter((item): item is string => typeof item === 'string') : [], source: 'manual', startsAt: text(input.startsAt) || null, dueAt: text(input.dueAt) || null })
      addAudit({ action: 'commitment_created', summary: commitment.title, source: 'api' })
      return send(res, 201, { commitment })
    }
    if (req.method === 'POST' && url.pathname === '/api/messages') {
      if (!requireOwnerSession(req, res)) return
      const input = await body(req)
      const message = text(input.text)
      if (!message) return send(res, 400, { error: 'text es obligatorio' })
      const decision = routeRequest(message)
      const requestedAgentId = text(input.agentId) as Parameters<typeof addMessage>[0]['agentId']
      const conversationAgentId = requestedAgentId && listAgents().some((agent) => agent.id === requestedAgentId) ? requestedAgentId : decision.agentId
      const request = createRequest({ agentId: decision.agentId, domain: decision.domain, title: message.slice(0, 120), projectId: decision.projectId, priority: decision.priority, riskLevel: decision.riskLevel, requiresApproval: decision.requiresApproval, nextAction: decision.nextAction })
      addMessage({ requestId: request.id, agentId: conversationAgentId, direction: 'user', text: message })
      if (isHermesConfigured()) {
        void completeWithHermes({ requestId: request.id, conversationAgentId, decision })
        addAudit({ requestId: request.id, action: 'hermes_reply_queued', summary: `${decision.agentId}/${decision.domain}`, source: 'synapse-api' })
        return send(res, 202, { request, decision, conversationAgentId, processing: true })
      }
      const reply = buildReply(decision, message)
      addMessage({ requestId: request.id, agentId: conversationAgentId, direction: 'agent', text: reply })
      addAudit({ requestId: request.id, action: 'request_routed', summary: `${decision.agentId}/${decision.domain}`, source: 'local-decision-provider' })
      return send(res, 201, { request, decision, conversationAgentId, reply })
    }
    const approvalMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/(approve|reject)$/)
    if (req.method === 'POST' && approvalMatch) {
      if (!requireOwnerSession(req, res)) return
      const request = approvalMatch[2] === 'approve'
        ? confirmRequestApproval(approvalMatch[1])
        : updateRequestStatus(approvalMatch[1], 'cancelled')
      if (!request) return send(res, 404, { error: 'request not found' })
      addAudit({ requestId: request.id, action: approvalMatch[2] === 'approve' ? 'approval_confirmed' : 'request_cancelled', summary: request.title, source: 'manual' })
      return send(res, 200, { request })
    }
    const agendaStatusMatch = url.pathname.match(/^\/api\/operational-agenda\/items\/([^/]+)$/)
    if (req.method === 'PATCH' && agendaStatusMatch) {
      if (!requireOwnerSession(req, res)) return
      const input = await body(req)
      const status = text(input.status)
      if (!['pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled'].includes(status)) return send(res, 400, { error: 'Estado no válido' })
      const id = decodeURIComponent(agendaStatusMatch[1])
      if (id.startsWith('commitment:')) {
        const commitmentStatus = status === 'in_progress' ? 'in_progress' : status === 'waiting_approval' ? 'waiting_approval' : status === 'blocked' ? 'blocked' : status
        const commitment = updateCommitmentStatus(id.slice('commitment:'.length), commitmentStatus as 'pending' | 'in_progress' | 'waiting_approval' | 'blocked' | 'done' | 'cancelled')
        if (!commitment) return send(res, 404, { error: 'compromiso no encontrado' })
        addAudit({ action: 'agenda_commitment_status_updated', summary: `${commitment.title}: ${commitment.status}`, source: 'agenda-operativa' })
        return send(res, 200, { item: agendaItemFromCommitment(commitment) })
      }
      if (!getRequest(id)) return send(res, 404, { error: 'tarea no encontrada' })
      const request = updateRequestStatus(id, status as 'pending' | 'in_progress' | 'waiting_approval' | 'blocked' | 'done' | 'cancelled')
      if (!request) return send(res, 409, { error: 'Confirma la aprobación antes de marcar esta tarea como hecha.' })
      addAudit({ requestId: request.id, action: 'agenda_status_updated', summary: `${request.title}: ${request.status}`, source: 'agenda-operativa' })
      return send(res, 200, { item: agendaItemFromRequest(request) })
    }
    const sourcesMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/sources$/)
    if (req.method === 'POST' && sourcesMatch) {
      if (!requireOwnerSession(req, res)) return
      const input = await body(req)
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
    const message = error instanceof Error ? error.message : 'Error interno'
    return send(res, 500, { error: message })
  }
})

server.listen(port, host, () => console.log(`Dmente Synapse API: http://${host}:${port}`))
process.on('SIGINT', () => { closeDatabase(); server.close(() => process.exit(0)) })
process.on('SIGTERM', () => { closeDatabase(); server.close(() => process.exit(0)) })
