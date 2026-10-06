import { addProjectUpdate, createMilestone, createProject, getProjectDetail, listProjects, MILESTONE_STATUSES, PROJECT_STATUSES, projectsDigest, resolveBlocker, UPDATE_KINDS, updateMilestone, updateProject, type ProjectActor } from './projects.js'
import type { Domain } from './types.js'

// Project tools for Lucía. Reading needs no write scope; every write shares the validation of the
// web API. There is deliberately no tool to delete a project: that stays with an admin in the UI.
const isoDate = { type: 'string', description: 'Fecha ISO con zona horaria, por ejemplo 2026-10-15T17:00:00-05:00.' }
const nullableIsoDate = { type: ['string', 'null'], description: 'Fecha ISO con zona horaria; null la quita.' }
const projectChanges = { name: { type: 'string', maxLength: 200 }, code: { type: ['string', 'null'], description: 'Código corto en mayúsculas, el mismo que usa Bitácora (ej. CORPAV).' }, clientId: { type: ['string', 'null'] }, domain: { type: 'string' }, ownerAgentId: { type: 'string' }, status: { type: 'string', enum: PROJECT_STATUSES }, startsAt: nullableIsoDate, dueAt: nullableIsoDate, nextAction: { type: ['string', 'null'], maxLength: 2000 }, sourcePath: { type: ['string', 'null'] }, sourceDriveFolder: { type: ['string', 'null'] }, obsidianNote: { type: ['string', 'null'] } }
const milestoneChanges = { title: { type: 'string', maxLength: 200 }, phase: { type: ['string', 'null'], description: 'Etiqueta para agrupar hitos, por ejemplo Descubrimiento.' }, ownerAgentId: { type: ['string', 'null'] }, ownerName: { type: ['string', 'null'], description: 'Persona responsable cuando no es un agente.' }, startsAt: nullableIsoDate, dueAt: isoDate, status: { type: 'string', enum: MILESTONE_STATUSES }, sortOrder: { type: 'integer', minimum: 0 }, notes: { type: ['string', 'null'], maxLength: 2000 } }

export const projectReadOnlyTools = ['synapse_list_projects', 'synapse_get_project', 'synapse_projects_digest']

export const projectToolDefinitions = [
  { name: 'synapse_list_projects', description: 'Lista los proyectos con estado, semáforo (rojo, amarillo, verde), avance por hitos, próximo hito y tareas abiertas. Los valores los calcula Synapse; no los estimes.', inputSchema: { type: 'object', properties: { status: { type: 'string', enum: PROJECT_STATUSES } } } },
  { name: 'synapse_get_project', description: 'Devuelve la ficha de un proyecto con su cronograma de hitos, tareas y novedades.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
  { name: 'synapse_projects_digest', description: 'Resumen de coordinación: hitos atrasados, hitos de los próximos 7 días, bloqueos abiertos, proyectos sin movimiento y proyectos en rojo o amarillo con sus razones. Consúltalo antes de responder sobre el estado de los proyectos.', inputSchema: { type: 'object', properties: {} } },
  { name: 'synapse_create_project', description: 'Registra un proyecto interno. No ejecuta acciones externas. Si no envías id se deriva del nombre.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Identificador en minúsculas, números y guiones.' }, ...projectChanges }, required: ['name', 'domain'] } },
  { name: 'synapse_update_project', description: 'Edita un proyecto por id cuando Diego lo solicita: estado, fechas, responsable, siguiente acción o referencias. Primero consulta el proyecto.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, changes: { type: 'object', additionalProperties: false, properties: { ...projectChanges, comment: { type: 'string', description: 'Contexto del cambio de estado.' } } } }, required: ['projectId', 'changes'] } },
  { name: 'synapse_create_milestone', description: 'Agrega un hito al cronograma de un proyecto. Con externalId estable, repetir la llamada actualiza el mismo hito en vez de duplicarlo.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, ...milestoneChanges, externalId: { type: 'string' } }, required: ['projectId', 'title', 'dueAt'] } },
  { name: 'synapse_update_milestone', description: 'Edita un hito o cambia su estado. Primero consulta el proyecto para verificar el id del hito.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, milestoneId: { type: 'string' }, changes: { type: 'object', additionalProperties: false, properties: { ...milestoneChanges, comment: { type: 'string', description: 'Contexto del cambio de estado.' } } } }, required: ['projectId', 'milestoneId', 'changes'] } },
  { name: 'synapse_add_project_update', description: 'Registra una novedad del proyecto: avance, bloqueo, riesgo, decisión o lección. Un bloqueo queda abierto hasta resolverlo. Las novedades no se editan ni se borran.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, kind: { type: 'string', enum: UPDATE_KINDS }, text: { type: 'string', maxLength: 2000 }, externalId: { type: 'string', description: 'ID estable de la fuente para no duplicar al reintentar.' } }, required: ['projectId', 'kind', 'text'] } },
  { name: 'synapse_resolve_blocker', description: 'Marca como resuelto un bloqueo abierto de un proyecto.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, updateId: { type: 'string' }, resolution: { type: 'string', maxLength: 2000 } }, required: ['projectId', 'updateId'] } },
]

const names = new Set(projectToolDefinitions.map((tool) => tool.name))
export const isProjectTool = (name: string): boolean => names.has(name)

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} es obligatorio`)
  return value.trim()
}

function objectArg(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} debe ser un objeto`)
  return value as Record<string, unknown>
}

export function callProjectTool(name: string, args: Record<string, unknown>, access: { scope: 'read' | 'write'; domains: Domain[] }): unknown {
  if (!projectReadOnlyTools.includes(name) && access.scope !== 'write') throw new Error('El token MCP no tiene permiso de escritura interna')
  const actor: ProjectActor = { source: 'hermes-mcp', allowDomain: (domain) => access.domains.includes(domain) }
  if (name === 'synapse_list_projects') return { projects: listProjects(actor, { status: typeof args.status === 'string' ? args.status : null }) }
  if (name === 'synapse_get_project') return getProjectDetail(required(args.projectId, 'projectId'), actor)
  if (name === 'synapse_projects_digest') return projectsDigest(actor)
  if (name === 'synapse_create_project') return { project: createProject(args, actor) }
  if (name === 'synapse_update_project') return { project: updateProject(required(args.projectId, 'projectId'), objectArg(args.changes, 'changes'), actor) }
  if (name === 'synapse_create_milestone') {
    const { projectId, ...fields } = args
    return { milestone: createMilestone(required(projectId, 'projectId'), fields, actor) }
  }
  if (name === 'synapse_update_milestone') return { milestone: updateMilestone(required(args.projectId, 'projectId'), required(args.milestoneId, 'milestoneId'), objectArg(args.changes, 'changes'), actor) }
  if (name === 'synapse_add_project_update') {
    const { projectId, ...fields } = args
    return { update: addProjectUpdate(required(projectId, 'projectId'), fields, actor) }
  }
  if (name === 'synapse_resolve_blocker') return { update: resolveBlocker(required(args.projectId, 'projectId'), required(args.updateId, 'updateId'), args.resolution === undefined ? {} : { resolution: args.resolution }, actor) }
  throw new Error(`Herramienta no encontrada: ${name}`)
}
