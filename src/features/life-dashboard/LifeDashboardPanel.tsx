import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Activity, ArrowLeft, ArrowRight, BookOpen, Brain, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, Compass, ExternalLink, Filter, Layers3, Search, ShieldAlert, Sparkles, X } from 'lucide-react'
import type { AgendaItem } from '../../main'
import { buildLifeReview, dayKey, domainLabels, isOverdue, LIFE_ZONE, lifeStatuses, shiftDay, statusInfo, type LifeStatus } from './model'
import './life-dashboard.css'

type Props = { items: AgendaItem[]; loading: boolean; loadError: string; onOpenAgenda: () => void; onClose: () => void; previewMode?: boolean }
type ModuleId = 'knowledge' | 'brand' | 'library'
const modules = {
  knowledge: { title: 'Segundo cerebro', icon: Brain, description: 'Lectura de notas e índices del vault Obsidian y originales de EBOOKS. Acceso reservado a administradores.' },
  brand: { title: 'Kit de marca', icon: Sparkles, description: 'Directrices versionadas y borradores para páginas, redes y newsletters. Falta configurar las directrices reales de marca y conectar el generador.' },
  library: { title: 'Biblioteca de vida', icon: BookOpen, description: 'Libros, artículos, podcasts y vídeos con notas y aprendizajes. La base SQL está preparada; la captura y el chat sobre apuntes están pendientes.' },
} as const
const formatDay = (key: string, long = false) => new Intl.DateTimeFormat('es-CO', { timeZone: LIFE_ZONE, weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short' }).format(new Date(`${key}T12:00:00Z`))
const formatTime = (value: string | null) => !value || !Number.isFinite(new Date(value).getTime()) || value.length === 10 ? 'Sin hora' : new Intl.DateTimeFormat('es-CO', { timeZone: LIFE_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function StateMap({ counts, selected, onSelect }: { counts: Record<LifeStatus, number>; selected: LifeStatus | 'all'; onSelect: (status: LifeStatus | 'all') => void }) {
  const total = lifeStatuses.reduce((sum, status) => sum + counts[status], 0)
  let offset = 0
  const arcs = lifeStatuses.map((status) => {
    const length = total ? counts[status] / total * 100 : 0
    const arc = { status, length, offset }
    offset += length
    return arc
  })
  return <div className="life-state-map">
    <div className="life-orbit" aria-hidden="true">
      <svg viewBox="0 0 400 270" fill="none">
        <defs><radialGradient id="life-orbit-light"><stop stopColor="#2bebd2" stopOpacity=".12" /><stop offset="1" stopColor="#2bebd2" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="200" cy="137" rx="150" ry="118" fill="url(#life-orbit-light)" />
        <ellipse cx="200" cy="137" rx="169" ry="48" stroke="#294958" transform="rotate(-28 200 137)" />
        <ellipse cx="200" cy="137" rx="169" ry="48" stroke="#294958" transform="rotate(28 200 137)" />
        <circle cx="200" cy="137" r="112" stroke="#284453" strokeDasharray="2 8" />
        <circle cx="200" cy="137" r="88" stroke="#1e3543" strokeWidth="11" />
        {arcs.filter((arc) => arc.length > 0).map(({ status, length, offset: start }) => <circle key={status} cx="200" cy="137" r="88" pathLength="100" stroke={statusInfo[status].color} strokeWidth={selected === status ? 16 : 10} strokeDasharray={`${Math.max(.2, length - .6)} ${100 - Math.max(.2, length - .6)}`} strokeDashoffset={-start} transform="rotate(-90 200 137)" opacity={selected === 'all' || selected === status ? 1 : .24} />)}
        <path d="M26 137h23m302 0h23M200 10v13m0 228v12" stroke="#64d9ff" />
        <circle cx="65" cy="78" r="4" fill="#64d9ff" /><circle cx="337" cy="195" r="4" fill="#e5bfff" />
      </svg>
      <div className="life-orbit-center"><strong>{total}</strong><span>registros</span><small>en este ámbito</small></div>
    </div>
    <div className="life-state-legend" aria-label="Filtrar la revisión por estado">
      {lifeStatuses.map((status) => <button key={status} type="button" aria-pressed={selected === status} onClick={() => onSelect(selected === status ? 'all' : status)} style={{ '--state-color': statusInfo[status].color } as CSSProperties}><span className="life-color-dot" /><span>{statusInfo[status].label}</span><strong>{counts[status]}</strong></button>)}
    </div>
  </div>
}

export function LifeDashboardPanel({ items, loading, loadError, onOpenAgenda, onClose, previewMode = false }: Props) {
  const [tab, setTab] = useState<'day' | 'review'>('day')
  const [now, setNow] = useState(() => new Date())
  const today = dayKey(now)!
  const [selectedDay, setSelectedDay] = useState(today)
  const [domain, setDomain] = useState('all')
  const [range, setRange] = useState(7)
  const [status, setStatus] = useState<LifeStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moduleId, setModuleId] = useState<ModuleId | null>(null)
  const [showData, setShowData] = useState(false)
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  const review = useMemo(() => buildLifeReview(items, { domain, selectedDay, range, now }), [items, domain, selectedDay, range, now])
  const domains = useMemo(() => [...new Set(items.map((item) => item.domain))].sort(), [items])
  const matches = (item: AgendaItem) => !query.trim() || `${item.title} ${item.nextAction}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
  const scheduled = review.scheduled.filter(matches)
  const attention = review.attention.filter(matches)
  const reviewList = review.scope.filter((item) => (status === 'all' || item.status === status) && matches(item))
  const selected = review.scope.find((item) => item.id === selectedId)
  const maxCreated = Math.max(1, ...review.days.map((entry) => entry.count))
  function chooseStatus(next: LifeStatus | 'all') { setStatus(next); setTab('review'); setSelectedId(null) }

  function taskList(list: AgendaItem[], empty: string, compact = false) {
    return list.length === 0 ? <div className="life-empty"><Compass size={27} aria-hidden="true" /><p>{empty}</p><button type="button" onClick={onOpenAgenda}>Abrir agenda <ArrowRight size={14} /></button></div> : <ul className={`life-task-list${compact ? ' life-task-list-compact' : ''}`}>
      {list.map((item) => <li key={item.id}>
        <button type="button" className={`life-task${selectedId === item.id ? ' is-selected' : ''}`} aria-expanded={selectedId === item.id} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}>
          <span className="life-task-status" style={{ '--state-color': statusInfo[item.status].color } as CSSProperties}>{item.status === 'done' ? <Check size={16} /> : item.status === 'blocked' ? <ShieldAlert size={16} /> : <span />}</span>
          <span className="life-task-copy"><strong>{item.title}</strong><span>{domainLabels[item.domain] ?? item.domain} <i /> {statusInfo[item.status].label}{isOverdue(item, now) && <b>Vencido</b>}</span>{compact && item.nextAction && <small>{item.nextAction}</small>}</span>
          {!compact && <time>{formatTime(item.startsAt ?? item.dueAt)}</time>}<ChevronRight size={15} />
        </button>
        {selectedId === item.id && <div className="life-task-detail"><p><strong>Próxima acción</strong>{item.nextAction || 'Sin próxima acción registrada.'}</p><p><strong>Vencimiento</strong>{dayKey(item.dueAt) ? formatDay(dayKey(item.dueAt)!, true) : 'Sin fecha registrada'}</p>{item.lastStatusComment?.comment && <p><strong>Último comentario</strong>{item.lastStatusComment.comment}</p>}<button type="button" onClick={onOpenAgenda}>Gestionar en agenda <ExternalLink size={13} /></button></div>}
      </li>)}
    </ul>
  }

  return <section className="life-panel" aria-labelledby="life-title">
    {previewMode && <div className="life-preview-notice" role="note">Vista de prueba. Los registros de esta página son ficticios; no hay cuentas conectadas.</div>}
    <header className="life-heading"><div className="life-heading-title"><span className="life-brand-symbol"><Compass size={27} /></span><div><h1 id="life-title">Panel de Vida<span>.</span></h1><p>Tu día, en perspectiva.</p></div></div><div className="life-heading-actions"><span><Clock3 size={14} /> Bogotá · {new Intl.DateTimeFormat('es-CO', { timeZone: LIFE_ZONE, hour: '2-digit', minute: '2-digit' }).format(now)}</span><button type="button" onClick={onClose} aria-label="Cerrar Panel de Vida"><X size={19} /></button></div></header>
    <div className="life-workspace-bar"><div className="life-tabs" role="group" aria-label="Vista del Panel de Vida"><button type="button" aria-pressed={tab === 'day'} onClick={() => setTab('day')}><CalendarDays size={17} /> Mi día</button><button type="button" aria-pressed={tab === 'review'} onClick={() => setTab('review')}><Activity size={17} /> Revisión</button></div><label className="life-domain-filter"><Filter size={14} /><span className="life-sr-only">Ámbito</span><select value={domain} onChange={(event) => { setDomain(event.target.value); setSelectedId(null) }}><option value="all">Todos los ámbitos</option>{domains.map((value) => <option key={value} value={value}>{domainLabels[value] ?? value}</option>)}</select></label><label className="life-search"><Search size={16} /><span className="life-sr-only">Buscar registros</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en tus registros" /></label></div>
    {loadError ? <div className="life-load-state" role="alert"><ShieldAlert size={32} /><h2>No se pudo actualizar el panel</h2><p>{loadError}</p><p>Los datos no están disponibles para esta revisión.</p><button type="button" onClick={() => window.location.reload()}>Volver a cargar</button></div> : loading ? <div className="life-load-state" role="status"><Layers3 size={32} /><h2>Cargando tu actividad</h2><p>Consultando los registros autorizados de la agenda.</p></div> : <>
      <div className="life-summary-strip"><span><i className="life-color-dot" style={{ '--state-color': '#64d9ff' } as CSSProperties} /><strong>{review.open}</strong> abiertos</span><button type="button" onClick={() => chooseStatus('blocked')}><ShieldAlert size={15} /><strong>{review.counts.blocked}</strong> bloqueos</button><span className={review.overdue ? 'life-overdue' : ''}><Clock3 size={15} /><strong>{review.overdue}</strong> vencidos</span><span className="life-source">Agenda Synapse · Estado actual</span></div>
      {tab === 'day' ? <div className="life-day-grid">
        <section className="life-day-agenda"><div className="life-section-heading"><div><h2>{selectedDay === today ? 'Tu agenda de hoy' : 'Tu agenda'}</h2><p>{formatDay(selectedDay, true)}</p></div><div className="life-day-controls"><button type="button" aria-label="Día anterior" onClick={() => setSelectedDay(shiftDay(selectedDay, -1))}><ArrowLeft size={16} /></button><button type="button" onClick={() => setSelectedDay(today)}>Hoy</button><button type="button" aria-label="Día siguiente" onClick={() => setSelectedDay(shiftDay(selectedDay, 1))}><ArrowRight size={16} /></button></div></div>
          <label className="life-date-picker">Elegir fecha<input type="date" value={selectedDay} onChange={(event) => { if (dayKey(event.target.value)) setSelectedDay(event.target.value) }} /></label>
          {taskList(scheduled, query ? 'No hay coincidencias en la agenda de este día.' : 'No hay registros programados para este día.')}
          <div className="life-agenda-foot"><span>{review.undated} abiertos sin fecha</span><button type="button" onClick={onOpenAgenda}>Organizar mi agenda <ArrowRight size={14} /></button></div>
        </section>
        <aside className="life-attention"><div className="life-section-heading"><div><h2>Necesita tu atención</h2><p>Bloqueos, vencidos y aprobaciones actuales.</p></div><span className="life-attention-count">{attention.length}</span></div>{taskList(attention, query ? 'No hay coincidencias en los registros que necesitan atención.' : 'No hay bloqueos, vencidos o aprobaciones pendientes registrados.', true)}</aside>
        <div className="life-day-insight"><Activity size={22} /><div><strong>Una pausa para ver el conjunto.</strong><p>Explora estados y registros creados, y vuelve al detalle con un clic.</p></div><button type="button" onClick={() => setTab('review')}>Abrir revisión <ArrowRight size={16} /></button></div>
      </div> : <div className="life-review-grid">
        <section className="life-chart-panel"><div className="life-section-heading"><div><h2>Registros creados</h2><p>{review.createdInPeriod} en los {range} días hasta {formatDay(selectedDay)}.</p></div><div className="life-range-controls" role="group" aria-label="Periodo del gráfico">{[7, 30, 90].map((days) => <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)}>{days} días</button>)}</div></div>
          <div className="life-chart" aria-label="Gráfico de registros creados por día"><div className="life-chart-scale" aria-hidden="true"><span>{maxCreated}</span><span>0</span></div><div className="life-chart-bars">{review.days.map((entry) => <button type="button" key={entry.day} aria-label={`${formatDay(entry.day)}: ${entry.count} registros creados. Ver agenda de ese día.`} onClick={() => { setSelectedDay(entry.day); setTab('day') }} style={{ '--bar-height': `${entry.count / maxCreated * 100}%` } as CSSProperties}><span className="life-chart-tooltip">{formatDay(entry.day)}<strong>{entry.count} registros</strong></span><span className={`life-chart-bar${entry.count ? '' : ' is-zero'}`} />{range === 7 && <small>{new Date(`${entry.day}T12:00:00Z`).getUTCDate()}</small>}</button>)}</div></div>
          <div className="life-chart-axis"><span>{formatDay(review.days[0].day)}</span><span>Selecciona un día para ver su agenda</span><span>{formatDay(selectedDay)}</span></div>
          <p className="life-chart-note"><CircleHelp size={14} /> Cuenta fechas de creación. No representa tareas completadas ni horas trabajadas.</p><button type="button" className="life-data-toggle" aria-expanded={showData} onClick={() => setShowData(!showData)}>{showData ? 'Ocultar' : 'Ver'} datos del gráfico</button>
          {showData && <div className="life-data-table"><table><caption>Registros creados por día, {domain === 'all' ? 'todos los ámbitos' : domainLabels[domain] ?? domain}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Creados</th></tr></thead><tbody>{review.days.map((entry) => <tr key={entry.day}><td>{entry.day}</td><td>{entry.count}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="life-distribution"><div className="life-section-heading"><div><h2>Mapa de estados</h2><p>Todos los registros del ámbito, en su estado actual.</p></div><Layers3 size={19} /></div><StateMap counts={review.counts} selected={status} onSelect={chooseStatus} /></section>
        <section className="life-review-records"><div className="life-section-heading"><div><h2>{status === 'all' ? 'Detrás de las cifras' : statusInfo[status].label}</h2><p>{reviewList.length} registros{query ? ' que coinciden con tu búsqueda' : ' en este ámbito'}. Selecciona uno para revisar la próxima acción.</p></div>{status !== 'all' && <button className="life-reset" type="button" onClick={() => setStatus('all')}>Todos los estados <X size={13} /></button>}</div>{taskList(reviewList, 'No hay registros con estos filtros.')}</section>
      </div>}
      <section className="life-connected-tools" aria-label="Estado de integraciones"><span><span className="life-color-dot" style={{ '--state-color': '#65edcf' } as CSSProperties} />{previewMode ? 'Agenda de prueba' : 'Agenda Synapse'}</span><span>Google Calendar <small>Pendiente</small></span><span>Gmail <small>Pendiente</small></span><span>n8n <small>Pendiente</small></span></section>
    </>}
    <section className="life-modules"><div className="life-modules-heading"><h2>Tu ecosistema</h2><p>La base para los cinco sistemas.</p></div><div className="life-module-links">{(Object.entries(modules) as [ModuleId, typeof modules[ModuleId]][]).map(([id, module]) => <button type="button" key={id} aria-expanded={id === 'knowledge' ? undefined : moduleId === id} onClick={() => { if (id === 'knowledge') { window.location.hash = 'second-brain'; return } setModuleId(moduleId === id ? null : id) }}><module.icon size={21} /><span><strong>{module.title}</strong><small>{id === 'knowledge' ? 'Obsidian · Solo administradores' : 'Base SQL preparada'}</small></span><ChevronRight size={15} /></button>)}</div>{moduleId && <div className="life-module-detail"><strong>{modules[moduleId].title}</strong><p>{modules[moduleId].description}</p><button type="button" onClick={() => setModuleId(null)}>Cerrar detalle <X size={13} /></button></div>}</section>
    <footer className="life-footnote"><span>Solo registros visibles para tu sesión. El estado de tareas es actual, también al consultar otras fechas.</span><span>America/Bogota</span></footer>
    <span className="life-sr-only" aria-live="polite">{selected ? `Registro seleccionado: ${selected.title}` : ''}</span>
  </section>
}
