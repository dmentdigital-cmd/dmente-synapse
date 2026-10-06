import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, RefreshCw, UsersRound } from 'lucide-react'

type Lead = {
  id: string
  name: string
  email: string | null
  phone: string
  company: string | null
  service: string | null
  message: string | null
  language: 'es' | 'en' | null
  utmSource: string | null
  utmCampaign: string | null
  page: string | null
  pipeline: string
  stage: string
  ownerId: string
  status: string
  submissionCount: number
  createdAt: string
  updatedAt: string
}

type Page = { leads: Lead[]; total: number; limit: number; offset: number }

async function fetchPage(offset: number, signal?: AbortSignal): Promise<Page> {
  const response = await fetch(`/api/leads?limit=50&offset=${offset}`, { signal })
  const data = await response.json() as Page & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los leads.')
  return data
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return <div className="lead-detail-field"><dt>{label}</dt><dd>{value || 'Sin dato'}</dd></div>
}

export function LeadsPanel({ onClose }: { onClose: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const selected = leads.find((lead) => lead.id === selectedId) ?? leads[0]

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void fetchPage(0, controller.signal).then((page) => {
      setLeads(page.leads)
      setTotal(page.total)
      setNextOffset(page.offset + page.leads.length)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los leads.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reloadKey])

  async function loadMore() {
    setLoadingMore(true)
    setError('')
    try {
      const page = await fetchPage(nextOffset)
      setLeads((current) => {
        const existingIds = new Set(current.map((lead) => lead.id))
        return [...current, ...page.leads.filter((lead) => !existingIds.has(lead.id))]
      })
      setTotal(page.total)
      setNextOffset(page.offset + page.leads.length)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar más leads.')
    } finally { setLoadingMore(false) }
  }

  return <section className="leads-panel" aria-labelledby="leads-heading">
    <header className="leads-heading">
      <div><span className="eyebrow">FORMULARIO DMENTE DIGITAL</span><h1 id="leads-heading">Leads recibidos</h1><p>Consultas que llegaron desde la landing.</p></div>
      <div className="leads-heading-actions"><span className="leads-total">{total} {total === 1 ? 'contacto' : 'contactos'}</span><button type="button" onClick={() => setReloadKey((current) => current + 1)} disabled={loading} aria-label="Actualizar leads"><RefreshCw size={16} /> Actualizar</button><button type="button" onClick={onClose}><ArrowLeft size={16} /> Volver</button></div>
    </header>
    {error && <div className="leads-error" role="alert">{error}</div>}
    {loading && leads.length === 0 ? <div className="leads-empty" role="status">Cargando leads...</div> : leads.length === 0 && !error ? <div className="leads-empty"><UsersRound size={28} /><strong>Aún no hay leads registrados.</strong><span>Los envíos de la landing aparecerán aquí cuando n8n los registre.</span></div> : <div className="leads-layout">
      <div className="leads-list" aria-label="Lista de leads">
        <div className="leads-list-heading"><strong>Entradas recientes</strong><span>Última actividad</span></div>
        {leads.map((lead) => <button type="button" key={lead.id} className={`lead-row${selected?.id === lead.id ? ' selected' : ''}`} onClick={() => setSelectedId(lead.id)} aria-current={selected?.id === lead.id ? 'true' : undefined}>
          <span className="lead-row-top"><strong>{lead.name}</strong><small>{dateLabel(lead.updatedAt)}</small></span>
          <span className="lead-row-sub">{lead.company || lead.service || lead.email || lead.phone}</span>
          <span className="lead-row-bottom"><span>{lead.service || 'Servicio sin especificar'}</span>{lead.submissionCount > 1 && <em>{lead.submissionCount} envíos</em>}</span>
        </button>)}
        {nextOffset < total && <button className="leads-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}><ArrowDown size={15} /> {loadingMore ? 'Cargando...' : 'Cargar más'}</button>}
      </div>
      {selected && <article className="lead-detail" aria-label={`Detalle de ${selected.name}`}>
        <div className="lead-detail-top"><span className="eyebrow">CONTACTO SELECCIONADO</span><span className="lead-stage">{selected.stage}</span></div>
        <h2>{selected.name}</h2><p className="lead-detail-intro">{selected.company || 'Empresa sin especificar'} · {selected.service || 'Servicio sin especificar'}</p>
        <dl className="lead-detail-grid">
          <Detail label="WhatsApp" value={selected.phone} /><Detail label="Correo" value={selected.email} />
          <Detail label="Empresa" value={selected.company} /><Detail label="Servicio" value={selected.service} />
          <Detail label="Idioma" value={selected.language} /><Detail label="Envíos registrados" value={selected.submissionCount} />
        </dl>
        <div className="lead-message"><span className="eyebrow">MENSAJE MÁS RECIENTE</span><p>{selected.message || 'El contacto no dejó un mensaje.'}</p></div>
        <div className="lead-source"><span className="eyebrow">ORIGEN Y SEGUIMIENTO</span><dl className="lead-detail-grid">
          <Detail label="Fuente UTM" value={selected.utmSource} /><Detail label="Campaña UTM" value={selected.utmCampaign} />
          <Detail label="Página" value={selected.page} /><Detail label="Embudo" value={selected.pipeline} />
          <Detail label="Responsable" value={selected.ownerId} /><Detail label="Estado" value={selected.status} />
          <Detail label="Primer envío" value={dateLabel(selected.createdAt)} /><Detail label="Última actividad" value={dateLabel(selected.updatedAt)} />
        </dl></div>
      </article>}
    </div>}
  </section>
}
