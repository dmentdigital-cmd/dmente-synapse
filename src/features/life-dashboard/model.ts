import type { AgendaItem } from '../../main'

export const LIFE_ZONE = 'America/Bogota'
export const statusInfo = {
  pending: { label: 'Pendientes', color: '#a2b9d3' },
  in_progress: { label: 'En progreso', color: '#64d9ff' },
  waiting_approval: { label: 'Por aprobar', color: '#e5bfff' },
  blocked: { label: 'Bloqueos', color: '#ffadbc' },
  done: { label: 'Hechos', color: '#65edcf' },
  cancelled: { label: 'Cancelados', color: '#b5adc9' },
} as const
export type LifeStatus = keyof typeof statusInfo
export const lifeStatuses = Object.keys(statusInfo) as LifeStatus[]
export const domainLabels: Record<string, string> = {
  agency: 'Agencia', personal: 'Personal', family: 'Familia', health: 'Salud', education: 'Educación',
  church: 'Iglesia', learning: 'Aprendizaje', wellbeing: 'Bienestar', projects: 'Proyectos',
  technology: 'Tecnología', finance: 'Finanzas', knowledge: 'Conocimiento', product: 'Producto',
  messaging: 'Mensajería', sales: 'Ventas', marketing: 'Marketing', legal: 'Legal',
}

export function dayKey(value: Date | string | null): string | null {
  if (!value) return null
  // Date-only fields express a calendar date, not a UTC instant.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
  }
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: LIFE_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map((part) => parts.find((p) => p.type === part)?.value).join('-')
}

export function shiftDay(key: string, amount: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function isOpen(item: AgendaItem) { return item.status !== 'done' && item.status !== 'cancelled' }
export function isOverdue(item: AgendaItem, now: Date): boolean {
  if (!isOpen(item) || !item.dueAt) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.dueAt)) return (dayKey(item.dueAt) ?? '9999') < (dayKey(now) ?? '')
  const due = new Date(item.dueAt).getTime()
  return Number.isFinite(due) && due < now.getTime()
}

export function scheduledOn(item: AgendaItem, key: string): boolean {
  const start = dayKey(item.startsAt)
  const end = dayKey(item.dueAt)
  if (start && end && start <= end) return start <= key && end >= key
  return (start ?? end) === key
}

export function buildLifeReview(items: AgendaItem[], options: { domain: string; selectedDay: string; range: number; now: Date }) {
  const scope = items.filter((item) => options.domain === 'all' || item.domain === options.domain)
  const counts = Object.fromEntries(lifeStatuses.map((status) => [status, 0])) as Record<LifeStatus, number>
  for (const item of scope) counts[item.status] += 1
  const attentionWeight = (item: AgendaItem) => (item.status === 'blocked' ? 100 : 0) + (isOverdue(item, options.now) ? 50 : 0) + (item.status === 'waiting_approval' ? 20 : 0) + (item.priority === 'urgent' ? 10 : item.priority === 'high' ? 5 : 0)
  const compare = (a: AgendaItem, b: AgendaItem) => attentionWeight(b) - attentionWeight(a) || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.id.localeCompare(b.id)
  const attention = scope.filter((item) => item.status === 'blocked' || item.status === 'waiting_approval' || isOverdue(item, options.now)).sort(compare)
  const days = Array.from({ length: options.range }, (_, index) => ({ day: shiftDay(options.selectedDay, index - options.range + 1), count: 0 }))
  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const item of scope) {
    const key = dayKey(item.createdAt)
    if (key) { const entry = byDay.get(key); if (entry) entry.count += 1 }
  }
  return {
    scope, counts, attention, days,
    scheduled: scope.filter((item) => item.status !== 'cancelled' && scheduledOn(item, options.selectedDay)).sort((a, b) => {
      const effectiveTime = (item: AgendaItem) => {
        const value = item.startsAt ?? item.dueAt
        if (!value) return Number.POSITIVE_INFINITY
        const instant = new Date(value.length === 10 ? `${value}T00:00:00-05:00` : value).getTime()
        return Number.isFinite(instant) ? instant : Number.POSITIVE_INFINITY
      }
      return effectiveTime(a) - effectiveTime(b) || compare(a, b)
    }),
    overdue: scope.filter((item) => isOverdue(item, options.now)).length,
    undated: scope.filter((item) => isOpen(item) && !dayKey(item.startsAt) && !dayKey(item.dueAt)).length,
    open: scope.filter(isOpen).length,
    createdInPeriod: days.reduce((sum, d) => sum + d.count, 0),
  }
}
