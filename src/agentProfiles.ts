import type { AgentId } from './types'

export type AgentProfile = {
  domain: string
  purpose: string
  capabilities: string[]
  allowed: string[]
  blocked: string[]
  projects: string[]
}

export const agentProfiles: Record<AgentId, AgentProfile> = {
  gerente: { domain: 'Coordinación general', purpose: 'Clasifica, delega, consolida y controla aprobaciones.', capabilities: ['Enrutamiento', 'Coordinación', 'Síntesis', 'Control de riesgo'], allowed: ['Lectura y escritura interna en Synapse'], blocked: ['Acciones externas sin aprobación'], projects: ['Todos los proyectos autorizados'] },
  secretaria: { domain: 'Agenda y administración', purpose: 'Organiza agenda, reuniones, recordatorios y compromisos.', capabilities: ['Agenda', 'Reuniones', 'Recordatorios', 'Minutas'], allowed: ['Registros y borradores internos'], blocked: ['Invitar o mover reuniones sin aprobación'], projects: ['Agenda Dmente', 'Agenda personal', 'Familia'] },
  'colegio-lucia': { domain: 'Familia y educación', purpose: 'Organiza eventos, tareas y comunicaciones escolares de Lucía.', capabilities: ['Eventos escolares', 'Tareas', 'Horarios', 'Recordatorios'], allowed: ['Calendario y notas privadas'], blocked: ['Compartir datos de una menor o escribir al colegio'], projects: ['Colegio Lucía'] },
  'salud-familiar': { domain: 'Salud privada', purpose: 'Organiza citas, fórmulas, exámenes y recordatorios familiares.', capabilities: ['Citas', 'Medicamentos', 'Exámenes', 'Recordatorios'], allowed: ['Registros privados mínimos'], blocked: ['Divulgar datos médicos o sustituir criterio médico'], projects: ['Salud Diego', 'Salud Lucía', 'Salud Tania'] },
  'finanzas-familiares': { domain: 'Finanzas familiares', purpose: 'Organiza pagos, presupuesto y gastos recurrentes.', capabilities: ['Pagos', 'Presupuesto', 'Educación', 'Gastos recurrentes'], allowed: ['Registros y análisis internos'], blocked: ['Mover dinero o realizar pagos'], projects: ['Presupuesto familiar', 'Educación', 'Pagos recurrentes'] },
  'educacion-aprendizaje': { domain: 'Aprendizaje', purpose: 'Convierte cursos y estudio en aplicaciones para Dmente.', capabilities: ['Cursos', 'Certificaciones', 'Rutas', 'Aplicación práctica'], allowed: ['Notas y planes internos'], blocked: ['Acumular estudio sin una aplicación definida'], projects: ['Platzi', 'UEMI', 'School', 'Formación Dmente'] },
  'conocimiento-obsidian': { domain: 'Conocimiento', purpose: 'Mantiene procedimientos, índices y memoria externa sin duplicados.', capabilities: ['Obsidian', 'Markdown', 'Índices', 'Procedimientos'], allowed: ['Organización documental interna'], blocked: ['Duplicar estados o guardar secretos'], projects: ['Base de conocimiento Dmente'] },
  pmo: { domain: 'Proyectos', purpose: 'Mantiene estados, pendientes, prioridades, riesgos y próximos pasos.', capabilities: ['Estados', 'Bitácoras', 'Prioridades', 'Seguimiento'], allowed: ['Organización y documentación interna'], blocked: ['Marcar como hecho algo no verificado'], projects: ['Synapse', 'Vértice', 'Can & Friends', 'PLES', 'ATG', 'Medigan', 'PMA'] },
  tecnico: { domain: 'Tecnología', purpose: 'Apoya código, integraciones, MCP, Docker, Coolify y QA.', capabilities: ['Código', 'Integraciones', 'Infraestructura', 'Pruebas'], allowed: ['Diagnóstico, builds y propuestas'], blocked: ['Commit, push, deploy o producción sin aprobación'], projects: ['Synapse', 'Vértice', 'Coolify/VPS', 'ATG', 'PMA', 'n8n'] },
  ventas: { domain: 'Ventas', purpose: 'Gestiona prospectos, pipeline, propuestas y seguimiento comercial.', capabilities: ['Leads', 'CRM', 'Pipeline', 'Propuestas'], allowed: ['Análisis y borradores internos'], blocked: ['Enviar, prometer precios o resultados sin aprobación'], projects: ['Vértice CRM', 'More Products', 'Pipeline Dmente'] },
  marketing: { domain: 'Marketing', purpose: 'Analiza campañas, contenidos, métricas y crecimiento.', capabilities: ['Meta Ads', 'GA4', 'Clarity', 'Contenido'], allowed: ['Análisis y recomendaciones'], blocked: ['Publicar o modificar campañas y presupuesto'], projects: ['Can & Friends', 'Medigan', 'DBVloggers', 'Dmente'] },
  legal: { domain: 'Legal y riesgos', purpose: 'Detecta riesgos contractuales, de privacidad y cumplimiento.', capabilities: ['Contratos', 'Privacidad', 'Cumplimiento', 'Riesgo'], allowed: ['Análisis preventivo interno'], blocked: ['Firmar, aprobar o enviar documentos legales'], projects: ['Todos los proyectos con revisión legal'] },
  'finanzas-dmente': { domain: 'Finanzas de agencia', purpose: 'Organiza cobros, facturación, pagos pendientes y rentabilidad.', capabilities: ['Cobros', 'Facturación', 'Rentabilidad', 'Cartera'], allowed: ['Análisis y registros internos'], blocked: ['Mover dinero o enviar facturas'], projects: ['PMA facturas', 'Cobros Dmente', 'Rentabilidad por cliente'] },
  'producto-vertice': { domain: 'Producto CRM', purpose: 'Organiza visión, CRM, n8n, pipeline y automatizaciones de Vértice.', capabilities: ['CRM', 'WhatsApp oficial', 'n8n', 'Automatizaciones'], allowed: ['Diseño y documentación interna'], blocked: ['Tocar número oficial, webhooks o producción'], projects: ['Vértice'] },
  'producto-synapse': { domain: 'Producto operativo', purpose: 'Organiza agentes, solicitudes, aprobaciones, UI, auditoría y MCP.', capabilities: ['Agentes', 'Solicitudes', 'Aprobaciones', 'MCP'], allowed: ['Diseño y mejora interna'], blocked: ['Habilitar escritura externa sin controles'], projects: ['Dmente Synapse'] },
  'whatsapp-conversaciones': { domain: 'Mensajería comercial', purpose: 'Clasifica chats, detecta prospectos y prepara respuestas.', capabilities: ['Clasificación', 'Prospectos', 'Borradores', 'Escalamiento'], allowed: ['Lectura y borradores internos'], blocked: ['Enviar sin aprobación o ignorar no_contactar'], projects: ['WhatsApp Dmente', 'Vértice CRM'] },
}
