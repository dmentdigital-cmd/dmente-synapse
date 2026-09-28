import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { AlertTriangle, ArrowDownWideNarrow, CalendarClock, Check, CheckCheck, Circle, Clock3, ExternalLink, Filter, Plus, Save, ShieldAlert, Sparkles, X } from 'lucide-react'
import { agents } from '../agents'
import type { AgendaItem } from '../main'
import type { AgentId } from '../types'

type NewAgendaItem = { title: string; domain: string; projectId: string; agentId: AgentId; priority: ApiPriority; riskLevel: AgendaItem['riskLevel']; requiresApproval: boolean; startsAt: string; dueAt: string; nextAction: string }
type ApiPriority = AgendaItem['priority']
type Props = { items: AgendaItem[]; loadError: string; onCreate: (input: Omit<NewAgendaItem, 'startsAt' | 'dueAt'> & { startsAt: string | null; dueAt: string | null }) => Promise<void>; onUpdateStatus: (id: string, status: AgendaItem['status']) => Promise<void>; onApprove: (id: string) => Promise<void>; onClose: () => void }
type View = 'today' | 'tomorrow' | 'week' | 'overdue' | 'calendar' | 'kanban'
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

export function OperationalAgenda({ items, loadError, onCreate, onUpdateStatus, onApprove, onClose }: Props) {
  const [view, setView] = useState<View>('today')
  const [domain, setDomain] = useState('all')
  const [project, setProject] = useState('all')
  const [agent, setAgent] = useState('all')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('active')
  const [approvalOnly, setApprovalOnly] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [newItem, setNewItem] = useState<NewAgendaItem>({ title: '', domain: 'projects', projectId: '', agentId: 'pmo', priority: 'normal', riskLevel: 'low', requiresApproval: false, startsAt: '', dueAt: '', nextAction: '' })
  const [error, setError] = useState('')
  const today = dateKey(new Date())
  const tomorrow = shiftDay(today, 1)
  const weekEnd = shiftDay(today, 6)

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
            : true
    return inSelectedView
      && (domain === 'all' || item.domain === domain)
      && (project === 'all' || item.projectId === project)
      && (agent === 'all' || item.agentId === agent)
      && (priority === 'all' || item.priority === priority)
      && (status === 'all' || (status === 'active' ? (view === 'kanban' ? item.status !== 'cancelled' : active) : item.status === status))
      && (!approvalOnly || (item.requiresApproval && !item.approvalConfirmed))
  }).sort((left, right) => (left.startsAt ?? left.dueAt ?? '').localeCompare(right.startsAt ?? right.dueAt ?? '')), [items, view, today, tomorrow, weekEnd, domain, project, agent, priority, status, approvalOnly])

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
      await onCreate({ ...newItem, projectId: newItem.projectId.trim(), nextAction: newItem.nextAction.trim(), startsAt: toBogotaIso(String(formData.get('startsAt') ?? '')), dueAt: toBogotaIso(String(formData.get('dueAt') ?? '')) })
      setNewItem({ title: '', domain: 'projects', projectId: '', agentId: 'pmo', priority: 'normal', riskLevel: 'low', requiresApproval: false, startsAt: '', dueAt: '', nextAction: '' })
      setCreateOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la tarea') }
    finally { setCreateBusy(false) }
  }

  function renderCard(item: AgendaItem) {
    const person = agentView(item.agentId)
    const day = itemDay(item)
    const dueDay = deadlineDay(item)
    const overdue = Boolean(dueDay && dueDay < today && item.status !== 'done' && item.status !== 'cancelled')
    return <article className={`agenda-task priority-${item.priority} ${overdue ? 'is-overdue' : ''}`} key={item.id}>
      <div className="agenda-task-identity">
        <span className="agenda-agent-avatar" style={{ '--agent-color': person.color } as CSSProperties}><img src={person.normal} alt="" /></span>
        <div className="agenda-task-heading"><strong>{item.title}</strong><div className="agenda-tags"><span className={`agenda-priority ${item.priority}`}>{priorityLabels[item.priority] ?? item.priority}</span><span className={`agenda-domain domain-${item.domain}`}>{domainLabels[item.domain] ?? item.domain}</span>{item.requiresApproval && <span className={item.approvalConfirmed ? 'agenda-approval approved' : 'agenda-approval'}>{item.approvalConfirmed ? 'Aprobación registrada' : 'Requiere aprobación'}</span>}</div></div>
        <span className={`agenda-risk ${item.riskLevel}`} title={`Riesgo ${item.riskLevel}`}><i />Riesgo {item.riskLevel === 'low' ? 'bajo' : item.riskLevel === 'medium' ? 'medio' : 'alto'}</span>
      </div>
      <div className="agenda-task-meta"><span><CalendarClock size={14} />{formatSchedule(item)}</span><span><Sparkles size={13} />{person.name}</span>{item.projectId && <span className="agenda-project">{item.projectId}</span>}{overdue && <span className="agenda-overdue"><AlertTriangle size={13} />Atrasada</span>}</div>
      {item.nextAction && <p className="agenda-next-action"><b>Siguiente:</b> {item.nextAction}</p>}
      {item.sourcePath && <div className="agenda-source"><ExternalLink size={12} />{item.sourcePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'Referencia del proyecto'}</div>}
      <div className="agenda-task-footer"><span className={`agenda-status ${item.status}`}><Circle size={8} fill="currentColor" />{statusLabels[item.status] ?? item.status}</span><div className="agenda-task-actions">
        {item.requiresApproval && !item.approvalConfirmed && <button className="agenda-approve" disabled={busyId === item.id} onClick={() => void runAction(item.id, () => onApprove(item.id))}><ShieldAlert size={14} />Aprobar</button>}
        <label className="agenda-status-control"><ArrowDownWideNarrow size={13} /><select aria-label={`Cambiar estado de ${item.title}`} value={item.status} disabled={busyId === item.id} onChange={(event) => void runAction(item.id, () => onUpdateStatus(item.id, event.target.value as AgendaItem['status']))}>
          {(['pending', 'in_progress', 'waiting_approval', 'blocked', 'done', 'cancelled'] as AgendaItem['status'][]).map((next) => <option key={next} value={next} disabled={next === 'done' && item.requiresApproval && !item.approvalConfirmed}>{statusLabels[next]}</option>)}
        </select></label>
      </div></div>
    </article>
  }

  const viewOptions: { id: View; label: string }[] = [{ id: 'today', label: 'Hoy' }, { id: 'tomorrow', label: 'Mañana' }, { id: 'week', label: 'Esta semana' }, { id: 'overdue', label: `Atrasadas${counts.overdue ? ` · ${counts.overdue}` : ''}` }, { id: 'calendar', label: 'Calendario' }, { id: 'kanban', label: 'Kanban' }]

  return <section className="operational-agenda" aria-label="Agenda Operativa">
    <header className="agenda-hero"><div><span className="eyebrow">DMENTE SYNAPSE · CENTRO DE MANDO</span><h1>Agenda <em>Operativa</em></h1><p>El siguiente movimiento de cada proyecto, en un solo lugar.</p></div><div className="agenda-hero-stats"><div className="agenda-stat"><strong>{counts.today}</strong><span>para hoy</span></div><div className="agenda-stat"><strong>{counts.tomorrow}</strong><span>mañana</span></div><button className={`agenda-stat approval-stat ${approvalOnly ? 'selected' : ''}`} onClick={() => { setApprovalOnly((current) => !current); setView('week') }}><strong>{counts.approvals}</strong><span>por aprobar</span></button></div></header>
    <div className="agenda-ribbon"><span className="agenda-ribbon-mark"><CheckCheck size={18} /></span><div><strong>Primero lo que necesita tu atención</strong><span>{counts.overdue ? `${counts.overdue} tareas atrasadas · ` : ''}{counts.approvals ? `${counts.approvals} esperando tu aprobación` : 'No hay aprobaciones pendientes'}</span></div><span className="agenda-date-label">{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span></div>
    <div className="agenda-toolbar"><div className="agenda-view-tabs" role="tablist" aria-label="Vistas de agenda">{viewOptions.map((option) => <button key={option.id} role="tab" aria-selected={view === option.id} className={view === option.id ? 'active' : ''} onClick={() => setView(option.id)}>{option.label}</button>)}</div><div className="agenda-toolbar-actions"><button className="agenda-new-task" onClick={() => setCreateOpen(true)}><Plus size={15} />Nueva tarea</button><button className="agenda-close" onClick={onClose}><Check size={15} />Volver a oficina</button></div></div>
    <div className="agenda-filters"><span className="filters-label"><Filter size={14} />Filtrar</span>
      <select aria-label="Filtrar por dominio" value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">Todos los dominios</option>{domains.map((item) => <option key={item} value={item}>{domainLabels[item] ?? item}</option>)}</select>
      <select aria-label="Filtrar por proyecto" value={project} onChange={(event) => setProject(event.target.value)}><option value="all">Todos los proyectos</option>{projects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select aria-label="Filtrar por agente" value={agent} onChange={(event) => setAgent(event.target.value)}><option value="all">Todos los agentes</option>{agentIds.map((id) => <option key={id} value={id}>{agentView(id).name}</option>)}</select>
      <select aria-label="Filtrar por prioridad" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">Toda prioridad</option>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Estados activos</option><option value="all">Todos los estados</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
    </div>
    {(error || loadError) && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error || loadError}</div>}
    <div className="agenda-content">
      {view === 'kanban' ? <div className="agenda-kanban">{kanbanColumns.map((column) => {
        const columnItems = filteredItems.filter((item) => kanbanStatus(item) === column)
        return <section className={`kanban-column ${column}`} key={column}><header><span>{statusLabels[column]}</span><b>{columnItems.length}</b></header><div className="kanban-cards">{columnItems.map((item) => renderCard(item))}{columnItems.length === 0 && <p className="kanban-empty">Sin tareas</p>}</div></section>
      })}</div> : view === 'calendar' ? <div className="agenda-calendar-week">{Array.from({ length: 7 }, (_, index) => shiftDay(today, index)).map((day) => {
        const dayItems = filteredItems.filter((item) => itemDay(item) === day)
        const local = new Date(`${day}T12:00:00-05:00`)
        return <section className="calendar-day" key={day}><header><small>{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short' }).format(local)}</small><strong>{new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric' }).format(local)}</strong></header>{dayItems.map((item) => <button className={`calendar-event priority-${item.priority}`} key={item.id} onClick={() => setView('week')}><time>{item.startsAt ? formatTime(item.startsAt) : 'Todo el día'}</time><strong>{item.title}</strong><small>{agentView(item.agentId).name}</small></button>)}</section>
      })}</div> : filteredItems.length ? <div className="agenda-list">{filteredItems.map((item) => renderCard(item))}</div> : <div className="agenda-empty"><span><CheckCheck size={23} /></span><strong>Agenda despejada</strong><p>No hay tareas en esta vista con los filtros actuales.</p><button onClick={() => { setView('week'); setDomain('all'); setProject('all'); setAgent('all'); setPriority('all'); setStatus('active'); setApprovalOnly(false) }}>Ver semana completa</button></div>}
    </div>
    <footer className="agenda-footer"><span><ShieldAlert size={13} />Las acciones externas siguen sujetas a aprobación registrada.</span><span><Clock3 size={13} />Hora Colombia</span></footer>
    {createOpen && <div className="agenda-modal-backdrop"><form className="agenda-create-form" role="dialog" aria-modal="true" aria-labelledby="agenda-create-title" onSubmit={(event) => void createTask(event)}>
      <header><div><span className="eyebrow">NUEVO PENDIENTE</span><h2 id="agenda-create-title">Agregar a la agenda</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={() => setCreateOpen(false)}><X size={18} /></button></header>
      <label className="agenda-field agenda-field-wide">Título<input autoFocus required maxLength={200} value={newItem.title} onChange={(event) => setNewItem({ ...newItem, title: event.target.value })} placeholder="¿Qué hay que hacer?" /></label>
      <div className="agenda-form-grid">
        <label className="agenda-field">Dominio<select value={newItem.domain} onChange={(event) => setNewItem({ ...newItem, domain: event.target.value })}>{Object.entries(domainLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="agenda-field">Responsable<select value={newItem.agentId} onChange={(event) => setNewItem({ ...newItem, agentId: event.target.value as AgentId })}>{(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
        <label className="agenda-field">Prioridad<select value={newItem.priority} onChange={(event) => setNewItem({ ...newItem, priority: event.target.value as ApiPriority })}>{Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="agenda-field">Riesgo<select value={newItem.riskLevel} onChange={(event) => setNewItem({ ...newItem, riskLevel: event.target.value as AgendaItem['riskLevel'] })}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></label>
        <label className="agenda-field">Inicia<input name="startsAt" type="datetime-local" value={newItem.startsAt} onChange={(event) => setNewItem({ ...newItem, startsAt: event.target.value })} /></label>
        <label className="agenda-field">Vence<input name="dueAt" type="datetime-local" value={newItem.dueAt} onChange={(event) => setNewItem({ ...newItem, dueAt: event.target.value })} /></label>
        <label className="agenda-field agenda-field-wide">Proyecto<input maxLength={120} value={newItem.projectId} onChange={(event) => setNewItem({ ...newItem, projectId: event.target.value })} placeholder="ID del proyecto (opcional)" /></label>
        <label className="agenda-field agenda-field-wide">Siguiente acción<textarea rows={2} value={newItem.nextAction} onChange={(event) => setNewItem({ ...newItem, nextAction: event.target.value })} placeholder="Primer paso concreto (opcional)" /></label>
      </div>
      <label className="agenda-approval-toggle"><input type="checkbox" checked={newItem.requiresApproval} onChange={(event) => setNewItem({ ...newItem, requiresApproval: event.target.checked })} /><span><strong>Requiere aprobación de Diego</strong><small>La tarea quedará en espera y no podrá marcarse como hecha hasta aprobarla.</small></span></label>
      {error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error}</div>}
      <footer><button type="button" className="agenda-cancel-create" onClick={() => setCreateOpen(false)}>Cancelar</button><button type="submit" className="agenda-save-create" disabled={createBusy}><Save size={15} />{createBusy ? 'Guardando…' : 'Guardar tarea'}</button></footer>
    </form></div>}
  </section>
}
