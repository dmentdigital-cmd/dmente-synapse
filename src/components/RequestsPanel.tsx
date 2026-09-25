import { Check, ChevronDown, Database, FileText, FolderOpen, X } from 'lucide-react'
import { agents } from '../agents'
import type { ApiRequest } from '../main'
import type { AgentId } from '../types'

type Props = { requests: ApiRequest[]; setActiveAgent: (agent: AgentId) => void; close: () => void }

export function RequestsPanel({ requests, setActiveAgent, close }: Props) {
  const activeRequests = requests.filter((request) => request.status !== 'done' && request.status !== 'cancelled')
  return <aside className="requests-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">CENTRO DE ATENCIÓN</span><h2>Solicitudes</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
    <p className="panel-intro">Estas solicitudes necesitan una respuesta tuya antes de continuar.</p>
    {activeRequests.map((request) => {
      const item = agents[request.agentId]
      return <div className="request-card" key={request.id}><img src={item.normal} alt="" /><div className="request-content"><div className="request-title"><strong>{item.name}</strong><span>{request.priority}</span></div><p>{request.title}</p><small>Siguiente: {request.nextAction}</small><div className="request-sources">{request.obsidianNote && <span title={request.obsidianNote}><Database size={12} /> Obsidian</span>}{request.sourcePath && <span title={request.sourcePath}><FileText size={12} /> Estado</span>}{request.sourceDriveFolder && <span title={request.sourceDriveFolder}><FolderOpen size={12} /> Drive</span>}</div><button className="text-button" onClick={() => { setActiveAgent(request.agentId); close() }}>Abrir conversación <ChevronDown size={14} /></button></div></div>
    })}
    {activeRequests.length === 0 && <div className="empty-state"><Check size={22} /> No tienes solicitudes pendientes.</div>}
  </aside>
}
