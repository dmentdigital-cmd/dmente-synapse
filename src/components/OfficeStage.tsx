import type { CSSProperties } from 'react'
import { Bell, CircleCheck, PauseCircle, Sparkles } from 'lucide-react'
import { agents } from '../agents'
import type { AgentId } from '../types'

type Props = { activeAgent: AgentId; pending: Record<AgentId, boolean>; processing: Record<AgentId, boolean>; pendingCount: number; agendaItems: { agentId: AgentId; status: string; requiresApproval: boolean; approvalConfirmed: boolean; updatedAt: string }[]; setActiveAgent: (agent: AgentId) => void }

export function OfficeStage({ activeAgent, pending, processing, pendingCount, agendaItems, setActiveAgent }: Props) {
  function motionFor(id: AgentId) {
    const tasks = agendaItems.filter((task) => task.agentId === id && task.status !== 'done' && task.status !== 'cancelled')
    if (processing[id] || tasks.some((task) => task.status === 'in_progress')) return 'working'
    if (tasks.some((task) => task.status === 'blocked')) return 'blocked'
    if (tasks.some((task) => task.status === 'waiting_approval' || (task.requiresApproval && !task.approvalConfirmed))) return 'approval'
    if (pending[id] || tasks.some((task) => task.status === 'pending')) return 'attention'
    const justFinished = agendaItems.some((task) => task.agentId === id && task.status === 'done' && Date.now() - new Date(task.updatedAt).getTime() < 12000)
    return justFinished ? 'celebrate' : 'idle'
  }

  const stateLabels = { idle: 'Disponible', attention: 'Nueva tarea', working: 'En marcha', approval: 'Espera aprobación', blocked: 'Bloqueo', celebrate: 'Completado' }
  return <section className="office-stage" aria-label="Oficina de Dmente Synapse">
    <img className="office-background" src="/assets/oficina-futurista.png" alt="Oficina futurista de Dmente Synapse" />
    <div className="office-emblem"><img src="/assets/dmente-synapse-icon.png" alt="Dmente Synapse" /><span>CENTRO DE OPERACIONES SYNAPSE</span></div>
    {(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).filter(([, item]) => item.visibleInOffice !== false).map(([id, item]) => {
      const motion = motionFor(id)
      return <button key={id} data-motion={motion} className={`agent-station station-${id} ${activeAgent === id ? 'selected' : ''}`} onClick={() => setActiveAgent(id)} aria-label={`Abrir chat de ${item.name}. Estado: ${stateLabels[motion]}`}>
      <img className="agent-sprite" src={pending[id] ? item.attention : item.normal} alt={item.name} />
      <span className="agent-platform" style={{ '--agent-color': item.color } as CSSProperties} />
      <span className="station-name"><img src="/assets/dmente-synapse-icon.png" alt="" /><span><strong>{item.name}</strong><small>{item.role}</small></span></span>
      <span className={`agent-motion-label ${motion}`}>{motion === 'approval' ? <PauseCircle size={12} /> : motion === 'celebrate' ? <CircleCheck size={12} /> : <Sparkles size={12} />}{stateLabels[motion]}</span>
      {pending[id] && <span className="attention-dot"><Bell size={13} /></span>}
    </button>})}
    <div className="stage-hint"><span className="live-dot" /> Oficina activa <span>·</span> {pendingCount} solicitud{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}</div>
  </section>
}
