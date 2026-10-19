import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Brain, CalendarDays, Clock3 } from 'lucide-react'
import type { AgendaItem } from '../../main'
import { dayKey, scheduledOn } from '../life-dashboard/model'

export function OfficeDayPanel({ items, loadError, loading, onOpenAgenda, onOpenSecondBrain }: { items: AgendaItem[]; loadError: string; loading: boolean; onOpenAgenda: () => void; onOpenSecondBrain?: () => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(interval) }, [])
  const today = dayKey(now)!
  const todayItems = useMemo(() => items.filter((item) => item.status !== 'done' && item.status !== 'cancelled' && scheduledOn(item, today)).sort((a, b) => (a.startsAt ?? a.dueAt ?? '').localeCompare(b.startsAt ?? b.dueAt ?? '')), [items, today])
  return <section className="office-day-panel" aria-labelledby="office-day-title"><div className="office-day-heading"><div><h1 id="office-day-title">Hoy en Synapse</h1><p><Clock3 size={13} />{now.toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · Bogotá</p></div><div className="office-day-actions"><button type="button" onClick={onOpenAgenda}><CalendarDays size={16} /> Agenda del día</button>{onOpenSecondBrain && <button type="button" className="office-brain-action" onClick={onOpenSecondBrain}><Brain size={17} /> Segundo cerebro <ArrowRight size={14} /></button>}</div></div><div className="office-day-items">{loadError ? <p role="alert">No se pudo consultar la agenda: {loadError}</p> : loading ? <p role="status">Consultando la agenda…</p> : todayItems.length ? <><p>{todayItems.length} registros abiertos programados para hoy</p><ul>{todayItems.slice(0, 3).map((item) => <li key={item.id}><button type="button" onClick={onOpenAgenda}>{item.title}<ArrowRight size={13} /></button></li>)}</ul></> : <p>No hay registros abiertos programados para hoy.</p>}</div></section>
}
