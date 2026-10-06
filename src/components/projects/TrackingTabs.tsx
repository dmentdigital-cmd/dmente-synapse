import { useState } from 'react'
import { AlertTriangle, Copy, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { call, dayLabel, dayToIso, type ProjectFinance, type ProjectMetric } from './model'

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const money = (value: number | null) => (value === null ? 'Sin dato' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value))
const invoiceLabels = { pendiente: 'Pendiente', pagado: 'Pagado', anulado: 'Anulado' } as const
/** Empty field means "no value"; anything else must be a number, and the server validates the range. */
const numeric = (data: FormData, key: string): number | null => { const raw = String(data.get(key) ?? '').trim(); return raw === '' ? null : Number(raw) }

function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await action(); onDone() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.') } finally { setBusy(false) }
  }
  return { busy, error, run }
}

type GoalsProps = { projectId: string; metrics: ProjectMetric[]; writer: boolean; admin: boolean; onChanged: () => void }

export function GoalsTab({ projectId, metrics, writer, admin, onChanged }: GoalsProps) {
  const route = `/api/projects/${encodeURIComponent(projectId)}`
  const [editing, setEditing] = useState<ProjectMetric | 'new' | null>(null)
  const [report, setReport] = useState('')
  const [copied, setCopied] = useState(false)
  const save = useAction(() => { setEditing(null); onChanged() })
  const quick = useAction(onChanged)
  const build = useAction(() => undefined)

  function submit(data: FormData) {
    void save.run(() => call(`${route}/metrics`, 'POST', { name: String(data.get('name') ?? '').trim(), unit: String(data.get('unit') ?? '').trim() || null, targetTotal: numeric(data, 'targetTotal'), plannedToDate: numeric(data, 'plannedToDate'), achieved: numeric(data, 'achieved') ?? 0 }))
  }
  function generate(data: FormData) {
    const query = new URLSearchParams()
    for (const key of ['from', 'to']) { const value = String(data.get(key) ?? ''); if (value) query.set(key, value) }
    setCopied(false)
    void build.run(async () => setReport((await call<{ markdown: string }>(`${route}/report?${query}`)).markdown))
  }
  const current = editing && editing !== 'new' ? editing : null

  return <section className="project-tab" aria-label="Seguimiento">
    {writer && <div className="project-tab-actions"><button type="button" className="agenda-new-task" onClick={() => setEditing('new')}><Plus size={15} />Nueva meta</button></div>}
    {quick.error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{quick.error}</div>}
    {metrics.length === 0 ? <div className="project-empty"><FileText size={22} /><strong>Este proyecto aún no tiene metas.</strong><span>Define la meta total, lo planeado a la fecha y lo alcanzado para medir el cumplimiento.</span></div> : <ul className="project-task-list metric-list">{metrics.map((metric) => {
      const percent = metric.targetTotal > 0 ? Math.round((metric.achieved / metric.targetTotal) * 100) : null
      const behind = metric.plannedToDate !== null && metric.achieved < metric.plannedToDate
      return <li key={metric.id}>
        <div><strong>{metric.name}</strong><span>Alcanzado {number.format(metric.achieved)} de {number.format(metric.targetTotal)}{metric.unit ? ` ${metric.unit}` : ''}{metric.plannedToDate !== null ? ` · planeado a la fecha ${number.format(metric.plannedToDate)}` : ''}</span>{behind && <span className="milestone-late"><AlertTriangle size={12} />Por debajo de lo planeado</span>}{percent !== null && <span className="project-row-progress" aria-hidden="true"><i style={{ width: `${Math.min(percent, 100)}%` }} /></span>}</div>
        <div className="milestone-actions">{percent !== null && <b className="metric-percent">{percent}%</b>}{writer && <button type="button" className="agenda-edit-task" aria-label={`Actualizar ${metric.name}`} onClick={() => setEditing(metric)}><Pencil size={14} /></button>}{admin && <button type="button" className="agenda-delete-task" aria-label={`Eliminar ${metric.name}`} disabled={quick.busy} onClick={() => void quick.run(() => call(`${route}/metrics/${metric.id}`, 'DELETE'))}><Trash2 size={14} /></button>}</div>
      </li>
    })}</ul>}

    <form className="project-report-form" onSubmit={(event) => { event.preventDefault(); generate(new FormData(event.currentTarget)) }}>
      <strong>Informe de seguimiento</strong>
      <label className="agenda-field">Desde<input name="from" type="date" /></label>
      <label className="agenda-field">Hasta<input name="to" type="date" /></label>
      <button type="submit" className="agenda-close" disabled={build.busy}><FileText size={14} />{build.busy ? 'Generando…' : 'Generar informe'}</button>
      <small>Sin fechas toma los últimos 30 días. Incluye estado, hitos, metas, bloqueos, avances, riesgos y lecciones.</small>
    </form>
    {build.error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{build.error}</div>}
    {report && <div className="project-report"><div className="project-tab-actions"><button type="button" className="agenda-close" onClick={() => { void navigator.clipboard?.writeText(report).then(() => setCopied(true)).catch(() => setCopied(false)) }}><Copy size={14} />{copied ? 'Copiado' : 'Copiar informe'}</button></div><pre tabIndex={0}>{report}</pre></div>}

    {editing && <Modal title={current ? 'Actualizar meta' : 'Nueva meta'} eyebrow="SEGUIMIENTO" busy={save.busy} error={save.error} submitLabel="Guardar meta" onClose={() => setEditing(null)} onSubmit={submit}>
      <label className="agenda-field agenda-field-wide">Meta<input name="name" required maxLength={120} readOnly={Boolean(current)} defaultValue={current?.name ?? ''} placeholder="Ej. Leads calificados" /></label>
      <div className="agenda-form-grid project-form-grid">
        <label className="agenda-field">Meta total<input name="targetTotal" type="number" min="0" step="any" required defaultValue={current?.targetTotal ?? ''} /></label>
        <label className="agenda-field">Unidad <span className="field-optional">Opcional</span><input name="unit" maxLength={40} defaultValue={current?.unit ?? ''} placeholder="Ej. leads" /></label>
        <label className="agenda-field">Planeada a la fecha <span className="field-optional">Opcional</span><input name="plannedToDate" type="number" min="0" step="any" defaultValue={current?.plannedToDate ?? ''} /></label>
        <label className="agenda-field">Alcanzada<input name="achieved" type="number" min="0" step="any" data-autofocus={current ? true : undefined} defaultValue={current?.achieved ?? 0} /></label>
      </div>
    </Modal>}
  </section>
}

type FinanceProps = { projectId: string; finance: ProjectFinance; writer: boolean; onChanged: () => void }

export function FinanceTab({ projectId, finance, writer, onChanged }: FinanceProps) {
  const route = `/api/projects/${encodeURIComponent(projectId)}`
  const [dialog, setDialog] = useState<'budget' | 'invoice' | null>(null)
  const save = useAction(() => { setDialog(null); onChanged() })
  const quick = useAction(onChanged)
  const figures: [string, number | null][] = [['Presupuesto', finance.budget], ['Costo real', finance.actualCost], ['Cobrado', finance.totals.invoiced], ['Pagado', finance.totals.paid], ['Por cobrar', finance.totals.pending], ['Margen sobre presupuesto', finance.budget !== null && finance.actualCost !== null ? finance.budget - finance.actualCost : null]]

  return <section className="project-tab" aria-label="Presupuesto y cobros">
    {writer && <div className="project-tab-actions"><button type="button" className="agenda-close" onClick={() => setDialog('budget')}><Pencil size={14} />Presupuesto</button><button type="button" className="agenda-new-task" onClick={() => setDialog('invoice')}><Plus size={15} />Nuevo cobro</button></div>}
    <dl className="lead-detail-grid">{figures.map(([label, value]) => <div className="lead-detail-field" key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
    {quick.error && <div className="agenda-error" role="alert"><AlertTriangle size={15} />{quick.error}</div>}
    {finance.invoices.length === 0 ? <div className="project-empty"><FileText size={22} /><strong>Sin cobros registrados.</strong><span>Registra cada cuenta de cobro para ver cuánto falta por recaudar.</span></div> : <ul className="project-task-list finance-list">{finance.invoices.map((invoice) => <li key={invoice.id} className={invoice.status === 'anulado' ? 'is-closed' : ''}>
      <div><strong>{invoice.concept} · {money(invoice.amount)}</strong><span>{invoice.issuedAt ? `Emitido ${dayLabel(invoice.issuedAt)}` : 'Sin fecha de emisión'}{invoice.dueAt ? ` · vence ${dayLabel(invoice.dueAt)}` : ''}{invoice.paidAt ? ` · pagado ${dayLabel(invoice.paidAt)}` : ''}</span></div>
      {writer ? <select aria-label={`Estado de ${invoice.concept}`} className="milestone-status" value={invoice.status} disabled={quick.busy} onChange={(event) => void quick.run(() => call(`${route}/invoices`, 'POST', { id: invoice.id, status: event.target.value }))}>{Object.entries(invoiceLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select> : <span className="project-status-label">{invoiceLabels[invoice.status]}</span>}
    </li>)}</ul>}
    <p className="status-comment-hint">Solo quienes tienen acceso al dominio Finanzas ven esta pestaña. Un cobro errado se marca como Anulado; no se elimina.</p>

    {dialog === 'budget' && <Modal narrow title="Presupuesto del proyecto" eyebrow="FINANZAS" busy={save.busy} error={save.error} submitLabel="Guardar" onClose={() => setDialog(null)} onSubmit={(data) => void save.run(() => call(`${route}/finance`, 'PATCH', { budget: numeric(data, 'budget'), actualCost: numeric(data, 'actualCost') }))}>
      <label className="agenda-field">Presupuesto (COP)<input name="budget" type="number" min="0" step="any" defaultValue={finance.budget ?? ''} /></label>
      <label className="agenda-field">Costo real a la fecha (COP)<input name="actualCost" type="number" min="0" step="any" defaultValue={finance.actualCost ?? ''} /></label>
    </Modal>}
    {dialog === 'invoice' && <Modal title="Nuevo cobro" eyebrow="FINANZAS" busy={save.busy} error={save.error} submitLabel="Registrar cobro" onClose={() => setDialog(null)} onSubmit={(data) => void save.run(() => call(`${route}/invoices`, 'POST', { concept: String(data.get('concept') ?? '').trim(), amount: numeric(data, 'amount'), issuedAt: dayToIso(String(data.get('issuedAt') ?? ''), false), dueAt: dayToIso(String(data.get('dueAt') ?? ''), true) }))}>
      <label className="agenda-field agenda-field-wide">Concepto<input name="concept" required maxLength={200} placeholder="Ej. Anticipo 50 %" /></label>
      <div className="agenda-form-grid project-form-grid">
        <label className="agenda-field">Valor (COP)<input name="amount" type="number" min="0" step="any" required /></label>
        <label className="agenda-field">Emitido <span className="field-optional">Opcional</span><input name="issuedAt" type="date" /></label>
        <label className="agenda-field">Vence <span className="field-optional">Opcional</span><input name="dueAt" type="date" /></label>
      </div>
    </Modal>}
  </section>
}
