import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'

const requestWindows = new Map<string, { count: number; resetAt: number }>()
const requestLimit = 100
const requestWindowMs = 60_000
const leadRequestWindows = new Map<string, { count: number; resetAt: number }>()
const leadRequestLimit = 20

export function allowLeadRequest(req: IncomingMessage, now = Date.now()): boolean {
  const address = clientAddress(req)
  const current = leadRequestWindows.get(address)
  if (!current || current.resetAt <= now) {
    leadRequestWindows.set(address, { count: 1, resetAt: now + requestWindowMs })
    if (leadRequestWindows.size > 10_000) {
      for (const [key, window] of leadRequestWindows) if (window.resetAt <= now) leadRequestWindows.delete(key)
    }
    return true
  }
  current.count += 1
  return current.count <= leadRequestLimit
}

export function authorizedLeadIngest(req: IncomingMessage): boolean {
  const configured = process.env.SYNAPSE_LEADS_INGEST_TOKEN
  const header = req.headers.authorization
  if (!configured || configured.length < 32 || !header?.startsWith('Bearer ')) return false
  const received = header.slice('Bearer '.length)
  if (!received) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(received), digest(configured))
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self'; connect-src 'self'")
  if (process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000')
  }
}

export function clientAddress(req: IncomingMessage): string {
  const remoteAddress = req.socket.remoteAddress ?? 'unknown'
  const trustedProxyHops = Number(process.env.SYNAPSE_TRUSTED_PROXY_HOPS ?? 0)
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) return remoteAddress
  const forwardedHeader = req.headers['x-forwarded-for']
  const forwarded = (Array.isArray(forwardedHeader) ? forwardedHeader.join(',') : forwardedHeader ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
  if (forwarded.length < trustedProxyHops) return remoteAddress
  return forwarded[forwarded.length - trustedProxyHops] ?? remoteAddress
}

export function allowApiRequest(req: IncomingMessage, now = Date.now()): boolean {
  const address = clientAddress(req)
  const key = address
  const current = requestWindows.get(key)
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + requestWindowMs })
    if (requestWindows.size > 10_000) {
      for (const [entry, window] of requestWindows) if (window.resetAt <= now) requestWindows.delete(entry)
    }
    return true
  }
  current.count += 1
  return current.count <= requestLimit
}

export function sameOriginMutation(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  const secFetchSite = req.headers['sec-fetch-site']
  if (typeof origin === 'string') {
    try {
      const parsed = new URL(origin)
      const production = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
      const allowed = new Set([`https://${req.headers.host}`])
      if (!production) allowed.add(`http://${req.headers.host}`)
      for (const configured of (process.env.SYNAPSE_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
        try {
          const configuredOrigin = new URL(configured)
          if (!production || configuredOrigin.protocol === 'https:') allowed.add(configuredOrigin.origin)
        } catch { /* Invalid configured origins are ignored. */ }
      }
      return allowed.has(parsed.origin)
    } catch { return false }
  }
  if (secFetchSite === 'cross-site') return false
  const hasSessionCookie = (req.headers.cookie ?? '').split(';').some((cookie) => cookie.trim().startsWith('synapse_session='))
  if (!hasSessionCookie) return true
  const referer = req.headers.referer
  if (!referer) return false
  try {
    const parsed = new URL(referer)
    const production = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
    return parsed.host === req.headers.host && (parsed.protocol === 'https:' || (!production && parsed.protocol === 'http:'))
  } catch { return false }
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const contentType = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') throw Object.assign(new Error('Content-Type debe ser application/json'), { statusCode: 415 })
  const declaredLength = Number(req.headers['content-length'] ?? 0)
  if (declaredLength > maxBytes) throw Object.assign(new Error('El cuerpo de la solicitud excede el límite permitido'), { statusCode: 413 })
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += data.length
    if (size > maxBytes) throw Object.assign(new Error('El cuerpo de la solicitud excede el límite permitido'), { statusCode: 413 })
    chunks.push(data)
  }
  if (size === 0) return {}
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El cuerpo JSON debe ser un objeto')
    return value as Record<string, unknown>
  } catch {
    throw Object.assign(new Error('JSON inválido'), { statusCode: 400 })
  }
}
