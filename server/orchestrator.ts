import type { AgentId, Domain, RouteDecision } from './types.js'

const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(word))

export function routeRequest(rawText: string): RouteDecision {
  const text = rawText.toLowerCase()
  if (includesAny(text, ['contrato', 'cláusula', 'legal', 'riesgo jurídico'])) return { agentId: 'legal', domain: 'agency', urgency: 'normal', riskLevel: 'medium', requiresApproval: false, reason: 'La solicitud contiene lenguaje contractual o de riesgo.' }
  if (includesAny(text, ['campaña', 'meta ads', 'anuncio', 'marketing', 'ga4', 'clarity'])) return { agentId: 'marketing', domain: 'agency', urgency: 'normal', riskLevel: 'medium', requiresApproval: includesAny(text, ['publica', 'pausa', 'activa', 'presupuesto']), reason: 'La solicitud se relaciona con campañas o métricas.' }
  if (includesAny(text, ['lead', 'prospecto', 'venta', 'cliente nuevo', 'propuesta comercial'])) return { agentId: 'ventas', domain: 'agency', urgency: 'normal', riskLevel: includesAny(text, ['envía', 'enviar', 'precio']) ? 'medium' : 'low', requiresApproval: includesAny(text, ['envía', 'enviar', 'precio']), reason: 'La solicitud se relaciona con una oportunidad comercial.' }
  if (includesAny(text, ['médic', 'doctor', 'ejercicio', 'leer', 'lectura', 'bienestar'])) return { agentId: 'secretaria', domain: 'wellbeing', urgency: 'normal', riskLevel: 'low', requiresApproval: false, reason: 'La solicitud se relaciona con salud, hábitos o bienestar personal.' }
  if (includesAny(text, ['lucía', 'cumpleaños', 'colegio', 'parque', 'cine', 'viaje', 'esposa', 'familia'])) return { agentId: 'secretaria', domain: 'family', urgency: 'normal', riskLevel: 'low', requiresApproval: false, reason: 'La solicitud se relaciona con familia y compromisos personales.' }
  if (includesAny(text, ['iglesia', 'prédica', 'pastor', 'presentación'])) return { agentId: 'secretaria', domain: 'church', urgency: 'normal', riskLevel: 'low', requiresApproval: false, reason: 'La solicitud se relaciona con iglesia o servicio comunitario.' }
  return { agentId: 'gerente', domain: 'agency', urgency: 'normal', riskLevel: 'low', requiresApproval: false, reason: 'LuciaBot coordina la solicitud porque no hay una ruta más específica.' }
}

export function buildReply(decision: RouteDecision, text: string): string {
  const labels: Record<AgentId, string> = { secretaria: 'Secretaria', legal: 'Legal', marketing: 'Marketing', ventas: 'Ventas', gerente: 'LuciaBot' }
  const domainLabels: Record<Domain, string> = { agency: 'agencia', personal: 'vida personal', family: 'familia', health: 'salud', education: 'educación', church: 'iglesia', learning: 'aprendizaje', wellbeing: 'bienestar' }
  return `LuciaBot clasificó la solicitud en ${domainLabels[decision.domain]} y la asignó a ${labels[decision.agentId]}. ${decision.reason} La solicitud quedó registrada para seguimiento.`
}
