import { useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, ChartNoAxesColumn, CircleCheck, CircleDollarSign, ExternalLink, Flag, ListChecks, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { agents } from '../../agents'
import type { AgentId } from '../../types'
import { ConfirmAction, MilestoneForm, ProjectForm } from './ProjectForms'
import { FinanceTab, GoalsTab } from './TrackingTabs'
import { call, canWrite, dateTimeLabel, dayLabel, domainLabels, healthLabels, milestoneStatusLabels, plural, projectStatusLabels, taskStatusLabels, updateKindLabels, type Client, type Milestone, type MilestoneStatus, type ProjectDetailData, type ProjectStatus, type ProjectUpdate, type Role, type UpdateKind } from './model'

type Tab = 'schedule' | 'tasks' | 'updates' | 'goals' | 'finance' | 'info'
type Dialog =
  | { type: 'project' }
  | { type: 'milestone'; milestone?: Milestone }
  | { type: 'project-status'; status: ProjectStatus }
  | { type: 'milestone-status'; milestone: Milestone; status: MilestoneStatus }
  | { type: 'delete-milestone'; milestone: Milestone }
  | { type: 'delete-project' }
  | { type: 'resolve'; update: ProjectUpdate }
type Props = { detail: ProjectDetailData; role?: Role; clients: Client[] | null; onChanged: () => void; onDeleted: () => void }

const DAY_MS = 86_400_000
const agentName = (id: AgentId | null) => (id ? agents[id]?.name ?? id : null)
const isOpen = (status: MilestoneStatus) => status === 'pending' || status === 'in_progress' || status === 'blocked'

export function HealthPill({ health }: { health: 'verde' | 'amarillo' | 'rojo' | null }) {
  if (!health) return null
  return <span className={`project-health ${health}`}><i aria-hidden="true" />{healthLabels[health]}</span>
}

export function ProgressBar({ progress, done, total }: { progress: number | null; done: number; total: number }) {
  if (progress === null) return <span className="project-progress-empty">Sin hitos todavía</span>
  return <div className="project-progress" role="img" aria-label={`Avance ${progress} %: ${done} de ${plural(total, 'hito cumplido', 'hitos cumplidos')}`}><span><i style={{ width: `${progress}%` }} /></span><b>{progress}%</b><small>{done} de {total} hitos</small></div>
}

export function ProjectDetail({ detail, role, clients, onChanged, onDeleted }: Props) {
  const { project, milestones, tasks, updates, metrics, finance } = detail
  const [tab, setTab] = useState<Tab>('schedule')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [draft, setDraft] = useState<{ kind: UpdateKind; text: string }>({ kind: 'avance', text: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const writer = canWrite(role)
  const admin = role === 'admin'
  const route = `/api/projects/${encodeURIComponent(project.id)}`
  const now = Date.now()
  const phases = [...new Set(milestones.map((milestone) => milestone.phase).filter((phase): phase is string => Boolean(phase)))]
  const groups = [...phases.map((phase) => ({ phase, items: milestones.filter((milestone) => milestone.phase === phase) })), { phase: 'Sin fase', items: milestones.filter((milestone) => !milestone.phase) }].filter((group) => group.items.length)
  const openBlockers = updates.filter((update) => update.kind === 'bloqueo' && !update.resolvedAt)
  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
  const done = () => { setDialog(null); onChanged() }

  async function quick(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try { await action(); onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.') }
    finally { setBusy(false) }
  }

  async function addUpdate() {
    const text = draft.text.trim()
    if (!text) return
    await quick(async () => { await call(`${route}/updates`, 'POST', { kind: draft.kind, text }); setDraft({ kind: 'avance', text: '' }) })
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'schedule', label: `Cronograma${milestones.length ? ` · ${milestones.length}` : ''}`, icon: <Flag size={14} /> },
    { id: 'tasks', label: `Tareas${openTasks.length ? ` · ${openTasks.length}` : ''}`, icon: <ListChecks size={14} /> },
    { id: 'updates', label: `Novedades${openBlockers.length ? ` · ${plural(openBlockers.length, 'bloqueo', 'bloqueos')}` : ''}`, icon: <MessageSquareText size={14} /> },
    { id: 'goals', label: `Seguimiento${metrics.length ? ` · ${metrics.length}` : ''}`, icon: <ChartNoAxesColumn size={14} /> },
    ...(finance ? [{ id: 'finance' as Tab, label: 'Cobros', icon: <CircleDollarSign size={14} /> }] : []),
    { id: 'info', label: 'Ficha', icon: <ExternalLink size={14} /> },
  ]

  return <article className="lead-detail project-detail" aria-label={`Proyecto ${project.name}`}>
    <div className="lead-detail-top"><span className="eyebrow">{(domainLabels[project.domain] ?? project.domain).toUpperCase()}{project.clientName ? ` · ${project.clientName.toUpperCase()}` : ''}</span>{project.code && <span className="project-code">{project.code}</span>}</div>
    <h2>{project.name}</h2>
    <div className="project-detail-status">
      <HealthPill health={project.health} />
      {writer ? <label className="project-status-control">Estado<select aria-label="Estado del proyecto" value={project.status} disabled={busy} onChange={(event) => setDialog({ type: 'project-status', status: event.target.value as ProjectStatus })}>{(Object.entries(projectStatusLabels) as [ProjectStatus, string][]).filter(([id]) => id !== 'por_clasificar' || project.status === 'por_clasificar').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label> : <span className="project-status-label">{projectStatusLabels[project.status]}</span>}
      {writer && <button type="button" className="agenda-edit-task" onClick={() => setDialog({ type: 'project' })}><Pencil size={14} />Editar</button>}
    </div>
    {project.status === 'por_clasificar' && <div className="project-classify" role="note"><strong>Aún no está confirmado como proyecto.</strong><span>Este identificador ya lo usan {plural(tasks.length, 'tarea', 'tareas')} en la Agenda. Actívalo si es un proyecto real o descártalo si era solo una etiqueta.</span>{writer && <div><button type="button" className="agenda-new-task" disabled={busy} onClick={() => void quick(() => call(route, 'PATCH', { status: 'en_curso' }))}><CircleCheck size={14} />Activar como proyecto</button><button type="button" className="agenda-close" disabled={busy} onClick={() => void quick(() => call(route, 'PATCH', { status: 'cancelado' }))}>Descartar</button></div>}</div>}
    {project.healthReasons.length > 0 && <ul className={`project-reasons ${project.health ?? ''}`}>{project.healthReasons.map((reason) => <li key={reason}><AlertTriangle size={13} />{reason}</li>)}</ul>}
    <ProgressBar progress={project.progress} done={project.milestoneCounts.done} total={project.milestoneCounts.total} />
    {project.nextAction && <p className="project-next-action"><b>Siguiente acción:</b> {project.nextAction}</p>}
    {error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{error}</div>}

    <div className="agenda-view-tabs project-tabs" role="tablist" aria-label="Secciones del proyecto">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</div>

    {tab === 'schedule' && <section className="project-tab" aria-label="Cronograma">
      {writer && <div className="project-tab-actions"><button type="button" className="agenda-new-task" onClick={() => setDialog({ type: 'milestone' })}><Plus size={15} />Nuevo hito</button></div>}
      {groups.length === 0 ? <div className="project-empty"><Flag size={22} /><strong>Este proyecto aún no tiene cronograma.</strong><span>Agrega los hitos con su fecha y responsable para ver el avance y recibir alertas de atraso.</span></div> : groups.map((group) => <div className="project-phase" key={group.phase}>
        <h3>{group.phase}<small>{group.items.filter((milestone) => milestone.status === 'done').length} de {group.items.filter((milestone) => milestone.status !== 'cancelled').length}</small></h3>
        <ol className="milestone-list">{group.items.map((milestone) => {
          const late = isOpen(milestone.status) && Date.parse(milestone.dueAt) < now
          const daysLate = late ? Math.max(1, Math.floor((now - Date.parse(milestone.dueAt)) / DAY_MS)) : 0
          const owner = milestone.ownerName ?? agentName(milestone.ownerAgentId) ?? agentName(project.ownerAgentId)
          return <li key={milestone.id} className={`milestone-row ${milestone.status}${late ? ' is-late' : ''}`}>
            <div className="milestone-body">
              <strong>{milestone.title}</strong>
              <span className="milestone-meta"><CalendarClock size={13} />{dayLabel(milestone.dueAt)}{owner ? ` · ${owner}` : ''}</span>
              {late && <span className="milestone-late"><AlertTriangle size={12} />Atrasado {plural(daysLate, 'día', 'días')}</span>}
              {milestone.status === 'done' && milestone.completedAt && <span className="milestone-done">Cumplido el {dayLabel(milestone.completedAt)}</span>}
              {milestone.notes && <p>{milestone.notes}</p>}
            </div>
            <div className="milestone-actions">
              {writer ? <select aria-label={`Estado de ${milestone.title}`} className={`milestone-status ${milestone.status}`} value={milestone.status} disabled={busy} onChange={(event) => setDialog({ type: 'milestone-status', milestone, status: event.target.value as MilestoneStatus })}>{Object.entries(milestoneStatusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select> : <span className={`milestone-status ${milestone.status}`}>{milestoneStatusLabels[milestone.status]}</span>}
              {writer && <button type="button" className="agenda-edit-task" aria-label={`Editar ${milestone.title}`} onClick={() => setDialog({ type: 'milestone', milestone })}><Pencil size={14} /></button>}
              {admin && <button type="button" className="agenda-delete-task" aria-label={`Eliminar ${milestone.title}`} onClick={() => setDialog({ type: 'delete-milestone', milestone })}><Trash2 size={14} /></button>}
            </div>
          </li>
        })}</ol>
      </div>)}
    </section>}

    {tab === 'tasks' && <section className="project-tab" aria-label="Tareas">
      {tasks.length === 0 ? <div className="project-empty"><ListChecks size={22} /><strong>No hay tareas enlazadas a este proyecto.</strong><span>Al crear o editar una tarea en la Agenda, escribe <code>{project.id}</code> en el campo Proyecto.</span></div> : <ul className="project-task-list">{tasks.map((task) => <li key={task.id} className={task.status === 'done' || task.status === 'cancelled' ? 'is-closed' : ''}>
        <div><strong>{task.title}</strong><span>{[task.kind === 'commitment' ? 'Compromiso' : agentName(task.agentId), task.dueAt ? `vence ${dateTimeLabel(task.dueAt)}` : task.startsAt ? dateTimeLabel(task.startsAt) : 'sin fecha'].filter(Boolean).join(' · ')}</span></div>
        <span className={`agenda-status ${task.status}`}>{taskStatusLabels[task.status] ?? task.status}</span>
      </li>)}</ul>}
      <div className="project-tab-actions"><button type="button" className="agenda-close" onClick={() => { window.location.hash = '#agenda' }}><CalendarClock size={14} />Abrir la Agenda</button></div>
    </section>}

    {tab === 'updates' && <section className="project-tab" aria-label="Novedades">
      {writer && <form className="project-update-form" onSubmit={(event) => { event.preventDefault(); void addUpdate() }}>
        <label className="agenda-field">Tipo<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as UpdateKind })}>{Object.entries(updateKindLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="agenda-field project-update-text">Novedad<textarea maxLength={2000} rows={2} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder={draft.kind === 'bloqueo' ? '¿Qué está frenando el proyecto?' : '¿Qué pasó en el proyecto?'} /></label>
        <button type="submit" className="agenda-new-task" disabled={busy || !draft.text.trim()}><Plus size={15} />Registrar</button>
      </form>}
      {updates.length === 0 ? <div className="project-empty"><MessageSquareText size={22} /><strong>Sin novedades registradas.</strong><span>Los avances, bloqueos, riesgos, decisiones y lecciones quedan aquí con fecha y autor.</span></div> : <ul className="project-update-list">{updates.map((update) => {
        const open = update.kind === 'bloqueo' && !update.resolvedAt
        return <li key={update.id} className={`project-update ${update.kind}${open ? ' is-open' : ''}`}>
          <div className="project-update-top"><span className="project-update-kind">{updateKindLabels[update.kind]}{open ? ' abierto' : update.kind === 'bloqueo' ? ' resuelto' : ''}</span><small>{dateTimeLabel(update.createdAt)} · {update.source === 'mcp' ? 'Lucía' : update.source === 'bitacora' ? 'Bitácora' : 'Synapse'}</small></div>
          <p>{update.text}</p>
          {update.resolvedAt && <p className="project-update-resolution"><b>Resuelto el {dateTimeLabel(update.resolvedAt)}.</b> {update.resolution}</p>}
          {open && writer && <button type="button" className="agenda-edit-task" onClick={() => setDialog({ type: 'resolve', update })}><CircleCheck size={14} />Marcar resuelto</button>}
        </li>
      })}</ul>}
    </section>}

    {tab === 'goals' && <GoalsTab projectId={project.id} metrics={metrics} writer={writer} admin={admin} onChanged={onChanged} />}
    {tab === 'finance' && finance && <FinanceTab projectId={project.id} finance={finance} writer={writer} onChanged={onChanged} />}

    {tab === 'info' && <section className="project-tab" aria-label="Ficha">
      <dl className="lead-detail-grid">
        <Field label="Identificador" value={project.id} /><Field label="Código corto" value={project.code} />
        <Field label="Cliente" value={project.clientName} /><Field label="Responsable" value={agentName(project.ownerAgentId)} />
        <Field label="Inicia" value={project.startsAt ? dayLabel(project.startsAt) : null} /><Field label="Termina" value={project.dueAt ? dayLabel(project.dueAt) : null} />
        <Field label="Archivo de estado" value={project.sourcePath} /><Field label="Carpeta de Drive" value={project.sourceDriveFolder} />
        <Field label="Nota de Obsidian" value={project.obsidianNote} /><Field label="Último movimiento" value={dateTimeLabel(project.lastActivityAt)} />
        <Field label="Registrado por" value={project.origin === 'auto' ? 'Detectado en tareas' : project.origin === 'mcp' ? 'Lucía (MCP)' : 'Synapse'} /><Field label="Creado" value={dayLabel(project.createdAt)} />
      </dl>
      {admin && <div className="project-tab-actions"><button type="button" className="agenda-delete-task" onClick={() => setDialog({ type: 'delete-project' })}><Trash2 size={14} />Eliminar proyecto</button></div>}
    </section>}

    {dialog?.type === 'project' && <ProjectForm project={project} clients={clients} onClose={() => setDialog(null)} onSaved={done} />}
    {dialog?.type === 'milestone' && <MilestoneForm projectId={project.id} milestone={dialog.milestone} phases={phases} onClose={() => setDialog(null)} onSaved={done} />}
    {dialog?.type === 'project-status' && <ConfirmAction title={`Cambiar a ${projectStatusLabels[dialog.status]}`} subject={project.name} hint="El comentario queda en el historial del proyecto." submitLabel="Guardar cambio" field={{ name: 'comment', label: 'Comentario', placeholder: 'Contexto de este cambio…' }} action={(comment) => call(route, 'PATCH', { status: dialog.status, ...(comment ? { comment } : {}) })} onClose={() => setDialog(null)} onDone={done} />}
    {dialog?.type === 'milestone-status' && <ConfirmAction title={`Cambiar a ${milestoneStatusLabels[dialog.status]}`} subject={dialog.milestone.title} hint="El comentario queda en el historial del hito." submitLabel="Guardar cambio" field={{ name: 'comment', label: 'Comentario', placeholder: 'Contexto de este cambio…' }} action={(comment) => call(`${route}/milestones/${dialog.milestone.id}`, 'PATCH', { status: dialog.status, ...(comment ? { comment } : {}) })} onClose={() => setDialog(null)} onDone={done} />}
    {dialog?.type === 'resolve' && <ConfirmAction title="Resolver bloqueo" subject={dialog.update.text} hint="El bloqueo deja de contar en el semáforo. El registro original se conserva." submitLabel="Marcar resuelto" field={{ name: 'resolution', label: '¿Cómo se resolvió?' }} action={(resolution) => call(`${route}/updates/${dialog.update.id}/resolve`, 'POST', resolution ? { resolution } : {})} onClose={() => setDialog(null)} onDone={done} />}
    {dialog?.type === 'delete-milestone' && <ConfirmAction danger title="Eliminar hito" subject={dialog.milestone.title} hint="Se quita del cronograma y de la Agenda. Su historial interno queda conservado." submitLabel="Eliminar hito" action={() => call(`${route}/milestones/${dialog.milestone.id}`, 'DELETE', { expectedTitle: dialog.milestone.title })} onClose={() => setDialog(null)} onDone={done} />}
    {dialog?.type === 'delete-project' && <ConfirmAction danger title="Eliminar proyecto" subject={project.name} hint="El proyecto deja de aparecer en Synapse. Sus tareas siguen en la Agenda y el historial interno queda conservado. El identificador no se podrá reutilizar." submitLabel="Eliminar proyecto" action={() => call(route, 'DELETE', { expectedName: project.name })} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onDeleted() }} />}
  </article>
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div className="lead-detail-field"><dt>{label}</dt><dd>{value || 'Sin dato'}</dd></div>
}
