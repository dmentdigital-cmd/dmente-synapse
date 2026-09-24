import type { AgentId, AgentView, Message } from './types'

export const agents: Record<AgentId, AgentView> = {
  secretaria: { name: 'Secretaria', role: 'Coordina la operación', normal: '/assets/secretaria-normal.png', attention: '/assets/secretaria-normal.png', status: 'Coordinando', color: '#2bebd2' },
  legal: { name: 'Legal', role: 'Analiza riesgos y contratos', normal: '/assets/legal-futurista-normal.png', attention: '/assets/legal-futurista-normal.png', status: 'Analizando', color: '#60a5fa' },
  marketing: { name: 'Marketing', role: 'Diseña crecimiento y campañas', normal: '/assets/marketing-normal.png', attention: '/assets/marketing-normal.png', status: 'Optimizando', color: '#ec4899' },
  ventas: { name: 'Ventas', role: 'Gestiona oportunidades', normal: '/assets/ventas-normal.png', attention: '/assets/ventas-normal.png', status: 'Conectando', color: '#34d399' },
  gerente: { name: 'LuciaBot', role: 'Gerente y orquestadora', normal: '/assets/gerente-normal.png', attention: '/assets/gerente-normal.png', status: 'Supervisando', color: '#818cf8' },
}

export const initialMessages: Record<AgentId, Message[]> = {
  secretaria: [{ from: 'agent', text: 'La operación está sincronizada. Tengo una revisión lista.', time: '10:24' }],
  legal: [{ from: 'agent', text: 'Encontré una cláusula que conviene revisar.', time: '10:18' }],
  marketing: [{ from: 'agent', text: 'Preparé una lectura de oportunidades para la próxima campaña.', time: '10:12' }],
  ventas: [{ from: 'agent', text: 'Hay tres conversaciones comerciales que requieren seguimiento.', time: '10:08' }],
  gerente: [{ from: 'agent', text: 'El equipo está listo. Puedo coordinar la agencia y tus compromisos personales.', time: '10:01' }],
}
