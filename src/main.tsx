import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { agents, initialMessages } from './agents'
import { ChatDock, ChatPanel } from './components/ChatPanel'
import { AddAgentPanel } from './components/AddAgentPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { LoginScreen } from './components/LoginScreen'
import { OfficeStage } from './components/OfficeStage'
import { RequestsPanel } from './components/RequestsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Topbar } from './components/Topbar'
import type { AgentId, Message, Section } from './types'
import './styles.css'

type ApiMessage = { id: string; direction: 'user' | 'agent'; text: string; createdAt: string }
export type ApiRequest = { id: string; agentId: AgentId; title: string; projectId: string | null; priority: 'low' | 'normal' | 'high' | 'urgent'; status: 'pending' | 'in_progress' | 'waiting_approval' | 'done' | 'cancelled'; nextAction: string; obsidianNote: string | null; sourcePath: string | null; sourceDriveFolder: string | null }
type AuthState = { configured: boolean; authenticated: boolean; userId?: string }

function Root() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then((response) => response.json() as Promise<AuthState>).then(setAuth).catch(() => setAuth({ configured: false, authenticated: false }))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setAuth({ configured: true, authenticated: false })
  }

  if (auth?.configured && !auth.authenticated) return <LoginScreen onAuthenticated={(userId) => setAuth({ configured: true, authenticated: true, userId })} />
  return <App onLogout={logout} />
}

function App({ onLogout }: { onLogout: () => void }) {
  const [activeAgent, setActiveAgent] = useState<AgentId>('secretaria')
  const [messages, setMessages] = useState(initialMessages)
  const [pending, setPending] = useState<Record<AgentId, boolean>>(() => Object.keys(agents).reduce((state, id) => ({ ...state, [id]: false }), {} as Record<AgentId, boolean>))
  const [processing, setProcessing] = useState<Record<AgentId, boolean>>(() => Object.keys(agents).reduce((state, id) => ({ ...state, [id]: false }), {} as Record<AgentId, boolean>))
  const [requests, setRequests] = useState<ApiRequest[]>([])
  const [draft, setDraft] = useState('')
  const [section, setSection] = useState<Section>('office')
  const [chatMinimized, setChatMinimized] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [addAgentOpen, setAddAgentOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const agent = agents[activeAgent]
  const pendingCount = Object.values(pending).filter(Boolean).length
  const orderedAgents = useMemo(() => Object.entries(agents) as [AgentId, typeof agents[AgentId]][], [])

  useEffect(() => {
    const capturePrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }
    const captureInstall = () => { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', captureInstall)
    return () => { window.removeEventListener('beforeinstallprompt', capturePrompt); window.removeEventListener('appinstalled', captureInstall) }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    if ((await installPrompt.userChoice).outcome === 'accepted') setInstallPrompt(null)
  }

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
        setRequests(requests.requests)
        setPending((current) => orderedAgents.reduce((next, [id]) => ({ ...next, [id]: activeAgents.includes(id) }), current))
        if (apiMessages.messages.length > 0) {
          setMessages((current) => ({ ...current, [activeAgent]: apiMessages.messages.map((message) => ({ from: message.direction, text: message.text, time: new Date(message.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) })) }))
          if (apiMessages.messages[apiMessages.messages.length - 1]?.direction === 'agent') setProcessing((current) => current[activeAgent] ? { ...current, [activeAgent]: false } : current)
        }
        setApiReady(true)
      } catch {
        if (!cancelled) setApiReady(false)
      }
    }
    void hydrate()
    const interval = window.setInterval(() => { void hydrate() }, 7000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [activeAgent, orderedAgents])

  async function sendMessage() {
    const text = draft.trim()
    if (!text) return
    setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'user', text, time: 'ahora' }] }))
    setProcessing((current) => ({ ...current, [activeAgent]: true }))
    setDraft('')
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: activeAgent, text }) })
      if (!response.ok) throw new Error('La API no respondió correctamente')
      const data = await response.json() as { reply?: string; processing?: boolean }
      if (data.reply) {
        setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'agent', text: data.reply!, time: 'ahora' }] }))
        setProcessing((current) => ({ ...current, [activeAgent]: false }))
      } else if (!data.processing) setProcessing((current) => ({ ...current, [activeAgent]: false }))
      setApiReady(true)
    } catch {
      setApiReady(false)
      setProcessing((current) => ({ ...current, [activeAgent]: false }))
      setMessages((current) => ({ ...current, [activeAgent]: [...current[activeAgent], { from: 'agent', text: 'Recibí tu mensaje. El servidor local aún no está disponible, pero lo conectaré cuando esté activo.', time: 'ahora' }] }))
    }
  }

  return <div className="app-shell">
    <Topbar section={section} pendingCount={pendingCount} setSection={setSection} setActiveAgent={setActiveAgent} onAddAgent={() => setAddAgentOpen(true)} onLogout={onLogout} />
    <main className="workspace">
      <OfficeStage activeAgent={activeAgent} pending={pending} pendingCount={pendingCount} setActiveAgent={setActiveAgent} />
      {section === 'agents' ? <AgentsPanel setActiveAgent={setActiveAgent} close={() => setSection('office')} /> : section === 'requests' ? <RequestsPanel requests={requests} setActiveAgent={setActiveAgent} close={() => setSection('office')} /> : section === 'settings' ? <SettingsPanel onLogout={onLogout} installed={installed} canInstall={Boolean(installPrompt)} onInstall={() => void installApp()} /> : chatMinimized ? <ChatDock agent={agent} pending={pending[activeAgent]} restore={() => setChatMinimized(false)} /> : <ChatPanel agent={agent} messages={messages[activeAgent] as Message[]} pending={pending[activeAgent]} processing={processing[activeAgent]} apiReady={apiReady} draft={draft} setDraft={setDraft} sendMessage={sendMessage} minimize={() => setChatMinimized(true)} togglePending={() => setPending((current) => ({ ...current, [activeAgent]: !current[activeAgent] }))} />}
    </main>
    <footer className="app-footer"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Desarrollado por Dmente Digital</span><a href="https://www.dmentedigital.co" target="_blank" rel="noreferrer">www.dmentedigital.co</a></footer>
    {addAgentOpen && <AddAgentPanel close={() => setAddAgentOpen(false)} />}
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) })
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
