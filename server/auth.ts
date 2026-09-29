import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

const username = process.env.SYNAPSE_OWNER_USERNAME ?? 'diego'
const ownerCredential = process.env.SYNAPSE_OWNER_PASSWORD
const sessionKey = process.env.SYNAPSE_SESSION_SECRET
const ownerTotpSecret = process.env.SYNAPSE_OWNER_TOTP_SECRET
const sessionTtlMs = 1000 * 60 * 60 * 8
const sessions = new Map<string, { userId: string; expiresAt: number }>()
const loginFailures = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>()
const loginFailureLimit = 5
const loginWindowMs = 15 * 60 * 1000

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

function signSession(token: string): string {
  return sessionKey ? createHmac('sha256', sessionKey).update(token).digest('hex') : ''
}

function decodeBase32(value: string): Buffer | null {
  const normalized = value.replace(/[=\s-]/g, '').toUpperCase()
  if (!normalized || /[^A-Z2-7]/.test(normalized)) return null
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const character of normalized) {
    buffer = (buffer << 5) | alphabet.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
      buffer &= (1 << bits) - 1
    }
  }
  return Buffer.from(bytes)
}

function totpAt(secret: Buffer, timestampMs: number): string {
  const counter = BigInt(Math.floor(timestampMs / 30_000))
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(counter)
  const digest = createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secretBase32: string, code: string, timestampMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const decodedBytes = decodeBase32(secretBase32)
  if (!decodedBytes?.length) return false
  for (const offset of [-30_000, 0, 30_000]) {
    if (safeEqual(code, totpAt(decodedBytes, timestampMs + offset))) return true
  }
  return false
}

export function loginBlocked(ip: string): boolean {
  return (loginFailures.get(ip)?.blockedUntil ?? 0) > Date.now()
}

export function login(inputUsername: string, inputCredential: string, ip: string, mfaCode = ''): string | null {
  if (loginBlocked(ip)) return null
  const credentialValid = authConfigured() && inputUsername === username && safeEqual(inputCredential, ownerCredential!)
  const mfaValid = !ownerTotpSecret || verifyTotp(ownerTotpSecret, mfaCode)
  if (!credentialValid || !mfaValid) {
    const now = Date.now()
    const existing = loginFailures.get(ip)
    const current = !existing || now - existing.windowStartedAt > loginWindowMs
      ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
      : existing
    current.count += 1
    if (current.count >= loginFailureLimit) current.blockedUntil = now + loginWindowMs
    loginFailures.set(ip, current)
    if (loginFailures.size > 5000) {
      for (const [address, failure] of loginFailures) {
        if (failure.blockedUntil <= now && now - failure.windowStartedAt > loginWindowMs) loginFailures.delete(address)
      }
    }
    return null
  }
  loginFailures.delete(ip)
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId: 'diego-local', expiresAt: Date.now() + sessionTtlMs })
  return `${token}.${signSession(token)}`
}

export function sessionFromRequest(req: IncomingMessage): { userId: string } | null {
  const cookieHeader = req.headers.cookie ?? ''
  const tokenValue = cookieHeader.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('synapse_session='))?.slice('synapse_session='.length)
  if (!tokenValue) return null
  const [token, signature] = tokenValue.split('.')
  if (!token || !signature || !safeEqual(signature, signSession(token))) return null
  const session = sessions.get(token)
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return { userId: session.userId }
}

export function clearSession(req: IncomingMessage): void {
  const cookieHeader = req.headers.cookie ?? ''
  const tokenValue = cookieHeader.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('synapse_session='))?.slice('synapse_session='.length)
  const token = tokenValue?.split('.')[0]
  if (token) sessions.delete(token)
}

export function setSessionCookie(res: ServerResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
  res.setHeader('Set-Cookie', `synapse_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}${secure ? '; Secure' : ''}`)
}

export function clearSessionCookie(res: ServerResponse): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
  res.setHeader('Set-Cookie', `synapse_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`)
}

export function authStatus(req: IncomingMessage): { configured: boolean; authenticated: boolean; mfaRequired: boolean; userId?: string } {
  const session = sessionFromRequest(req)
  return { configured: authConfigured(), authenticated: Boolean(session), mfaRequired: Boolean(ownerTotpSecret), ...(session ? { userId: session.userId } : {}) }
}
