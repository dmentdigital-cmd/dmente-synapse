import { useState } from 'react'
import { FolderOpen, Unplug } from 'lucide-react'
import type { BrainSource } from '../../../shared/second-brain'
import { LocalBrain } from './local-brain'
import { SecondBrainPanel } from './SecondBrainPanel'
import './second-brain.css'

export function SecondBrainWorkspace({ local, onClose }: { local: LocalBrain; onClose: () => void }) {
  const [mode, setMode] = useState<'local' | 'server'>('local')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function choose(source: BrainSource) {
    setBusy(true); setMessage('')
    try { await local.connect(source); setRevision(value => value + 1) }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof Error ? error.message : 'No se pudo conectar la carpeta local.') }
    finally { setBusy(false) }
  }
  return <div className="brain-workspace">
    <section className="brain-local-connection" aria-label="Origen de documentos">
      <div className="brain-source-modes" role="group" aria-label="Elegir origen"><button type="button" aria-pressed={mode === 'local'} disabled={busy} onClick={() => setMode('local')}>Este equipo</button><button type="button" aria-pressed={mode === 'server'} disabled={busy} onClick={() => setMode('server')}>Servidor</button></div>
      {mode === 'local' ? <><div className="brain-local-buttons"><button type="button" disabled={busy} onClick={() => void choose('vault')}><FolderOpen size={16} /> Elegir vault Obsidian</button><button type="button" disabled={busy} onClick={() => void choose('ebooks')}><FolderOpen size={16} /> Elegir EBOOKS</button><button type="button" disabled={busy} onClick={() => { local.disconnect(); setRevision(value => value + 1); setMessage('Carpetas desconectadas de esta sesión.') }}><Unplug size={15} /> Desconectar</button></div><p>Solo lectura desde este equipo. No se suben documentos al servidor. Las carpetas elegidas se conservan en memoria hasta recargar o cerrar sesión.</p><p>Elige «WIKI DMENTE DIGITAL» como vault y, si quieres consultar originales, la carpeta «EBOOKS».</p></> : <p>Consulta las carpetas configuradas en el servidor. Las carpetas de este equipo no se copian ni se conectan a este modo.</p>}
      {mode === 'local' && <p>La ruta se elige en la ventana de Windows: pega la ruta del vault en su barra de direcciones y confirma «Seleccionar carpeta».</p>}
      {busy && <p role="status">Esperando la selección de carpeta…</p>}{message && <p role="status">{message}</p>}
    </section>
    <SecondBrainPanel key={`${mode}:${revision}`} api={mode === 'local' ? local : undefined} localMode={mode === 'local'} onClose={onClose} />
  </div>
}
