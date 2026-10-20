import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesAgendaSearch } from '../src/agenda-search'
import type { AgendaItem } from '../src/main'

const item = { title: 'Reunión de seguimiento', nextAction: 'Enviar cuestionario', projectId: 'totto-girardot', domain: 'agency', agentId: 'pmo', people: ['Ricardo Abella'], status: 'done', startsAt: '2025-01-01', eisenhower: { sourceTopic: 'Ventas / Consultoría' }, lastStatusComment: { comment: 'Revisar propuesta comercial' } } as AgendaItem

test('search finds words across title, people, context and labels regardless of accents or case', () => {
  for (const query of ['REUNION', 'ricardo ABELLA', 'cuestionario girardot', 'consultoria', 'propuesta', '   ']) assert.equal(matchesAgendaSearch(item, query), true, query)
  assert.equal(matchesAgendaSearch(item, 'agencia', ['Agencia']), true)
  assert.equal(matchesAgendaSearch(item, 'ricardo ausente'), false)
  assert.equal(matchesAgendaSearch({ ...item, people: undefined, lastStatusComment: null }, 'ricardo'), false)
})
