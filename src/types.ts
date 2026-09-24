export type AgentId = 'secretaria' | 'legal' | 'marketing' | 'ventas' | 'gerente'
export type Section = 'office' | 'requests' | 'settings'
export type Message = { from: 'agent' | 'user'; text: string; time: string }
export type AgentView = { name: string; role: string; normal: string; attention: string; status: string; color: string }
