import { addAudit, deleteCommitment, deleteRequest, getCommitment, getRequest, listAgents, listPermissions, updateCommitment, updateRequest } from './db.js'
import type { Commitment, Domain, RequestRecord } from './types.js'

export class AgendaMutationError extends Error {
  constructor(message: string, public statusCode = 400) { super(message) }
}

export function findAgendaRecord(id: string, commitmentOnly = false) {
  if (id.startsWith('commitment:') || commitmentOnly) {
    const record = getCommitment(id.replace(/^commitment:/, ''))
    return record ? { kind: 'commitment' as const, record } : null
  }
  const request = getRequest(id)
  if (request) return { kind: 'request' as const, record: request }
  const commitment = getCommitment(id)
  return commitment ? { kind: 'commitment' as const, record: commitment } : null
}

function stringField(value: unknown, name: string, max: number, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || value.trim().length > max || (!nullable && !value.trim())) throw new AgendaMutationError(`${name} no válido (máximo ${max} caracteres).`)
  return value.trim() || null
}

export function editAgendaRecord(id: string, input: Record<string, unknown>, source: string, allowDomain: (domain: Domain) => boolean, commitmentOnly = false) {
  const found = findAgendaRecord(id, commitmentOnly)
  if (!found) throw new AgendaMutationError('Tarea no encontrada.', 404)
  if (!allowDomain(found.record.domain)) throw new AgendaMutationError('No tienes acceso a ese dominio.', 403)
  const allowed = found.kind === 'commitment' ? ['title', 'domain', 'startsAt', 'dueAt', 'people', 'status'] : ['title', 'domain', 'startsAt', 'dueAt', 'projectId', 'agentId', 'priority', 'riskLevel', 'nextAction', 'requiresApproval', 'status']
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) throw new AgendaMutationError('Campos de edición no válidos.')
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (['title', 'domain', 'projectId', 'agentId', 'nextAction'].includes(key)) patch[key] = stringField(value, key, key === 'title' ? 200 : key === 'nextAction' ? 2000 : 120, key === 'projectId' || key === 'nextAction')
    else if (key === 'startsAt' || key === 'dueAt') {
      if (value === null || value === '') patch[key] = null
      else {
        if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) throw new AgendaMutationError('Revisa las fechas e incluye la zona horaria.')
        patch[key] = new Date(value).toISOString()
      }
    } else if (key === 'people') {
      if (!Array.isArray(value) || value.length > 20 || value.some((person) => typeof person !== 'string' || person.trim().length > 120)) throw new AgendaMutationError('people no válido.')
      patch.people = value.map((person: string) => person.trim()).filter(Boolean)
    } else if (key === 'requiresApproval') {
      if (typeof value !== 'boolean' || (found.kind === 'request' && found.record.requiresApproval && !value)) throw new AgendaMutationError('La edición no puede retirar una aprobación requerida.')
      patch[key] = value
    } else {
      const options = key === 'priority' ? ['low', 'normal', 'high', 'urgent'] : key === 'riskLevel' ? ['low', 'medium', 'high'] : found.kind === 'commitment' ? ['captured', 'planned', 'confirmed', 'pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled'] : ['pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled']
      if (typeof value !== 'string' || !options.includes(value)) throw new AgendaMutationError(`${key} no válido.`)
      patch[key] = value
    }
  }
  const domain = (patch.domain ?? found.record.domain) as Domain
  if (!listPermissions().some((permission) => permission.domain === domain)) throw new AgendaMutationError('Selecciona un dominio válido.')
  if (!allowDomain(domain)) throw new AgendaMutationError('No tienes acceso al dominio de destino.', 403)
  if (patch.agentId && !listAgents().some((agent) => agent.id === patch.agentId)) throw new AgendaMutationError('Selecciona un agente válido.')
  const startsAt = patch.startsAt === undefined ? found.record.startsAt : patch.startsAt as string | null
  const dueAt = patch.dueAt === undefined ? found.record.dueAt : patch.dueAt as string | null
  if (startsAt && dueAt && Date.parse(startsAt) > Date.parse(dueAt)) throw new AgendaMutationError('La fecha de vencimiento debe ser posterior al inicio.')
  if (found.kind === 'request' && (found.record.requiresApproval || patch.requiresApproval) && patch.status === 'done' && !found.record.approvalConfirmed) throw new AgendaMutationError('Confirma la aprobación antes de marcar esta tarea como hecha.', 409)
  const record = found.kind === 'commitment' ? updateCommitment(found.record.id, patch as Partial<Commitment>) : updateRequest(found.record.id, patch as Partial<RequestRecord>)
  if (!record) throw new AgendaMutationError('Tarea no encontrada.', 404)
  addAudit({ action: `agenda_${found.kind}_edited`, summary: `${record.id}: ${record.title}`, source })
  return { kind: found.kind, record }
}

export function removeAgendaRecord(id: string, expectedTitle: unknown, source: string, allowDomain: (domain: Domain) => boolean, commitmentOnly = false) {
  const found = findAgendaRecord(id, commitmentOnly)
  if (!found) throw new AgendaMutationError('Tarea no encontrada.', 404)
  if (!allowDomain(found.record.domain)) throw new AgendaMutationError('No tienes acceso a ese dominio.', 403)
  if (expectedTitle !== found.record.title) throw new AgendaMutationError('El título cambió. Recarga la tarea antes de eliminarla.', 409)
  const deleted = found.kind === 'commitment' ? deleteCommitment(found.record.id) : deleteRequest(found.record.id)
  if (!deleted) throw new AgendaMutationError('Tarea no encontrada.', 404)
  addAudit({ action: `agenda_${found.kind}_deleted`, summary: `${found.record.id}: ${found.record.title}`, source })
  return { deleted: true, id: found.record.id, kind: found.kind, title: found.record.title }
}
