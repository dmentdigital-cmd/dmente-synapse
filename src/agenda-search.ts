import type { AgendaItem } from './main'

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}

export function matchesAgendaSearch(item: AgendaItem, query: string, labels: string[] = []): boolean {
  const words = normalized(query).split(/\s+/).filter(Boolean)
  const text = normalized([item.title, item.nextAction, item.projectId, item.domain, item.agentId, item.eisenhower?.sourceTopic, item.lastStatusComment?.comment, ...(item.people ?? []), ...labels].filter(Boolean).join(' '))
  return words.every((word) => text.includes(word))
}
