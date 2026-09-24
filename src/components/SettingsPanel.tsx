import { LogOut, ShieldCheck, WifiOff } from 'lucide-react'

type Props = { onLogout: () => void }

export function SettingsPanel({ onLogout }: Props) {
  return <section className="settings-panel panel-card">
    <div className="panel-heading"><div><span className="eyebrow">CONTROL DEL SISTEMA</span><h2>Configuración</h2></div><button className="logout-button" onClick={onLogout}><LogOut size={15} /> Salir</button></div>
    <div className="settings-list">
      <div className="settings-row"><ShieldCheck size={19} /><div><strong>Sesión protegida</strong><p>Tu sesión usa una cookie HttpOnly.</p></div><span className="settings-status online">Activa</span></div>
      <div className="settings-row"><WifiOff size={19} /><div><strong>Hermes</strong><p>La conexión del agente de Hermes todavía no está configurada.</p></div><span className="settings-status">Pendiente</span></div>
    </div>
    <div className="settings-note">La conexión con Hermes requiere una URL o endpoint verificable, método de autenticación y formato de mensajes. No se deben inventar esos datos.</div>
  </section>
}
