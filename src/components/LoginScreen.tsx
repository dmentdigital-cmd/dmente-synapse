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
  const [mode, setMode] = useState<'login' | 'register'>(() => new URLSearchParams(window.location.search).get('trial') === '1' ? 'register' : 'login')
  const [username, setUsername] = useState('')
  const [credential, setCredential] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [name, setName] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const credentialField = 'password'

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
      const response = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'register' ? { username, name, [credentialField]: credential, acceptedTerms } : { username, [credentialField]: credential, mfaCode }) })
      const data = await response.json() as { userId?: string; role?: 'viewer' | 'operator' | 'approver' | 'admin'; mfaEnabled?: boolean; mfaManaged?: boolean; domains?: string[]; error?: string }
      if (!response.ok || !data.userId) throw new Error(data.error ?? (mode === 'register' ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión'))
      onAuthenticated(data.userId, data.role, data.mfaEnabled, data.mfaManaged, data.domains)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-screen"><section className="auth-card panel-card"><img className="auth-logo" src="/assets/dmente-synapse-brand.jpg" alt="Dmente Synapse, agencia de agentes AI" /><span className="eyebrow">{mode === 'register' ? 'PRUEBA GRATUITA' : 'ACCESO PROTEGIDO'}</span><h1>{mode === 'register' ? 'Prueba Synapse 15 días' : 'Entrar a Synapse'}</h1><p>{mode === 'register' ? 'Crea tu cuenta y empieza a usarla ahora. Sin tarjeta de crédito y sin renovación automática.' : 'Accede a tu centro de operaciones y a tus dominios personales.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}<label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label><label>Contraseña<input value={credential} onChange={(event) => setCredential(event.target.value)} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required /></label>{mode === 'login' && <label>Código del autenticador, si configuraste MFA<input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} /></label>}{mode === 'register' && <label className="terms-check"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /> Acepto los <a href="/legal/terminos.html" target="_blank" rel="noreferrer">términos</a> y la <a href="/legal/privacidad.html" target="_blank" rel="noreferrer">política de privacidad</a>.</label>}{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" type="submit" disabled={submitting || passkeyBusy || (mode === 'register' && !acceptedTerms)}>{submitting ? (mode === 'register' ? 'Creando cuenta...' : 'Verificando...') : (mode === 'register' ? 'Empezar prueba' : 'Iniciar sesión')} <ArrowRight size={17} /></button></form>{mode === 'login' && <><div className="auth-divider"><span>o</span></div><button className="auth-passkey" type="button" onClick={() => void loginWithPasskey()} disabled={submitting || passkeyBusy}>{passkeyBusy ? 'Esperando verificación…' : <><Fingerprint size={17} /> Entrar con passkey / huella</>}</button></>}<button className="auth-mode-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'register' ? 'Ya tengo una cuenta' : 'Quiero probarlo 15 días'}</button><small className="auth-note"><LockKeyhole size={13} /> La sesión se mantiene en una cookie protegida.</small><nav className="legal-links" aria-label="Información legal"><a href="/legal/privacidad.html">Privacidad</a><a href="/legal/terminos.html">Términos</a><a href="/legal/cookies.html">Cookies</a></nav><div className="auth-credit"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Desarrollado por Dmente Digital</span><a href="https://www.dmentedigital.co" target="_blank" rel="noreferrer">www.dmentedigital.co</a></div></section></main>
}
