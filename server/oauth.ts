import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { accessFromRequest, login, setSessionCookie } from './auth.js'
import { consumeOAuthCode, consumeOAuthRefreshToken, createOAuthClient, findUserById, findUserByUsername, getOAuthClient, getOAuthToken, saveOAuthCode, saveOAuthRefreshToken, saveOAuthToken } from './db.js'
import type { Domain } from './types.js'

const issuer = () => process.env.SYNAPSE_PUBLIC_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3010'
const allowedScopes = new Set(['mcp:read'])

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`<!doctype html><meta charset="utf-8"><title>Dmente Synapse OAuth</title>${body}`)
}
function escape(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string)) }
function formBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => { let raw = ''; req.setEncoding('utf8'); req.on('data', (chunk) => { raw += chunk }); req.on('end', () => resolve(new URLSearchParams(raw))); req.on('error', reject) })
}
function validRedirectUri(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) return Boolean(parsed.port)
    if (parsed.protocol !== 'https:') return false
    return ['claude.ai', 'claude.com'].some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch { return false }
}
function validRedirect(client: { redirectUris: string[] }, redirectUri: string): boolean { return client.redirectUris.includes(redirectUri) }
function redirectError(res: ServerResponse, redirectUri: string, error: string, state: string): void {
  const target = new URL(redirectUri); target.searchParams.set('error', error); if (state) target.searchParams.set('state', state); res.writeHead(302, { Location: target.toString() }); res.end()
}
function pkceValid(verifier: string, challenge: string): boolean {
  const digest = createHash('sha256').update(verifier).digest('base64url')
  return digest.length === challenge.length && timingSafeEqual(Buffer.from(digest), Buffer.from(challenge))
}
function hashOpaque(value: string): string { return createHash('sha256').update(value).digest('hex') }
function userDomains(userId: string): Domain[] { return findUserById(userId)?.domains ?? [] }

export function oauthAccess(req: IncomingMessage): { scope: 'read'; domains: Domain[] } | null {
  const value = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : ''
  const token = getOAuthToken(hashOpaque(value))
  if (!token || token.scope !== 'mcp:read') return null
  return { scope: 'read', domains: userDomains(token.userId) }
}

export function oauthMetadata(): Record<string, unknown> {
  const base = issuer()
  return { issuer: base, authorization_endpoint: `${base}/oauth/authorize`, token_endpoint: `${base}/oauth/token`, registration_endpoint: `${base}/oauth/register`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: [...allowedScopes] }
}

export function protectedResourceMetadata(): Record<string, unknown> {
  const base = issuer(); return { resource: `${base}/mcp`, authorization_servers: [base], scopes_supported: [...allowedScopes], bearer_methods_supported: ['header'] }
}

export async function handleOAuth(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (req.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') { json(res, 200, oauthMetadata()); return true }
  if (req.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource') { json(res, 200, protectedResourceMetadata()); return true }
  if (req.method === 'POST' && url.pathname === '/oauth/register') {
    let input: any; try { input = JSON.parse(await new Promise<string>((resolve, reject) => { let raw = ''; req.on('data', (chunk) => { raw += chunk }); req.on('end', () => resolve(raw)); req.on('error', reject) })) } catch { json(res, 400, { error: 'invalid_request' }); return true }
    const redirectUris: string[] = Array.isArray(input?.redirect_uris) ? input.redirect_uris.filter((item: unknown): item is string => typeof item === 'string' && item.length <= 1000) : []
    if (!redirectUris.length || redirectUris.some((item) => !validRedirectUri(item))) { json(res, 400, { error: 'invalid_redirect_uri' }); return true }
    const clientId = `synapse_${randomUUID()}`; const client = createOAuthClient({ clientId, clientName: typeof input?.client_name === 'string' ? input.client_name.slice(0, 120) : 'MCP client', redirectUris })
    json(res, 201, { client_id: clientId, client_name: client.clientName, redirect_uris: redirectUris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }); return true
  }
  if (url.pathname === '/oauth/authorize' && (req.method === 'GET' || req.method === 'POST')) {
    const input = req.method === 'GET' ? url.searchParams : await formBody(req)
    const client = getOAuthClient(input.get('client_id') || '')
    const redirectUri = input.get('redirect_uri') || ''; const state = input.get('state') || ''; const challenge = input.get('code_challenge') || ''; const method = input.get('code_challenge_method') || ''
    if (!client || !validRedirect(client, redirectUri) || input.get('response_type') !== 'code' || !challenge || method !== 'S256') { if (client && validRedirect(client, redirectUri)) redirectError(res, redirectUri, 'invalid_request', state); else html(res, 400, '<h1>Solicitud OAuth inválida</h1>'); return true }
    const consent = (userId: string): void => {
      const account = findUserById(userId)
      html(res, 200, `<h1>Autorizar Dmente Synapse</h1><p>La aplicación <b>${escape(client.clientName)}</b> solicita acceso de solo lectura a Synapse.</p><p>Cuenta: <b>${escape(account?.username ?? userId)}</b></p><form method="post"><input type="hidden" name="action" value="consent"><input type="hidden" name="response_type" value="code"><input type="hidden" name="client_id" value="${escape(client.clientId)}"><input type="hidden" name="redirect_uri" value="${escape(redirectUri)}"><input type="hidden" name="state" value="${escape(state)}"><input type="hidden" name="code_challenge" value="${escape(challenge)}"><input type="hidden" name="code_challenge_method" value="S256"><button>Autorizar acceso de solo lectura</button></form>`)
    }
    const session = accessFromRequest(req)
    if (!session && req.method === 'GET') { html(res, 200, `<h1>Autorizar Dmente Synapse</h1><p>Inicie sesión para autorizar <b>${escape(client.clientName)}</b>.</p><form method="post"><input type="hidden" name="action" value="login"><input type="hidden" name="response_type" value="code"><input type="hidden" name="client_id" value="${escape(client.clientId)}"><input type="hidden" name="redirect_uri" value="${escape(redirectUri)}"><input type="hidden" name="state" value="${escape(state)}"><input type="hidden" name="code_challenge" value="${escape(challenge)}"><input type="hidden" name="code_challenge_method" value="S256"><label>Usuario <input name="username" required></label><br><label>Contraseña <input name="password" type="password" required></label><br><label>MFA (si aplica) <input name="mfa_code" inputmode="numeric"></label><br><button>Continuar</button></form>`); return true }
    if (!session && req.method === 'POST' && input.get('action') === 'login') { const token = login(input.get('username') || '', input.get('password') || '', req.socket.remoteAddress || 'oauth-client', input.get('mfa_code') || ''); if (!token) { html(res, 401, '<h1>Inicio de sesión rechazado</h1><p>Credenciales o MFA inválidos.</p>'); return true }; setSessionCookie(res, token); consent(findUserByUsername(input.get('username') || '')?.id ?? ''); return true }
    if (!session && req.method === 'POST') { html(res, 401, '<h1>Sesión OAuth no encontrada</h1><p>Inicie nuevamente la autorización.</p>'); return true }
    if (req.method === 'GET' || input.get('action') !== 'consent') { consent(session!.userId); return true }
    const code = randomBytes(32).toString('base64url'); saveOAuthCode(hashOpaque(code), { clientId: client.clientId, redirectUri, userId: session!.userId, scope: 'mcp:read', codeChallenge: challenge, expiresAt: Date.now() + 300_000 }); const target = new URL(redirectUri); target.searchParams.set('code', code); if (state) target.searchParams.set('state', state); res.writeHead(302, { Location: target.toString() }); res.end(); return true
  }
  if (req.method === 'POST' && url.pathname === '/oauth/token') {
    const input = await formBody(req); const clientId = input.get('client_id') || ''; const grantType = input.get('grant_type') || ''
    let userId = ''; let scope = 'mcp:read'
    if (grantType === 'authorization_code') {
      const code = consumeOAuthCode(hashOpaque(input.get('code') || ''))
      if (!code || code.clientId !== clientId || code.redirectUri !== (input.get('redirect_uri') || '') || !pkceValid(input.get('code_verifier') || '', code.codeChallenge)) { json(res, 400, { error: 'invalid_grant' }); return true }
      userId = code.userId; scope = code.scope
    } else if (grantType === 'refresh_token') {
      const refresh = consumeOAuthRefreshToken(hashOpaque(input.get('refresh_token') || ''))
      if (!refresh || refresh.clientId !== clientId) { json(res, 400, { error: 'invalid_grant' }); return true }
      userId = refresh.userId; scope = refresh.scope
    } else { json(res, 400, { error: 'unsupported_grant_type' }); return true }
    const accessToken = randomBytes(32).toString('base64url'); const refreshToken = randomBytes(32).toString('base64url'); saveOAuthToken(hashOpaque(accessToken), { userId, scope, expiresAt: Date.now() + 3600_000 }); saveOAuthRefreshToken(hashOpaque(refreshToken), { clientId, userId, scope, expiresAt: Date.now() + 30 * 24 * 3600_000 }); json(res, 200, { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: 3600, scope }); return true
  }
  return false
}
