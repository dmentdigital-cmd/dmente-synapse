export type Domain = 'agency' | 'personal' | 'family' | 'health' | 'education' | 'church' | 'learning' | 'wellbeing'
export type AgentId = 'secretaria' | 'legal' | 'marketing' | 'ventas' | 'gerente'
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
  status: RequestStatus
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
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
  urgency: 'low' | 'normal' | 'high' | 'critical'
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  reason: string
}
