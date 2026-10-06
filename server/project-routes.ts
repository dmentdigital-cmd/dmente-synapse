import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from './security.js'
import { addProjectUpdate, createClient, createMilestone, createProject, deleteMilestone, deleteProject, getProjectDetail, listClients, listProjects, projectsDigest, resolveBlocker, updateClient, updateMilestone, updateProject, type ProjectActor } from './projects.js'
import type { Domain, UserRole } from './types.js'

type Session = { userId: string; role: UserRole; domains: Domain[] }
export type ProjectRouteContext = {
  send: (res: ServerResponse, status: number, payload: unknown) => void
  requireSession: (req: IncomingMessage, res: ServerResponse, allowedRoles?: UserRole[]) => Session | null
  inDomain: (session: Session, domain: Domain) => boolean
}

const WRITERS: UserRole[] = ['operator', 'approver', 'admin']

/** Handles /api/projects, /api/clients and /api/project-digest. Returns false when the path is not one of them. */
export async function handleProjectRoutes(req: IncomingMessage, res: ServerResponse, url: URL, context: ProjectRouteContext): Promise<boolean> {
  const { send, requireSession, inDomain } = context
  const method = req.method ?? 'GET'
  let segments: string[]
  try { segments = url.pathname.split('/').filter(Boolean).slice(1).map((segment) => decodeURIComponent(segment)) }
  catch { return false }
  const [root, id, child, childId, action] = segments
  if (root !== 'projects' && root !== 'clients' && root !== 'project-digest') return false
  const begin = (roles?: UserRole[]): ProjectActor | null => {
    const session = requireSession(req, res, roles)
    return session ? { source: 'manual', actorId: session.userId, allowDomain: (domain) => inDomain(session, domain) } : null
  }

  if (root === 'project-digest' && segments.length === 1 && method === 'GET') {
    const actor = begin(); if (!actor) return true
    send(res, 200, projectsDigest(actor)); return true
  }
  if (root === 'clients') {
    if (segments.length === 1 && method === 'GET') { const actor = begin(); if (!actor) return true; send(res, 200, { clients: listClients(actor) }); return true }
    if (segments.length === 1 && method === 'POST') { const actor = begin(WRITERS); if (!actor) return true; send(res, 201, { client: createClient(await readJsonBody(req), actor) }); return true }
    if (segments.length === 2 && method === 'PATCH') { const actor = begin(WRITERS); if (!actor) return true; send(res, 200, { client: updateClient(id, await readJsonBody(req), actor) }); return true }
    return false
  }
  if (segments.length === 1) {
    if (method === 'GET') { const actor = begin(); if (!actor) return true; send(res, 200, { projects: listProjects(actor, { status: url.searchParams.get('status'), clientId: url.searchParams.get('clientId') }) }); return true }
    if (method === 'POST') { const actor = begin(WRITERS); if (!actor) return true; send(res, 201, { project: createProject(await readJsonBody(req), actor) }); return true }
    return false
  }
  if (segments.length === 2) {
    if (method === 'GET') { const actor = begin(); if (!actor) return true; send(res, 200, getProjectDetail(id, actor)); return true }
    if (method === 'PATCH') { const actor = begin(WRITERS); if (!actor) return true; send(res, 200, { project: updateProject(id, await readJsonBody(req), actor) }); return true }
    if (method === 'DELETE') { const actor = begin(['admin']); if (!actor) return true; send(res, 200, deleteProject(id, (await readJsonBody(req)).expectedName, actor)); return true }
    return false
  }
  if (child === 'milestones') {
    if (segments.length === 3 && method === 'POST') { const actor = begin(WRITERS); if (!actor) return true; send(res, 201, { milestone: createMilestone(id, await readJsonBody(req), actor) }); return true }
    if (segments.length === 4 && method === 'PATCH') { const actor = begin(WRITERS); if (!actor) return true; send(res, 200, { milestone: updateMilestone(id, childId, await readJsonBody(req), actor) }); return true }
    if (segments.length === 4 && method === 'DELETE') { const actor = begin(['admin']); if (!actor) return true; send(res, 200, deleteMilestone(id, childId, (await readJsonBody(req)).expectedTitle, actor)); return true }
    return false
  }
  if (child === 'updates') {
    if (segments.length === 3 && method === 'POST') { const actor = begin(WRITERS); if (!actor) return true; send(res, 201, { update: addProjectUpdate(id, await readJsonBody(req), actor) }); return true }
    if (segments.length === 5 && action === 'resolve' && method === 'POST') { const actor = begin(WRITERS); if (!actor) return true; send(res, 200, { update: resolveBlocker(id, childId, await readJsonBody(req), actor) }); return true }
  }
  return false
}
