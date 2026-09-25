import type { AgentId, Domain, MessageRecord, RouteDecision } from './types.js'

const hermesApiUrl = process.env.HERMES_API_URL?.trim().replace(/\/+$/, '')
const hermesCredential = process.env['HERMES_API_KEY']?.trim()
const timeoutMs = Math.max(Number(process.env.HERMES_API_TIMEOUT_MS ?? 180000), 180000)
let lastHermesError: string | null = null

export function isHermesConfigured(): boolean {
  return Boolean(hermesApiUrl && hermesCredential)
}

export async function getHermesStatus(): Promise<{ configured: boolean; reachable: boolean; lastError: string | null }> {
  if (!hermesApiUrl || !hermesCredential) return { configured: false, reachable: false, lastError: 'Configuración incompleta' }
  const healthEndpoint = `${hermesApiUrl.replace(/\/v1$/, '')}/health`
  try {
    const response = await fetch(healthEndpoint, { signal: AbortSignal.timeout(5000) })
    return { configured: true, reachable: response.ok, lastError: response.ok ? lastHermesError : `Health HTTP ${response.status}` }
  } catch (error) {
    return { configured: true, reachable: false, lastError: error instanceof Error ? error.message : 'No se pudo contactar Hermes' }
  }
}

type HermesReplyInput = {
  requestId: string
  conversationAgentId: AgentId
  assignedAgentId: AgentId
  domain: Domain
  projectId: string | null
  priority: RouteDecision['priority']
  riskLevel: RouteDecision['riskLevel']
  requiresApproval: boolean
  nextAction: string
  obsidianNote?: string | null
  sourcePath?: string | null
  sourceDriveFolder?: string | null
  history: MessageRecord[]
}

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>
}

export async function requestHermesReply(input: HermesReplyInput): Promise<string> {
  if (!hermesApiUrl || !hermesCredential) throw new Error('Hermes API no configurada')
  const endpoint = hermesApiUrl.endsWith('/v1') ? `${hermesApiUrl}/chat/completions` : `${hermesApiUrl}/v1/chat/completions`
  const context = input.history.slice(-6).map((message) => ({
    role: message.direction === 'agent' ? 'assistant' : 'user',
    content: message.text.slice(0, 2000),
  }))
  const coordination = [
    `Solicitud Synapse: ${input.requestId}`,
    `Agente asignado: ${input.assignedAgentId}`,
    `Dominio: ${input.domain}`,
    `Proyecto: ${input.projectId ?? 'sin definir'}`,
    `Prioridad: ${input.priority}`,
    `Riesgo: ${input.riskLevel}`,
    `Requiere aprobación: ${input.requiresApproval ? 'sí' : 'no'}`,
    `Próxima acción sugerida: ${input.nextAction}`,
    `Nota Obsidian: ${input.obsidianNote ?? 'sin definir'}`,
    `Estado o fuente local: ${input.sourcePath ?? 'sin definir'}`,
    `Carpeta Drive: ${input.sourceDriveFolder ?? 'sin definir'}`,
  ].join('\n')
  const requestBody = JSON.stringify({
      model: 'hermes-agent',
      stream: false,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: 'Eres LuciaBot, gerente y orquestadora de Dmente Synapse. Responde en español, breve y operativa. Comprende el caso, asigna el especialista y devuelve hallazgos, siguiente acción y aprobación requerida. Para conocimiento o documentación, busca primero en /home/diego/Obsidian con search_files, lee solo notas relevantes con read_file y cita la ruta usada. Para estado de proyecto, consulta el archivo Markdown canónico indicado. No leas todo el vault, no copies documentos largos a memoria y no inventes accesos ni resultados. Solo crea o actualiza una nota cuando haya conocimiento estable que conservar, sin guardar secretos. No envíes mensajes, correos, pagos, campañas ni cambios de producción sin aprobación explícita.',
        },
        { role: 'system', content: coordination },
        ...context,
      ],
  })
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hermesCredential}`, 'Content-Type': 'application/json', 'X-Hermes-Session-Key': `synapse:${input.conversationAgentId}` },
        body: requestBody,
        signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 180000),
      })
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240)
        throw new Error(`Hermes API respondió ${response.status}${detail ? `: ${detail}` : ''}`)
      }
      const payload = await response.json() as ChatCompletion
      const reply = payload.choices?.[0]?.message?.content?.trim()
      if (!reply) throw new Error('Hermes API devolvió una respuesta vacía')
      lastHermesError = null
      return reply
    } catch (error) {
      lastHermesError = error instanceof Error ? error.message : 'Fallo desconocido de Hermes'
      if (attempt === 2 || /respondió 4\d\d/.test(lastHermesError)) throw error
    }
  }
  throw new Error(lastHermesError ?? 'Hermes no respondió')
}
