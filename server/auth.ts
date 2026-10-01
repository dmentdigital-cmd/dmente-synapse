import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createUserAccount, findUserById, findUserByUsername, updateUserTotp } from './db.js'
import type { Domain, UserRole } from './types.js'

const username = process.env.SYNAPSE_OWNER_USERNAME ?? 'diego'
const ownerCredential = process.env.SYNAPSE_OWNER_PASSWORD
const sessionKey = process.env.SYNAPSE_SESSION_SECRET
const ownerTotpSecret = process.env.SYNAPSE_OWNER_TOTP_SECRET
const totpEncryptionKey = process.env.SYNAPSE_TOTP_ENCRYPTION_KEY
const sessionTtlMs = 1000 * 60 * 60 * 8
const sessions = new Map<string, { userId: string; expiresAt: number }>()
const loginFailures = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>()
const mfaFailures = new Map<string, { count: number; windowStartedAt: number; blockedUntil: number }>()
const loginFailureLimit = 5
const loginWindowMs = 15 * 60 * 1000
const mfaFailureLimit = 5

function recordMfaFailure(userId: string, valid: boolean): boolean {
  const now = Date.now()
  const previous = mfaFailures.get(userId)
  if (previous && previous.blockedUntil > now) return false
  if (valid) { mfaFailures.delete(userId); return true }
  const current = !previous || now - previous.windowStartedAt > loginWindowMs
    ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
    : previous
  current.count += 1
  if (current.count >= mfaFailureLimit) current.blockedUntil = now + loginWindowMs
  mfaFailures.set(userId, current)
  return false
}

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

export function validateProductionSecurityConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return
  const missing: string[] = []
  if (!ownerCredential || ownerCredential.length < 12) missing.push('SYNAPSE_OWNER_PASSWORD (mínimo 12 caracteres)')
  if (!sessionKey || sessionKey.length < 32) missing.push('SYNAPSE_SESSION_SECRET (mínimo 32 caracteres)')
  if (!totpEncryptionKey || totpEncryptionKey.length < 32) missing.push('SYNAPSE_TOTP_ENCRYPTION_KEY (mínimo 32 caracteres)')
  if (sessionKey && totpEncryptionKey && sessionKey === totpEncryptionKey) missing.push('SYNAPSE_SESSION_SECRET debe ser distinto de SYNAPSE_TOTP_ENCRYPTION_KEY')
  if (missing.length) throw new Error(`Configuración de seguridad de producción incompleta: ${missing.join(', ')}`)
}

const allDomains: Domain[] = ['agency', 'personal', 'family', 'health', 'education', 'church', 'learning', 'wellbeing', 'projects', 'technology', 'finance', 'knowledge', 'product', 'messaging', 'sales', 'marketing', 'legal']

function passwordDigest(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

function encryptionKey(): Buffer | null {
  return totpEncryptionKey && totpEncryptionKey.length >= 32 ? createHash('sha256').update(totpEncryptionKey).digest() : null
}

function encryptTotpSecret(secret: string): string | null {
  const key = encryptionKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return `v1.${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${ciphertext.toString('hex')}`
}

function decryptTotpSecret(value: string | null): string | null {
  const key = encryptionKey()
  if (!key || !value) return null
  const [version, ivHex, tagHex, ciphertextHex] = value.split('.')
  if (version !== 'v1' || !ivHex || !tagHex || !ciphertextHex) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8')
  } catch { return null }
}

function encodeBase32(bytes: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let output = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) { bits -= 5; output += alphabet[(buffer >> bits) & 31]; buffer &= (1 << bits) - 1 }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31]
  return output
}

export function hashPassword(password: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = randomBytes(16).toString('hex')
  return { passwordHash: passwordDigest(password, passwordSalt), passwordSalt }
}

if (ownerCredential) {
  const existingOwner = findUserByUsername(username)
  if (!existingOwner && !findUserById('diego-local')) {
    const salt = randomBytes(16).toString('hex')
    createUserAccount({ id: 'diego-local', username, name: 'Diego', role: 'admin', domains: allDomains, passwordHash: passwordDigest(ownerCredential, salt), passwordSalt: salt })
  }
}

if (ownerTotpSecret && encryptionKey()) {
  const owner = findUserByUsername(username)
  if (owner && !owner.totpSecretEncrypted) updateUserTotp(owner.id, { secretEncrypted: encryptTotpSecret(ownerTotpSecret), pendingEncrypted: owner.totpPendingEncrypted })
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
  const user = authConfigured() ? findUserByUsername(inputUsername) : null
  const credentialValid = Boolean(user?.active && safeEqual(passwordDigest(inputCredential, user.passwordSalt), user.passwordHash))
  const accountSecret = user?.totpSecretEncrypted ? decryptTotpSecret(user.totpSecretEncrypted) : null
  const mfaValid = user?.totpSecretEncrypted
    ? Boolean(accountSecret && verifyTotp(accountSecret, mfaCode))
    : inputUsername.toLowerCase() !== username.toLowerCase() || !ownerTotpSecret || verifyTotp(ownerTotpSecret, mfaCode)
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
      while (loginFailures.size > 5000) loginFailures.delete(loginFailures.keys().next().value as string)
    }
    return null
  }
  loginFailures.delete(ip)
  if (sessions.size >= 20_000) {
    const now = Date.now()
    for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token)
    if (sessions.size >= 20_000) return null
  }
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId: user!.id, expiresAt: Date.now() + sessionTtlMs })
  return `${token}.${signSession(token)}`
}

export function accessFromRequest(req: IncomingMessage): { userId: string; role: UserRole; domains: Domain[] } | null {
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
  const user = findUserById(session.userId)
  if (!user?.active) { sessions.delete(token); return null }
  return { userId: user.id, role: user.role, domains: user.domains }
}

export function sessionFromRequest(req: IncomingMessage): { userId: string } | null {
  const access = accessFromRequest(req)
  return access ? { userId: access.userId } : null
}

export function clearSession(req: IncomingMessage): void {
  const cookieHeader = req.headers.cookie ?? ''
  const tokenValue = cookieHeader.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith('synapse_session='))?.slice('synapse_session='.length)
  const token = tokenValue?.split('.')[0]
  if (token) sessions.delete(token)
}

export function revokeUserSessions(userId: string): void {
  for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token)
}

export function setSessionCookie(res: ServerResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
  res.setHeader('Set-Cookie', `synapse_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionTtlMs / 1000}${secure ? '; Secure' : ''}`)
}

export function clearSessionCookie(res: ServerResponse): void {
  const secure = process.env.NODE_ENV === 'production' || process.env.SYNAPSE_COOKIE_SECURE === 'true'
  res.setHeader('Set-Cookie', `synapse_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`)
}

export function authStatus(req: IncomingMessage): { configured: boolean; authenticated: boolean; mfaRequired: boolean; userId?: string; role?: UserRole; domains?: Domain[]; mfaEnabled?: boolean; mfaManaged?: boolean } {
  const session = accessFromRequest(req)
  return { configured: authConfigured(), authenticated: Boolean(session), mfaRequired: Boolean(ownerTotpSecret), ...(session ? { userId: session.userId, role: session.role, domains: session.domains, mfaEnabled: mfaEnabledForUser(session.userId), mfaManaged: mfaManagedForUser(session.userId) } : {}) }
}

export function totpEncryptionConfigured(): boolean { return Boolean(encryptionKey()) }

export function mfaEnabledForUser(userId: string): boolean {
  const account = findUserById(userId)
  return Boolean(account?.totpSecretEncrypted || (ownerTotpSecret && account?.username.toLowerCase() === username.toLowerCase()))
}

export function mfaManagedForUser(userId: string): boolean {
  return Boolean(findUserById(userId)?.totpSecretEncrypted)
}

export function beginTotpSetup(userId: string, currentCode = ''): { secret: string; uri: string } | null {
  const account = findUserById(userId)
  if (!account || !encryptionKey()) return null
  if (account.totpSecretEncrypted) {
    const currentSecret = decryptTotpSecret(account.totpSecretEncrypted)
    if (!currentSecret || !verifyTotp(currentSecret, currentCode)) return null
  }
  const secret = encodeBase32(randomBytes(20))
  const pendingEncrypted = encryptTotpSecret(secret)
  if (!pendingEncrypted || !updateUserTotp(userId, { secretEncrypted: account.totpSecretEncrypted, pendingEncrypted })) return null
  const label = encodeURIComponent(`Dmente Synapse:${account.username}`)
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=Dmente%20Synapse&algorithm=SHA1&digits=6&period=30`
  return { secret, uri }
}

export function confirmTotpSetup(userId: string, code: string): boolean {
  const account = findUserById(userId)
  const pendingSecret = decryptTotpSecret(account?.totpPendingEncrypted ?? null)
  if (!account || !recordMfaFailure(userId, Boolean(pendingSecret && verifyTotp(pendingSecret, code)))) return false
  if (!pendingSecret) return false
  return updateUserTotp(userId, { secretEncrypted: encryptTotpSecret(pendingSecret), pendingEncrypted: null })
}

export function disableTotp(userId: string, password: string, code: string): boolean {
  const account = findUserById(userId)
  const secret = decryptTotpSecret(account?.totpSecretEncrypted ?? null)
  if (!account || !secret) return false
  const valid = safeEqual(passwordDigest(password, account.passwordSalt), account.passwordHash) && verifyTotp(secret, code)
  if (!recordMfaFailure(userId, valid)) return false
  return updateUserTotp(userId, { secretEncrypted: null, pendingEncrypted: null })
}
