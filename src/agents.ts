import type { AgentId, AgentView, Message } from './types'

export const agents: Record<AgentId, AgentView> = {
  gerente: { name: 'LuciaBot', role: 'Gerente y orquestadora', normal: '/assets/lucia-bot-gerente-v2.png', attention: '/assets/lucia-bot-gerente-v2.png', status: 'Supervisando', color: '#818cf8' },
  secretaria: { name: 'Secretaria', role: 'Coordina la operación', normal: '/assets/secretaria-normal.png', attention: '/assets/secretaria-normal.png', status: 'Coordinando', color: '#2bebd2' },
  'colegio-lucia': { name: 'Colegio Lucía', role: 'Educación y eventos escolares', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Organizando', color: '#fbbf24', visibleInOffice: false },
  'salud-familiar': { name: 'Salud Familiar', role: 'Citas y seguimiento privado', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Protegiendo', color: '#fb7185', visibleInOffice: false },
  'finanzas-familiares': { name: 'Finanzas Familiares', role: 'Pagos y presupuesto familiar', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Organizando', color: '#a3e635', visibleInOffice: false },
  'educacion-aprendizaje': { name: 'Educación', role: 'Aprendizaje aplicado', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Aprendiendo', color: '#c084fc', visibleInOffice: false },
  'conocimiento-obsidian': { name: 'Conocimiento', role: 'Memoria y documentación', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Documentando', color: '#94a3b8', visibleInOffice: false },
  pmo: { name: 'PMO', role: 'Proyectos y prioridades', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Priorizando', color: '#ec4899', visibleInOffice: false },
  tecnico: { name: 'Técnico', role: 'Código, integraciones y QA', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Diagnosticando', color: '#60a5fa', visibleInOffice: false },
  ventas: { name: 'Ventas', role: 'Gestiona oportunidades', normal: '/assets/ventas-normal.png', attention: '/assets/ventas-normal.png', status: 'Conectando', color: '#34d399' },
  marketing: { name: 'Marketing', role: 'Diseña crecimiento y campañas', normal: '/assets/marketing-normal.png', attention: '/assets/marketing-normal.png', status: 'Optimizando', color: '#ec4899' },
  legal: { name: 'Legal', role: 'Analiza riesgos y contratos', normal: '/assets/legal-futurista-normal.png', attention: '/assets/legal-futurista-normal.png', status: 'Analizando', color: '#60a5fa' },
  'finanzas-dmente': { name: 'Finanzas Dmente', role: 'Cobros y rentabilidad', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Analizando', color: '#34d399', visibleInOffice: false },
  'producto-vertice': { name: 'Producto Vértice', role: 'CRM y automatizaciones', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Diseñando', color: '#38bdf8', visibleInOffice: false },
  'producto-synapse': { name: 'Producto Synapse', role: 'Oficina, agentes y MCP', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Evolucionando', color: '#818cf8', visibleInOffice: false },
  'whatsapp-conversaciones': { name: 'WhatsApp', role: 'Conversaciones y prospectos', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Clasificando', color: '#22c55e', visibleInOffice: false },
}

export const initialMessages: Record<AgentId, Message[]> = {
  gerente: [{ from: 'agent', text: 'El equipo está listo. Coordino cada solicitud con el especialista necesario.', time: '10:01' }],
  secretaria: [{ from: 'agent', text: 'La operación está sincronizada. Tengo una revisión lista.', time: '10:24' }],
  'colegio-lucia': [{ from: 'agent', text: 'Organizo fechas y acciones escolares con privacidad reforzada.', time: 'Ahora' }],
  'salud-familiar': [{ from: 'agent', text: 'Registro citas y recordatorios de salud con contexto mínimo.', time: 'Ahora' }],
  'finanzas-familiares': [{ from: 'agent', text: 'Organizo pagos y presupuesto sin mover dinero.', time: 'Ahora' }],
  'educacion-aprendizaje': [{ from: 'agent', text: 'Convierto cada aprendizaje en una aplicación práctica.', time: 'Ahora' }],
  'conocimiento-obsidian': [{ from: 'agent', text: 'Organizo procedimientos y notas sin duplicar contexto.', time: 'Ahora' }],
  pmo: [{ from: 'agent', text: 'Ordeno proyectos, pendientes, riesgos y próximos pasos.', time: 'Ahora' }],
  tecnico: [{ from: 'agent', text: 'Reviso código, integraciones y pruebas; producción requiere aprobación.', time: 'Ahora' }],
  ventas: [{ from: 'agent', text: 'Hay tres conversaciones comerciales que requieren seguimiento.', time: '10:08' }],
  marketing: [{ from: 'agent', text: 'Preparé una lectura de oportunidades para la próxima campaña.', time: '10:12' }],
  legal: [{ from: 'agent', text: 'Encontré una cláusula que conviene revisar.', time: '10:18' }],
  'finanzas-dmente': [{ from: 'agent', text: 'Organizo cobros y rentabilidad sin ejecutar pagos ni envíos.', time: 'Ahora' }],
  'producto-vertice': [{ from: 'agent', text: 'Organizo la evolución de Vértice y sus automatizaciones.', time: 'Ahora' }],
  'producto-synapse': [{ from: 'agent', text: 'Mantengo la evolución de agentes, solicitudes, UI y MCP.', time: 'Ahora' }],
  'whatsapp-conversaciones': [{ from: 'agent', text: 'Clasifico conversaciones y preparo respuestas para aprobación.', time: 'Ahora' }],
}
