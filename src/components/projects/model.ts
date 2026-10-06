import type { AgentId } from '../../types'

export type ProjectStatus = 'por_clasificar' | 'propuesta' | 'en_curso' | 'pausado' | 'completado' | 'facturado' | 'cancelado'
export type MilestoneStatus = 'pending' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
export type UpdateKind = 'avance' | 'bloqueo' | 'riesgo' | 'decision' | 'leccion'
export type Health = 'verde' | 'amarillo' | 'rojo'
export type Role = 'viewer' | 'operator' | 'approver' | 'admin'

export type MilestoneBrief = { id: string; title: string; dueAt: string; status: MilestoneStatus; ownerAgentId: AgentId | null; ownerName: string | null; daysLate: number }
export type ProjectSummary = {
  id: string; code: string | null; name: string; clientId: string | null; clientName: string | null; domain: string; ownerAgentId: AgentId; status: ProjectStatus
  startsAt: string | null; dueAt: string | null; nextAction: string | null; sourcePath: string | null; sourceDriveFolder: string | null; obsidianNote: string | null
  origin: 'manual' | 'auto' | 'mcp'; createdAt: string; updatedAt: string
  progress: number | null; milestoneCounts: { total: number; done: number; open: number; overdue: number }; nextMilestone: MilestoneBrief | null; overdueMilestones: MilestoneBrief[]
  openTasks: number; openBlockers: number; lastActivityAt: string; silentDays: number | null; health: Health | null; healthReasons: string[]
  progressSource: 'hitos' | 'estado' | null; stateFile: { generalStatus: string | null; updatedLabel: string | null; changedAt: string } | null
}
export type Milestone = { id: string; projectId: string; title: string; phase: string | null; ownerAgentId: AgentId | null; ownerName: string | null; startsAt: string | null; dueAt: string; status: MilestoneStatus; sortOrder: number; completedAt: string | null; notes: string | null }
export type TaskBrief = { id: string; kind: 'request' | 'commitment'; title: string; domain: string; agentId: AgentId | null; status: string; priority: string | null; startsAt: string | null; dueAt: string | null; nextAction: string }
export type ProjectUpdate = { id: string; projectId: string; kind: UpdateKind; text: string; author: string; source: 'manual' | 'mcp' | 'bitacora'; resolvedAt: string | null; resolution: string | null; createdAt: string }
export type Client = { id: string; name: string; contactName: string | null; email: string | null; phone: string | null; industry: string | null; status: 'active' | 'inactive' | 'archived'; notes: string | null }
export type ProjectMetric = { id: string; projectId: string; name: string; unit: string | null; targetTotal: number; plannedToDate: number | null; achieved: number; updatedAt: string }
export type ProjectInvoice = { id: string; concept: string; amount: number; status: 'pendiente' | 'pagado' | 'anulado'; issuedAt: string | null; dueAt: string | null; paidAt: string | null }
export type ProjectFinance = { budget: number | null; actualCost: number | null; invoices: ProjectInvoice[]; totals: { invoiced: number; paid: number; pending: number } }
export type ProjectDetailData = { project: ProjectSummary; milestones: Milestone[]; tasks: TaskBrief[]; updates: ProjectUpdate[]; metrics: ProjectMetric[]; finance: ProjectFinance | null; state: ProjectState | null }
export type ProjectState = { title: string | null; updatedLabel: string | null; generalStatus: string | null; progress: number | null; sections: { completed: string[]; inProgress: string[]; pending: string[]; nextSteps: string[] }; sourcePath: string | null; changedAt: string; importedAt: string }

export const projectStatusLabels: Record<ProjectStatus, string> = { por_clasificar: 'Por clasificar', propuesta: 'Propuesta', en_curso: 'En curso', pausado: 'Pausado', completado: 'Completado', facturado: 'Facturado', cancelado: 'Cancelado' }
export const milestoneStatusLabels: Record<MilestoneStatus, string> = { pending: 'Pendiente', in_progress: 'En progreso', blocked: 'Bloqueado', done: 'Cumplido', cancelled: 'Cancelado' }
export const updateKindLabels: Record<UpdateKind, string> = { avance: 'Avance', bloqueo: 'Bloqueo', riesgo: 'Riesgo', decision: 'Decisión', leccion: 'Lección' }
export const healthLabels: Record<Health, string> = { rojo: 'Requiere atención', amarillo: 'En observación', verde: 'Al día' }
export const taskStatusLabels: Record<string, string> = { pending: 'Pendiente', in_progress: 'En progreso', waiting_approval: 'Esperando aprobación', blocked: 'Bloqueado', done: 'Hecho', cancelled: 'Cancelado', captured: 'Capturado', planned: 'Planeado', confirmed: 'Confirmado' }
export const domainLabels: Record<string, string> = { family: 'Familia', health: 'Salud familiar', agency: 'Agencia', sales: 'Ventas', marketing: 'Marketing', technology: 'Técnico / producto', learning: 'Aprendizaje', projects: 'Proyectos', personal: 'Personal', education: 'Educación', church: 'Iglesia', wellbeing: 'Bienestar', finance: 'Finanzas', knowledge: 'Conocimiento', product: 'Producto', messaging: 'Mensajería', legal: 'Legal' }
export const canWrite = (role?: Role) => role === 'operator' || role === 'approver' || role === 'admin'

/** JSON call against the Synapse API. Throws the server's own message so the user sees what to fix. */
export async function call<T>(route: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(route, { method, signal, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la acción.')
  return data
}

const bogota = 'America/Bogota'
const valid = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dayLabel(value: string | null | undefined): string {
  const date = valid(value)
  return date ? new Intl.DateTimeFormat('es-CO', { timeZone: bogota, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Sin fecha'
}

export function dateTimeLabel(value: string | null | undefined): string {
  const date = valid(value)
  return date ? new Intl.DateTimeFormat('es-CO', { timeZone: bogota, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date) : 'Sin fecha'
}

/** ISO instant to the YYYY-MM-DD a date input expects, read in Colombia time. */
export function inputDay(value: string | null | undefined): string {
  const date = valid(value)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: bogota, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** A due date means "by the end of that day" in Colombia, so it is not late during the day itself. */
export function dayToIso(day: string, endOfDay: boolean): string | null {
  if (!day) return null
  return new Date(`${day}T${endOfDay ? '23:59' : '00:00'}:00-05:00`).toISOString()
}

export function plural(count: number, one: string, many: string): string { return `${count} ${count === 1 ? one : many}` }
