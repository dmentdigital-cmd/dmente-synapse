import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { addAudit, addMessage, createCommitment, createRequest, getLocalProfile, getRequest, listAgents, listCommitments, listMessages, listPermissions, listRequests, updateRequestSources } from './db.js'
import { readJsonBody } from './security.js'
import type { AgentId, Domain } from './types.js'
import { editAgendaRecord, removeAgendaRecord } from './agenda-mutations.js'
import { callProjectTool, isProjectTool, projectReadOnlyTools, projectToolDefinitions } from './project-mcp.js'

const legacyMcpToken = process.env.SYNAPSE_MCP_TOKEN
const mcpReadToken = process.env.SYNAPSE_MCP_READ_TOKEN
const mcpWriteToken = process.env.SYNAPSE_MCP_WRITE_TOKEN
type McpScope = 'read' | 'write' | null
type McpAccess = { scope: Exclude<McpScope, null>; domains: Domain[] }
const readOnlyTools = new Set(['synapse_get_profile', 'synapse_list_agents', 'synapse_list_requests', 'synapse_list_messages', 'synapse_list_commitments', ...projectReadOnlyTools])
const knownDomains: Domain[] = ['agency', 'personal', 'family', 'health', 'education', 'church', 'learning', 'wellbeing', 'projects', 'technology', 'finance', 'knowledge', 'product', 'messaging', 'sales', 'marketing', 'legal']

function configuredDomains(variable: string): Domain[] {
  const configured = (process.env[variable] ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (!configured.length && process.env.NODE_ENV !== 'production') return knownDomains
  return [...new Set(configured.filter((value): value is Domain => knownDomains.includes(value as Domain)))]
}
const readDomains = configuredDomains('SYNAPSE_MCP_READ_DOMAINS')
const writeDomains = configuredDomains('SYNAPSE_MCP_WRITE_DOMAINS')

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const toolDefinitions = [
  ...['commitment', 'task'].flatMap((kind) => [
    { name: `synapse_update_${kind}`, description: 'Edita una tarea interna por ID cuando Diego lo solicita. Primero consulta la tarea. No ejecuta acciones externas ni retira aprobaciones. task acepta solicitudes y compromisos; commitment solo compromisos.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, changes: { type: 'object', additionalProperties: false, properties: { title: { type: 'string', maxLength: 200 }, domain: { type: 'string' }, startsAt: { type: ['string', 'null'], description: 'Fecha ISO con zona horaria; null quita la fecha.' }, dueAt: { type: ['string', 'null'] }, status: { type: 'string' }, ...(kind === 'commitment' ? { people: { type: 'array', items: { type: 'string' } }, projectId: { type: ['string', 'null'] } } : { projectId: { type: ['string', 'null'] }, agentId: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }, riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] }, nextAction: { type: 'string' }, requiresApproval: { type: 'boolean' } }) } } }, required: ['id', 'changes'] } },
    { name: `synapse_delete_${kind}`, description: 'Elimina una tarea interna de la agenda únicamente por petición explícita de Diego. Primero lista las tareas para verificar ID y título exactos. No crea una solicitud para borrar después: ejecuta el borrado y devuelve el resultado. No necesita aprobación externa. Conserva el historial interno.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, expectedTitle: { type: 'string', description: 'Título exacto leído al consultar la tarea.' } }, required: ['id', 'expectedTitle'] } },
  ]),
  { name: 'synapse_get_profile', description: 'Obtiene el perfil local y los permisos de Diego.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_agents', description: 'Lista los agentes disponibles en Dmente Synapse.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_requests', description: 'Lista las solicitudes registradas y su estado.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_messages', description: 'Lista mensajes de un agente.', inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
  { name: 'synapse_reply_to_request', description: 'Permite a LuciaBot/Hermes responder dentro de una solicitud existente de Dmente Synapse. Guarda la respuesta como mensaje interno y no ejecuta acciones externas.', inputSchema: { type: 'object', properties: { requestId: { type: 'string', description: 'ID de la solicitud existente en Synapse.' }, agentId: { type: 'string', description: 'ID del agente que responde.' }, text: { type: 'string', description: 'Respuesta interna para mostrar en el chat visual.' } }, required: ['requestId', 'agentId', 'text'] } },
  { name: 'synapse_create_request', description: 'Registra una solicitud interna con agente, dominio, proyecto, prioridad, siguiente acción y referencias documentales. No ejecuta acciones externas.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, agentId: { type: 'string' }, domain: { type: 'string' }, projectId: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }, riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] }, requiresApproval: { type: 'boolean' }, nextAction: { type: 'string' }, obsidianNote: { type: 'string' }, sourcePath: { type: 'string' }, sourceDriveFolder: { type: 'string' } }, required: ['title', 'agentId', 'domain'] } },
  { name: 'synapse_update_request_sources', description: 'Agrega o actualiza en una solicitud las referencias a Obsidian, estado canónico local o carpeta de Drive.', inputSchema: { type: 'object', properties: { requestId: { type: 'string' }, obsidianNote: { type: 'string' }, sourcePath: { type: 'string' }, sourceDriveFolder: { type: 'string' } }, required: ['requestId'] } },
  { name: 'synapse_add_message', description: 'Agrega un mensaje de Hermes o LuciaBot a la conversación.', inputSchema: { type: 'object', properties: { agentId: { type: 'string' }, text: { type: 'string' }, requestId: { type: 'string' } }, required: ['agentId', 'text'] } },
  { name: 'synapse_list_commitments', description: 'Lista compromisos personales, familiares y de agencia.', inputSchema: { type: 'object', properties: { domain: { type: 'string' } } } },
  { name: 'synapse_create_commitment', description: 'Registra o sincroniza de forma idempotente un compromiso (por ejemplo, desde un cronjob). No envía mensajes ni crea eventos externos.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, domain: { type: 'string' }, people: { type: 'array', items: { type: 'string' } }, startsAt: { type: 'string' }, dueAt: { type: 'string' }, externalId: { type: 'string', description: 'ID estable del evento externo para actualizarlo sin duplicarlo al reintentar.' }, projectId: { type: 'string', description: 'Proyecto al que pertenece el compromiso (opcional).' } }, required: ['title', 'domain'] } },
  ...projectToolDefinitions,
]

function digest(value: string): Buffer { return createHash('sha256').update(value).digest() }
export function authorized(req: IncomingMessage): boolean {
  return authorizedScope(req) !== null
}

export function authorizedWrite(req: IncomingMessage): boolean {
  return authorizedScope(req)?.scope === 'write'
}

export function authorizedWriteForDomain(req: IncomingMessage, domain: Domain): boolean {
  const access = authorizedScope(req)
  return Boolean(access && access.scope === 'write' && access.domains.includes(domain))
}

function authorizedScope(req: IncomingMessage): McpAccess | null {
  const received = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
  if (!received) return null
  const receivedDigest = digest(received)
  const matches = (token: string | undefined): boolean => Boolean(token && timingSafeEqual(receivedDigest, digest(token)))
  if (matches(mcpWriteToken)) return { scope: 'write', domains: writeDomains }
  if (matches(mcpReadToken)) return { scope: 'read', domains: readDomains }
  if (matches(legacyMcpToken)) return mcpWriteToken ? { scope: 'read', domains: readDomains } : { scope: 'write', domains: writeDomains }
  return null
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function jsonRpc(id: JsonRpcRequest['id'], result: unknown): Record<string, unknown> { return { jsonrpc: '2.0', id: id ?? null, result } }
function errorRpc(id: JsonRpcRequest['id'], code: number, message: string): Record<string, unknown> { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } } }
function toolResult(value: unknown): Record<string, unknown> { return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value } }
function requireDomainAccess(access: McpAccess, domain: Domain): void {
  if (!access.domains.includes(domain)) throw new Error('El token MCP no tiene acceso a ese dominio')
}

async function callTool(name: string, args: Record<string, unknown>, access: McpAccess): Promise<unknown> {
  if (isProjectTool(name)) return callProjectTool(name, args, access)
  if (['synapse_update_commitment', 'synapse_update_task', 'synapse_delete_commitment', 'synapse_delete_task'].includes(name)) {
    if (access.scope !== 'write') throw new Error('El token MCP no tiene permiso de escritura interna')
    const id = text(args.id)
    if (!id) throw new Error('id es obligatorio')
    const commitmentOnly = name.endsWith('_commitment')
    const allowDomain = (domain: Domain) => access.domains.includes(domain)
    if (name.startsWith('synapse_delete_')) return removeAgendaRecord(id, args.expectedTitle, 'hermes-mcp', allowDomain, commitmentOnly)
    if (!args.changes || typeof args.changes !== 'object' || Array.isArray(args.changes)) throw new Error('changes debe ser un objeto')
    const result = editAgendaRecord(id, args.changes as Record<string, unknown>, 'hermes-mcp', allowDomain, commitmentOnly)
    return result.kind === 'commitment' ? { commitment: result.record } : { request: result.record }
  }
  if (name === 'synapse_get_profile') return { profile: getLocalProfile(), domains: access.domains }
  if (name === 'synapse_list_agents') return { agents: listAgents().filter((agent) => access.domains.includes(agent.domain)) }
  if (name === 'synapse_list_requests') return { requests: listRequests().filter((request) => access.domains.includes(request.domain)) }
  if (name === 'synapse_list_messages') {
    const agentId = text(args.agentId) as AgentId
    if (!agentId) throw new Error('agentId es obligatorio')
    const agent = listAgents().find((item) => item.id === agentId)
    if (!agent) throw new Error('agentId no encontrado')
    requireDomainAccess(access, agent.domain)
    return { messages: listMessages(agentId, access.domains) }
  }
  if (name === 'synapse_reply_to_request') {
    const requestId = text(args.requestId)
    const agentId = text(args.agentId) as AgentId
    const message = text(args.text)
    if (!requestId || !agentId || !message) throw new Error('requestId, agentId y text son obligatorios')
    if (message.length > 10_000) throw new Error('La respuesta excede el máximo de 10000 caracteres')
    const request = getRequest(requestId)
    if (!request) throw new Error('request no encontrado')
    requireDomainAccess(access, request.domain)
    const agent = listAgents().find((item) => item.id === agentId)
    if (!agent) throw new Error('agentId no encontrado')
    requireDomainAccess(access, agent.domain)
    const saved = addMessage({ requestId, agentId, domain: request.domain, direction: 'agent', text: message })
    addAudit({ requestId, action: 'hermes_reply_created', summary: message.slice(0, 120), source: 'hermes-lucia' })
    return { message: saved }
  }
  if (name === 'synapse_create_request') {
    const title = text(args.title)
    const agentId = text(args.agentId) as AgentId
    const domain = text(args.domain) as Domain
    if (!title || !agentId || !domain) throw new Error('title, agentId y domain son obligatorios')
    requireDomainAccess(access, domain)
    if (title.length > 200) throw new Error('title excede el máximo de 200 caracteres')
    const assignedAgent = listAgents().find((agent) => agent.id === agentId)
    if (!assignedAgent || assignedAgent.domain !== domain) throw new Error('agentId no corresponde al dominio solicitado')
    if (!listPermissions().some((permission) => permission.domain === domain)) throw new Error('domain no encontrado')
    const priority = text(args.priority) as 'low' | 'normal' | 'high' | 'urgent'
    const riskLevel = text(args.riskLevel) as 'low' | 'medium' | 'high'
    if (priority && !['low', 'normal', 'high', 'urgent'].includes(priority)) throw new Error('priority no válido')
    if (riskLevel && !['low', 'medium', 'high'].includes(riskLevel)) throw new Error('riskLevel no válido')
    const request = createRequest({ agentId, domain, title, projectId: text(args.projectId).slice(0, 120) || null, priority: priority || 'normal', riskLevel: riskLevel || 'medium', requiresApproval: true, nextAction: text(args.nextAction).slice(0, 500) || 'Revisar solicitud', obsidianNote: text(args.obsidianNote).slice(0, 500) || null, sourcePath: text(args.sourcePath).slice(0, 1000) || null, sourceDriveFolder: text(args.sourceDriveFolder).slice(0, 1000) || null })
    addAudit({ requestId: request.id, action: 'mcp_request_created', summary: request.title, source: 'hermes-mcp' })
    return { request, requiresApproval: true }
  }
  if (name === 'synapse_update_request_sources') {
    const requestId = text(args.requestId)
    if (!requestId) throw new Error('requestId es obligatorio')
    const existing = getRequest(requestId)
    if (!existing) throw new Error('request no encontrado')
    requireDomainAccess(access, existing.domain)
    const request = updateRequestSources(requestId, { obsidianNote: text(args.obsidianNote) || undefined, sourcePath: text(args.sourcePath) || undefined, sourceDriveFolder: text(args.sourceDriveFolder) || undefined })
    if (!request) throw new Error('request no encontrado')
    addAudit({ requestId, action: 'request_sources_updated', summary: 'Referencias documentales actualizadas', source: 'hermes-mcp' })
    return { request }
  }
  if (name === 'synapse_add_message') {
    const agentId = text(args.agentId) as AgentId
    const message = text(args.text)
    if (!agentId || !message) throw new Error('agentId y text son obligatorios')
    const agent = listAgents().find((item) => item.id === agentId)
    if (!agent) throw new Error('agentId no encontrado')
    requireDomainAccess(access, agent.domain)
    if (message.length > 10_000) throw new Error('El mensaje excede el máximo de 10000 caracteres')
    const requestId = text(args.requestId)
    if (requestId) {
      const request = getRequest(requestId)
      if (!request) throw new Error('request no encontrado')
      requireDomainAccess(access, request.domain)
    }
    const request = requestId ? getRequest(requestId) : null
    addMessage({ agentId, requestId: requestId || undefined, domain: request?.domain ?? agent.domain, direction: 'agent', text: message })
    addAudit({ action: 'mcp_message_added', summary: `${agentId}: ${message.slice(0, 120)}`, source: 'hermes-mcp' })
    return { saved: true, agentId }
  }
  if (name === 'synapse_list_commitments') {
    const requestedDomain = text(args.domain) as Domain | ''
    if (requestedDomain) requireDomainAccess(access, requestedDomain)
    return { commitments: listCommitments(requestedDomain || undefined).filter((item) => access.domains.includes(item.domain)) }
  }
  if (name === 'synapse_create_commitment') {
    const title = text(args.title)
    const domain = text(args.domain) as Domain
    if (!title || !domain) throw new Error('title y domain son obligatorios')
    requireDomainAccess(access, domain)
    if (title.length > 200) throw new Error('title excede el máximo de 200 caracteres')
    if (!listPermissions().some((permission) => permission.domain === domain)) throw new Error('domain no encontrado')
    const startsAtValue = text(args.startsAt)
    const dueAtValue = text(args.dueAt)
    const startsAt = startsAtValue ? new Date(startsAtValue) : null
    const dueAt = dueAtValue ? new Date(dueAtValue) : null
    if ((startsAtValue && (!startsAt || Number.isNaN(startsAt.getTime()))) || (dueAtValue && (!dueAt || Number.isNaN(dueAt.getTime())))) throw new Error('Fechas del compromiso no válidas')
    if (startsAt && dueAt && startsAt.getTime() > dueAt.getTime()) throw new Error('La fecha de vencimiento debe ser posterior al inicio')
    const people = Array.isArray(args.people) ? args.people.filter((item): item is string => typeof item === 'string').slice(0, 20).map((person) => person.trim().slice(0, 120)).filter(Boolean) : []
    const externalId = text(args.externalId)
    if (externalId.length > 200) throw new Error('externalId excede el máximo de 200 caracteres')
    const commitment = createCommitment({ title, domain, people, source: externalId ? 'cronjob' : 'manual', startsAt: startsAt?.toISOString() ?? null, dueAt: dueAt?.toISOString() ?? null, externalId: externalId || null, projectId: text(args.projectId).slice(0, 120) || null })
    addAudit({ action: externalId ? 'mcp_commitment_synced' : 'mcp_commitment_created', summary: commitment.title, source: 'hermes-mcp' })
    return { commitment }
  }
  throw new Error(`Herramienta no encontrada: ${name}`)
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Vary', 'Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const access = authorizedScope(req)
  if (!access) { res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'MCP no autorizado' })); return }
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Dmente Synapse MCP'); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
  try {
    const message = await readJsonBody(req) as JsonRpcRequest
    if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') { res.writeHead(202); res.end(); return }
    if (message.method === 'initialize') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'MCP-Protocol-Version': '2025-06-18' })
      res.end(JSON.stringify(jsonRpc(message.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'dmente-synapse', version: '0.1.0' } })))
      return
    }
    if (message.method === 'ping') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(jsonRpc(message.id, {}))); return }
    if (message.method === 'tools/list') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(jsonRpc(message.id, { tools: toolDefinitions }))); return }
    if (message.method === 'tools/call') {
      const name = text(message.params?.name)
      if (access.scope === 'read' && !readOnlyTools.has(name)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(errorRpc(message.id, -32003, 'El token MCP no tiene permiso de escritura interna')))
        return
      }
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>
      const result = await callTool(name, args, access)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(jsonRpc(message.id, toolResult(result)))); return
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(errorRpc(message.id, -32601, 'Método MCP no soportado')))
  } catch (error) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(errorRpc(null, -32603, error instanceof Error ? error.message : 'Error MCP')))
  }
}
