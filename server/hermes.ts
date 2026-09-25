import type { AgentId, Domain, MessageRecord, RouteDecision } from './types.js'

const hermesApiUrl = process.env.HERMES_API_URL?.trim().replace(/\/+$/, '')
const hermesCredential = process.env['HERMES_API_KEY']?.trim()
const timeoutMs = Number(process.env.HERMES_API_TIMEOUT_MS ?? 90000)

export function isHermesConfigured(): boolean {
  return Boolean(hermesApiUrl && hermesCredential)
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
  ].join('\n')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hermesCredential}`,
      'Content-Type': 'application/json',
      'X-Hermes-Session-Key': `synapse:${input.conversationAgentId}`,
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      stream: false,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: 'Eres LuciaBot, gerente y orquestadora de Dmente Synapse. Responde en español, de forma breve y operativa. Comprende el caso, usa herramientas autorizadas si aportan información, asigna el especialista adecuado y devuelve hallazgos, acción siguiente y si requiere aprobación. No inventes accesos ni resultados. No envíes mensajes, correos, pagos, campañas ni cambios de producción sin aprobación explícita. No reveles secretos.',
        },
        { role: 'system', content: coordination },
        ...context,
      ],
    }),
    signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 90000),
  })
  if (!response.ok) throw new Error(`Hermes API respondió ${response.status}`)
  const payload = await response.json() as ChatCompletion
  const reply = payload.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error('Hermes API devolvió una respuesta vacía')
  return reply
}
