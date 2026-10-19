import type { BrainCatalog, BrainEntry, BrainKind, BrainNote, BrainSource, BrainStatus } from '../../../shared/second-brain'
import { extractBrainLinks } from '../../../shared/brain-links'
import type { BrainClient } from './SecondBrainPanel'

export type LocalFileHandle = { kind: 'file'; name: string; getFile: () => Promise<File> }
export type LocalDirectory = { kind: 'directory'; name: string; values: () => AsyncIterable<LocalDirectory | LocalFileHandle> }
type PickerWindow = Window & { showDirectoryPicker?: (options: { id: string; mode: 'read' }) => Promise<LocalDirectory> }
const normal = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
const extension = (value: string) => /\.[^.\/]+$/.exec(value)?.[0].toLowerCase() ?? ''
const basename = (value: string) => value.split('/').pop() ?? value
const safePath = (value: string) => Boolean(value && value.length <= 2000 && !/[\x00-\x1f\\:]/.test(value) && !value.split('/').some(part => !part || part === '..' || part.startsWith('.')))
const allowed = (value: string, source: BrainSource) => ['.pdf', '.epub', '.mobi', '.azw', '.azw3', ...(source === 'vault' ? ['.md'] : [])].includes(extension(value))
const MAX_NOTE = 1024 * 1024

/** Read-only browser handles. No fetch, upload, IndexedDB or file-writing capability. */
export class LocalBrain implements BrainClient {
  private roots: Partial<Record<BrainSource, LocalDirectory>> = {}
  private files = new Map<string, { entry: BrainEntry; handle: LocalFileHandle }>()
  private scannedAt = ''; private warnings: string[] = []

  async connect(source: BrainSource) {
    const picker = (window as PickerWindow).showDirectoryPicker
    if (!picker) throw new Error('La selección de carpetas no está disponible en este navegador. Abre Synapse en Chrome o Edge desde este equipo.')
    const directory = await picker.call(window, { id: `synapse-${source}`, mode: 'read' })
    this.setDirectory(source, directory)
  }
  setDirectory(source: BrainSource, directory: LocalDirectory) { this.roots[source] = directory; this.files.clear(); this.scannedAt = '' }
  disconnect() { this.roots = {}; this.files.clear(); this.scannedAt = ''; this.warnings = [] }
  async status(signal: AbortSignal): Promise<BrainStatus> {
    signal.throwIfAborted()
    return { configured: Boolean(this.roots.vault), available: Boolean(this.roots.vault), vaultName: this.roots.vault?.name ?? 'Carpetas de este equipo', readOnly: true, ebooksConfigured: Boolean(this.roots.ebooks), ebooksAvailable: Boolean(this.roots.ebooks), message: this.roots.vault ? undefined : 'Elige tu vault de Obsidian para consultar las notas de este equipo.' }
  }
  private async scan(signal: AbortSignal, refresh = false) {
    if (this.scannedAt && !refresh) return
    const files: typeof this.files = new Map(); const warnings: string[] = []
    let partial = false
    const walk = async (directory: LocalDirectory, source: BrainSource, relative = '', depth = 0) => {
      signal.throwIfAborted()
      if (depth > 32 || files.size >= 12000) { partial = true; return }
      try {
        for await (const child of directory.values()) {
          signal.throwIfAborted()
          if (child.name.startsWith('.') || child.name === 'node_modules') continue
          if (files.size >= 12000) { partial = true; break }
          const path = relative ? `${relative}/${child.name}` : child.name
          if (!safePath(path)) { partial = true; continue }
          if (child.kind === 'directory') await walk(child, source, path, depth + 1)
          else if (allowed(path, source)) {
            try {
              const file = await child.getFile()
              const ext = extension(path)
              const kind: BrainKind = ext !== '.md' ? 'ebook' : /(^|\/)(fichas|indices|índices|indexes)(\/|$)/i.test(path) || /^(index|índice|indice|moc|readme)([._ -]|$)/i.test(basename(path)) ? 'index' : 'note'
              const entry: BrainEntry = { id: `${source}:${path}`, source, path, title: basename(path).replace(/\.[^.]+$/, ''), kind, extension: ext, bytes: file.size, modifiedAt: new Date(file.lastModified).toISOString() }
              files.set(entry.id, { entry, handle: child })
            } catch (error) { if (signal.aborted) throw error; partial = true }
          }
        }
      } catch (error) { if (signal.aborted) throw error; partial = true }
    }
    for (const source of ['vault', 'ebooks'] as const) { const root = this.roots[source]; if (root) await walk(root, source) }
    signal.throwIfAborted()
    if (partial) warnings.push('El catálogo local es parcial: hay archivos sin permiso o se alcanzó el límite de 12 000 archivos o 32 niveles. Puedes volver a elegir las carpetas y actualizar.')
    this.files = files; this.warnings = warnings; this.scannedAt = new Date().toISOString()
  }
  private async text(relative: string, signal: AbortSignal, byteLimit = MAX_NOTE) {
    signal.throwIfAborted()
    if (!safePath(relative) || extension(relative) !== '.md') throw new Error('Selecciona una nota Markdown del vault elegido.')
    const record = this.files.get(`vault:${relative}`)
    if (!record) throw new Error('La nota no está en el catálogo local. Actualiza o vuelve a elegir el vault.')
    const file = await record.handle.getFile()
    if (file.size > MAX_NOTE) throw new Error('La nota supera el límite de lectura de 1 MiB.')
    if (file.size > byteLimit) throw new Error('Se alcanzó el límite de búsqueda de contenido local.')
    const content = (await file.text()).replace(/^\uFEFF/, '')
    signal.throwIfAborted()
    return { entry: { ...record.entry, bytes: file.size, modifiedAt: new Date(file.lastModified).toISOString() }, content }
  }
  async list(params: URLSearchParams, signal: AbortSignal): Promise<BrainCatalog> {
    await this.scan(signal, params.get('refresh') === 'true')
    const counts: BrainCatalog['counts'] = { note: 0, index: 0, ebook: 0 }
    const entries = [...this.files.values()].map(record => record.entry)
    const terms = normal((params.get('q') ?? '').slice(0, 200).trim()).split(/\s+/).filter(Boolean)
    const kind = params.get('kind') ?? 'all'
    const limit = Math.max(1, Math.min(100, Number(params.get('limit')) || 40))
    const offset = Math.max(0, Number(params.get('offset')) || 0)
    const warnings = [...this.warnings]; const results: (BrainEntry & { rank: number })[] = []
    let searchBytes = 0; let partial = false
    for (const entry of entries) {
      signal.throwIfAborted(); counts[entry.kind]++
      if (kind !== 'all' && kind !== entry.kind) continue
      const title = normal(`${entry.title} ${entry.path}`)
      const rank = terms.filter(term => title.includes(term)).length
      let content = ''
      if (terms.length && rank !== terms.length && entry.extension === '.md') {
        if (entry.bytes <= MAX_NOTE && searchBytes + entry.bytes <= 32 * MAX_NOTE) {
          try { const result = await this.text(entry.path, signal, 32 * MAX_NOTE - searchBytes); content = result.content; searchBytes += result.entry.bytes } catch (error) { if (signal.aborted) throw error; partial = true }
        } else partial = true
      }
      if (terms.every(term => `${title} ${normal(content)}`.includes(term))) results.push({ ...entry, rank, snippet: content ? content.slice(Math.max(0, normal(content).indexOf(terms[0]) - 65), Math.max(0, normal(content).indexOf(terms[0]) - 65) + 220).replace(/\s+/g, ' ') : undefined })
    }
    if (partial) warnings.push('La búsqueda local de contenido es parcial: límite de 1 MiB por nota, 32 MiB por consulta o archivos sin permiso. Los nombres se buscan en todo el catálogo disponible.')
    results.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
    return { items: results.slice(offset, offset + limit).map(({ rank: _rank, ...entry }) => entry), total: results.length, limit, offset, scannedAt: this.scannedAt, counts, warnings, readOnly: true }
  }
  async note(relative: string, signal: AbortSignal): Promise<BrainNote> {
    await this.scan(signal)
    const value = await this.text(relative, signal)
    return { ...value, links: extractBrainLinks(value.content), obsidianUrl: `obsidian://open?vault=${encodeURIComponent(this.roots.vault?.name ?? '')}&file=${encodeURIComponent(relative)}`, readOnly: true }
  }
  async resolve(target: string, from: string, signal: AbortSignal) {
    await this.scan(signal)
    if (!safePath(from) || target.length > 2000) throw new Error('El enlace no es válido.')
    let decoded: string
    try { decoded = decodeURIComponent(target.split('#')[0]).replace(/\\/g, '/') } catch { throw new Error('El enlace no es válido.') }
    if (!decoded) decoded = basename(from)
    if (/^[a-z][a-z0-9+.-]*:|^\//i.test(decoded)) throw new Error('Solo se abren enlaces internos a las carpetas elegidas.')
    const segments = from.split('/').slice(0, -1)
    for (const part of decoded.split('/')) { if (part === '..') { if (!segments.length) throw new Error('El enlace sale de las carpetas elegidas.'); segments.pop() } else if (part && part !== '.') segments.push(part) }
    const local = segments.join('/')
    if (!safePath(local)) throw new Error('El enlace sale de las carpetas elegidas.')
    const entries = [...this.files.values()].map(record => record.entry)
    const possible = new Set([local, decoded, `${local}.md`, `${decoded}.md`].map(normal))
    const exact = entries.filter(entry => entry.source === 'vault' && possible.has(normal(entry.path)))
    const matches = exact.length ? exact : entries.filter(entry => [normal(basename(decoded)), normal(`${basename(decoded)}.md`)].includes(normal(basename(entry.path))))
    return { matches: matches.slice(0, 50) }
  }
  async original(entry: BrainEntry, signal: AbortSignal): Promise<File> {
    signal.throwIfAborted()
    const record = this.files.get(entry.id)
    if (!record || record.entry.kind !== 'ebook') throw new Error('El original no está en las carpetas elegidas.')
    const file = await record.handle.getFile(); signal.throwIfAborted(); return file
  }
}
