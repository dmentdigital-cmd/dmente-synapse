import type { Commitment, RequestRecord } from './types.js'

export type EisenhowerQuadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type EisenhowerLevel = 'low' | 'medium' | 'high'
export type EisenhowerFields = {
  quadrant: EisenhowerQuadrant | null
  urgency: EisenhowerLevel | null
  importance: EisenhowerLevel | null
  urgencyReason: string | null
  importanceReason: string | null
  sourceTopic: string | null
}

export type EisenhowerInput = Partial<EisenhowerFields>

const levels: EisenhowerLevel[] = ['low', 'medium', 'high']
const quadrants: EisenhowerQuadrant[] = ['Q1', 'Q2', 'Q3', 'Q4']

export function isEisenhowerQuadrant(value: unknown): value is EisenhowerQuadrant { return typeof value === 'string' && quadrants.includes(value as EisenhowerQuadrant) }
export function isEisenhowerLevel(value: unknown): value is EisenhowerLevel { return typeof value === 'string' && levels.includes(value as EisenhowerLevel) }

function dueTodayOrOverdue(value: string | null): boolean {
  if (!value) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const due = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed)
  return due <= today
}

export function inferQuadrant(item: Pick<RequestRecord, 'priority' | 'riskLevel' | 'requiresApproval' | 'projectId' | 'domain' | 'dueAt'> | Pick<Commitment, 'projectId' | 'domain' | 'dueAt' | 'status'>): EisenhowerQuadrant {
  const request = 'priority' in item
  const urgent = request
    ? item.priority === 'urgent' || item.priority === 'high' || dueTodayOrOverdue(item.dueAt) || item.riskLevel === 'high'
    : dueTodayOrOverdue(item.dueAt) || item.status === 'blocked'
  const important = request
    ? item.riskLevel === 'high' || item.requiresApproval === true || Boolean(item.projectId) || ['sales', 'agency', 'marketing', 'technology', 'product', 'projects'].includes(item.domain) || item.priority === 'high' || item.priority === 'urgent'
    : Boolean(item.projectId) || ['sales', 'agency', 'marketing', 'technology', 'product', 'projects'].includes(item.domain)
  if (urgent && important) return 'Q1'
  if (!urgent && important) return 'Q2'
  if (urgent && !important) return 'Q3'
  return 'Q4'
}

export function normalizedEisenhower(fields: EisenhowerInput, inferred: EisenhowerQuadrant): EisenhowerFields {
  return {
    quadrant: fields.quadrant === null ? null : isEisenhowerQuadrant(fields.quadrant) ? fields.quadrant : inferred,
    urgency: fields.urgency === null ? null : isEisenhowerLevel(fields.urgency) ? fields.urgency : null,
    importance: fields.importance === null ? null : isEisenhowerLevel(fields.importance) ? fields.importance : null,
    urgencyReason: fields.urgencyReason === null ? null : typeof fields.urgencyReason === 'string' ? fields.urgencyReason.trim().slice(0, 500) : null,
    importanceReason: fields.importanceReason === null ? null : typeof fields.importanceReason === 'string' ? fields.importanceReason.trim().slice(0, 500) : null,
    sourceTopic: fields.sourceTopic === null ? null : typeof fields.sourceTopic === 'string' ? fields.sourceTopic.trim().slice(0, 120) : null,
  }
}
