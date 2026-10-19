import { useMemo, useState } from 'react'
import { ArrowRight, Check, LayoutGrid } from 'lucide-react'
import type { AgendaItem } from '../../main'
import { groupOpenAgenda, quadrantLabels, quadrants, type Quadrant } from '../../eisenhower'

export function EisenhowerPanel({ items, onManage }: { items: AgendaItem[]; onManage: (quadrant: Quadrant) => void }) {
  const [selected, setSelected] = useState<Quadrant>('Q1')
  const { groups, unclassified } = useMemo(() => groupOpenAgenda(items), [items])
  return <section className="daily-eisenhower" aria-labelledby="daily-eisenhower-title">
    <div className="life-section-heading"><div><h2 id="daily-eisenhower-title"><LayoutGrid size={20} /> Matriz de Eisenhower</h2><p>Tareas abiertas de la agenda, con los filtros actuales. Incluye tareas sin fecha.</p></div><span className="daily-matrix-source">Solo administradores</span></div>
    <div className="daily-matrix-grid" role="group" aria-label="Filtrar tareas por cuadrante">
      {quadrants.map(quadrant => <button key={quadrant} type="button" className={`daily-quadrant ${quadrantLabels[quadrant].tone}`} aria-pressed={selected === quadrant} onClick={() => setSelected(quadrant)}><span className="daily-quadrant-top"><strong>{quadrant}</strong><span>{quadrantLabels[quadrant].action}</span>{selected === quadrant && <Check size={17} aria-hidden="true" />}</span><span className="daily-quadrant-title">{quadrantLabels[quadrant].title}</span><span className="daily-quadrant-count">{groups[quadrant].length} tareas abiertas</span></button>)}
    </div>
    <div className="daily-matrix-results" aria-live="polite"><div><h3>{selected} · {quadrantLabels[selected].action}</h3><button type="button" onClick={() => onManage(selected)}>Gestionar en la agenda <ArrowRight size={15} /></button></div>
      {groups[selected].length ? <ul>{groups[selected].slice(0, 5).map(item => <li key={item.id}><strong>{item.title}</strong><span>{item.nextAction || 'Sin próxima acción registrada'}</span>{(item.eisenhower.urgencyReason || item.eisenhower.importanceReason) && <small>{[item.eisenhower.urgencyReason, item.eisenhower.importanceReason].filter(Boolean).join(' · ')}</small>}</li>)}</ul> : <p>No hay tareas abiertas en este cuadrante con los filtros actuales.</p>}
      {groups[selected].length > 5 && <p>Se muestran 5 de {groups[selected].length}. Consulta el resto en la agenda.</p>}
    </div>
    {unclassified.length > 0 && <p className="daily-matrix-note">{unclassified.length} tareas abiertas sin cuadrante. Su clasificación se gestiona en la agenda.</p>}
    <p className="daily-matrix-note">La clasificación procede de la agenda. Archivar en Q4 se realiza allí y conserva el historial.</p>
  </section>
}
