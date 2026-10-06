import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  consumeWebAuthnChallenge,
  createWebAuthnChallenge,
  deleteWebAuthnCredential,
  findWebAuthnCredential,
  findUserById,
  hasAnyWebAuthnCredentials,
  listWebAuthnCredentials,
  saveWebAuthnCredential,
  updateWebAuthnCredentialCounter,
} from './db.js'
import { loginWithVerifiedPasskey, mfaEnabledForUser, verifyAccountPasswordAndMfa } from './auth.js'

const challengeLifetimeMs = 2 * 60_000
const maxCredentialsPerUser = 8
const defaultProductionOrigin = 'https://synapse.dmentedigital.co'

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode })
}

function webAuthnConfig(req: IncomingMessage): { origin: string; rpID: string } {
  const configuredOrigin = process.env.SYNAPSE_WEBAUTHN_ORIGIN?.trim()
  const production = process.env.NODE_ENV === 'production'
  const requestOrigin = req.headers.origin
  const origin = configuredOrigin || (production ? defaultProductionOrigin : requestOrigin)
  if (!origin || !requestOrigin || requestOrigin !== origin) throw httpError(403, 'Origen no válido para passkeys.')
  let parsed: URL
  try { parsed = new URL(origin) } catch { throw httpError(503, 'Configuración WebAuthn inválida en el servidor.') }
  if (parsed.origin !== origin || (production ? parsed.protocol !== 'https:' : !['https:', 'http:'].includes(parsed.protocol))) {
    throw httpError(503, 'Configuración WebAuthn inválida en el servidor.')
  }
  if (req.headers.host !== parsed.host) throw httpError(403, 'El dominio de Synapse no coincide con passkeys.')
  const rpID = process.env.SYNAPSE_WEBAUTHN_RP_ID?.trim() || parsed.hostname
  const rpIsOriginDomain = parsed.hostname === rpID || parsed.hostname.endsWith(`.${rpID}`)
  if (!rpIsOriginDomain || /[/:\s]/.test(rpID)) throw httpError(503, 'El dominio RP de WebAuthn no coincide con el origen configurado.')
  return { origin, rpID }
}

function persistChallenge(userId: string | null, purpose: 'registration' | 'authentication', challenge: string): string {
  const id = randomUUID()
  createWebAuthnChallenge({ id, userId, purpose, challenge, expiresAt: Date.now() + challengeLifetimeMs })
  return id
}

export async function beginPasskeyRegistration(req: IncomingMessage, userId: string, password: string, mfaCode: string, ip: string) {
  const user = findUserById(userId)
  if (!user?.active) throw httpError(404, 'Cuenta no encontrada.')
  if (!mfaEnabledForUser(userId)) throw httpError(403, 'Activa 2FA antes de registrar una passkey.')
  if (!verifyAccountPasswordAndMfa(userId, password, mfaCode, ip)) throw httpError(401, 'Contraseña o código 2FA incorrectos.')
  const credentials = listWebAuthnCredentials(userId)
  if (credentials.length >= maxCredentialsPerUser) throw httpError(409, 'Esta cuenta ya tiene el máximo de 8 passkeys.')
  const { rpID } = webAuthnConfig(req)
  const options = await generateRegistrationOptions({
    rpName: 'Dmente Synapse',
    rpID,
    userID: Buffer.from(user.id, 'utf8'),
    userName: user.username,
    userDisplayName: user.name,
    timeout: challengeLifetimeMs,
    attestationType: 'none',
    excludeCredentials: credentials.map((credential) => ({ id: credential.id, transports: credential.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  })
  return { stateId: persistChallenge(userId, 'registration', options.challenge), options }
}

export async function completePasskeyRegistration(req: IncomingMessage, userId: string, input: Record<string, unknown>) {
  const stateId = typeof input.stateId === 'string' ? input.stateId : ''
  const response = input.response as RegistrationResponseJSON | undefined
  const label = typeof input.label === 'string' ? input.label.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80) : ''
  if (!stateId || !response || !label) throw httpError(400, 'Faltan datos requeridos para registrar la passkey.')
  const challenge = consumeWebAuthnChallenge(stateId, 'registration', userId)
  if (!challenge) throw httpError(400, 'El intento de registro venció. Inicia de nuevo.')
  const { origin, rpID } = webAuthnConfig(req)
  let verification
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true })
  } catch {
    throw httpError(400, 'No se pudo verificar la passkey. Intenta registrarla de nuevo.')
  }
  if (!verification.verified || !verification.registrationInfo.userVerified) throw httpError(400, 'La verificación de identidad del dispositivo no fue suficiente.')
  const user = findUserById(userId)
  if (!user?.active) throw httpError(404, 'Cuenta no encontrada.')
  if (listWebAuthnCredentials(userId).length >= maxCredentialsPerUser) throw httpError(409, 'Esta cuenta ya tiene el máximo de 8 passkeys.')
  const { credential } = verification.registrationInfo
  const saved = saveWebAuthnCredential({
    id: credential.id,
    userId,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? [],
    label,
    createdAt: new Date().toISOString(),
  })
  if (!saved) throw httpError(409, 'Esta passkey ya está registrada.')
  return { id: credential.id, label }
}

export async function beginPasskeyAuthentication(req: IncomingMessage) {
  if (!hasAnyWebAuthnCredentials()) throw httpError(409, 'Aún no hay passkeys registradas. Entra con contraseña y 2FA y regístrala en Configuración.')
  const { rpID } = webAuthnConfig(req)
  const options = await generateAuthenticationOptions({ rpID, timeout: challengeLifetimeMs, userVerification: 'required' })
  return { stateId: persistChallenge(null, 'authentication', options.challenge), options }
}

export async function completePasskeyAuthentication(req: IncomingMessage, input: Record<string, unknown>, ip: string): Promise<string | null> {
  const stateId = typeof input.stateId === 'string' ? input.stateId : ''
  const response = input.response as AuthenticationResponseJSON | undefined
  if (!stateId || !response?.id) throw httpError(400, 'Faltan datos requeridos para iniciar sesión con passkey.')
  const challenge = consumeWebAuthnChallenge(stateId, 'authentication', null)
  if (!challenge) throw httpError(400, 'El intento de inicio venció. Intenta de nuevo.')
  const credential = findWebAuthnCredential(response.id)
  if (!credential) throw httpError(401, 'Passkey no reconocida.')
  const { origin, rpID } = webAuthnConfig(req)
  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
        transports: credential.transports,
      },
    })
  } catch {
    throw httpError(401, 'No se pudo verificar esta passkey.')
  }
  if (!verification.verified || !verification.authenticationInfo.userVerified) throw httpError(401, 'La verificación de identidad del dispositivo no fue suficiente.')
  const account = findUserById(credential.userId)
  if (!account?.active) throw httpError(401, 'Cuenta no disponible.')
  updateWebAuthnCredentialCounter(credential.id, verification.authenticationInfo.newCounter)
  return account.id
}

export function listPasskeys(userId: string) {
  return listWebAuthnCredentials(userId).map(({ id, label, createdAt }) => ({ id, label, createdAt }))
}

export function removePasskey(userId: string, id: string): boolean {
  return deleteWebAuthnCredential(id, userId)
}

export { loginWithVerifiedPasskey }
