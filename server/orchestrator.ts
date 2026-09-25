import type { AgentId, Domain, RouteDecision } from './types.js'

const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(word))
const approvalWords = ['envía', 'enviar', 'publica', 'publicar', 'cambia', 'modifica', 'paga', 'pagar', 'deploy', 'despliegue', 'producción', 'webhook', 'commit', 'push']

type Rule = {
  words: string[]
  agentId: AgentId
  domain: Domain
  projectId?: string
  riskLevel?: RouteDecision['riskLevel']
  priority?: RouteDecision['priority']
  reason: string
  nextAction: string
  alwaysApproval?: boolean
}

const rules: Rule[] = [
  { words: ['colegio', 'boletín', 'uniforme', 'tarea escolar', 'reunión de padres'], agentId: 'colegio-lucia', domain: 'education', projectId: 'colegio-lucia', priority: 'high', reason: 'Corresponde al entorno escolar de Lucía.', nextAction: 'Extraer fecha, lugar y acción requerida.' },
  { words: ['cita médica', 'medicamento', 'fórmula', 'examen médico', 'salud de lucía', 'salud de tania'], agentId: 'salud-familiar', domain: 'health', projectId: 'salud-familiar', priority: 'high', reason: 'Contiene información de salud familiar.', nextAction: 'Registrar solo los datos mínimos y el recordatorio.' },
  { words: ['presupuesto familiar', 'pago familiar', 'gasto familiar', 'mensualidad', 'matrícula'], agentId: 'finanzas-familiares', domain: 'finance', projectId: 'finanzas-familiares', reason: 'Corresponde a finanzas personales o familiares.', nextAction: 'Registrar monto, fecha y estado sin ejecutar pagos.', alwaysApproval: true },
  { words: ['platzi', 'uemi', 'curso', 'certificación', 'ruta de aprendizaje', 'comunidad school'], agentId: 'educacion-aprendizaje', domain: 'learning', projectId: 'formacion-dmente', reason: 'Corresponde a aprendizaje continuo.', nextAction: 'Definir idea útil, aplicación Dmente y próxima acción.' },
  { words: ['obsidian', 'base de conocimiento', 'wiki', 'documentación', 'procedimiento', 'índice de notas'], agentId: 'conocimiento-obsidian', domain: 'knowledge', projectId: 'conocimiento-dmente', reason: 'Corresponde a memoria externa y documentación.', nextAction: 'Actualizar el estado canónico evitando duplicados.' },
  { words: ['producto vértice', 'vertice crm', 'vértice crm', 'número oficial', 'crm vértice'], agentId: 'producto-vertice', domain: 'product', projectId: 'vertice', riskLevel: 'medium', reason: 'Corresponde al producto Vértice.', nextAction: 'Preparar propuesta de producto y validar dependencias.' },
  { words: ['producto synapse', 'agentes synapse', 'ui synapse', 'mcp synapse', 'solicitudes synapse'], agentId: 'producto-synapse', domain: 'product', projectId: 'dmente-synapse', riskLevel: 'medium', reason: 'Corresponde al producto Dmente Synapse.', nextAction: 'Definir cambio, criterio de aceptación y prueba.' },
  { words: ['whatsapp', 'chat comercial', 'conversación comercial', 'no_contactar'], agentId: 'whatsapp-conversaciones', domain: 'messaging', projectId: 'whatsapp-dmente', riskLevel: 'medium', reason: 'Corresponde a mensajería y clasificación de conversaciones.', nextAction: 'Clasificar y preparar un borrador para aprobación.' },
  { words: ['contrato', 'cláusula', 'legal', 'riesgo jurídico', 'privacidad', 'cumplimiento'], agentId: 'legal', domain: 'legal', riskLevel: 'medium', reason: 'Contiene lenguaje contractual, de privacidad o cumplimiento.', nextAction: 'Preparar análisis preventivo y puntos de riesgo.' },
  { words: ['campaña', 'meta ads', 'anuncio', 'marketing', 'ga4', 'clarity', 'contenido'], agentId: 'marketing', domain: 'marketing', riskLevel: 'medium', reason: 'Se relaciona con campañas, contenido o métricas.', nextAction: 'Preparar análisis y recomendación interna.' },
  { words: ['lead', 'prospecto', 'venta', 'cliente nuevo', 'propuesta comercial', 'pipeline'], agentId: 'ventas', domain: 'sales', reason: 'Se relaciona con una oportunidad comercial.', nextAction: 'Calificar oportunidad y preparar seguimiento.' },
  { words: ['código', 'bug', 'error', 'repositorio', 'github', 'coolify', 'deploy', 'despliegue', 'mcp', 'integración', 'docker', 'prueba técnica'], agentId: 'tecnico', domain: 'technology', riskLevel: 'medium', reason: 'Se relaciona con desarrollo, integraciones o infraestructura.', nextAction: 'Diagnosticar y proponer cambio verificable.' },
  { words: ['cobro', 'factura', 'facturación', 'rentabilidad', 'cuenta por cobrar', 'finanzas dmente'], agentId: 'finanzas-dmente', domain: 'finance', projectId: 'finanzas-dmente', riskLevel: 'medium', reason: 'Se relaciona con finanzas de la agencia.', nextAction: 'Registrar estado, fecha y acción de seguimiento.', alwaysApproval: true },
  { words: ['proyecto', 'pendiente', 'prioridad', 'bitácora', 'pmo', 'estado semanal', 'próximo paso'], agentId: 'pmo', domain: 'projects', reason: 'Se relaciona con organización y seguimiento de proyectos.', nextAction: 'Actualizar estado, riesgo y próximo paso.' },
  { words: ['agenda', 'reunión', 'recordatorio', 'compromiso', 'calendario'], agentId: 'secretaria', domain: 'personal', reason: 'Se relaciona con agenda o administración.', nextAction: 'Registrar fecha, participantes y acción pendiente.' },
]

export function routeRequest(rawText: string): RouteDecision {
  const text = rawText.toLowerCase()
  const rule = rules.find((candidate) => includesAny(text, candidate.words))
  if (!rule) return { agentId: 'gerente', domain: 'agency', projectId: null, priority: 'normal', riskLevel: 'low', requiresApproval: false, nextAction: 'LuciaBot debe aclarar la intención y asignar un agente.', llmNeeded: true, reason: 'No existe una regla determinista suficientemente específica.' }
  const requiresApproval = Boolean(rule.alwaysApproval || includesAny(text, approvalWords))
  const elevatedRisk = requiresApproval && rule.riskLevel !== 'high' ? 'high' : (rule.riskLevel ?? 'low')
  return { agentId: rule.agentId, domain: rule.domain, projectId: rule.projectId ?? null, priority: rule.priority ?? 'normal', riskLevel: elevatedRisk, requiresApproval, nextAction: rule.nextAction, llmNeeded: false, reason: rule.reason }
}

export function buildReply(decision: RouteDecision, _text: string): string {
  const labels: Record<AgentId, string> = {
    gerente: 'LuciaBot', secretaria: 'Secretaria', 'colegio-lucia': 'Colegio Lucía', 'salud-familiar': 'Salud Familiar',
    'finanzas-familiares': 'Finanzas Familiares', 'educacion-aprendizaje': 'Educación', 'conocimiento-obsidian': 'Conocimiento',
    pmo: 'PMO', tecnico: 'Técnico', ventas: 'Ventas', marketing: 'Marketing', legal: 'Legal', 'finanzas-dmente': 'Finanzas Dmente',
    'producto-vertice': 'Producto Vértice', 'producto-synapse': 'Producto Synapse', 'whatsapp-conversaciones': 'WhatsApp',
  }
  const approval = decision.requiresApproval ? ' Requiere aprobación antes de cualquier acción externa.' : ''
  return `Asignado a ${labels[decision.agentId]}. ${decision.nextAction}${approval}`
}
