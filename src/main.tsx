import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { agents, initialMessages } from './agents'
import { ChatDock, ChatPanel } from './components/ChatPanel'
import { AddAgentPanel } from './components/AddAgentPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { OperationalAgenda } from './components/OperationalAgenda'
import { LoginScreen } from './components/LoginScreen'
import { OfficeStage } from './components/OfficeStage'
import { RequestsPanel } from './components/RequestsPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { Topbar } from './components/Topbar'
import type { AgentId, Message, Section } from './types'
import './styles.css'

type ApiMessage = { id: string; direction: 'user' | 'agent'; text: string; createdAt: string }
export type ApiRequest = { id: string; agentId: AgentId; title: string; domain: string; projectId: string | null; priority: 'low' | 'normal' | 'high' | 'urgent'; status: 'pending' | 'in_progress' | 'waiting_approval' | 'blocked' | 'done' | 'cancelled'; riskLevel: 'low' | 'medium' | 'high'; requiresApproval: boolean; approvalConfirmed: boolean; startsAt: string | null; dueAt: string | null; nextAction: string; obsidianNote?: string | null; sourcePath: string | null; sourceDriveFolder: string | null }
export type AgendaItem = ApiRequest & { id: string; kind: 'request' | 'commitment'; requestId: string | null; commitmentId: string | null; createdAt: string; updatedAt: string }
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
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [draft, setDraft] = useState('')
  const [section, setSection] = useState<Section>(() => sectionFromHash(window.location.hash))
  const [chatMinimized, setChatMinimized] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [apiError, setApiError] = useState('')
  const [addAgentOpen, setAddAgentOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  const agent = agents[activeAgent]
  const pendingCount = Object.values(pending).filter(Boolean).length
  const orderedAgents = useMemo(() => Object.entries(agents) as [AgentId, typeof agents[AgentId]][], [])

  useEffect(() => {
    const syncSection = () => setSection(sectionFromHash(window.location.hash))
    window.addEventListener('hashchange', syncSection)
    return () => window.removeEventListener('hashchange', syncSection)
  }, [])

  function openSection(nextSection: Section) {
    setSection(nextSection)
    const nextHash = nextSection === 'office' ? '' : `#${nextSection}`
    if (window.location.hash !== nextHash) window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
    window.requestAnimationFrame(() => window.scrollTo(0, 0))
  }

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
        const [agendaResponse, messagesResponse] = await Promise.all([fetch('/api/operational-agenda'), fetch(`/api/messages?agentId=${activeAgent}`)])
        if (!agendaResponse.ok) {
          const failure = await agendaResponse.json() as { error?: string }
          throw new Error(failure.error ?? 'No se pudo cargar la agenda')
        }
        if (!messagesResponse.ok) throw new Error('No se pudo cargar la sesión de Synapse')
        const agenda = await agendaResponse.json() as { items: AgendaItem[] }
        const apiMessages = await messagesResponse.json() as { messages: ApiMessage[] }
        if (cancelled) return
        const activeAgents = agenda.items.filter((item) => item.status !== 'done' && item.status !== 'cancelled').map((item) => item.agentId)
        setAgendaItems(agenda.items)
        setRequests(agenda.items.filter((item) => item.kind === 'request'))
        setPending((current) => orderedAgents.reduce((next, [id]) => ({ ...next, [id]: activeAgents.includes(id) }), current))
        if (apiMessages.messages.length > 0) {
          setMessages((current) => ({ ...current, [activeAgent]: apiMessages.messages.map((message) => ({ from: message.direction, text: message.text, time: new Date(message.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) })) }))
          if (apiMessages.messages[apiMessages.messages.length - 1]?.direction === 'agent') setProcessing((current) => current[activeAgent] ? { ...current, [activeAgent]: false } : current)
        }
        setApiReady(true)
        setApiError('')
      } catch (cause) {
        if (!cancelled) { setApiReady(false); setApiError(cause instanceof Error ? cause.message : 'API no disponible') }
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

  async function updateAgendaStatus(itemId: string, status: AgendaItem['status']) {
    const response = await fetch(`/api/operational-agenda/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const data = await response.json() as { item?: AgendaItem; error?: string }
    if (!response.ok || !data.item) throw new Error(data.error ?? 'No se pudo actualizar la tarea')
    setAgendaItems((current) => current.map((item) => item.id === itemId ? data.item! : item))
    setRequests((current) => current.map((item) => item.id === itemId ? data.item! : item))
  }

  async function createAgendaItem(input: { title: string; domain: string; projectId: string; agentId: AgentId; priority: ApiRequest['priority']; riskLevel: ApiRequest['riskLevel']; requiresApproval: boolean; startsAt: string | null; dueAt: string | null; nextAction: string }) {
    const response = await fetch('/api/operational-agenda/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const data = await response.json() as { item?: AgendaItem; error?: string }
    if (!response.ok || !data.item) throw new Error(data.error ?? 'No se pudo crear la tarea')
    setAgendaItems((current) => [...current, data.item!].sort((left, right) => (left.startsAt ?? left.dueAt ?? '').localeCompare(right.startsAt ?? right.dueAt ?? '')))
    setRequests((current) => [...current, data.item!])
  }

  async function approveAgendaItem(itemId: string) {
    const response = await fetch(`/api/requests/${encodeURIComponent(itemId)}/approve`, { method: 'POST' })
    const data = await response.json() as { request?: ApiRequest; error?: string }
    if (!response.ok || !data.request) throw new Error(data.error ?? 'No se pudo registrar la aprobación')
    setAgendaItems((current) => current.map((item) => item.id === itemId ? { ...item, ...data.request!, kind: 'request' } : item))
    setRequests((current) => current.map((item) => item.id === itemId ? data.request! : item))
  }

  return <div className="app-shell">
    <Topbar section={section} pendingCount={pendingCount} setSection={openSection} setActiveAgent={setActiveAgent} onAddAgent={() => setAddAgentOpen(true)} onLogout={onLogout} />
    <main className="workspace">
      {section === 'agenda' ? <OperationalAgenda items={agendaItems} loadError={apiError} onCreate={createAgendaItem} onUpdateStatus={updateAgendaStatus} onApprove={approveAgendaItem} onClose={() => openSection('office')} /> : <>
        <OfficeStage activeAgent={activeAgent} pending={pending} processing={processing} pendingCount={pendingCount} agendaItems={agendaItems} setActiveAgent={setActiveAgent} />
        {section === 'agents' ? <AgentsPanel setActiveAgent={setActiveAgent} close={() => openSection('office')} /> : section === 'requests' ? <RequestsPanel requests={requests} setActiveAgent={setActiveAgent} close={() => openSection('office')} /> : section === 'settings' ? <SettingsPanel onLogout={onLogout} installed={installed} canInstall={Boolean(installPrompt)} onInstall={() => void installApp()} /> : chatMinimized ? <ChatDock agent={agent} pending={pending[activeAgent]} restore={() => setChatMinimized(false)} /> : <ChatPanel agent={agent} messages={messages[activeAgent] as Message[]} pending={pending[activeAgent]} processing={processing[activeAgent]} apiReady={apiReady} draft={draft} setDraft={setDraft} sendMessage={sendMessage} minimize={() => setChatMinimized(true)} togglePending={() => setPending((current) => ({ ...current, [activeAgent]: !current[activeAgent] }))} />}
      </>}
    </main>
    <footer className="app-footer"><img src="/assets/logo-dmente.png" alt="Dmente Digital" /><span>Desarrollado por Dmente Digital</span><a href="https://www.dmentedigital.co" target="_blank" rel="noreferrer">www.dmentedigital.co</a></footer>
    {addAgentOpen && <AddAgentPanel close={() => setAddAgentOpen(false)} />}
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js?v=2').catch(() => undefined) })
}

function sectionFromHash(hash: string): Section {
  const section = hash.replace(/^#/, '')
  return section === 'agents' || section === 'requests' || section === 'agenda' || section === 'settings' ? section : 'office'
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
