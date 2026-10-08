import { useState } from 'react'
import { agents } from '../../agents'
import type { AgentId } from '../../types'
import { Modal } from './Modal'
import { call, dayToIso, domainLabels, inputDay, milestoneStatusLabels, projectStatusLabels, type Client, type Milestone, type ProjectStatus, type ProjectSummary } from './model'

const agentOptions = Object.entries(agents) as [AgentId, typeof agents[AgentId]][]
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()

/** Runs a save and keeps the dialog open with the server's message when it fails. */
function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try { await action(); onDone() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); setBusy(false) }
  }
  return { busy, error, run }
}

type ProjectFormProps = { project?: ProjectSummary; clients: Client[] | null; onClose: () => void; onSaved: (project: ProjectSummary) => void }

export function ProjectForm({ project, clients, onClose, onSaved }: ProjectFormProps) {
  // The parent closes the dialog from onSaved, so a successful save leaves the form busy until it unmounts.
  const { busy, error, run } = useSave(() => undefined)

  function submit(data: FormData) {
    const next: Record<string, string | null> = {
      name: text(data, 'name'), code: text(data, 'code') || null, domain: text(data, 'domain'), ownerAgentId: text(data, 'ownerAgentId'), status: text(data, 'status'),
      nextAction: text(data, 'nextAction') || null, sourcePath: text(data, 'sourcePath') || null, sourceDriveFolder: text(data, 'sourceDriveFolder') || null, obsidianNote: text(data, 'obsidianNote') || null,
    }
    if (clients) next.clientId = text(data, 'clientId') || null
    // Dates are sent only when the day changed, so a time set elsewhere (for example by Lucía) is not overwritten.
    for (const [key, endOfDay] of [['startsAt', false], ['dueAt', true]] as const) {
      const day = text(data, key)
      if (day !== inputDay(project?.[key])) next[key] = dayToIso(day, endOfDay)
    }
    void run(async () => {
      if (!project) {
        const id = text(data, 'id')
        const result = await call<{ project: ProjectSummary }>('/api/projects', 'POST', { ...next, ...(id ? { id } : {}) })
        onSaved(result.project); return
      }
      const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== (project[key as keyof ProjectSummary] ?? null)))
      if (!Object.keys(changes).length) { onClose(); return }
      const result = await call<{ project: ProjectSummary }>(`/api/projects/${encodeURIComponent(project.id)}`, 'PATCH', changes)
      onSaved(result.project)
    })
  }

  return <Modal title={project ? 'Editar proyecto' : 'Nuevo proyecto'} eyebrow="PROYECTOS" busy={busy} error={error} submitLabel={project ? 'Guardar cambios' : 'Crear proyecto'} onClose={onClose} onSubmit={submit}>
    <label className="agenda-field agenda-field-wide">Nombre<input name="name" data-autofocus required maxLength={200} defaultValue={project?.name ?? ''} placeholder="Nombre del proyecto" /></label>
    <div className="agenda-form-grid project-form-grid">
      <label className="agenda-field">Estado<select name="status" defaultValue={project?.status ?? 'en_curso'}>{(Object.entries(projectStatusLabels) as [ProjectStatus, string][]).filter(([id]) => id !== 'por_clasificar' || project?.status === 'por_clasificar').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="agenda-field">Dominio<select name="domain" defaultValue={project?.domain ?? 'agency'}>{Object.entries(domainLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="agenda-field">Responsable<select name="ownerAgentId" defaultValue={project?.ownerAgentId ?? 'pmo'}>{agentOptions.map(([id, agent]) => <option key={id} value={id}>{agent.name}</option>)}</select></label>
      {clients ? <label className="agenda-field">Cliente<select name="clientId" defaultValue={project?.clientId ?? ''}><option value="">Sin cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : <span className="project-field-note">Tu acceso no incluye la lista de clientes.</span>}
      <label className="agenda-field">Inicia<input name="startsAt" type="date" defaultValue={inputDay(project?.startsAt)} /></label>
      <label className="agenda-field">Termina<input name="dueAt" type="date" defaultValue={inputDay(project?.dueAt)} /></label>
      <label className="agenda-field">Código corto <span className="field-optional">Opcional</span><input name="code" maxLength={20} defaultValue={project?.code ?? ''} placeholder="Ej. CORPAV" /></label>
      {!project && <label className="agenda-field">Identificador <span className="field-optional">Opcional</span><input name="id" maxLength={120} pattern="[a-z0-9][a-z0-9-]{1,119}" title="Minúsculas, números y guiones" placeholder="Se deriva del nombre" /></label>}
      <label className="agenda-field agenda-field-wide">Siguiente acción<textarea name="nextAction" maxLength={2000} rows={2} defaultValue={project?.nextAction ?? ''} placeholder="El próximo paso concreto" /></label>
      <label className="agenda-field agenda-field-wide">Archivo de estado <span className="field-optional">Opcional</span><input name="sourcePath" maxLength={1000} defaultValue={project?.sourcePath ?? ''} placeholder="Ruta del PROYECTO_ESTADO.md" /></label>
      <label className="agenda-field">Carpeta de Drive <span className="field-optional">Opcional</span><input name="sourceDriveFolder" maxLength={1000} defaultValue={project?.sourceDriveFolder ?? ''} /></label>
      <label className="agenda-field">Nota de Obsidian <span className="field-optional">Opcional</span><input name="obsidianNote" maxLength={500} defaultValue={project?.obsidianNote ?? ''} /></label>
    </div>
    <p className="status-comment-hint">El código corto es el mismo que se usa en Bitácora para identificar el proyecto.</p>
  </Modal>
}

type MilestoneFormProps = { projectId: string; milestone?: Milestone; phases: string[]; onClose: () => void; onSaved: () => void }

export function MilestoneForm({ projectId, milestone, phases, onClose, onSaved }: MilestoneFormProps) {
  const { busy, error, run } = useSave(onSaved)

  function submit(data: FormData) {
    const next: Record<string, string | null> = { title: text(data, 'title'), phase: text(data, 'phase') || null, ownerAgentId: text(data, 'ownerAgentId') || null, ownerName: text(data, 'ownerName') || null, status: text(data, 'status'), notes: text(data, 'notes') || null }
    const startDay = text(data, 'startsAt')
    const dueDay = text(data, 'dueAt')
    if (startDay !== inputDay(milestone?.startsAt)) next.startsAt = dayToIso(startDay, false)
    if (dueDay !== inputDay(milestone?.dueAt)) next.dueAt = dayToIso(dueDay, true)
    const route = `/api/projects/${encodeURIComponent(projectId)}/milestones`
    void run(async () => {
      if (!milestone) { await call(route, 'POST', next); return }
      const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== (milestone[key as keyof Milestone] ?? null)))
      if (Object.keys(changes).length) await call(`${route}/${milestone.id}`, 'PATCH', changes)
    })
  }

  return <Modal title={milestone ? 'Editar hito' : 'Nuevo hito'} eyebrow="CRONOGRAMA" busy={busy} error={error} submitLabel={milestone ? 'Guardar cambios' : 'Agregar hito'} onClose={onClose} onSubmit={submit}>
    <label className="agenda-field agenda-field-wide">Hito<input name="title" data-autofocus required maxLength={200} defaultValue={milestone?.title ?? ''} placeholder="¿Qué debe estar cumplido?" /></label>
    <div className="agenda-form-grid project-form-grid">
      <label className="agenda-field">Vence<input name="dueAt" type="date" required defaultValue={inputDay(milestone?.dueAt)} /></label>
      <label className="agenda-field">Inicia <span className="field-optional">Opcional</span><input name="startsAt" type="date" defaultValue={inputDay(milestone?.startsAt)} /></label>
      <label className="agenda-field">Fase <span className="field-optional">Opcional</span><input name="phase" maxLength={80} list="project-phase-options" defaultValue={milestone?.phase ?? ''} placeholder="Ej. Descubrimiento" /><datalist id="project-phase-options">{phases.map((phase) => <option key={phase} value={phase} />)}</datalist></label>
      <label className="agenda-field">Estado<select name="status" defaultValue={milestone?.status ?? 'pending'}>{Object.entries(milestoneStatusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="agenda-field">Agente responsable<select name="ownerAgentId" defaultValue={milestone?.ownerAgentId ?? ''}><option value="">El responsable del proyecto</option>{agentOptions.map(([id, agent]) => <option key={id} value={id}>{agent.name}</option>)}</select></label>
      <label className="agenda-field">Persona responsable <span className="field-optional">Opcional</span><input name="ownerName" maxLength={120} defaultValue={milestone?.ownerName ?? ''} placeholder="Nombre" /></label>
      <label className="agenda-field agenda-field-wide">Notas <span className="field-optional">Opcional</span><textarea name="notes" maxLength={2000} rows={2} defaultValue={milestone?.notes ?? ''} /></label>
    </div>
    <p className="status-comment-hint">El hito cuenta como atrasado al terminar el día de vencimiento, hora Colombia.</p>
  </Modal>
}

export function ClientForm({ onClose, onSaved }: { onClose: () => void; onSaved: (client: Client) => void }) {
  const { busy, error, run } = useSave(() => undefined)
  function submit(data: FormData) {
    void run(async () => {
      const result = await call<{ client: Client }>('/api/clients', 'POST', { name: text(data, 'name'), contactName: text(data, 'contactName') || null, email: text(data, 'email') || null, phone: text(data, 'phone') || null, industry: text(data, 'industry') || null })
      onSaved(result.client)
    })
  }
  return <Modal title="Nuevo cliente" eyebrow="CLIENTES" busy={busy} error={error} submitLabel="Crear cliente" onClose={onClose} onSubmit={submit}>
    <p className="form-purpose">El nombre identifica al cliente. Los datos opcionales de contacto, correo, teléfono y sector se guardan para gestionar la relación y el proyecto en Synapse.</p>
    <label className="agenda-field agenda-field-wide">Nombre o empresa<input name="name" data-autofocus required maxLength={200} /></label>
    <div className="agenda-form-grid project-form-grid">
      <label className="agenda-field">Contacto <span className="field-optional">Opcional</span><input name="contactName" maxLength={120} /></label>
      <label className="agenda-field">Sector <span className="field-optional">Opcional</span><input name="industry" maxLength={100} placeholder="Ej. Turismo" /></label>
      <label className="agenda-field">Correo <span className="field-optional">Opcional</span><input name="email" type="email" maxLength={200} /></label>
      <label className="agenda-field">Teléfono <span className="field-optional">Opcional</span><input name="phone" maxLength={40} /></label>
    </div>
  </Modal>
}

type ConfirmProps = { title: string; subject: string; hint: string; submitLabel: string; danger?: boolean; field?: { name: string; label: string; placeholder?: string }; action: (value: string) => Promise<unknown>; onClose: () => void; onDone: () => void }

/** Small confirmation dialog, optionally with one free-text field (a status comment or a blocker resolution). */
export function ConfirmAction({ title, subject, hint, submitLabel, danger, field, action, onClose, onDone }: ConfirmProps) {
  const { busy, error, run } = useSave(onDone)
  return <Modal narrow danger={danger} title={title} busy={busy} error={error} submitLabel={submitLabel} onClose={onClose} onSubmit={(data) => void run(() => action(field ? text(data, field.name) : ''))}>
    <p className="status-comment-task">{subject}</p>
    {field && <label className="agenda-field">{field.label} <span className="field-optional">Opcional</span><textarea name={field.name} data-autofocus maxLength={2000} rows={3} placeholder={field.placeholder} /></label>}
    <p className="status-comment-hint">{hint}</p>
  </Modal>
}
