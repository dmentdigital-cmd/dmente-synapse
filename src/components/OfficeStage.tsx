import type { CSSProperties } from 'react'
import { Bell } from 'lucide-react'
import { agents } from '../agents'
import type { AgentId } from '../types'

type Props = { activeAgent: AgentId; pending: Record<AgentId, boolean>; pendingCount: number; setActiveAgent: (agent: AgentId) => void }

export function OfficeStage({ activeAgent, pending, pendingCount, setActiveAgent }: Props) {
  return <section className="office-stage" aria-label="Oficina de Dmente Synapse">
    <img className="office-background" src="/assets/oficina-futurista.png" alt="Oficina futurista de Dmente Synapse" />
    <div className="office-emblem"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>CENTRO DE OPERACIONES SYNAPSE</span></div>
    {(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).map(([id, item]) => <button key={id} className={`agent-station station-${id} ${activeAgent === id ? 'selected' : ''}`} onClick={() => setActiveAgent(id)} aria-label={`Abrir chat de ${item.name}`}>
      <img className="agent-sprite" src={pending[id] ? item.attention : item.normal} alt={item.name} />
      <span className="agent-platform" style={{ '--agent-color': item.color } as CSSProperties} />
      <span className="station-name"><img src="/assets/logo-dmente.png" alt="" /><span><strong>{item.name}</strong><small>{item.role}</small></span></span>
      {pending[id] && <span className="attention-dot"><Bell size={13} /></span>}
    </button>)}
    <div className="stage-hint"><span className="live-dot" /> Oficina activa <span>·</span> {pendingCount} solicitud{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}</div>
  </section>
}
