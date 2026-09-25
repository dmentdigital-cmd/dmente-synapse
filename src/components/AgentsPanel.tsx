import { ShieldCheck, Sparkles } from 'lucide-react'
import { agents } from '../agents'
import { agentProfiles } from '../agentProfiles'
import type { AgentId } from '../types'

type Props = { setActiveAgent: (agent: AgentId) => void; close: () => void }

export function AgentsPanel({ setActiveAgent, close }: Props) {
  return <section className="agents-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">RED OPERATIVA</span><h2>Agentes</h2></div><span className="agents-count">{Object.keys(agents).length} perfiles</span></div>
    <p className="panel-intro">LuciaBot coordina. Las reglas asignan al especialista y solo escalan cuando hay ambigüedad, riesgo o aprobación.</p>
    <div className="agent-profile-list">{(Object.entries(agents) as [AgentId, typeof agents[AgentId]][]).map(([id, agent]) => { const profile = agentProfiles[id]; return <article className={`agent-profile-card ${id === 'gerente' ? 'coordinator' : ''}`} key={id}>
      <div className="agent-profile-heading"><img src={agent.normal} alt="" /><div><strong>{agent.name}</strong><small>{agent.role}</small></div>{id === 'gerente' && <Sparkles size={15} />}</div>
      <span className="profile-domain">{profile.domain}</span><p>{profile.purpose}</p>
      <div className="profile-tags">{profile.capabilities.slice(0, 4).map((capability) => <span key={capability}>{capability}</span>)}</div>
      <div className="profile-boundaries"><span><ShieldCheck size={12} /> Interno: {profile.allowed[0]}</span><span className="blocked">Límite: {profile.blocked[0]}</span></div>
      <button className="text-button" onClick={() => { setActiveAgent(id); close() }}>Abrir chat de {agent.name}</button>
    </article> })}</div>
  </section>
}
