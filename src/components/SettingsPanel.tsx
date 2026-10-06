import { useEffect, useState, type FormEvent } from 'react'
import { Download, Fingerprint, Link2, LogOut, ShieldCheck, Smartphone, Trash2, UserPlus } from 'lucide-react'

const domainOptions = [
  ['agency', 'Agencia'], ['personal', 'Personal'], ['family', 'Familia'], ['health', 'Salud'],
  ['education', 'Educación'], ['church', 'Iglesia'], ['learning', 'Aprendizaje'], ['wellbeing', 'Bienestar'],
  ['projects', 'Proyectos'], ['technology', 'Tecnología'], ['finance', 'Finanzas'], ['knowledge', 'Conocimiento'],
  ['product', 'Producto'], ['messaging', 'Mensajería'], ['sales', 'Ventas'], ['marketing', 'Marketing'], ['legal', 'Legal'],
] as const
type Role = 'viewer' | 'operator' | 'approver' | 'admin'
type Account = { id: string; username: string; name: string; role: Role; domains: string[]; active: boolean; password?: string }
type DeploymentVersion = { sourceCommit: string; branch: string }
type PasskeyRecord = { id: string; label: string; createdAt: string }
type Props = { onLogout: () => void; installed: boolean; canInstall: boolean; onInstall: () => void; role?: Role; userId?: string; mfaEnabled?: boolean; mfaManaged?: boolean }

const roleLabels: Record<Role, string> = { viewer: 'Lector', operator: 'Operador', approver: 'Aprobador', admin: 'Administrador' }

export function SettingsPanel({ onLogout, installed, canInstall, onInstall, role, userId, mfaEnabled = false, mfaManaged = false }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [draft, setDraft] = useState({ username: '', name: '', password: '', role: 'viewer' as Role, domains: ['agency'] as string[] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mfaActive, setMfaActive] = useState(mfaEnabled)
  const [mfaStored, setMfaStored] = useState(mfaManaged)
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaUri, setMfaUri] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [currentCode, setCurrentCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [deploymentVersion, setDeploymentVersion] = useState<DeploymentVersion | null>(null)
  const [versionError, setVersionError] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([])
  const [passkeyLabel, setPasskeyLabel] = useState('Este dispositivo')
  const [passkeyPassword, setPasskeyPassword] = useState('')
  const [passkeyCode, setPasskeyCode] = useState('')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [removePasskeyId, setRemovePasskeyId] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/version').then(async (response) => {
      if (!response.ok) throw new Error('Version unavailable')
      return await response.json() as DeploymentVersion
    }).then((data) => { if (!cancelled) { setDeploymentVersion(data); setVersionError(false) } }).catch(() => { if (!cancelled) setVersionError(true) })
    return () => { cancelled = true }
  }, [])

  async function loadAccounts() {
    const response = await fetch('/api/admin/users')
    const data = await response.json() as { users?: Account[]; error?: string }
    if (!response.ok || !data.users) throw new Error(data.error ?? 'No se pudieron cargar las cuentas.')
    setAccounts(data.users)
  }

  useEffect(() => {
    if (role === 'admin') void loadAccounts().catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las cuentas.'))
  }, [role])

  useEffect(() => { setMfaActive(mfaEnabled) }, [mfaEnabled])
  useEffect(() => { setMfaStored(mfaManaged) }, [mfaManaged])

  async function loadPasskeys() {
    const response = await fetch('/api/auth/passkeys')
    const data = await response.json() as { passkeys?: PasskeyRecord[]; error?: string }
    if (!response.ok || !data.passkeys) throw new Error(data.error ?? 'No se pudieron cargar las passkeys.')
    setPasskeys(data.passkeys)
  }

  useEffect(() => {
    if (userId) void loadPasskeys().catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las passkeys.'))
  }, [userId])

  async function addPasskey() {
    setPasskeyBusy(true); setError(''); setNotice('')
    try {
      const optionsResponse = await fetch('/api/auth/passkeys/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passkeyPassword, mfaCode: passkeyCode }) })
      const optionsData = await optionsResponse.json() as { stateId?: string; options?: Parameters<(typeof import('@simplewebauthn/browser'))['startRegistration']>[0]['optionsJSON']; error?: string }
      if (!optionsResponse.ok || !optionsData.stateId || !optionsData.options) throw new Error(optionsData.error ?? 'No se pudo preparar la passkey.')
      const { startRegistration } = await import('@simplewebauthn/browser')
      const response = await startRegistration({ optionsJSON: optionsData.options })
      const verifyResponse = await fetch('/api/auth/passkeys/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stateId: optionsData.stateId, response, label: passkeyLabel }) })
      const data = await verifyResponse.json() as { passkey?: PasskeyRecord; error?: string }
      if (!verifyResponse.ok || !data.passkey) throw new Error(data.error ?? 'No se pudo guardar la passkey.')
      setPasskeys((current) => [...current, data.passkey!])
      setPasskeyPassword(''); setPasskeyCode('')
      setNotice(`Passkey “${data.passkey.label}” registrada.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo registrar la passkey.') }
    finally { setPasskeyBusy(false) }
  }

  async function removePasskey(id: string) {
    setPasskeyBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passkeyPassword, mfaCode: passkeyCode }) })
      const data = await response.json() as { removed?: boolean; error?: string }
      if (!response.ok || !data.removed) throw new Error(data.error ?? 'No se pudo eliminar la passkey.')
      setPasskeys((current) => current.filter((passkey) => passkey.id !== id))
      setPasskeyPassword(''); setPasskeyCode(''); setRemovePasskeyId('')
      setNotice('Passkey eliminada.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la passkey.') }
    finally { setPasskeyBusy(false) }
  }

  async function startMfaSetup() {
    setMfaBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/auth/mfa/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentCode }) })
      const data = await response.json() as { secret?: string; uri?: string; error?: string }
      if (!response.ok || !data.secret || !data.uri) throw new Error(data.error ?? 'No se pudo preparar MFA.')
      setMfaSecret(data.secret); setMfaUri(data.uri); setMfaCode('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar MFA.') }
    finally { setMfaBusy(false) }
  }

  async function confirmMfaSetup() {
    setMfaBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/auth/mfa/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: mfaCode }) })
      const data = await response.json() as { mfaEnabled?: boolean; error?: string }
      if (!response.ok || !data.mfaEnabled) throw new Error(data.error ?? 'No se pudo confirmar MFA.')
      window.location.reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo confirmar MFA.') }
    finally { setMfaBusy(false) }
  }

  async function disableMfa() {
    setMfaBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/auth/mfa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: currentPassword, code: currentCode }) })
      const data = await response.json() as { mfaEnabled?: boolean; error?: string }
      if (!response.ok || data.mfaEnabled !== false) throw new Error(data.error ?? 'No se pudo desactivar MFA.')
      setMfaActive(false); setMfaStored(false); setCurrentPassword(''); setCurrentCode(''); setNotice('MFA desactivado para esta cuenta.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo desactivar MFA.') }
    finally { setMfaBusy(false) }
  }

  async function copyMfaSecret() {
    try { await navigator.clipboard.writeText(mfaSecret); setNotice('Clave copiada. Elimínala del portapapeles después de guardarla.') }
    catch { setError('No se pudo copiar. Selecciona y copia la clave manualmente.') }
  }

  function toggleDraftDomain(domain: string) {
    setDraft((current) => ({ ...current, domains: current.domains.includes(domain) ? current.domains.filter((item) => item !== domain) : [...current.domains, domain] }))
  }

  function updateAccount(id: string, update: Partial<Account>) {
    setAccounts((current) => current.map((account) => account.id === id ? { ...account, ...update } : account))
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const data = await response.json() as { user?: Account; error?: string }
      if (!response.ok || !data.user) throw new Error(data.error ?? 'No se pudo crear la cuenta.')
      setAccounts((current) => [...current, data.user!].sort((left, right) => left.name.localeCompare(right.name)))
      setDraft({ username: '', name: '', password: '', role: 'viewer', domains: ['agency'] })
      setNotice(`Cuenta ${data.user.username} creada.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la cuenta.') }
    finally { setBusy(false) }
  }

  async function saveAccount(account: Account) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(account.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: account.name, role: account.role, domains: account.domains, active: account.active, ...(account.password ? { password: account.password } : {}) }) })
      const data = await response.json() as { user?: Account; error?: string }
      if (!response.ok || !data.user) throw new Error(data.error ?? 'No se pudieron guardar los cambios.')
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...data.user!, password: '' } : item))
      setNotice(`Cambios de ${account.username} guardados.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.') }
    finally { setBusy(false) }
  }

  return <section className="settings-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">CONTROL DEL SISTEMA</span><h2>Configuración</h2></div><button className="logout-button" onClick={onLogout}><LogOut size={15} /> Salir</button></div>
    <div className="settings-list">
      <div className="settings-row"><ShieldCheck size={19} /><div><strong>Sesión protegida</strong><p>Tu sesión usa una cookie HttpOnly.</p></div><span className="settings-status online">Activa</span></div>
      <div className="settings-row"><Link2 size={19} /><div><strong>Hermes</strong><p>Conectado mediante el MCP remoto protegido de Synapse.</p></div><span className="settings-status online">Activo</span></div>
      <div className="settings-row"><Smartphone size={19} /><div><strong>Aplicación móvil</strong><p>{installed ? 'Synapse está instalada en este dispositivo.' : canInstall ? 'Instala Synapse con su icono y ventana independiente.' : 'En iPhone usa Compartir y Añadir a pantalla de inicio. En Android usa el menú e Instalar aplicación.'}</p></div>{installed ? <span className="settings-status online">Instalada</span> : canInstall ? <button className="install-app-button" onClick={onInstall}><Download size={14} /> Instalar</button> : <span className="settings-status">Disponible</span>}</div>
    </div>
    {userId && <section className="mfa-control" aria-labelledby="mfa-control-title">
      <header><div><span className="eyebrow">SEGURIDAD DE LA CUENTA</span><h3 id="mfa-control-title">Autenticación de dos pasos</h3></div><span className={mfaActive ? 'settings-status online' : 'settings-status'}>{mfaActive ? 'Activa' : 'Inactiva'}</span></header>
      <p>Vincula un autenticador a esta cuenta. La clave se guarda cifrada en el servidor.</p>
      {!mfaActive && !mfaSecret && <><label className="mfa-field">Código actual, si tu cuenta ya usa MFA<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={currentCode} onChange={(event) => setCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="account-save" disabled={mfaBusy} onClick={() => void startMfaSetup()}>{mfaBusy ? 'Preparando…' : 'Configurar MFA'}</button></>}
      {!mfaActive && mfaSecret && <div className="mfa-enrollment"><p>Agrega esta clave en tu aplicación autenticadora y confirma con el código de seis dígitos.</p><label className="mfa-field">Clave de configuración<input readOnly value={mfaSecret} onFocus={(event) => event.currentTarget.select()} /></label><button className="mfa-copy" onClick={() => void copyMfaSecret()}>Copiar clave</button><details><summary>URI para autenticador</summary><code>{mfaUri}</code></details><label className="mfa-field">Código del autenticador<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><div className="mfa-actions"><button className="mfa-copy" disabled={mfaBusy} onClick={() => { setMfaSecret(''); setMfaUri(''); setMfaCode('') }}>Cancelar</button><button className="account-save" disabled={mfaBusy || mfaCode.length !== 6} onClick={() => void confirmMfaSetup()}>{mfaBusy ? 'Confirmando…' : 'Confirmar MFA'}</button></div></div>}
      {mfaActive && !mfaStored && <p className="mfa-legacy-note">Este MFA se administra con <code>SYNAPSE_OWNER_TOTP_SECRET</code>. Para administrar MFA individual, configura <code>SYNAPSE_TOTP_ENCRYPTION_KEY</code> en el servidor y reinícialo.</p>}
      {mfaActive && mfaStored && <div className="mfa-disable"><label className="mfa-field">Contraseña actual<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="mfa-field">Código actual<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={currentCode} onChange={(event) => setCurrentCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button className="mfa-disable-button" disabled={mfaBusy || !currentPassword || currentCode.length !== 6} onClick={() => void disableMfa()}>{mfaBusy ? 'Verificando…' : 'Desactivar MFA'}</button></div>}
    </section>}
    {userId && <section className="passkey-control" aria-labelledby="passkey-control-title">
      <header><div><span className="eyebrow">INICIO SIN CONTRASEÑA</span><h3 id="passkey-control-title">Passkeys y huella</h3></div><span className={passkeys.length ? 'settings-status online' : 'settings-status'}>{passkeys.length} registradas</span></header>
      <p>La huella o Windows Hello se guarda en el dispositivo. Synapse conserva solo la clave pública. Para añadir o quitar una passkey confirma tu contraseña y código 2FA.</p>
      {!mfaActive && <p className="mfa-legacy-note">Activa 2FA antes de registrar una passkey.</p>}
      {passkeys.map((passkey) => <article className="passkey-row" key={passkey.id}><Fingerprint size={16} /><div><strong>{passkey.label}</strong><small>Registrada {new Date(passkey.createdAt).toLocaleDateString('es-CO')}</small></div>{removePasskeyId === passkey.id ? <button type="button" className="passkey-remove confirm" disabled={passkeyBusy || !passkeyPassword || passkeyCode.length !== 6} onClick={() => void removePasskey(passkey.id)}>Confirmar</button> : <button type="button" className="passkey-remove" disabled={passkeyBusy} onClick={() => setRemovePasskeyId(passkey.id)}><Trash2 size={14} /> Quitar</button>}</article>)}
      {mfaActive && <div className="passkey-enroll"><label className="mfa-field">Nombre<input value={passkeyLabel} maxLength={80} onChange={(event) => setPasskeyLabel(event.target.value)} /></label><label className="mfa-field">Contraseña actual<input type="password" autoComplete="current-password" value={passkeyPassword} onChange={(event) => setPasskeyPassword(event.target.value)} /></label><label className="mfa-field">Código actual 2FA<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={passkeyCode} onChange={(event) => setPasskeyCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button type="button" className="account-save" disabled={passkeyBusy || !passkeyPassword || passkeyCode.length !== 6 || !passkeyLabel.trim()} onClick={() => void addPasskey()}>{passkeyBusy ? 'Esperando dispositivo…' : 'Registrar passkey en este dispositivo'}</button></div>}
    </section>}
    {role === 'admin' && <section className="account-admin" aria-labelledby="account-admin-title">
      <header><div><span className="eyebrow">ACCESO Y ALCANCE</span><h3 id="account-admin-title">Cuentas</h3></div><span>{accounts.filter((account) => account.active).length} activas</span></header>
      <p className="account-intro">Cada persona recibe un rol y acceso a dominios concretos. Los cambios se aplican en las solicitudes siguientes.</p>
      <form className="account-create" onSubmit={(event) => void createAccount(event)}>
        <strong><UserPlus size={15} /> Nueva cuenta</strong>
        <div className="account-fields"><label>Nombre<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>Usuario<input required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} /></label><label>Contraseña<input required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /><small>Mínimo 12 caracteres.</small></label><label>Rol<select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <div className="domain-access"><span>Dominios</span><div>{domainOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.domains.includes(value)} onChange={() => toggleDraftDomain(value)} />{label}</label>)}</div></div>
        <button className="account-save" type="submit" disabled={busy || draft.domains.length === 0}>{busy ? 'Guardando…' : 'Crear cuenta'}</button>
      </form>
      <div className="account-list">{accounts.map((account) => <article className="account-card" key={account.id}>
        <header><div><strong>{account.name}</strong><small>@{account.username}</small></div><label className="account-active"><input type="checkbox" checked={account.active} onChange={(event) => updateAccount(account.id, { active: event.target.checked })} /> Activa</label></header>
        <div className="account-fields"><label>Nombre<input value={account.name} maxLength={120} onChange={(event) => updateAccount(account.id, { name: event.target.value })} /></label><label>Rol<select value={account.role} onChange={(event) => updateAccount(account.id, { role: event.target.value as Role })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="account-password">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={256} placeholder="Sin cambios" value={account.password ?? ''} onChange={(event) => updateAccount(account.id, { password: event.target.value })} /></label></div>
        <div className="domain-access"><span>Dominios</span><div>{domainOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={account.domains.includes(value)} onChange={() => updateAccount(account.id, { domains: account.domains.includes(value) ? account.domains.filter((domain) => domain !== value) : [...account.domains, value] })} />{label}</label>)}</div></div>
        <button className="account-save" disabled={busy || account.domains.length === 0 || Boolean(account.password && account.password.length < 12)} onClick={() => void saveAccount(account)}>Guardar cambios</button>
      </article>)}</div>
    </section>}
    <section className="deployment-version" aria-labelledby="deployment-version-title">
      <header><div><span className="eyebrow">CONTROL DE VERSIONES</span><h3 id="deployment-version-title">Versión online</h3></div><span className={deploymentVersion?.sourceCommit && deploymentVersion.sourceCommit !== 'unknown' ? 'settings-status online' : 'settings-status'}>{deploymentVersion?.sourceCommit && deploymentVersion.sourceCommit !== 'unknown' ? 'Identificada' : 'Sin identificar'}</span></header>
      {deploymentVersion?.sourceCommit && deploymentVersion.sourceCommit !== 'unknown' ? <dl><div><dt>Commit</dt><dd title={deploymentVersion.sourceCommit}>{deploymentVersion.sourceCommit}</dd></div><div><dt>Rama</dt><dd>{deploymentVersion.branch}</dd></div></dl> : <p>{versionError ? 'No se pudo consultar la versión del servidor.' : 'Coolify aún no está enviando el commit al contenedor.'}</p>}
      <small>Compárala con el commit del despliegue en Coolify. Si no coincide, esta versión no está online.</small>
    </section>
    {(error || notice) && <div className={`account-feedback${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    <div className="settings-note">Las respuestas internas están habilitadas. Correo, WhatsApp, calendarios, campañas y producción permanecen bloqueados hasta contar con aprobación y auditoría.</div>
  </section>
}
