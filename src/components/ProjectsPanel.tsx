import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Building2, ChevronDown, ChevronRight, FolderKanban, Plus, RefreshCw } from 'lucide-react'
import { ProjectDetail } from './projects/ProjectDetail'
import { ClientForm, ProjectForm } from './projects/ProjectForms'
import { call, canWrite, dayLabel, domainLabels, healthLabels, plural, projectStatusLabels, type Client, type ProjectDetailData, type ProjectStatus, type ProjectSummary, type Role } from './projects/model'

type Filter = 'active' | 'all' | ProjectStatus
const ACTIVE: ProjectStatus[] = ['propuesta', 'en_curso', 'pausado']

function idFromHash(): string | null {
  const match = window.location.hash.match(/^#projects\/(.+)$/)
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return null }
}

export function ProjectsPanel({ role, onClose }: { role?: Role; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [clients, setClients] = useState<Client[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash)
  const [detail, setDetail] = useState<ProjectDetailData | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [domain, setDomain] = useState('all')
  const [showUnclassified, setShowUnclassified] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [dialog, setDialog] = useState<'project' | 'client' | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const writer = canWrite(role)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    call<{ projects: ProjectSummary[] }>('/api/projects', 'GET', undefined, controller.signal).then((data) => setProjects(data.projects))
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los proyectos.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    // Clients are optional: without agency or sales access the list stays hidden and projects still work.
    call<{ clients: Client[] }>('/api/clients', 'GET', undefined, controller.signal).then((data) => setClients(data.clients)).catch(() => { if (!controller.signal.aborted) setClients(null) })
    return () => controller.abort()
  }, [reloadKey])

  const unclassified = useMemo(() => projects.filter((project) => project.status === 'por_clasificar' && (domain === 'all' || project.domain === domain)), [projects, domain])
  const visible = useMemo(() => projects.filter((project) => (domain === 'all' || project.domain === domain) && (filter === 'all' ? project.status !== 'por_clasificar' : filter === 'active' ? ACTIVE.includes(project.status) : project.status === filter)), [projects, filter, domain])
  const groupUnclassified = filter === 'active' || filter === 'all'
  const activeId = selectedId ?? visible[0]?.id ?? null

  useEffect(() => {
    if (!activeId) { setDetail(null); return }
    const controller = new AbortController()
    setDetailError('')
    call<ProjectDetailData>(`/api/projects/${encodeURIComponent(activeId)}`, 'GET', undefined, controller.signal).then(setDetail)
      .catch((cause: unknown) => { if (!controller.signal.aborted) { setDetail(null); setDetailError(cause instanceof Error ? cause.message : 'No se pudo cargar el proyecto.') } })
    return () => controller.abort()
  }, [activeId, reloadKey])

  // The selected project lives in the URL so the Agenda can link straight to a project's schedule.
  useEffect(() => {
    const next = selectedId ? `#projects/${encodeURIComponent(selectedId)}` : '#projects'
    if (window.location.hash !== next && window.location.hash.startsWith('#projects')) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }, [selectedId])
  useEffect(() => {
    const sync = () => { if (window.location.hash.startsWith('#projects/')) setSelectedId(idFromHash()) }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function select(id: string) {
    setSelectedId(id)
    // On a phone the detail sits below the list, so bring it into view.
    if (window.matchMedia('(max-width: 700px)').matches) window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
  }
  const reload = () => setReloadKey((current) => current + 1)
  const tracked = visible.filter((project) => project.health !== null)
  const count = (health: string) => tracked.filter((project) => project.health === health).length
  const domains = [...new Set(projects.map((project) => project.domain))].sort()
  const shown = detail && detail.project.id === activeId ? detail : null

  function row(project: ProjectSummary) {
    const selected = project.id === activeId
    return <button type="button" key={project.id} className={`lead-row project-row${selected ? ' selected' : ''}`} onClick={() => select(project.id)} aria-current={selected ? 'true' : undefined}>
      <span className="lead-row-top"><strong><i className={`project-dot ${project.health ?? 'none'}`} aria-hidden="true" />{project.name}</strong><small>{projectStatusLabels[project.status]}</small></span>
      <span className="lead-row-sub">{project.clientName ?? domainLabels[project.domain] ?? project.domain}{project.health ? ` · ${healthLabels[project.health]}` : ''}{project.openTasks ? ` · ${plural(project.openTasks, 'tarea abierta', 'tareas abiertas')}` : ''}</span>
      <span className="lead-row-bottom"><span>{project.nextMilestone ? `Próximo: ${project.nextMilestone.title} · ${dayLabel(project.nextMilestone.dueAt)}` : project.status === 'por_clasificar' ? 'Pendiente de confirmar' : 'Sin hitos abiertos'}</span>{project.milestoneCounts.overdue > 0 && <em>{plural(project.milestoneCounts.overdue, 'atrasado', 'atrasados')}</em>}</span>
      {project.progress !== null && <span className="project-row-progress" aria-hidden="true"><i style={{ width: `${project.progress}%` }} /></span>}
    </button>
  }

  return <section className="leads-panel projects-panel" aria-labelledby="projects-heading">
    <header className="leads-heading">
      <div><span className="eyebrow">DMENTE SYNAPSE · SEGUIMIENTO</span><h1 id="projects-heading">Proyectos</h1><p>El cronograma, los bloqueos y el siguiente paso de cada proyecto.</p></div>
      <div className="leads-heading-actions">
        {writer && <button type="button" className="projects-primary" onClick={() => setDialog('project')}><Plus size={16} /> Nuevo proyecto</button>}
        {writer && clients && <button type="button" onClick={() => setDialog('client')}><Building2 size={16} /> Nuevo cliente</button>}
        <button type="button" onClick={reload} disabled={loading} aria-label="Actualizar proyectos"><RefreshCw size={16} /> Actualizar</button>
        <button type="button" onClick={onClose}><ArrowLeft size={16} /> Volver</button>
      </div>
    </header>
    <div className="projects-summary" aria-label="Resumen del semáforo">
      <span className="project-health rojo"><i aria-hidden="true" />{count('rojo')} requieren atención</span>
      <span className="project-health amarillo"><i aria-hidden="true" />{count('amarillo')} en observación</span>
      <span className="project-health verde"><i aria-hidden="true" />{count('verde')} al día</span>
      <div className="agenda-filters projects-filters">
        <select aria-label="Filtrar por estado" value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setSelectedId(null) }}><option value="active">Proyectos activos</option><option value="all">Todos los estados</option>{(Object.entries(projectStatusLabels) as [ProjectStatus, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Filtrar por dominio" value={domain} onChange={(event) => { setDomain(event.target.value); setSelectedId(null) }}><option value="all">Todos los dominios</option>{domains.map((item) => <option key={item} value={item}>{domainLabels[item] ?? item}</option>)}</select>
      </div>
    </div>
    {error && <div className="leads-error" role="alert">{error}</div>}
    {loading && projects.length === 0 ? <div className="leads-empty" role="status">Cargando proyectos...</div> : <div className="leads-layout projects-layout">
      <div className="leads-list" aria-label="Lista de proyectos">
        <div className="leads-list-heading"><strong>{plural(visible.length, 'proyecto', 'proyectos')}</strong><span>Primero lo que necesita atención</span></div>
        {visible.map(row)}
        {visible.length === 0 && <div className="project-empty project-empty-list"><FolderKanban size={22} /><strong>{projects.some((project) => project.status !== 'por_clasificar') ? 'Ningún proyecto con estos filtros.' : 'Aún no hay proyectos confirmados.'}</strong><span>{writer ? 'Crea uno nuevo o activa uno de los identificadores que ya usan tus tareas.' : 'Cuando se registren aparecerán aquí.'}</span></div>}
        {groupUnclassified && unclassified.length > 0 && <>
          <button type="button" className="project-group-toggle" aria-expanded={showUnclassified} onClick={() => setShowUnclassified((current) => !current)}>{showUnclassified ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Por clasificar · {unclassified.length}<small>Identificadores que ya usan tus tareas</small></button>
          {showUnclassified && unclassified.map(row)}
        </>}
      </div>
      <div ref={detailRef} className="project-detail-slot">
        {detailError && <div className="leads-error" role="alert">{detailError}</div>}
        {shown ? <ProjectDetail key={shown.project.id} detail={shown} role={role} clients={clients} onChanged={reload} onDeleted={() => { setSelectedId(null); reload() }} /> : !detailError && <div className="lead-detail project-empty"><FolderKanban size={24} /><strong>{activeId ? 'Cargando proyecto...' : 'Selecciona un proyecto'}</strong>{!activeId && <span>Verás su cronograma de hitos, sus tareas y sus novedades.</span>}</div>}
      </div>
    </div>}
    {shown && <span className="sr-only" aria-live="polite">{shown.project.name}: {shown.project.health ? healthLabels[shown.project.health] : projectStatusLabels[shown.project.status]}</span>}
    {dialog === 'project' && <ProjectForm clients={clients} onClose={() => setDialog(null)} onSaved={(project) => { setDialog(null); setFilter(ACTIVE.includes(project.status) ? 'active' : 'all'); setDomain('all'); setSelectedId(project.id); reload() }} />}
    {dialog === 'client' && <ClientForm onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload() }} />}
  </section>
}
