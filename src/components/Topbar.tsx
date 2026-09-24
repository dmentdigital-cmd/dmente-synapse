import { ClipboardList, Home, Plus, Settings, Sparkles } from 'lucide-react'
import type { AgentId, Section } from '../types'

type Props = { section: Section; pendingCount: number; setSection: (section: Section) => void; setActiveAgent: (agent: AgentId) => void }

export function Topbar({ section, pendingCount, setSection, setActiveAgent }: Props) {
  return <header className="topbar">
    <div className="brand-lockup"><img className="brand-logo" src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Dmente <b>Synapse</b></span></div>
    <nav className="main-nav" aria-label="Navegación principal">
      <button className={section === 'office' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('office')}><Home size={17} /> Oficina</button>
      <button className="nav-item" onClick={() => setActiveAgent('gerente')}><Sparkles size={17} /> Agentes</button>
      <button className={section === 'requests' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('requests')}><ClipboardList size={17} /> Solicitudes {pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>
      <button className="nav-item"><Settings size={17} /> Configuración</button>
    </nav>
    <button className="add-agent"><Plus size={17} /> Añadir agente</button>
  </header>
}
