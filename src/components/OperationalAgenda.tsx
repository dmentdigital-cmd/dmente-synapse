import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertTriangle, ArrowDownWideNarrow, CalendarClock, Check, CheckCheck, Circle, Clock3, ExternalLink, Filter, Flag, Pencil, Plus, Save, Search, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import { agents } from '../agents'
import type { AgendaItem } from '../main'
import type { AgentId } from '../types'
import { agendaQuadrant, isEisenhowerAgenda, quadrantLabels, type Quadrant } from '../eisenhower'
import { matchesAgendaSearch } from '../agenda-search'

type NewAgendaItem = { title: string; domain: string; projectId: string; agentId: AgentId; priority: ApiPriority; riskLevel: AgendaItem['riskLevel']; requiresApproval: boolean; startsAt: string; dueAt: string; nextAction: string }
type ApiPriority = AgendaItem['priority']
type RescheduleMode = 'both' | 'start' | 'due'
type RescheduleEdit = { item: AgendaItem; day: string; mode: RescheduleMode; busy: boolean }
type Props = { items: AgendaItem[]; loadError: string; onCreate: (input: Omit<NewAgendaItem, 'startsAt' | 'dueAt'> & { startsAt: string | null; dueAt: string | null }) => Promise<void>; onEdit: (id: string, input: Record<string, unknown>) => Promise<void>; onDelete: (item: AgendaItem) => Promise<void>; onUpdateStatus: (id: string, status: AgendaItem['status'], comment: string) => Promise<void>; onApprove: (id: string) => Promise<void>; onClose: () => void }
type View = 'today' | 'tomorrow' | 'week' | 'overdue' | 'calendar' | 'kanban' | 'eisenhower' | 'search'
const statusLabels: Record<AgendaItem['status'], string> = { pending: 'Pendiente', in_progress: 'En progreso', waiting_approval: 'Esperando aprobación', blocked: 'Bloqueado', done: 'Hecho', cancelled: 'Cancelado' }
const priorityLabels = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baja' } as const
const domainLabels: Record<string, string> = { family: 'Familia', health: 'Salud familiar', agency: 'Agencia', sales: 'Ventas', marketing: 'Marketing', technology: 'Técnico / producto', learning: 'Aprendizaje', projects: 'Proyectos', personal: 'Personal', education: 'Educación', church: 'Iglesia', wellbeing: 'Bienestar', finance: 'Finanzas', knowledge: 'Conocimiento', product: 'Producto', messaging: 'Mensajería', legal: 'Legal' }
const kanbanColumns: AgendaItem['status'][] = ['pending', 'in_progress', 'waiting_approval', 'blocked', 'done']
const fallbackAgent = { name: 'Sin asignar', role: 'Responsable por revisar', normal: '/assets/logo-dmente.png', attention: '/assets/logo-dmente.png', status: 'Por revisar', color: '#94a3b8', visibleInOffice: false }

function agentView(agentId: string) {
  return agents[agentId as AgentId] ?? fallbackAgent
}

function validDate(value: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  const values = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => values.find((value) => value.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function shiftDay(key: string, amount: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12))
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const date = validDate(value)
  if (!date) return 'Fecha por revisar'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatTime(value: string): string {
  const date = validDate(value)
  if (!date) return 'Hora por revisar'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatSchedule(item: AgendaItem): string {
  if (item.startsAt && item.dueAt) {
    if (dateKey(new Date(item.startsAt)) === dateKey(new Date(item.dueAt))) return `${formatDate(item.startsAt)} – ${formatTime(item.dueAt)}`
    return `${formatDate(item.startsAt)} · vence ${formatDate(item.dueAt)}`
  }
  return formatDate(item.startsAt ?? item.dueAt)
}

function itemDay(item: AgendaItem): string | null {
  const value = item.startsAt ?? item.dueAt
  const date = validDate(value)
  return date ? dateKey(date) : null
}

function deadlineDay(item: AgendaItem): string | null {
  const value = item.dueAt ?? item.startsAt
  const date = validDate(value)
  return date ? dateKey(date) : null
}

function kanbanStatus(item: AgendaItem): AgendaItem['status'] {
  if (item.status === 'blocked') return 'blocked'
  if (item.requiresApproval && !item.approvalConfirmed && item.status === 'pending') return 'waiting_approval'
  return item.status
}

function localInputDate(value: string | null): string {
  const date = validDate(value)
  if (!date) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

function localInputTime(value: string | null, fallback = '09:00'): string {
  const date = validDate(value)
  if (!date) return fallback
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('hour')}:${part('minute')}` || fallback
}

function bogotaIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00-05:00`).toISOString()
}

export function OperationalAgenda({ items, loadError, onCreate, onEdit, onDelete, onUpdateStatus, onApprove, onClose }: Props) {
  const [view, setView] = useState<View>(() => isEisenhowerAgenda(window.location.hash) ? 'eisenhower' : 'today')
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | 'all'>(() => agendaQuadrant(window.location.hash) ?? 'all')
  const [domain, setDomain] = useState('all')
  const [project, setProject] = useState('all')
  const [agent, setAgent] = useState('all')
  const [priority, setPriority] = useState('all')
  // Eisenhower is also the recovery view: closed items must remain discoverable there.
  const [status, setStatus] = useState(() => isEisenhowerAgenda(window.location.hash) ? 'all' : 'active')
  const [approvalOnly, setApprovalOnly] = useState(false)
  const [sourceTopic, setSourceTopic] = useState('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const highlightedCard = useRef<HTMLElement | null>(null)
  const focusSavedCard = useRef(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<AgendaItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [statusEdit, setStatusEdit] = useState<{ item: AgendaItem; status: AgendaItem['status']; comment: string } | null>(null)
  const [rescheduleEdit, setRescheduleEdit] = useState<RescheduleEdit | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [newItem, setNewItem] = useState<NewAgendaItem>({ title: '', domain: 'projects', projectId: '', agentId: 'pmo', priority: 'normal', riskLevel: 'low', requiresApproval: false, startsAt: '', dueAt: '', nextAction: '' })
  const [quadrantEdit, setQuadrantEdit] = useState<Quadrant | null>(null)
  const [error, setError] = useState('')
  const modalBusy = useRef(false)
  modalBusy.current = createBusy || deleteBusy || statusBusy || Boolean(rescheduleEdit?.busy)
  const today = dateKey(new Date())
  const tomorrow = shiftDay(today, 1)
  const weekEnd = shiftDay(today, 6)

  useEffect(() => {
    if (createOpen || !highlightedId || !focusSavedCard.current || !highlightedCard.current) return
    focusSavedCard.current = false
    highlightedCard.current.scrollIntoView({ block: 'nearest' })
    highlightedCard.current.focus({ preventScroll: true })
  }, [items, highlightedId, createOpen])

  function resetFilters() {
    setDomain('all'); setProject('all'); setAgent('all'); setPriority('all')
    setStatus('all'); setApprovalOnly(false); setSourceTopic('all'); setQuadrantFilter('all')
    window.history.replaceState(null, '', '#agenda')
  }

  function searchAgenda(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resetFilters()
    setSearchQuery(searchDraft.trim())
    setView('search')
    setNotice('')
    setHighlightedId(null)
  }

  useEffect(() => {
    if (!createOpen && !deleteItem && !statusEdit && !rescheduleEdit) return
    const previousFocus = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('.agenda-modal-backdrop [role="dialog"], .agenda-modal-backdrop [role="alertdialog"]')
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])
    controls().find((control) => control.hasAttribute('autofocus'))?.focus()
    if (!dialog?.contains(document.activeElement)) controls()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !modalBusy.current) { setCreateOpen(false); setEditingItem(null); setDeleteItem(null); setStatusEdit(null); setRescheduleEdit(null) }
      if (event.key !== 'Tab') return
      const list = controls()
      if (!list.length) { event.preventDefault(); dialog?.focus(); return }
      const first = list[0], last = list[list.length - 1]
      if (!list.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); if (previousFocus?.isConnected) previousFocus.focus(); else document.querySelector<HTMLButtonElement>('.agenda-new-task')?.focus() }
  }, [createOpen, Boolean(deleteItem), Boolean(statusEdit), Boolean(rescheduleEdit)])

  function openEditor(item: AgendaItem | null) {
    setError('')
    setEditingItem(item)
    setQuadrantEdit(item?.eisenhower?.quadrant ?? null)
    setNewItem(item ? { title: item.title, domain: item.domain, projectId: item.projectId ?? '', agentId: item.agentId, priority: item.priority, riskLevel: item.riskLevel, requiresApproval: item.requiresApproval, startsAt: localInputDate(item.startsAt), dueAt: localInputDate(item.dueAt), nextAction: item.nextAction } : { title: '', domain: 'projects', projectId: '', agentId: 'pmo', priority: 'normal', riskLevel: 'low', requiresApproval: false, startsAt: '', dueAt: '', nextAction: '' })
    setCreateOpen(true)
  }

  async function confirmDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!deleteItem) return
    setDeleteBusy(true)
    setError('')
    try { await onDelete(deleteItem); setDeleteItem(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la tarea') }
    finally { setDeleteBusy(false) }
  }

  const counts = useMemo(() => ({
    today: items.filter((item) => itemDay(item) === today && item.status !== 'done' && item.status !== 'cancelled').length,
    tomorrow: items.filter((item) => itemDay(item) === tomorrow && item.status !== 'done' && item.status !== 'cancelled').length,
    approvals: items.filter((item) => item.requiresApproval && !item.approvalConfirmed && item.status !== 'done' && item.status !== 'cancelled').length,
    overdue: items.filter((item) => { const day = deadlineDay(item); return day !== null && day < today && item.status !== 'done' && item.status !== 'cancelled' }).length,
  }), [items, today, tomorrow])

  const domains = [...new Set(items.map((item) => item.domain))].sort()
  const projects = [...new Set(items.map((item) => item.projectId).filter((value): value is string => Boolean(value)))].sort()
  const agentIds = [...new Set(items.map((item) => item.agentId))].sort()

  const filteredItems = useMemo(() => items.filter((item) => {
    const day = itemDay(item)
    const active = item.status !== 'done' && item.status !== 'cancelled'
    const inSelectedView = view === 'today' ? day === today
      : view === 'tomorrow' ? day === tomorrow
        : view === 'week' || view === 'calendar' ? day !== null && day >= today && day <= weekEnd
        : view === 'overdue' ? deadlineDay(item) !== null && deadlineDay(item)! < today
            : view === 'eisenhower' ? true : true
    return inSelectedView
      && (domain === 'all' || item.domain === domain)
      && (project === 'all' || item.projectId === project)
      && (agent === 'all' || item.agentId === agent)
      && (priority === 'all' || item.priority === priority)
      && (status === 'all' || (status === 'active' ? (view === 'kanban' ? item.status !== 'cancelled' : active) : item.status === status))
      && (!approvalOnly || (item.requiresApproval && !item.approvalConfirmed))
      && (sourceTopic === 'all' || item.eisenhower?.sourceTopic === sourceTopic)
      && (view !== 'search' || matchesAgendaSearch(item, searchQuery, [domainLabels[item.domain] ?? '', agentView(item.agentId).name]))
      && (view !== 'eisenhower' || (item.kind !== 'milestone' && (quadrantFilter === 'all' || item.eisenhower?.quadrant === quadrantFilter)))
  }).sort((left, right) => (left.startsAt ?? left.dueAt ?? '').localeCompare(right.startsAt ?? right.dueAt ?? '')), [items, view, today, tomorrow, weekEnd, domain, project, agent, priority, status, approvalOnly, sourceTopic, quadrantFilter, searchQuery])

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id)
    setError('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio') }
    finally { setBusyId(null) }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateBusy(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    const toBogotaIso = (value: string) => value ? new Date(`${value}:00-05:00`).toISOString() : null
    try {
      const input = { ...newItem, projectId: newItem.projectId.trim(), nextAction: newItem.nextAction.trim(), startsAt: toBogotaIso(String(formData.get('startsAt') ?? '')), dueAt: toBogotaIso(String(formData.get('dueAt') ?? '')) }
      if (editingItem) {
        const fields = editingItem.kind === 'commitment' ? ['title', 'domain', 'startsAt', 'dueAt'] : Object.keys(input)
        const changes = Object.fromEntries(fields.flatMap((key) => {
          if (key === 'startsAt' || key === 'dueAt') return newItem[key] === localInputDate(editingItem[key]) ? [] : [[key, input[key]]]
          const value = input[key as keyof typeof input]
          const original = editingItem[key as keyof AgendaItem]
          return (value === original || (key === 'projectId' && !value && !original)) ? [] : [[key, value]]
        })); if (quadrantEdit !== editingItem.eisenhower?.quadrant) changes.quadrant = quadrantEdit
        if (Object.keys(changes).length) {
          await onEdit(editingItem.id, changes)
          if ('quadrant' in changes) {
            resetFilters()
            setView('eisenhower')
            window.history.replaceState(null, '', '#agenda/eisenhower')
            setSearchDraft(''); setSearchQuery('')
            focusSavedCard.current = true
            setHighlightedId(editingItem.id)
            setNotice(`«${input.title}» guardada en ${quadrantEdit ? `${quadrantEdit} · ${quadrantLabels[quadrantEdit].title}` : 'el cuadrante automático'}. Se muestran todos los cuadrantes.`)
          } else setNotice(`Cambios guardados: ${input.title}.`)
        }
      } else await onCreate(input)
      setNewItem({ title: '', domain: 'projects', projectId: '', agentId: 'pmo', priority: 'normal', riskLevel: 'low', requiresApproval: false, startsAt: '', dueAt: '', nextAction: '' })
      setCreateOpen(false)
      setEditingItem(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la tarea') }
    finally { setCreateBusy(false) }
  }

  async function saveStatusChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!statusEdit) return
    setStatusBusy(true)
    setError('')
    try {
      await onUpdateStatus(statusEdit.item.id, statusEdit.status, statusEdit.comment.trim())
      setStatusEdit(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio') }
    finally { setStatusBusy(false) }
  }

  function openReschedule(item: AgendaItem) {
    setError('')
    setRescheduleEdit({ item, day: today, mode: 'both', busy: false })
  }

  async function saveReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rescheduleEdit) return
    const formData = new FormData(event.currentTarget)
    const day = String(formData.get('day') ?? rescheduleEdit.day)
    const mode = String(formData.get('mode') ?? rescheduleEdit.mode) as RescheduleMode
    const startTime = String(formData.get('startTime') ?? localInputTime(rescheduleEdit.item.startsAt))
    const dueTime = String(formData.get('dueTime') ?? localInputTime(rescheduleEdit.item.dueAt, startTime))
    const item = rescheduleEdit.item
    const changes: Record<string, string> = {}
    if (mode === 'both' || mode === 'start') changes.startsAt = bogotaIso(day, startTime)
    if (mode === 'both' || mode === 'due') changes.dueAt = bogotaIso(day, dueTime)
    setRescheduleEdit({ ...rescheduleEdit, day, mode, busy: true })
    setError('')
    try {
      await onEdit(item.id, changes)
      setRescheduleEdit(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo reprogramar la tarea')
      setRescheduleEdit((current) => current ? { ...current, busy: false } : current)
    }
  }

  function renderCard(item: AgendaItem) {
    const person = agentView(item.agentId)
    const day = itemDay(item)
    const dueDay = deadlineDay(item)
    const overdue = Boolean(dueDay && dueDay < today && item.status !== 'done' && item.status !== 'cancelled')
    return <article className={`agenda-task priority-${item.priority} ${overdue ? 'is-overdue' : ''} ${highlightedId === item.id ? 'agenda-task-saved' : ''}`} key={item.id} ref={highlightedId === item.id ? highlightedCard : undefined} tabIndex={highlightedId === item.id ? -1 : undefined}>
      <div className="agenda-task-identity">
        <span className="agenda-agent-avatar" style={{ '--agent-color': person.color } as CSSProperties}><img src={person.normal} alt="" /></span>
        <div className="agenda-task-heading"><strong>{item.title}</strong><div className="agenda-tags">{item.kind === 'milestone' ? <span className="agenda-milestone-tag"><Flag size={10} />Hito</span> : <span className={`agenda-priority ${item.priority}`}>{priorityLabels[item.priority] ?? item.priority}</span>}<span className={`agenda-domain domain-${item.domain}`}>{domainLabels[item.domain] ?? item.domain}</span>{item.eisenhower?.quadrant && <span className={`agenda-quadrant ${item.eisenhower.quadrant.toLowerCase()}`}>{item.eisenhower.quadrant}</span>}{item.requiresApproval && <span className={item.approvalConfirmed ? 'agenda-approval approved' : 'agenda-approval'}>{item.approvalConfirmed ? 'Aprobación registrada' : 'Requiere aprobación'}</span>}</div></div>
        {item.kind !== 'milestone' && <span className={`agenda-risk ${item.riskLevel}`} title={`Riesgo ${item.riskLevel}`}><i />Riesgo {item.riskLevel === 'low' ? 'bajo' : item.riskLevel === 'medium' ? 'medio' : 'alto'}</span>}
      </div>
      <div className="agenda-task-meta"><span><CalendarClock size={14} />{formatSchedule(item)}</span><span><Sparkles size={13} />{person.name}</span>{item.projectId && <span className="agenda-project">{item.projectId}</span>}{item.eisenhower?.sourceTopic && <span className="agenda-source-topic">{item.eisenhower.sourceTopic}</span>}{overdue && <span className="agenda-overdue"><AlertTriangle size={13} />Atrasada</span>}</div>
      {item.nextAction && <p className="agenda-next-action"><b>Siguiente:</b> {item.nextAction}</p>}
      {item.lastStatusComment?.comment && <p className="agenda-status-comment"><b>Comentario del cambio:</b> {item.lastStatusComment.comment}</p>}
      {item.sourcePath && <div className="agenda-source"><ExternalLink size={12} />{item.sourcePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'Referencia del proyecto'}</div>}
      <div className="agenda-task-footer"><span className={`agenda-status ${item.status}`}><Circle size={8} fill="currentColor" />{statusLabels[item.status] ?? item.status}</span>{item.kind === 'milestone' ? <div className="agenda-task-actions"><button className="agenda-edit-task" aria-label={`Ver el cronograma de ${item.title}`} onClick={() => { window.location.hash = `#projects/${encodeURIComponent(item.projectId ?? '')}` }}><Flag size={14} />Ver cronograma</button></div> : <div className="agenda-task-actions">
        {overdue && <button className="agenda-reschedule-task" disabled={busyId === item.id} aria-label={`Reprogramar ${item.title} esta semana`} onClick={() => openReschedule(item)}><CalendarClock size={14} />Esta semana</button>}
        {view === 'eisenhower' && item.eisenhower?.quadrant === 'Q4' && <button className="agenda-edit-task" disabled={busyId === item.id} aria-label={`Archivar ${item.title}`} onClick={() => { if (window.confirm('Esta tarea se archivará con estado cancelado y conservará su historial. ¿Continuar?')) void runAction(item.id, () => onUpdateStatus(item.id, 'cancelled', 'Archivada desde la matriz de Eisenhower')) }}>Archivar</button>}
        <button className="agenda-edit-task" disabled={busyId === item.id} aria-label={`Editar ${item.title}`} onClick={() => openEditor(item)}><Pencil size={14} />Editar</button>
        <button className="agenda-delete-task" disabled={busyId === item.id} aria-label={`Eliminar ${item.title}`} onClick={() => { setError(''); setDeleteItem(item) }}><Trash2 size={14} />Eliminar</button>
        {item.requiresApproval && !item.approvalConfirmed && <button className="agenda-approve" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => onApprove(item.id))}><ShieldAlert size={14} />Aprobar</button>}
        <label className="agenda-status-control"><ArrowDownWideNarrow size={13} /><select aria-label={`Cambiar estado de ${item.title}`} value={item.status} disabled={busyId === item.id} onChange={(event) => { const nextStatus = event.target.value as AgendaItem['status']; if (nextStatus !== item.status) setStatusEdit({ item, status: nextStatus, comment: '' }) }}>
          {(['pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled'] as AgendaItem['status'][]).map((next) => <option key={next} value={next} disabled={next === 'done' && item.requiresApproval && !item.approvalConfirmed}>{statusLabels[next]}</option>)}
        </select></label>
      </div>}</div>
    </article>
  }

  const viewOptions: { id: View; label: string }[] = [{ id: 'today', label: 'Hoy' }, { id: 'tomorrow', label: 'Mañana' }, { id: 'week', label: 'Esta semana' }, { id: 'overdue', label: `Atrasadas${counts.overdue ? ` · ${counts.overdue}` : ''}` }, { id: 'calendar', label: 'Calendario' }, { id: 'kanban', label: 'Kanban' }, { id: 'eisenhower', label: 'Eisenhower' }, { id: 'search', label: 'Todos / Buscar' }]

  return <section className="operational-agenda" aria-label="Agenda Operativa">
    <header className="agenda-hero"><div><span className="eyebrow">DMENTE SYNAPSE · CENTRO DE MANDO</span><h1>Agenda <em>Operativa</em></h1><p>El siguiente movimiento de cada proyecto, en un solo lugar.</p></div><div className="agenda-hero-stats"><div className="agenda-stat"><strong>{counts.today}</strong><span>para hoy</span></div><div className="agenda-stat"><strong>{counts.tomorrow}</strong><span>mañana</span></div><button className={`agenda-stat approval-stat ${approvalOnly ? 'selected' : ''}`} onClick={() => { setApprovalOnly((current) => !current); setView('week') }}><strong>{counts.approvals}</strong><span>por aprobar</span></button></div></header>
    <div className="agenda-ribbon"><span className="agenda-ribbon-mark"><CheckCheck size={18} /></span><div><strong>Primero lo que necesita tu atención</strong><span>{counts.overdue ? `${counts.overdue} tareas atrasadas · ` : ''}{counts.approvals ? `${counts.approvals} esperando tu aprobación` : 'No hay aprobaciones pendientes'}</span></div><span className="agenda-date-label">{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div>
    <div className="agenda-toolbar"><div className="agenda-view-tabs" role="tablist" aria-label="Vistas de agenda">{viewOptions.map((option) => <button key={option.id} role="tab" aria-selected={view === option.id} className={view === option.id ? 'active' : ''} onClick={() => { setView(option.id); if (option.id === 'eisenhower') { setStatus('all'); setQuadrantFilter('all'); window.history.replaceState(null, '', '#agenda/eisenhower') } if (option.id === 'search') { resetFilters(); setSearchQuery(searchDraft.trim()) } }}>{option.label}</button>)}</div><div className="agenda-toolbar-actions"><button className="agenda-new-task" onClick={() => openEditor(null)}><Plus size={15} />Nueva tarea</button><button className="agenda-close" onClick={onClose}><Check size={15} />Volver a oficina</button></div></div>
    <form className="agenda-search" role="search" onSubmit={searchAgenda}>
      <label htmlFor="agenda-search-input"><Search size={17} /><span>Buscar en toda la agenda</span></label>
      <div className="agenda-search-controls"><input id="agenda-search-input" type="search" value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); if (view === 'search') setSearchQuery(event.target.value.trim()) }} placeholder="Palabra clave, persona o proyecto" aria-describedby="agenda-search-hint" /><button type="submit" className="agenda-close"><Search size={15} />Buscar</button>{(searchDraft || searchQuery) && <button type="button" className="agenda-close" onClick={() => { setSearchDraft(''); setSearchQuery('') }}>Limpiar búsqueda</button>}</div>
      <small id="agenda-search-hint">Busca en todas las fechas y estados, incluidos compromisos sin fecha, hechos y cancelados.</small>
    </form>
    <div className="agenda-filters"><span className="filters-label"><Filter size={14} />Filtrar</span>
      {view === 'eisenhower' && <select aria-label="Filtrar por cuadrante" value={quadrantFilter} onChange={event => setQuadrantFilter(event.target.value as Quadrant | 'all')}><option value="all">Todos los cuadrantes</option>{(Object.keys(quadrantLabels) as Quadrant[]).map(quadrant => <option key={quadrant} value={quadrant}>{quadrant} · {quadrantLabels[quadrant].action}</option>)}</select>}
      <select aria-label="Filtrar por dominio" value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">Todos los dominios</option>{domains.map((item) => <option key={item} value={item}>{domainLabels[item] ?? item}</option>)}</select>
      <select aria-label="Filtrar por proyecto" value={project} onChange={(event) => setProject(event.target.value)}><option value="all">Todos los proyectos</option>{projects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select aria-label="Filtrar por agente" value={agent} onChange={(event) => setAgent(event.target.value)}><option value="all">Todos los agentes</option>{agentIds.map((id) => <option key={id} value={id}>{agentView(id).name}</option>)}</select>
      <select aria-label="Filtrar por prioridad" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">Toda prioridad</option>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Estados activos</option><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Filtrar por hilo de origen" value={sourceTopic} onChange={(event) => setSourceTopic(event.target.value)}><option value="all">Todos los hilos</option>{[...new Set(items.map((item) => item.eisenhower?.sourceTopic).filter((value): value is string => Boolean(value)))].sort().map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select>
    </div>
    {view === 'eisenhower' && quadrantFilter !== 'all' && <div className="agenda-filter-notice"><span>Solo se muestra {quadrantFilter}. Los demás cuadrantes están ocultos por el filtro.</span><button className="agenda-close" onClick={() => { setQuadrantFilter('all'); window.history.replaceState(null, '', '#agenda/eisenhower') }}>Ver todos los cuadrantes</button></div>}
    {notice && <div className="agenda-save-notice" role="status"><CheckCheck size={17} /><span>{notice}</span><button type="button" className="agenda-close" aria-label="Cerrar confirmación" onClick={() => { setNotice(''); setHighlightedId(null) }}><X size={15} /></button></div>}
    {view === 'search' && <p className="agenda-search-results" role="status">{filteredItems.length} {filteredItems.length === 1 ? 'resultado' : 'resultados'}{searchQuery ? ` para «${searchQuery}»` : ' en toda la agenda'}. {domain !== 'all' || project !== 'all' || agent !== 'all' || priority !== 'all' || status !== 'all' || approvalOnly || sourceTopic !== 'all' ? 'Hay filtros adicionales activos.' : 'Todas las fechas y estados.'}</p>}
    {(error || loadError) && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error || loadError}</div>}
    {deleteItem && <div className="agenda-modal-backdrop"><form tabIndex={-1} className="agenda-create-form status-comment-modal" role="alertdialog" aria-modal="true" aria-labelledby="agenda-delete-title" onSubmit={(event) => void confirmDelete(event)}>
      <header><h2 id="agenda-delete-title">Eliminar tarea</h2><button type="button" aria-label="Cerrar" disabled={deleteBusy} onClick={() => setDeleteItem(null)}><X size={18} /></button></header>
      <p className="status-comment-task">{deleteItem.title}</p><p className="status-comment-hint">Se quitará de la agenda. Su historial interno quedará conservado.</p>
      {error && <div className="agenda-error" role="alert">{error}</div>}
      <footer><button type="button" autoFocus className="agenda-close" disabled={deleteBusy} onClick={() => setDeleteItem(null)}>Cancelar</button><button type="submit" className="agenda-delete-task" disabled={deleteBusy}><Trash2 size={15} />{deleteBusy ? 'Eliminando…' : 'Eliminar tarea'}</button></footer>
    </form></div>}
    {statusEdit && <div className="agenda-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusBusy) setStatusEdit(null) }}><form tabIndex={-1} className="agenda-create-form status-comment-modal" role="dialog" aria-modal="true" aria-labelledby="status-comment-title" onSubmit={(event) => void saveStatusChange(event)}>
      <header><div><span className="eyebrow">ACTUALIZACIÓN DE AGENDA</span><h2 id="status-comment-title">Cambiar a {statusLabels[statusEdit.status]}</h2></div><button type="button" aria-label="Cerrar" disabled={statusBusy} onClick={() => setStatusEdit(null)}><X size={17} /></button></header>
      <p className="status-comment-task">{statusEdit.item.title}</p>
      <label className="agenda-field">Comentario <span className="field-optional">Opcional</span><textarea autoFocus maxLength={2000} rows={4} placeholder="Deja contexto sobre este cambio…" value={statusEdit.comment} onChange={(event) => setStatusEdit({ ...statusEdit, comment: event.target.value })} /></label>
      <p className="status-comment-hint">El comentario quedará guardado en el historial de la tarea. Evita incluir contraseñas o datos sensibles.</p>
      <footer><button className="agenda-close" type="button" disabled={statusBusy} onClick={() => setStatusEdit(null)}>Cancelar</button><button className="agenda-new-task" type="submit" disabled={statusBusy}>{statusBusy ? 'Guardando…' : 'Guardar cambio'}</button></footer>
    </form></div>}
    {rescheduleEdit && <div className="agenda-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !rescheduleEdit.busy) setRescheduleEdit(null) }}><form tabIndex={-1} className="agenda-create-form status-comment-modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" onSubmit={(event) => void saveReschedule(event)}>
      <header><div><span className="eyebrow">REPROGRAMACIÓN DE AGENDA</span><h2 id="reschedule-title">Mover a esta semana</h2></div><button type="button" aria-label="Cerrar" disabled={rescheduleEdit.busy} onClick={() => setRescheduleEdit(null)}><X size={17} /></button></header>
      <p className="status-comment-task">{rescheduleEdit.item.title}</p>
      <label className="agenda-field">Fecha de la agenda<input name="day" autoFocus type="date" min={today} max={weekEnd} value={rescheduleEdit.day} onChange={(event) => setRescheduleEdit({ ...rescheduleEdit, day: event.target.value })} /></label>
      <label className="agenda-field">Qué fecha mover<select name="mode" value={rescheduleEdit.mode} onChange={(event) => setRescheduleEdit({ ...rescheduleEdit, mode: event.target.value as RescheduleMode })}><option value="both">Inicio y vencimiento</option><option value="start">Solo inicio</option><option value="due">Solo vencimiento</option></select></label>
      {(rescheduleEdit.mode === 'both' || rescheduleEdit.mode === 'start') && <label className="agenda-field">Hora de inicio<input name="startTime" type="time" defaultValue={localInputTime(rescheduleEdit.item.startsAt)} /></label>}
      {(rescheduleEdit.mode === 'both' || rescheduleEdit.mode === 'due') && <label className="agenda-field">Hora de vencimiento<input name="dueTime" type="time" defaultValue={localInputTime(rescheduleEdit.item.dueAt, localInputTime(rescheduleEdit.item.startsAt, '09:00'))} /></label>}
      <p className="status-comment-hint">Al mover ambas fechas se conserva la hora de cada una. La tarea dejará de aparecer como atrasada cuando el vencimiento quede en el futuro.</p>
      {error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error}</div>}
      <footer><button className="agenda-close" type="button" disabled={rescheduleEdit.busy} onClick={() => setRescheduleEdit(null)}>Cancelar</button><button className="agenda-new-task" type="submit" disabled={rescheduleEdit.busy}>{rescheduleEdit.busy ? 'Guardando…' : 'Reprogramar tarea'}</button></footer>
    </form></div>}
    <div className="agenda-content">
      {view === 'eisenhower' ? <div className="eisenhower-grid">{(Object.keys(quadrantLabels) as Quadrant[]).filter((quadrant) => quadrantFilter === 'all' || quadrantFilter === quadrant).map((quadrant) => { const columnItems = filteredItems.filter((item) => item.eisenhower?.quadrant === quadrant); const meta = quadrantLabels[quadrant]; return <section className={`eisenhower-quadrant ${meta.tone}`} key={quadrant}><header><div><span>{quadrant}</span><strong>{meta.title}</strong><small>{meta.action}</small></div><b>{columnItems.length}</b></header><div className="eisenhower-cards">{columnItems.map((item) => renderCard(item))}{columnItems.length === 0 && <p className="kanban-empty">Sin tareas clasificadas</p>}</div></section> })}</div> : view === 'kanban' ? <div className="agenda-kanban">{kanbanColumns.map((column) => {
        const columnItems = filteredItems.filter((item) => kanbanStatus(item) === column)
        return <section className={`kanban-column ${column}`} key={column}><header><span>{statusLabels[column]}</span><b>{columnItems.length}</b></header><div className="kanban-cards">{columnItems.map((item) => renderCard(item))}{columnItems.length === 0 && <p className="kanban-empty">Sin tareas</p>}</div></section>
      })}</div> : view === 'calendar' ? <div className="agenda-calendar-week">{Array.from({ length: 7 }, (_, index) => shiftDay(today, index)).map((day) => {
        const dayItems = filteredItems.filter((item) => itemDay(item) === day)
        const local = new Date(`${day}T12:00:00-05:00`)
        return <section className="calendar-day" key={day}><header><small>{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short' }).format(local)}</small><strong>{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric' }).format(local)}</strong></header>{dayItems.map((item) => <button className={`calendar-event priority-${item.priority}`} key={item.id} onClick={() => setView('week')}><time>{item.startsAt ? formatTime(item.startsAt) : 'Todo el día'}</time><strong>{item.title}</strong><small>{agentView(item.agentId).name}</small></button>)}</section>
      })}</div> : view === 'search' && !filteredItems.length ? <div className="agenda-empty"><strong>Sin coincidencias</strong><p>Prueba otra palabra o quita los filtros adicionales.</p><button onClick={() => { resetFilters(); setSearchDraft(''); setSearchQuery('') }}>Ver toda la agenda</button></div> : filteredItems.length ? <div className="agenda-list">{filteredItems.map((item) => renderCard(item))}</div> : <div className="agenda-empty"><span><CheckCheck size={23} /></span><strong>Agenda despejada</strong><p>No hay tareas en esta vista con los filtros actuales.</p><button onClick={() => { setView('week'); setDomain('all'); setProject('all'); setAgent('all'); setPriority('all'); setStatus('active'); setApprovalOnly(false) }}>Ver semana completa</button></div>}
    </div>
    <footer className="agenda-footer"><span><ShieldAlert size={13} />Las acciones externas siguen sujetas a aprobación registrada.</span><span><Clock3 size={13} />Hora Colombia</span></footer>
    {createOpen && <div className="agenda-modal-backdrop"><form tabIndex={-1} className="agenda-create-form" role="dialog" aria-modal="true" aria-labelledby="agenda-create-title" onSubmit={(event) => void createTask(event)}>
      <header><h2 id="agenda-create-title">{editingItem ? 'Editar tarea' : 'Agregar a la agenda'}</h2><button type="button" className="icon-button" aria-label="Cerrar" disabled={createBusy} onClick={() => setCreateOpen(false)}><X size={18} /></button></header>
      <label className="agenda-field agenda-field-wide">Título<input autoFocus required maxLength={200} value={newItem.title} onChange={(event) => setNewItem({ ...newItem, title: event.target.value })} placeholder="¿Qué hay que hacer?" /></label>
      <div className="agenda-form-grid">
        <label className="agenda-field">Dominio<select value={newItem.domain} onChange={(event) => setNewItem({ ...newItem, domain: event.target.value })}>{Object.entries(domainLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {editingItem?.kind !== 'commitment' && <label className="agenda-field">Responsable<select value={newItem.agentId} onChange={(event) => setNewItem({ ...newItem, agentId: event.target.value as AgentId })}>{(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>}
        {editingItem?.kind !== 'commitment' && <><label className="agenda-field">Prioridad<select value={newItem.priority} onChange={(event) => setNewItem({ ...newItem, priority: event.target.value as ApiPriority })}>{Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="agenda-field">Riesgo<select value={newItem.riskLevel} onChange={(event) => setNewItem({ ...newItem, riskLevel: event.target.value as AgendaItem['riskLevel'] })}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></label></>}
        <label className="agenda-field">Inicia<input name="startsAt" type="datetime-local" value={newItem.startsAt} onChange={(event) => setNewItem({ ...newItem, startsAt: event.target.value })} /></label>
        <label className="agenda-field">Vence<input name="dueAt" type="datetime-local" value={newItem.dueAt} onChange={(event) => setNewItem({ ...newItem, dueAt: event.target.value })} /></label>
        {editingItem && <label className="agenda-field">Cuadrante<select aria-label="Cuadrante Eisenhower" value={quadrantEdit ?? ''} onChange={(event) => setQuadrantEdit((event.target.value || null) as Quadrant | null)}><option value="">Inferido automáticamente</option>{(Object.entries(quadrantLabels) as [Quadrant, typeof quadrantLabels[Quadrant]][]).map(([id, label]) => <option key={id} value={id}>{id} · {label.title}</option>)}</select></label>}
        {editingItem?.kind !== 'commitment' && <><label className="agenda-field agenda-field-wide">Proyecto<input maxLength={120} list="agenda-project-options" value={newItem.projectId} onChange={(event) => setNewItem({ ...newItem, projectId: event.target.value })} placeholder="ID del proyecto (opcional)" /><datalist id="agenda-project-options">{projects.map((item) => <option key={item} value={item} />)}</datalist></label>
        <label className="agenda-field agenda-field-wide">Siguiente acción<textarea maxLength={2000} rows={2} value={newItem.nextAction} onChange={(event) => setNewItem({ ...newItem, nextAction: event.target.value })} placeholder="Primer paso concreto (opcional)" /></label></>}
      </div>
      {editingItem?.kind !== 'commitment' && <label className="agenda-approval-toggle"><input type="checkbox" disabled={editingItem?.requiresApproval} checked={newItem.requiresApproval} onChange={(event) => setNewItem({ ...newItem, requiresApproval: event.target.checked })} /><span><strong>Requiere aprobación de Diego</strong><small>La tarea quedará en espera hasta aprobarla. Editar una tarea aprobada requiere revisarla de nuevo.</small></span></label>}
      <p className="form-purpose">Título, fechas, dominio y contexto se guardan para coordinar la agenda y sus aprobaciones. Evita datos personales innecesarios. Consulta la <a href="/legal/privacidad.html" target="_blank" rel="noreferrer">política de privacidad</a>.</p>
      {error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error}</div>}
      <footer><button type="button" className="agenda-cancel-create" disabled={createBusy} onClick={() => setCreateOpen(false)}>Cancelar</button><button type="submit" className="agenda-save-create" disabled={createBusy}><Save size={15} />{createBusy ? 'Guardando…' : editingItem ? 'Guardar cambios' : 'Guardar tarea'}</button></footer>
    </form></div>}
  </section>
}
