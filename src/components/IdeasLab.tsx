import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, FlaskConical, Lightbulb, Plus, Radar, Sparkles, Target, X } from 'lucide-react'

type Stage = 'radar' | 'ideas' | 'evaluacion' | 'sprint' | 'decision'
type Idea = { id: string; title: string; problem: string; audience: string; source: string; score: number; stage: Stage; createdAt: string; nextStep: string }

type Props = { close?: () => void }

const stages: Array<{ id: Stage; label: string; description: string; color: string }> = [
  { id: 'radar', label: 'Radar', description: 'Señales y problemas observados', color: '#60a5fa' },
  { id: 'ideas', label: 'Ideas', description: 'Lluvia divergente sin juzgar', color: '#ec4899' },
  { id: 'evaluacion', label: 'Evaluación', description: 'Evidencia, valor y viabilidad', color: '#fbbf24' },
  { id: 'sprint', label: 'Sprint', description: 'Prototipo y prueba rápida', color: '#a78bfa' },
  { id: 'decision', label: 'Decisión', description: 'Aprender, pausar o convertir', color: '#34d399' },
]

const seedIdeas: Idea[] = [
  { id: 'seed-1', title: 'Radar de oportunidades para clientes', problem: 'Las señales comerciales están repartidas entre conversaciones, tendencias y notas.', audience: 'Dmente Digital y sus clientes B2B', source: 'Google Trends + conversación comercial', score: 8, stage: 'evaluacion', createdAt: new Date().toISOString(), nextStep: 'Elegir una oportunidad y validar demanda con tres fuentes.' },
  { id: 'seed-2', title: 'Sprint visual para Montes Visión', problem: 'El conocimiento óptico necesita convertirse en una experiencia clara de explicación y cotización.', audience: 'Asesores y pacientes de Montes Visión', source: 'Necesidad documentada del cliente', score: 9, stage: 'sprint', createdAt: new Date().toISOString(), nextStep: 'Probar un flujo Atlas → Comparador → Plan Visual con un asesor.' },
]

const storageKey = 'synapse-ideas-lab-v1'

function loadIdeas(): Idea[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as Idea[]
  } catch { /* iniciar con datos demo si el almacenamiento no está disponible */ }
  return seedIdeas
}

export function IdeasLab({ close }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>(loadIdeas)
  const [activeStage, setActiveStage] = useState<Stage>('radar')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [audience, setAudience] = useState('')
  const [source, setSource] = useState('')

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(ideas)) }, [ideas])

  const currentStage = stages.find((stage) => stage.id === activeStage)!
  const currentIdeas = useMemo(() => ideas.filter((idea) => idea.stage === activeStage), [activeStage, ideas])

  function addIdea(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !problem.trim()) return
    setIdeas((current) => [{ id: crypto.randomUUID(), title: title.trim(), problem: problem.trim(), audience: audience.trim() || 'Por definir', source: source.trim() || 'Observación interna', score: 0, stage: 'radar', createdAt: new Date().toISOString(), nextStep: 'Formular una pregunta verificable y conseguir evidencia.' }, ...current])
    setTitle(''); setProblem(''); setAudience(''); setSource(''); setShowForm(false); setActiveStage('radar')
  }

  function advanceIdea(idea: Idea) {
    const index = stages.findIndex((stage) => stage.id === idea.stage)
    const next = stages[Math.min(index + 1, stages.length - 1)].id
    setIdeas((current) => current.map((item) => item.id === idea.id ? { ...item, stage: next, nextStep: next === 'evaluacion' ? 'Puntuar valor, evidencia y viabilidad.' : next === 'sprint' ? 'Construir un prototipo visible y probarlo con usuarios.' : next === 'decision' ? 'Registrar aprendizaje y decidir el siguiente paso.' : item.nextStep } : item))
    setActiveStage(next)
  }

  function removeIdea(id: string) { setIdeas((current) => current.filter((idea) => idea.id !== id)) }

  return <section className="ideas-lab panel-card">
    <div className="ideas-heading">
      <div><span className="eyebrow">SYNAPSE · LABORATORIO</span><h2>Radar de ideas</h2><p>De una señal dispersa a un proyecto probado, sin saltar directo a construir.</p></div>
      <div className="ideas-heading-actions"><button className="add-agent" onClick={() => setShowForm(true)}><Plus size={16} /> Nueva señal</button>{close && <button className="icon-button" onClick={close} aria-label="Cerrar"><X size={18} /></button>}</div>
    </div>

    <div className="ideas-principles"><span><Radar size={15} /> Observar</span><span><Lightbulb size={15} /> Divergir</span><span><Target size={15} /> Elegir</span><span><FlaskConical size={15} /> Probar</span><span><CheckCircle2 size={15} /> Aprender</span></div>

    <div className="ideas-flow" role="tablist" aria-label="Etapas de CENIT Dmente">
      {stages.map((stage, index) => <button key={stage.id} className={activeStage === stage.id ? 'idea-stage active' : 'idea-stage'} onClick={() => setActiveStage(stage.id)} role="tab" aria-selected={activeStage === stage.id} style={{ '--stage-color': stage.color } as React.CSSProperties}><span className="idea-stage-number">{index + 1}</span><strong>{stage.label}</strong><small>{stage.description}</small>{index < stages.length - 1 && <ArrowRight size={14} className="idea-stage-arrow" />}</button>)}
    </div>

    <div className="ideas-content"><div className="ideas-content-heading"><div><span className="eyebrow">ETAPA {stages.findIndex((stage) => stage.id === activeStage) + 1} DE 5</span><h3>{currentStage.label}</h3></div><span className="ideas-count">{currentIdeas.length} {currentIdeas.length === 1 ? 'registro' : 'registros'}</span></div>
      {currentIdeas.length === 0 && <div className="ideas-empty"><Sparkles size={26} /><strong>Aún no hay señales aquí</strong><span>Registre un problema, tendencia, conversación o intuición. CENIT Dmente la convertirá en un siguiente paso verificable.</span><button className="text-button" onClick={() => setShowForm(true)}>Agregar primera señal <ArrowRight size={14} /></button></div>}
      <div className="idea-grid">{currentIdeas.map((idea) => <article className="idea-card" key={idea.id}><div className="idea-card-top"><span className="idea-source">{idea.source}</span><button className="icon-button" onClick={() => removeIdea(idea.id)} aria-label={`Eliminar ${idea.title}`}><X size={14} /></button></div><h4>{idea.title}</h4><p>{idea.problem}</p><dl><div><dt>Público</dt><dd>{idea.audience}</dd></div><div><dt>Puntaje</dt><dd>{idea.score ? `${idea.score}/10` : 'Pendiente'}</dd></div></dl><div className="idea-next"><span>Próximo paso</span><strong>{idea.nextStep}</strong></div>{activeStage !== 'decision' && <button className="idea-advance" onClick={() => advanceIdea(idea)}>Pasar a {stages[stages.findIndex((stage) => stage.id === activeStage) + 1]?.label ?? 'decisión'} <ArrowRight size={14} /></button>}</article>)}</div>
    </div>

    {showForm && <div className="modal-backdrop"><form className="idea-form panel-card" onSubmit={addIdea}><div className="panel-heading"><div><span className="eyebrow">NUEVA SEÑAL</span><h2>Capturar para explorar</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Cerrar"><X size={18} /></button></div><p className="idea-form-note">No evaluamos todavía. Primero capturamos el problema y su origen; la selección viene después.</p><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Seguimiento visual para pacientes" autoFocus /></label><label>Problema u oportunidad<textarea value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="¿Qué observó y por qué podría importar?" /></label><label>Público objetivo<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="¿A quién afecta o beneficia?" /></label><label>Origen de la señal<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Conversación, tendencia, cliente, investigación..." /></label><button className="auth-submit" type="submit" disabled={!title.trim() || !problem.trim()}><Plus size={16} /> Guardar en Radar</button></form></div>}
  </section>
}
