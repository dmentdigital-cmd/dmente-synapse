const baseValue = process.env.COOLIFY_BASE_URL?.trim()
const token = process.env.COOLIFY_API_TOKEN?.trim()
const uuid = process.env.COOLIFY_APPLICATION_UUID?.trim()
const deploy = process.argv.includes('--deploy')

if (!baseValue || !token || !uuid) {
  console.error('Faltan COOLIFY_BASE_URL, COOLIFY_API_TOKEN o COOLIFY_APPLICATION_UUID. Configúralos como secretos fuera del repositorio.')
  process.exit(2)
}

let base
try {
  const parsed = new URL(baseValue)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('URL insegura')
  base = `${parsed.origin}${parsed.pathname.replace(/\/(api\/v1)?\/?$/, '')}/api/v1`
} catch {
  console.error('COOLIFY_BASE_URL debe ser una URL HTTPS válida del panel de Coolify.')
  process.exit(2)
}
if (!/^[a-zA-Z0-9_-]+$/.test(uuid)) {
  console.error('COOLIFY_APPLICATION_UUID no tiene un formato válido.')
  process.exit(2)
}

async function request(path, method = 'GET') {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Coolify respondió HTTP ${response.status}: ${String(payload.message ?? 'Solicitud rechazada')}`)
  return payload
}

try {
  const app = await request(`/applications/${encodeURIComponent(uuid)}`)
  if (app.uuid !== uuid || !/dmente[-_ ]?synapse/i.test(`${app.name ?? ''} ${app.git_repository ?? ''}`)) throw new Error('El UUID no corresponde a la aplicación Dmente Synapse. Se canceló la operación.')
  console.log(`Aplicación verificada: ${app.name} (${app.uuid}); rama: ${app.git_branch ?? 'no informada'}`)
  if (!deploy) {
    console.log('Verificación de lectura terminada. Usa --deploy para solicitar el despliegue.')
    process.exit(0)
  }
  const result = await request(`/deploy?uuid=${encodeURIComponent(uuid)}`, 'POST')
  const entries = Array.isArray(result.deployments) ? result.deployments : []
  if (!entries.length) throw new Error('Coolify no devolvió un identificador de despliegue; revisa el panel.')
  for (const entry of entries) console.log(`Despliegue solicitado: ${entry.deployment_uuid ?? 'sin UUID'}; ${entry.message ?? ''}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la solicitud a Coolify.')
  process.exitCode = 1
}
