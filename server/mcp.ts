import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { addAudit, addMessage, createCommitment, createRequest, getLocalProfile, getRequest, listAgents, listCommitments, listMessages, listRequests } from './db.js'
import type { AgentId, Domain } from './types.js'

const mcpToken = process.env.SYNAPSE_MCP_TOKEN

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const toolDefinitions = [
  { name: 'synapse_get_profile', description: 'Obtiene el perfil local y los permisos de Diego.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_agents', description: 'Lista los agentes disponibles en Dmente Synapse.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_requests', description: 'Lista las solicitudes registradas y su estado.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_list_messages', description: 'Lista mensajes de un agente.', inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
  { name: 'synapse_reply_to_request', description: 'Permite a LuciaBot/Hermes responder dentro de una solicitud existente de Dmente Synapse. Guarda la respuesta como mensaje interno y no ejecuta acciones externas.', inputSchema: { type: 'object', properties: { requestId: { type: 'string', description: 'ID de la solicitud existente en Synapse.' }, agentId: { type: 'string', description: 'ID del agente que responde.' }, text: { type: 'string', description: 'Respuesta interna para mostrar en el chat visual.' } }, required: ['requestId', 'agentId', 'text'] } },
  { name: 'synapse_create_request', description: 'Registra una solicitud para seguimiento humano. Las acciones externas no se ejecutan automáticamente.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, agentId: { type: 'string' }, domain: { type: 'string' } }, required: ['title', 'agentId', 'domain'] } },
  { name: 'synapse_add_message', description: 'Agrega un mensaje de Hermes o LuciaBot a la conversación.', inputSchema: { type: 'object', properties: { agentId: { type: 'string' }, text: { type: 'string' }, requestId: { type: 'string' } }, required: ['agentId', 'text'] } },
  { name: 'synapse_list_commitments', description: 'Lista compromisos personales, familiares y de agencia.', inputSchema: { type: 'object', properties: { domain: { type: 'string' } } } },
  { name: 'synapse_create_commitment', description: 'Registra un compromiso. No envía mensajes ni crea eventos externos.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, domain: { type: 'string' }, people: { type: 'array', items: { type: 'string' } }, startsAt: { type: 'string' }, dueAt: { type: 'string' } }, required: ['title', 'domain'] } },
]

function digest(value: string): Buffer { return createHash('sha256').update(value).digest() }
export function authorized(req: IncomingMessage): boolean {
  if (!mcpToken) return false
  const received = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
  return received.length > 0 && timingSafeEqual(digest(received), digest(mcpToken))
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function jsonRpc(id: JsonRpcRequest['id'], result: unknown): Record<string, unknown> { return { jsonrpc: '2.0', id: id ?? null, result } }
function errorRpc(id: JsonRpcRequest['id'], code: number, message: string): Record<string, unknown> { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } } }
function toolResult(value: unknown): Record<string, unknown> { return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value } }

async function readJson(req: IncomingMessage): Promise<JsonRpcRequest> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) as JsonRpcRequest : {}
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'synapse_get_profile') return { profile: getLocalProfile() }
  if (name === 'synapse_list_agents') return { agents: listAgents() }
  if (name === 'synapse_list_requests') return { requests: listRequests() }
  if (name === 'synapse_list_messages') {
    const agentId = text(args.agentId) as AgentId
    if (!agentId) throw new Error('agentId es obligatorio')
    return { messages: listMessages(agentId) }
  }
  if (name === 'synapse_reply_to_request') {
    const requestId = text(args.requestId)
    const agentId = text(args.agentId) as AgentId
    const message = text(args.text)
    if (!requestId || !agentId || !message) throw new Error('requestId, agentId y text son obligatorios')
    const request = getRequest(requestId)
    if (!request) throw new Error('request no encontrado')
    if (!listAgents().some((agent) => agent.id === agentId)) throw new Error('agentId no encontrado')
    const saved = addMessage({ requestId, agentId, direction: 'agent', text: message })
    addAudit({ requestId, action: 'hermes_reply_created', summary: message.slice(0, 120), source: 'hermes-lucia' })
    return { message: saved }
  }
  if (name === 'synapse_create_request') {
    const title = text(args.title)
    const agentId = text(args.agentId) as AgentId
    const domain = text(args.domain) as Domain
    if (!title || !agentId || !domain) throw new Error('title, agentId y domain son obligatorios')
    const request = createRequest({ agentId, domain, title, riskLevel: 'medium', requiresApproval: true })
    addAudit({ requestId: request.id, action: 'mcp_request_created', summary: request.title, source: 'hermes-mcp' })
    return { request, requiresApproval: true }
  }
  if (name === 'synapse_add_message') {
    const agentId = text(args.agentId) as AgentId
    const message = text(args.text)
    if (!agentId || !message) throw new Error('agentId y text son obligatorios')
    addMessage({ agentId, requestId: text(args.requestId) || undefined, direction: 'agent', text: message })
    addAudit({ action: 'mcp_message_added', summary: `${agentId}: ${message.slice(0, 120)}`, source: 'hermes-mcp' })
    return { saved: true, agentId }
  }
  if (name === 'synapse_list_commitments') return { commitments: listCommitments(text(args.domain) as Domain || undefined) }
  if (name === 'synapse_create_commitment') {
    const title = text(args.title)
    const domain = text(args.domain) as Domain
    if (!title || !domain) throw new Error('title y domain son obligatorios')
    const commitment = createCommitment({ title, domain, people: Array.isArray(args.people) ? args.people.filter((item): item is string => typeof item === 'string') : [], source: 'manual', startsAt: text(args.startsAt) || null, dueAt: text(args.dueAt) || null })
    addAudit({ action: 'mcp_commitment_created', summary: commitment.title, source: 'hermes-mcp' })
    return { commitment }
  }
  throw new Error(`Herramienta no encontrada: ${name}`)
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (!authorized(req)) { res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'MCP no autorizado' })); return }
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Dmente Synapse MCP'); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
  try {
    const message = await readJson(req)
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
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>
      const result = await callTool(name, args)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(jsonRpc(message.id, toolResult(result)))); return
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(errorRpc(message.id, -32601, 'Método MCP no soportado')))
  } catch (error) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(errorRpc(null, -32603, error instanceof Error ? error.message : 'Error MCP')))
  }
}
