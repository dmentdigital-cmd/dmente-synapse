import type { MilestoneStatus, ProjectHealth, ProjectStatus } from './types.js'

// Pure rules for the project traffic light. Kept free of database access so the numbers Lucía
// reads are computed by code that can be tested on its own, never estimated by the model.
export const UPCOMING_DAYS = 7
export const SILENCE_DAYS = 7
const DAY_MS = 86_400_000
const OPEN: MilestoneStatus[] = ['pending', 'in_progress', 'blocked']
const TRACKED: ProjectStatus[] = ['propuesta', 'en_curso']

export type HealthMilestone = { status: MilestoneStatus; dueAt: string }
export type HealthInput = { status: ProjectStatus; milestones: HealthMilestone[]; openBlockers: number; lastActivityAt: string | null }
export type HealthResult = { health: ProjectHealth | null; reasons: string[]; silentDays: number | null }

export function isOpenMilestone(status: MilestoneStatus): boolean { return OPEN.includes(status) }
export function isOverdue(milestone: HealthMilestone, now: number): boolean { return isOpenMilestone(milestone.status) && Date.parse(milestone.dueAt) < now }

/** Share of non-cancelled milestones that are done, 0-100. No milestones means there is nothing to measure. */
export function computeProgress(milestones: { status: MilestoneStatus }[]): number | null {
  const counted = milestones.filter((milestone) => milestone.status !== 'cancelled')
  if (!counted.length) return null
  return Math.round((counted.filter((milestone) => milestone.status === 'done').length / counted.length) * 100)
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function computeHealth(input: HealthInput, now: number): HealthResult {
  if (!TRACKED.includes(input.status)) return { health: null, reasons: [], silentDays: null }
  const red: string[] = []
  const yellow: string[] = []
  const open = input.milestones.filter((milestone) => isOpenMilestone(milestone.status))
  const overdue = open.filter((milestone) => isOverdue(milestone, now)).length
  if (overdue) red.push(plural(overdue, 'hito atrasado', 'hitos atrasados'))
  if (input.openBlockers > 0) red.push(plural(input.openBlockers, 'bloqueo abierto', 'bloqueos abiertos'))

  const blocked = open.filter((milestone) => milestone.status === 'blocked' && !isOverdue(milestone, now)).length
  if (blocked) yellow.push(plural(blocked, 'hito bloqueado', 'hitos bloqueados'))
  const dueSoon = open.filter((milestone) => milestone.status === 'pending' && !isOverdue(milestone, now) && Date.parse(milestone.dueAt) - now <= UPCOMING_DAYS * DAY_MS).length
  if (dueSoon) yellow.push(`${plural(dueSoon, 'hito vence', 'hitos vencen')} en ${UPCOMING_DAYS} días sin iniciar`)

  let silentDays: number | null = null
  if (input.status === 'en_curso') {
    if (!open.length) yellow.push('Sin hitos abiertos')
    const last = input.lastActivityAt ? Date.parse(input.lastActivityAt) : Number.NaN
    if (!Number.isNaN(last)) {
      const days = Math.floor((now - last) / DAY_MS)
      if (days >= SILENCE_DAYS) { silentDays = days; yellow.push(`Sin movimiento hace ${days} días`) }
    }
  }
  if (red.length) return { health: 'rojo', reasons: [...red, ...yellow], silentDays }
  if (yellow.length) return { health: 'amarillo', reasons: yellow, silentDays }
  return { health: 'verde', reasons: [], silentDays }
}
