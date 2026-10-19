import type { AgendaItem } from './main'

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export const quadrantLabels: Record<Quadrant, { title: string; action: string; tone: string }> = {
  Q1: { title: 'Urgente + importante', action: 'Hacer hoy', tone: 'q1' },
  Q2: { title: 'Importante, no urgente', action: 'Agendar', tone: 'q2' },
  Q3: { title: 'Urgente, no importante', action: 'Delegar', tone: 'q3' },
  Q4: { title: 'No urgente, no importante', action: 'Archivar', tone: 'q4' },
}
export const quadrants = Object.keys(quadrantLabels) as Quadrant[]
export function agendaQuadrant(hash: string): Quadrant | null {
  const match = /^#agenda\/eisenhower\/(Q[1-4])$/.exec(hash)
  return match ? match[1] as Quadrant : null
}
/** The server's classification is authoritative. Never infer a second quadrant here. */
export function groupOpenAgenda(items: AgendaItem[]) {
  const groups: Record<Quadrant, AgendaItem[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
  const unclassified: AgendaItem[] = []
  for (const item of items) {
    if (item.kind === 'milestone' || item.status === 'done' || item.status === 'cancelled') continue
    const quadrant = item.eisenhower?.quadrant
    if (quadrant && quadrants.includes(quadrant)) groups[quadrant].push(item)
    else unclassified.push(item)
  }
  return { groups, unclassified }
}
