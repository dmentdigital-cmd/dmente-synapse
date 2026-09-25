import { Bot, X } from 'lucide-react'

type Props = { close: () => void }

export function AddAgentPanel({ close }: Props) {
  return <div className="modal-backdrop" role="presentation" onClick={close}>
    <section className="add-agent-panel panel-card" role="dialog" aria-modal="true" aria-labelledby="add-agent-title" onClick={(event) => event.stopPropagation()}>
      <div className="panel-heading"><div><span className="eyebrow">NUEVO EQUIPO</span><h2 id="add-agent-title">Añadir agente</h2></div><button className="icon-button" onClick={close} aria-label="Cerrar"><X size={18} /></button></div>
      <div className="add-agent-icon"><Bot size={28} /></div>
      <p className="panel-intro">El catálogo base ya contiene 16 agentes. La creación dinámica se habilitará cuando existan validación de permisos, dominio y límites.</p>
      <div className="settings-note">Hermes ya está conectado por MCP remoto. Añadir un agente no habilita por sí solo correo, WhatsApp, calendarios ni acciones en producción.</div>
      <button className="auth-submit" onClick={close}>Entendido</button>
    </section>
  </div>
}
