export type Domain = 'agency' | 'personal' | 'family' | 'health' | 'education' | 'church' | 'learning' | 'wellbeing' | 'projects' | 'technology' | 'finance' | 'knowledge' | 'product' | 'messaging' | 'sales' | 'marketing' | 'legal'
export type AgentId =
  | 'gerente' | 'secretaria' | 'colegio-lucia' | 'salud-familiar'
  | 'finanzas-familiares' | 'educacion-aprendizaje' | 'conocimiento-obsidian'
  | 'pmo' | 'tecnico' | 'ventas' | 'marketing' | 'legal' | 'finanzas-dmente'
  | 'producto-vertice' | 'producto-synapse' | 'whatsapp-conversaciones'
export type RequestStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'done' | 'cancelled'
export type ProfileRole = 'owner' | 'assistant'

export type Agent = {
  id: AgentId
  name: string
  role: string
  domain: Domain
}

export type Profile = {
  id: string
  name: string
  role: ProfileRole
}

export type Permission = {
  profileId: string
  domain: Domain
  canRead: boolean
  canWrite: boolean
  requiresApproval: boolean
}

export type Commitment = {
  id: string
  title: string
  domain: Domain
  people: string[]
  source: 'manual' | 'calendar' | 'whatsapp' | 'email' | 'note'
  startsAt: string | null
  dueAt: string | null
  status: 'captured' | 'planned' | 'confirmed' | 'done' | 'cancelled'
  createdAt: string
}

export type RequestRecord = {
  id: string
  agentId: AgentId
  domain: Domain
  title: string
  projectId: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: RequestStatus
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  nextAction: string
  createdAt: string
  updatedAt: string
}

export type MessageRecord = {
  id: string
  requestId: string | null
  agentId: AgentId
  direction: 'user' | 'agent'
  text: string
  createdAt: string
}

export type RouteDecision = {
  agentId: AgentId
  domain: Domain
  projectId: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  nextAction: string
  llmNeeded: boolean
  reason: string
}
