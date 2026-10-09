import { useEffect, useState } from 'react'

type DeletionRequest = { id: string; status: string; createdAt: string }
type GuardianAuthorization = { guardianName: string; relationship: string; authorizedAt: string; verifiedAt: string | null; revokedAt: string | null }
type GuardianRequest = { userId: string; username: string; guardianName: string; relationship: string; authorizedAt: string }

export function DataPrivacyPanel({ admin = false }: { admin?: boolean }) {
  const [request, setRequest] = useState<DeletionRequest | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ id: string; userId: string; username: string; name: string; createdAt: string }[]>([])
  const [guardian, setGuardian] = useState<GuardianAuthorization | null>(null)
  const [guardianName, setGuardianName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [guardianPending, setGuardianPending] = useState<GuardianRequest[]>([])
  const [evidence, setEvidence] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/account/data-deletion-request')
      .then(async (response) => response.ok ? response.json() as Promise<{ request: DeletionRequest | null }> : Promise.reject(new Error('No se pudo consultar la solicitud.')))
      .then((data) => setRequest(data.request))
      .catch(() => setError('No se pudo consultar el estado del borrado.'))
  }, [])

  useEffect(() => {
    fetch('/api/account/guardian-authorization').then(async (response) => response.ok ? response.json() as Promise<{ authorization: GuardianAuthorization | null }> : Promise.reject()).then((data) => setGuardian(data.authorization)).catch(() => setError('No se pudo consultar la autorización parental.'))
  }, [])

  useEffect(() => {
    if (!admin) return
    fetch('/api/admin/data-deletion-requests')
      .then(async (response) => response.ok ? response.json() as Promise<{ requests: typeof pending }> : Promise.reject(new Error('No se pudieron consultar las solicitudes.')))
      .then((data) => setPending(data.requests))
      .catch(() => setError('No se pudieron consultar las solicitudes pendientes.'))
    fetch('/api/admin/guardian-authorizations').then(async (response) => response.ok ? response.json() as Promise<{ requests: GuardianRequest[] }> : Promise.reject()).then((data) => setGuardianPending(data.requests)).catch(() => setError('No se pudieron consultar las verificaciones parentales.'))
  }, [admin])

  async function sendGuardianAuthorization() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/guardian-authorization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guardianName, relationship, authorized }) })
      const data = await response.json() as { authorization?: GuardianAuthorization; error?: string }
      if (!response.ok || !data.authorization) throw new Error(data.error ?? 'No se pudo registrar la autorización.')
      setGuardian(data.authorization); setAuthorized(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar la autorización.') }
    finally { setBusy(false) }
  }

  async function revokeGuardian() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/guardian-authorization', { method: 'DELETE' })
      if (!response.ok) throw new Error('No se pudo revocar la autorización.')
      setGuardian((current) => current ? { ...current, verifiedAt: null, revokedAt: new Date().toISOString() } : null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo revocar la autorización.') }
    finally { setBusy(false) }
  }

  async function verifyGuardian(item: GuardianRequest) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/guardian-authorizations/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: item.userId, evidenceReference: evidence[item.userId] }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la verificación.')
      setGuardianPending((current) => current.filter((request) => request.userId !== item.userId))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la verificación.') }
    finally { setBusy(false) }
  }

  async function requestDeletion() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/account/data-deletion-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) })
      const data = await response.json() as { request?: DeletionRequest; error?: string }
      if (!response.ok || !data.request) throw new Error(data.error ?? 'No se pudo registrar la solicitud.')
      setRequest(data.request)
      setConfirmation('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar la solicitud.') }
    finally { setBusy(false) }
  }

  async function completeDeletion(item: { id: string; userId: string }) {
    if (!window.confirm('Esta acción anonimiza la cuenta y elimina sus credenciales. ¿Continuar?')) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/data-deletion-requests/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: item.id, userId: item.userId }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo completar el borrado.')
      setPending((current) => current.filter((request) => request.id !== item.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar el borrado.') }
    finally { setBusy(false) }
  }

  return <section className="account-admin" aria-labelledby="data-privacy-title">
    <header><div><span className="eyebrow">DATOS PERSONALES</span><h3 id="data-privacy-title">Privacidad y borrado</h3></div></header>
    <p>Tu cuenta guarda nombre, usuario, credenciales de acceso y, si las configuraste, claves de autenticación. Las tareas, mensajes y registros de actividad pueden contener datos que ingresaste.</p>
    <p>Solicita la revisión y el borrado de tus datos asociados a la cuenta. El equipo deberá revisar los registros compartidos y las obligaciones de conservación antes de completar la solicitud.</p>
    {request?.status === 'pending' ? <p role="status">Solicitud recibida el {new Date(request.createdAt).toLocaleDateString('es-CO')}. Estado: pendiente.</p> : <>
      <label className="mfa-field">Escribe SOLICITAR BORRADO para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      <button type="button" className="account-save" disabled={busy || confirmation !== 'SOLICITAR BORRADO'} onClick={() => void requestDeletion()}>{busy ? 'Enviando…' : 'Solicitar borrado de mis datos'}</button>
    </>}
    {error && <p role="alert">{error}</p>}
    {admin && <div><h4>Solicitudes pendientes de cuentas</h4>{pending.length ? <ul>{pending.map((item) => <li key={item.id}>{item.name} (@{item.username}), {new Date(item.createdAt).toLocaleDateString('es-CO')} <button type="button" className="account-save" disabled={busy} onClick={() => void completeDeletion(item)}>Completar borrado</button></li>)}</ul> : <p>No hay solicitudes pendientes.</p>}</div>}
    <div><h4>Datos de menores</h4><p>Si registras información de una persona menor de edad, identifica tu vínculo y autoriza expresamente su tratamiento para coordinar tareas de familia, salud o educación. Un administrador debe verificar tu representación antes de habilitar esos dominios en una cuenta de cliente. No ingreses aquí nombres ni documentos del menor.</p>
      {guardian && !guardian.revokedAt ? <><p role="status">Autorización de {guardian.guardianName} ({guardian.relationship}): {guardian.verifiedAt ? 'verificada' : 'pendiente de verificación'}.</p><button type="button" className="mfa-disable-button" disabled={busy} onClick={() => void revokeGuardian()}>Revocar autorización</button></> : <>
        <label className="mfa-field">Nombre del representante<input maxLength={120} value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
        <label className="mfa-field">Vínculo<select value={relationship} onChange={(event) => setRelationship(event.target.value)}><option value="">Selecciona</option><option value="madre">Madre</option><option value="padre">Padre</option><option value="representante legal">Representante legal</option></select></label>
        <label className="terms-check"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> Confirmo mi representación y autorizo el tratamiento necesario de datos del menor conforme a la política de privacidad.</label>
        <button type="button" className="account-save" disabled={busy || guardianName.trim().length < 3 || !relationship || !authorized} onClick={() => void sendGuardianAuthorization()}>Solicitar verificación</button>
      </>}
    </div>
    {admin && <div><h4>Verificación parental pendiente</h4><p>Comprueba la representación por un canal separado y registra solo una referencia interna; no adjuntes documentos del menor.</p>{guardianPending.length ? <ul>{guardianPending.map((item) => <li key={item.userId}><strong>{item.guardianName}</strong> (@{item.username}, {item.relationship}) <label className="mfa-field">Referencia de comprobación<input value={evidence[item.userId] ?? ''} maxLength={200} onChange={(event) => setEvidence((current) => ({ ...current, [item.userId]: event.target.value }))} /></label><button type="button" className="account-save" disabled={busy || (evidence[item.userId]?.trim().length ?? 0) < 8} onClick={() => void verifyGuardian(item)}>Marcar verificado</button></li>)}</ul> : <p>No hay verificaciones pendientes.</p>}</div>}
  </section>
}
