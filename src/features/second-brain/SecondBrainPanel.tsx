import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Brain, ExternalLink, FileText, FolderOpen, Link2, LoaderCircle, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import type { BrainCatalog, BrainEntry, BrainKind, BrainNote, BrainStatus } from '../../../shared/second-brain'
import './second-brain.css'

export type BrainClient = {
  status: (signal: AbortSignal) => Promise<BrainStatus>
  list: (params: URLSearchParams, signal: AbortSignal) => Promise<BrainCatalog>
  note: (path: string, signal: AbortSignal) => Promise<BrainNote>
  resolve: (target: string, from: string, signal: AbortSignal) => Promise<{ matches: BrainEntry[] }>
}
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'No se pudo consultar el segundo cerebro.')
  return data
}
const client: BrainClient = {
  status: (signal) => json('/api/second-brain/status', signal),
  list: (params, signal) => json(`/api/second-brain/files?${params}`, signal),
  note: (path, signal) => json(`/api/second-brain/note?${new URLSearchParams({ path })}`, signal),
  resolve: (target, from, signal) => json(`/api/second-brain/resolve?${new URLSearchParams({ target, from })}`, signal),
}
const labels: Record<BrainKind, string> = { note: 'Nota', index: 'Índice', ebook: 'Ebook' }
const byteLabel = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
const fileUrl = (entry: BrainEntry) => `/api/second-brain/file?${new URLSearchParams({ source: entry.source, path: entry.path })}`

function NoteText({ content }: { content: string }) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)
  const body = match ? content.slice(match[0].length) : content
  return <div className="brain-prose">{match && <details className="brain-frontmatter"><summary>Metadatos de la nota</summary><pre>{match[1]}</pre></details>}{body.split(/\r?\n/).map((line, index) => {
    if (/^# /.test(line)) return <h2 key={index}>{line.slice(2)}</h2>
    if (/^## /.test(line)) return <h3 key={index}>{line.slice(3)}</h3>
    if (/^#{3,6} /.test(line)) return <h4 key={index}>{line.replace(/^#+ /, '')}</h4>
    if (/^\s*---\s*$/.test(line)) return <hr key={index} />
    if (!line.trim()) return null
    return <p key={index} className={/^\s*[-*] /.test(line) ? 'brain-note-list-line' : undefined}>{line}</p>
  })}</div>
}

export function SecondBrainPanel({ onClose, api = client, preview = false }: { onClose: () => void; api?: BrainClient; preview?: boolean }) {
  const [status, setStatus] = useState<BrainStatus | null>(null)
  const [catalog, setCatalog] = useState<BrainCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const refresh = useRef(false)
  const [selected, setSelected] = useState<BrainEntry | null>(null)
  const [note, setNote] = useState<BrainNote | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [raw, setRaw] = useState(false)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMessage, setLinkMessage] = useState('')
  const [matches, setMatches] = useState<BrainEntry[]>([])
  const noteRequest = useRef<AbortController | null>(null)
  const linkRequest = useRef<AbortController | null>(null)
  const reader = useRef<HTMLElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ q: query, kind, offset: String(offset), limit: '40' })
    if (refresh.current) { params.set('refresh', 'true'); refresh.current = false }
    setLoading(true); setError('')
    void Promise.all([api.status(controller.signal), api.list(params, controller.signal)]).then(([nextStatus, nextCatalog]) => {
      if (!controller.signal.aborted) { setStatus(nextStatus); setCatalog(nextCatalog) }
    }).catch((cause: unknown) => { if (!controller.signal.aborted) { setStatus(null); setCatalog(null); setError(cause instanceof Error ? cause.message : 'No se pudo leer el catálogo.') } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, query, kind, offset, revision])
  useEffect(() => () => { noteRequest.current?.abort(); linkRequest.current?.abort() }, [])

  function scrollReader() {
    if (window.matchMedia('(max-width: 850px)').matches) reader.current?.scrollIntoView({ block: 'start' })
    reader.current?.focus({ preventScroll: true })
  }
  async function openEntry(entry: BrainEntry) {
    noteRequest.current?.abort(); linkRequest.current?.abort()
    const controller = new AbortController(); noteRequest.current = controller
    setSelected(entry); setNote(null); setNoteError(''); setMatches([]); setLinkMessage(''); setLinkBusy(false); setRaw(false)
    if (entry.extension !== '.md') { setNoteBusy(false); window.requestAnimationFrame(scrollReader); return }
    setNoteBusy(true)
    try { const value = await api.note(entry.path, controller.signal); if (!controller.signal.aborted) { setNote(value); window.requestAnimationFrame(scrollReader) } }
    catch (cause) { if (!controller.signal.aborted) setNoteError(cause instanceof Error ? cause.message : 'No se pudo leer la nota.') }
    finally { if (!controller.signal.aborted) setNoteBusy(false) }
  }
  async function resolveLink(target: string) {
    if (!note) return
    linkRequest.current?.abort()
    const controller = new AbortController(); linkRequest.current = controller
    setLinkBusy(true); setMatches([]); setLinkMessage('')
    try {
      const result = await api.resolve(target, note.entry.path, controller.signal)
      if (controller.signal.aborted) return
      if (result.matches.length === 1) { await openEntry(result.matches[0]); return }
      if (result.matches.length === 0) setLinkMessage('Este enlace no tiene un archivo disponible en las fuentes configuradas.')
      else { setMatches(result.matches); setLinkMessage('Hay varios archivos posibles. Elige el original que quieres consultar.') }
    } catch (cause) { if (!controller.signal.aborted) setLinkMessage(cause instanceof Error ? cause.message : 'No se pudo resolver el enlace.') }
    finally { if (!controller.signal.aborted) setLinkBusy(false) }
  }
  function search(event: FormEvent) { event.preventDefault(); setOffset(0); setQuery(draft.trim()) }
  function reload() { refresh.current = true; setRevision((current) => current + 1) }

  return <section className="brain-panel" aria-labelledby="brain-heading">
    {preview && <p className="brain-preview-notice">Vista de prueba con datos ficticios. No consulta notas reales ni abre los originales.</p>}
    <header className="brain-heading"><div><Brain size={30} /><div><h1 id="brain-heading">Segundo cerebro</h1><p>{status?.vaultName || 'Obsidian y biblioteca de ebooks'}</p></div></div><button type="button" className="brain-icon-button" onClick={onClose} aria-label="Cerrar segundo cerebro"><X size={20} /></button></header>
    <div className="brain-source-bar"><span><ShieldCheck size={15} /> Solo lectura · Administradores</span><span>Notas: {status?.available ? 'vault disponible' : 'pendiente de consulta'}</span><span>Originales: {status?.ebooksAvailable ? 'carpeta disponible' : status?.ebooksConfigured ? 'no disponible' : 'sin configurar'}</span></div>
    <div className="brain-controls"><form onSubmit={search}><Search size={17} /><label className="brain-sr-only" htmlFor="brain-search">Buscar en el segundo cerebro</label><input id="brain-search" type="search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Buscar en notas, índices y nombres de ebooks" maxLength={200} /><button type="submit" disabled={loading}>Buscar</button></form><button type="button" className="brain-refresh" onClick={reload} disabled={loading}><RefreshCw size={15} /> Actualizar</button></div>
    <div className="brain-kind-tabs" role="group" aria-label="Tipo de documento">{(['all', 'index', 'note', 'ebook'] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setOffset(0) }}>{value === 'all' ? 'Todos' : value === 'index' ? 'Índices' : value === 'note' ? 'Notas' : 'Ebooks'}{catalog && <span>{value === 'all' ? Object.values(catalog.counts).reduce((sum, count) => sum + count, 0) : catalog.counts[value]}</span>}</button>)}</div>
    {error ? <div className="brain-state" role="alert"><FolderOpen size={30} /><h2>No se pudo consultar el segundo cerebro</h2><p>{error}</p><button type="button" onClick={reload}>Reintentar</button></div> : <div className="brain-layout">
      <section className="brain-catalog" aria-label="Archivos del segundo cerebro" aria-busy={loading}>
        <div className="brain-catalog-heading"><strong>{loading ? 'Consultando las fuentes…' : `${catalog?.total ?? 0} resultados${query ? ` para «${query}»` : ''}`}</strong><small>Contenido en notas · Nombre en ebooks</small></div>
        {loading ? <div className="brain-state" role="status"><LoaderCircle size={26} /><p>Leyendo el catálogo. Los originales permanecen en sus carpetas.</p></div> : catalog?.items.length ? <ul className="brain-file-list">{catalog.items.map((entry) => <li key={entry.id}><button type="button" onClick={() => void openEntry(entry)} className={selected?.id === entry.id ? 'is-selected' : ''} aria-pressed={selected?.id === entry.id}>{entry.kind === 'ebook' ? <BookOpen size={21} /> : <FileText size={21} />}<span><strong>{entry.title}</strong><span>{labels[entry.kind]} · {entry.extension.slice(1).toUpperCase()} · {byteLabel(entry.bytes)}</span><small>{entry.source === 'ebooks' ? 'EBOOKS' : 'Vault'} / {entry.path}</small>{entry.snippet && <p>{entry.snippet}</p>}</span><ArrowRight size={15} /></button></li>)}</ul> : <div className="brain-state"><Search size={28} /><h2>Sin coincidencias</h2><p>Prueba otro término o tipo de documento. La búsqueda no extrae texto de PDF o EPUB.</p></div>}
        {catalog && !loading && <div className="brain-pagination"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 40))}><ArrowLeft size={15} /> Anterior</button><span>{catalog.total ? `${offset + 1} a ${Math.min(offset + 40, catalog.total)} de ${catalog.total}` : '0 resultados'}</span><button type="button" disabled={offset + 40 >= catalog.total} onClick={() => setOffset(offset + 40)}>Siguiente <ArrowRight size={15} /></button></div>}
      </section>
      <section className="brain-reader" ref={reader} tabIndex={-1} aria-label="Lectura del documento">
        {!selected ? <div className="brain-reader-welcome"><span className="brain-reader-mark"><Brain size={43} /></span><h2>El conocimiento está en tus archivos.</h2><p>Selecciona una nota o una ficha para leerla aquí. Sus enlaces permiten consultar los ebooks de las fuentes autorizadas.</p><span><ShieldCheck size={15} /> Lectura directa, sin importar los documentos a otra base.</span></div> : <>
          <header className="brain-reader-heading"><div><span>{labels[selected.kind]} · {selected.source === 'ebooks' ? 'EBOOKS' : 'Obsidian'}</span><h2>{selected.title}</h2><p>{selected.path}</p></div></header>
          {noteBusy ? <div className="brain-state" role="status"><LoaderCircle size={27} /><p>Leyendo la nota original…</p></div> : noteError ? <div className="brain-state" role="alert"><p>{noteError}</p><button type="button" onClick={() => void openEntry(selected)}>Reintentar lectura</button></div> : note ? <>
            <div className="brain-reader-actions"><button type="button" aria-pressed={raw} onClick={() => setRaw(!raw)}>{raw ? 'Vista de lectura' : 'Markdown original'}</button>{!preview && <a href={note.obsidianUrl}><ExternalLink size={14} /> Abrir en Obsidian</a>}</div>
            {raw ? <pre className="brain-markdown-source">{note.content}</pre> : <NoteText content={note.content} />}
            {note.links.length > 0 && <section className="brain-note-links"><h3><Link2 size={16} /> Enlaces de la nota</h3><p>Busca el destino dentro del vault y la carpeta de ebooks configurada.</p><ul>{note.links.map((link) => <li key={link.target}><button type="button" onClick={() => void resolveLink(link.target)} disabled={linkBusy}>{link.label}<ArrowRight size={14} /></button></li>)}</ul></section>}
            <p className="brain-device-note">Abrir en Obsidian requiere que ese vault esté disponible en tu dispositivo.</p>
          </> : <div className="brain-book-detail"><BookOpen size={48} /><p>Original {selected.extension.slice(1).toUpperCase()} · {byteLabel(selected.bytes)}</p><p>El archivo se sirve desde su carpeta. Synapse no extrae ni modifica su contenido.</p>{preview ? <p>La apertura del original requiere una sesión real de administrador.</p> : <a href={fileUrl(selected)} target="_blank" rel="noreferrer">{selected.extension === '.pdf' ? 'Abrir PDF' : 'Descargar original'} <ExternalLink size={15} /></a>}</div>}
          {(linkBusy || linkMessage) && <p className="brain-link-message" role="status">{linkBusy ? 'Buscando el archivo enlazado…' : linkMessage}</p>}
          {matches.length > 0 && <ul className="brain-resolve-list">{matches.map((entry) => <li key={entry.id}><button type="button" onClick={() => void openEntry(entry)}><strong>{entry.title}</strong><small>{entry.source} / {entry.path}</small></button></li>)}</ul>}
        </>}
      </section>
    </div>}
    {catalog?.warnings.map((warning) => <p className="brain-warning" key={warning} role="note">{warning}</p>)}
    <footer className="brain-footer"><span>Fuentes originales de solo lectura. No se ejecutan instrucciones incluidas en las notas.</span>{catalog && <span>Catálogo: {new Date(catalog.scannedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · Bogotá</span>}</footer>
  </section>
}
