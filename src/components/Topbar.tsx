import { CalendarDays, ClipboardList, FolderKanban, Home, LogOut, Plus, Settings, Sparkles, UsersRound } from 'lucide-react'
import type { AgentId, Section } from '../types'

type Props = { section: Section; pendingCount: number; canViewLeads: boolean; setSection: (section: Section) => void; setActiveAgent: (agent: AgentId) => void; onAddAgent: () => void; onLogout: () => void }

export function Topbar({ section, pendingCount, canViewLeads, setSection, setActiveAgent, onAddAgent, onLogout }: Props) {
  const buildDate = new Date(__BUILD_AT__).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' })
  return <header className="topbar">
    <div className="brand-lockup"><img className="brand-logo" src="/assets/dmente-synapse-icon.png" alt="Dmente Synapse" /><span className="brand-copy"><span>Dmente <b>Synapse</b></span><small className="release-stamp" title={`Compilada el ${buildDate}`}>v{__APP_VERSION__} · {buildDate}</small></span></div>
    <nav className="main-nav" aria-label="Navegación principal">
      <button type="button" className={section === 'office' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('office')}><Home size={17} /> Oficina</button>
      <button type="button" className={section === 'agents' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('agents')}><Sparkles size={17} /> Agentes</button>
      <button type="button" className={section === 'agenda' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('agenda')}><CalendarDays size={17} /> Agenda</button>
      <button type="button" className={section === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('projects')}><FolderKanban size={17} /> Proyectos</button>
      <button type="button" className={section === 'requests' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('requests')}><ClipboardList size={17} /> Solicitudes {pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}</button>
      {canViewLeads && <button type="button" className={section === 'leads' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('leads')}><UsersRound size={17} /> Leads</button>}
      <button type="button" className={section === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('settings')}><Settings size={17} /> Configuración</button>
    </nav>
    <div className="topbar-actions"><button className="add-agent" onClick={onAddAgent}><Plus size={17} /> Añadir agente</button><button className="logout-button" onClick={onLogout}><LogOut size={16} /> Salir</button></div>
  </header>
}
