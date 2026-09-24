import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

const username = process.env.SYNAPSE_OWNER_USERNAME ?? 'diego'
const ownerCredential = process.env.SYNAPSE_OWNER_PASSWORD
const sessionKey = process.env.SYNAPSE_SESSION_SECRET
const sessionTtlMs = 1000 * 60 * 60 * 8
const sessions = new Map<string, { userId: string; expiresAt: number }>()

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = digest(left)
  const rightDigest = digest(right)
  return timingSafeEqual(leftDigest, rightDigest)
}

export function authConfigured(): boolean {
  return Boolean(ownerCredential && sessionKey)
}

export function login(inputUsername: string, inputCredential: string): string | null {
  if (!authConfigured() || inputUsername !== username || !safeEqual(inputCredential, ownerCredential!)) return null
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId: 'diego-local', expiresAt: Date.now() + sessionTtlMs })
  return token
}

export function sessionFromRequest(req: IncomingMessage): { userId: string } | null {
  const cookieHeader = req.headers.cookie ?? ''
  const token = cookieHeader.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('synapse_session='))?.split('=')[1]
  if (!token) return null
  const session = sessions.get(token)
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return { userId: session.userId }
}

export function clearSession(req: IncomingMessage): void {
  const cookieHeader = req.headers.cookie ?? ''
  const token = cookieHeader.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('synapse_session='))?.split('=')[1]
  if (token) sessions.delete(token)
}

export function setSessionCookie(res: ServerResponse, token: string): void {
  res.setHeader('Set-Cookie', `synapse_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}`)
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('Set-Cookie', 'synapse_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
}

export function authStatus(req: IncomingMessage): { configured: boolean; authenticated: boolean; userId?: string } {
  const session = sessionFromRequest(req)
  return { configured: authConfigured(), authenticated: Boolean(session), ...(session ? { userId: session.userId } : {}) }
}
