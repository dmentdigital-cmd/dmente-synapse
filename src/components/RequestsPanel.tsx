import { Check, ChevronDown, X } from 'lucide-react'
import { agents } from '../agents'
import type { AgentId } from '../types'

type Props = { pending: Record<AgentId, boolean>; pendingCount: number; setActiveAgent: (agent: AgentId) => void; close: () => void }

export function RequestsPanel({ pending, pendingCount, setActiveAgent, close }: Props) {
  return <aside className="requests-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">CENTRO DE ATENCIÓN</span><h2>Solicitudes</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
    <p className="panel-intro">Estas solicitudes necesitan una respuesta tuya antes de continuar.</p>
    {(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).filter(([id]) => pending[id]).map(([id, item]) => <div className="request-card" key={id}><img src={item.normal} alt="" /><div><strong>{item.name}</strong><p>Necesita tu atención para continuar con su tarea.</p><button className="text-button" onClick={() => { setActiveAgent(id); close() }}>Abrir conversación <ChevronDown size={14} /></button></div></div>)}
    {pendingCount === 0 && <div className="empty-state"><Check size={22} /> No tienes solicitudes pendientes.</div>}
  </aside>
}
