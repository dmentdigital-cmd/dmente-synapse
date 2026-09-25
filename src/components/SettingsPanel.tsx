import { Link2, LogOut, ShieldCheck } from 'lucide-react'

type Props = { onLogout: () => void }

export function SettingsPanel({ onLogout }: Props) {
  return <section className="settings-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">CONTROL DEL SISTEMA</span><h2>Configuración</h2></div><button className="logout-button" onClick={onLogout}><LogOut size={15} /> Salir</button></div>
    <div className="settings-list">
      <div className="settings-row"><ShieldCheck size={19} /><div><strong>Sesión protegida</strong><p>Tu sesión usa una cookie HttpOnly.</p></div><span className="settings-status online">Activa</span></div>
      <div className="settings-row"><Link2 size={19} /><div><strong>Hermes</strong><p>Conectado mediante el MCP remoto protegido de Synapse.</p></div><span className="settings-status online">Activo</span></div>
    </div>
    <div className="settings-note">Las respuestas internas están habilitadas. Correo, WhatsApp, calendarios, campañas y producción permanecen bloqueados hasta contar con aprobación y auditoría.</div>
  </section>
}
