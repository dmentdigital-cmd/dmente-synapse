import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJsonBody } from './security.js'
import { AccountHealthError, addAccountHealthSource, createAccountHealthReview, getAccountHealth, listAccountHealth, type AccountHealthActor } from './account-health.js'
import type { Domain, UserRole } from './types.js'

type Session = { userId: string; role: UserRole; domains: Domain[] }
export type AccountHealthRouteContext = { send: (res: ServerResponse, status: number, payload: unknown) => void; requireSession: (req: IncomingMessage, res: ServerResponse, allowedRoles?: UserRole[]) => Session | null; inDomain: (session: Session, domain: Domain) => boolean }
const writers: UserRole[] = ['operator', 'approver', 'admin']
export async function handleAccountHealthRoutes(req: IncomingMessage, res: ServerResponse, url: URL, context: AccountHealthRouteContext): Promise<boolean> {
  if (!url.pathname.startsWith('/api/account-health')) return false
  const session = context.requireSession(req, res); if (!session) return true
  const actor: AccountHealthActor = { actorId: session.userId, allowDomain: (domain) => context.inDomain(session, domain) }
  try {
    const segments = url.pathname.split('/').filter(Boolean).slice(2).map(decodeURIComponent)
    const [accountId, child] = segments
    if (!accountId && req.method === 'GET') return context.send(res, 200, { accounts: listAccountHealth(actor) }) as never
    if (!accountId) return false
    if (segments.length === 1 && req.method === 'GET') return context.send(res, 200, getAccountHealth(accountId, actor)) as never
    if (child === 'sources' && req.method === 'POST') { if (!writers.includes(session.role)) return context.send(res, 403, { error: 'No tienes permisos para registrar fuentes.' }) as never; return context.send(res, 201, { source: addAccountHealthSource(accountId, await readJsonBody(req), actor) }) as never }
    if (child === 'reviews' && req.method === 'POST') { if (!writers.includes(session.role)) return context.send(res, 403, { error: 'No tienes permisos para crear revisiones.' }) as never; return context.send(res, 201, { review: createAccountHealthReview(accountId, await readJsonBody(req), actor) }) as never }
    return false
  } catch (cause) { if (cause instanceof AccountHealthError) { context.send(res, cause.statusCode, { error: cause.message }); return true } throw cause }
}
