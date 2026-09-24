import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { agents, initialMessages } from './agents'
import { ChatDock, ChatPanel } from './components/ChatPanel'
import { LoginScreen } from './components/LoginScreen'
import { OfficeStage } from './components/OfficeStage'
import { RequestsPanel } from './components/RequestsPanel'
import { Topbar } from './components/Topbar'
import type { AgentId, Message, Section } from './types'
import './styles.css'

type ApiMessage = { id: string; direction: 'user' | 'agent'; text: string; createdAt: string }
type ApiRequest = { agentId: AgentId; status: 'pending' | 'in_progress' | 'waiting_approval' | 'done' | 'cancelled' }
type AuthState = { configured: boolean; authenticated: boolean; userId?: string }

function Root() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then((response) => response.json() as Promise<AuthState>).then(setAuth).catch(() => setAuth({ configured: false, authenticated: false }))
  }, [])

  if (auth?.configured && !auth.authenticated) return <LoginScreen onAuthenticated={(userId) => setAuth({ configured: true, authenticated: true, userId })} />
  return <App />
}

function App() {
  const [activeAgent, setActiveAgent] = useState<AgentId>('secretaria')
  const [messages, setMessages] = useState(initialMessages)
  const [pending, setPending] = useState<Record<AgentId, boolean>>({ secretaria: true, legal: false, marketing: false, ventas: true, gerente: false })
  const [draft, setDraft] = useState('')
  const [section, setSection] = useState<Section>('office')
  const [chatMinimized, setChatMinimized] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const agent = agents[activeAgent]
  const pendingCount = Object.values(pending).filter(Boolean).length
  const orderedAgents = useMemo(() => Object.entries(agents) as [AgentId, typeof agents[AgentId]][], [])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const [requestsResponse, messagesResponse] = await Promise.all([fetch('/api/requests'), fetch(`/api/messages?agentId=${activeAgent}`)])
        if (!requestsResponse.ok || !messagesResponse.ok) throw new Error('API no disponible')
        const requests = await requestsResponse.json() as { requests: ApiRequest[] }
        const apiMessages = await messagesResponse.json() as { messages: ApiMessage[] }
        if (cancelled) return
        const activeAgents = requests.requests.filter((request) => request.status !== 'done' && request.status !== 'cancelled').map((request) => request.agentId)
        setPending((current) => orderedAgents.reduce((next, [id]) => ({ ...next, [id]: activeAgents.includes(id) }), current))
        if (apiMessages.messages.length > 0) {
          setMessages((current) => ({ ...current, [activeAgent]: apiMessages.messages.map((message) => ({ from: message.direction, text: message.text, time: new Date(message.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) })) }))
        }
        setApiReady(true)
      } catch {
        if (!cancelled) setApiReady(false)
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [activeAgent, orderedAgents])

  async function sendMessage() {
    const text = draft.trim()
    if (!text) return
    setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'user', text, time: 'ahora' }] }))
    setDraft('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: activeAgent, text }) })
      if (!response.ok) throw new Error('La API no respondió correctamente')
      const data = await response.json() as { reply?: string }
      if (data.reply) setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'agent', text: data.reply!, time: 'ahora' }] }))
      setApiReady(true)
    } catch {
      setApiReady(false)
      setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'agent', text: 'Recibí tu mensaje. El servidor local aún no está disponible, pero lo conectaré cuando esté activo.', time: 'ahora' }] }))
    }
  }

  return <div className="app-shell">
    <Topbar section={section} pendingCount={pendingCount} setSection={setSection} setActiveAgent={setActiveAgent} />
    <main className="workspace">
      <OfficeStage activeAgent={activeAgent} pending={pending} pendingCount={pendingCount} setActiveAgent={setActiveAgent} />
      {section === 'requests' ? <RequestsPanel pending={pending} pendingCount={pendingCount} setActiveAgent={setActiveAgent} close={() => setSection('office')} /> : chatMinimized ? <ChatDock agent={agent} pending={pending[activeAgent]} restore={() => setChatMinimized(false)} /> : <ChatPanel agent={agent} messages={messages[activeAgent] as Message[]} pending={pending[activeAgent]} apiReady={apiReady} draft={draft} setDraft={setDraft} sendMessage={sendMessage} minimize={() => setChatMinimized(true)} togglePending={() => setPending((current) => ({ ...current, [activeAgent]: !current[activeAgent] }))} />}
    </main>
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)
