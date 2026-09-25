import { Bell, Menu, Minus, Paperclip, Send } from 'lucide-react'
import { agents } from '../agents'
import type { AgentId, Message } from '../types'

type Props = { agent: typeof agents[AgentId]; messages: Message[]; pending: boolean; processing: boolean; apiReady: boolean; draft: string; setDraft: (value: string) => void; sendMessage: () => void; minimize: () => void; togglePending: () => void }

export function ChatPanel({ agent, messages, pending, processing, apiReady, draft, setDraft, sendMessage, minimize, togglePending }: Props) {
  return <aside className="chat-panel panel-card">
    <div className="chat-heading"><div className="agent-heading"><img src={pending ? agent.attention : agent.normal} alt="" /><div><span className="eyebrow">AGENTE EN LÍNEA</span><h2>{agent.name}</h2><span className="role-label">{agent.role}</span></div></div><div className="chat-heading-actions"><button className="icon-button" onClick={minimize} aria-label="Minimizar chat"><Minus size={19} /></button><button className="icon-button" aria-label="Opciones del chat"><Menu size={19} /></button></div></div>
    <div className="status-row"><span className="status-pill"><span className="status-dot" /> {apiReady ? 'Sincronizado' : agent.status}</span><button className="small-action" onClick={togglePending}>{pending ? 'Marcar resuelta' : 'Crear solicitud'}</button></div>
    <div className="message-list">{messages.map((message, index) => <div key={`${message.time}-${index}`} className={`message-row ${message.from}`}><div className="message-bubble">{message.text}<span>{message.time}</span></div></div>)}{processing && <div className="message-row"><div className="message-bubble thinking-bubble">LuciaBot está trabajando<span><i /><i /><i /></span></div></div>}</div>
    <div className="composer"><button className="attach-button" aria-label="Adjuntar archivo"><Paperclip size={17} /></button><input value={draft} disabled={processing} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !processing && sendMessage()} placeholder={processing ? 'Esperando respuesta de LuciaBot...' : 'Escribe un mensaje...'} /><button className="send-button" disabled={processing} aria-label="Enviar mensaje" onClick={sendMessage}><Send size={16} /></button></div>
  </aside>
}

export function ChatDock({ agent, pending, restore }: { agent: typeof agents[AgentId]; pending: boolean; restore: () => void }) {
  return <button className="chat-dock" onClick={restore} aria-label={`Abrir chat de ${agent.name}`}><img src={pending ? agent.attention : agent.normal} alt="" /><span><small>CHAT ACTIVO</small><strong>{agent.name}</strong></span>{pending && <i><Bell size={13} /></i>}</button>
}
