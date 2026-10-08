import { FormEvent, useState } from 'react'
import { ArrowRight, Fingerprint, LockKeyhole } from 'lucide-react'

type Props = { onAuthenticated: (userId: string, role?: 'viewer' | 'operator' | 'approver' | 'admin', mfaEnabled?: boolean, mfaManaged?: boolean, domains?: string[]) => void }

function passkeyErrorMessage(cause: unknown): string {
  if (cause instanceof Error && (cause.name === 'NotAllowedError' || /timed out or was not allowed/i.test(cause.message))) {
    return 'El teléfono no encontró una passkey disponible o se canceló la verificación. Si la registraste en otro dispositivo, elígelo en “Usar otro dispositivo”. Para usar la huella de este teléfono, inicia sesión con contraseña y 2FA y registra una passkey aquí en Configuración.'
  }
  return cause instanceof Error ? cause.message : 'No se pudo iniciar sesión con passkey.'
}

export function LoginScreen({ onAuthenticated }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)

  async function loginWithPasskey() {
    setPasskeyBusy(true)
    setError('')
    try {
      const optionsResponse = await fetch('/api/auth/passkey/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const optionsData = await optionsResponse.json() as { stateId?: string; options?: Parameters<(typeof import('@simplewebauthn/browser'))['startAuthentication']>[0]['optionsJSON']; error?: string }
      if (!optionsResponse.ok || !optionsData.stateId || !optionsData.options) throw new Error(optionsData.error ?? 'No se pudo preparar el inicio con passkey.')
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const response = await startAuthentication({ optionsJSON: optionsData.options })
      const verifyResponse = await fetch('/api/auth/passkey/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stateId: optionsData.stateId, response }) })
      const data = await verifyResponse.json() as { userId?: string; role?: 'viewer' | 'operator' | 'approver' | 'admin'; mfaEnabled?: boolean; mfaManaged?: boolean; domains?: string[]; error?: string }
      if (!verifyResponse.ok || !data.userId) throw new Error(data.error ?? 'No se pudo verificar la passkey.')
      onAuthenticated(data.userId, data.role, data.mfaEnabled, data.mfaManaged, data.domains)
    } catch (cause) {
      setError(passkeyErrorMessage(cause))
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, mfaCode }) })
      const data = await response.json() as { userId?: string; role?: 'viewer' | 'operator' | 'approver' | 'admin'; mfaEnabled?: boolean; mfaManaged?: boolean; domains?: string[]; error?: string }
      if (!response.ok || !data.userId) throw new Error(data.error ?? 'No se pudo iniciar sesión')
      onAuthenticated(data.userId, data.role, data.mfaEnabled, data.mfaManaged, data.domains)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-screen"><section className="auth-card panel-card"><img className="auth-logo" src="/assets/dmente-synapse-brand.jpg" alt="Dmente Synapse, agencia de agentes AI" /><span className="eyebrow">ACCESO PROTEGIDO</span><h1>Entrar a Synapse</h1><p>Accede a tu centro de operaciones y a tus dominios personales.</p><form onSubmit={submit}><p className="form-purpose">Solicitamos usuario y contraseña para verificar tu acceso. El código MFA solo se usa si lo configuraste.</p><label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label><label>Código del autenticador, si configuraste MFA<input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" type="submit" disabled={submitting || passkeyBusy}>{submitting ? 'Verificando...' : 'Iniciar sesión'} <ArrowRight size={17} /></button></form><div className="auth-divider"><span>o</span></div><button className="auth-passkey" type="button" onClick={() => void loginWithPasskey()} disabled={submitting || passkeyBusy}>{passkeyBusy ? 'Esperando verificación…' : <><Fingerprint size={17} /> Entrar con passkey / huella</>}</button><small className="auth-note"><LockKeyhole size={13} /> La sesión se mantiene en una cookie protegida.</small><nav className="legal-links" aria-label="Información legal"><a href="/legal/privacidad.html">Privacidad</a><a href="/legal/terminos.html">Términos</a><a href="/legal/cookies.html">Cookies</a></nav><div className="auth-credit"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Desarrollado por Dmente Digital</span><a href="https://www.dmentedigital.co" target="_blank" rel="noreferrer">www.dmentedigital.co</a></div></section></main>
}
