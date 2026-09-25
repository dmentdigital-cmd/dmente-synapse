import { FormEvent, useState } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'

type Props = { onAuthenticated: (userId: string) => void }

export function LoginScreen({ onAuthenticated }: Props) {
  const [username, setUsername] = useState('diego')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await response.json() as { userId?: string; error?: string }
      if (!response.ok || !data.userId) throw new Error(data.error ?? 'No se pudo iniciar sesión')
      onAuthenticated(data.userId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-screen"><section className="auth-card panel-card"><img className="auth-logo" src="/assets/dmente-synapse-brand.jpg" alt="Dmente Synapse, agencia de agentes AI" /><span className="eyebrow">ACCESO PROTEGIDO</span><h1>Entrar a Synapse</h1><p>Accede a tu centro de operaciones y a tus dominios personales.</p><form onSubmit={submit}><label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label>Contraseña<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Verificando...' : 'Iniciar sesión'} <ArrowRight size={17} /></button></form><small className="auth-note"><LockKeyhole size={13} /> La sesión se mantiene en una cookie protegida.</small><div className="auth-credit"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Desarrollado por Dmente Digital</span><a href="https://www.dmentedigital.co" target="_blank" rel="noreferrer">www.dmentedigital.co</a></div></section></main>
}
