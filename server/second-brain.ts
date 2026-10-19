import { constants } from 'node:fs'
import { lstat, open, readdir, readFile, realpath, stat, type FileHandle } from 'node:fs/promises'
import path from 'node:path'
import type { BrainCatalog, BrainEntry, BrainKind, BrainNote, BrainSource, BrainStatus } from '../shared/second-brain.js'

export type BrainConfig = { vaultPath: string; ebooksPath?: string; vaultName?: string }
const MAX_NOTE_BYTES = 1024 * 1024
const MAX_FILES = 12000
const MAX_SEARCH_BYTES = 32 * 1024 * 1024
const EBOOK_EXTENSIONS = new Set(['.pdf', '.epub', '.mobi', '.azw', '.azw3'])
const normal = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

export class BrainError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Only env in production. Optional machine-local configuration in ignored data/ for development. */
export async function brainConfiguration(env = process.env): Promise<BrainConfig | null> {
  if (env.SYNAPSE_SECOND_BRAIN_PATH?.trim()) return {
    vaultPath: env.SYNAPSE_SECOND_BRAIN_PATH.trim(),
    ebooksPath: env.SYNAPSE_SECOND_BRAIN_EBOOKS_PATH?.trim() || undefined,
    vaultName: env.SYNAPSE_SECOND_BRAIN_VAULT_NAME?.trim() || undefined,
  }
  if (env.NODE_ENV === 'production') return null
  try {
    const configPath = path.join(env.SYNAPSE_DATA_DIR ?? path.resolve('data'), 'second-brain-settings.json')
    if ((await stat(configPath)).size > 8192) throw new BrainError(503, 'La configuración local del segundo cerebro no es válida.')
    const value: unknown = JSON.parse(await readFile(configPath, 'utf8'))
    if (!value || typeof value !== 'object' || !('vaultPath' in value) || typeof value.vaultPath !== 'string') return null
    const data = value as Record<string, unknown>
    return { vaultPath: value.vaultPath, ebooksPath: typeof data.ebooksPath === 'string' ? data.ebooksPath : undefined, vaultName: typeof data.vaultName === 'string' ? data.vaultName : undefined }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new BrainError(503, 'No se pudo leer la configuración local del segundo cerebro.')
  }
}

export function validateBrainPath(value: string): string {
  if (!value || value.length > 2000 || /[\x00-\x1f\\:]/.test(value) || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new BrainError(400, 'La ruta debe ser relativa a una fuente autorizada.')
  }
  return value
}

const within = (root: string, candidate: string) => {
  const relative = path.relative(root, candidate)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}
const allowed = (filename: string, source: BrainSource) => {
  const extension = path.extname(filename).toLowerCase()
  return EBOOK_EXTENSIONS.has(extension) || (source === 'vault' && extension === '.md')
}
function entryFor(source: BrainSource, relative: string, info: { size: number; mtime: Date }): BrainEntry {
  const extension = path.extname(relative).toLowerCase()
  const kind: BrainKind = extension !== '.md' ? 'ebook' : /(^|\/)(fichas|indices|índices|indexes)(\/|$)/i.test(relative)
    || /^(index|índice|indice|moc|readme)([._ -]|$)/i.test(path.posix.basename(relative, extension)) ? 'index' : 'note'
  return { id: `${source}:${relative}`, source, path: relative, title: path.posix.basename(relative).replace(/\.[^.]+$/, ''), kind, extension, bytes: info.size, modifiedAt: info.mtime.toISOString() }
}

export function extractBrainLinks(content: string): { target: string; label: string }[] {
  const links = new Map<string, { target: string; label: string }>()
  const add = (target: string, label: string) => {
    if (links.size >= 100 || !target || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(target)) return
    links.set(target, { target, label: label || target })
  }
  for (const match of content.matchAll(/!?\[\[([^\]\r\n]{1,2000})\]\]/g)) {
    const [target, label] = match[1].split('|')
    add(target.trim(), label?.trim() ?? target.trim())
  }
  for (const match of content.matchAll(/!?\[([^\]\r\n]*)\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g)) {
    const target = match[2].replace(/^<|>$/g, '').replace(/\s+["'][^]*$/, '').trim()
    add(target, match[1])
  }
  return [...links.values()]
}

export class SecondBrain {
  private cached?: { key: string; at: number; entries: BrainEntry[]; warnings: string[]; scannedAt: string }
  private scanning?: { key: string; promise: Promise<NonNullable<SecondBrain['cached']>> }
  constructor(private configuration: () => Promise<BrainConfig | null> = brainConfiguration) {}

  private async root(source: BrainSource): Promise<{ root: string; config: BrainConfig }> {
    const config = await this.configuration()
    if (!config?.vaultPath) throw new BrainError(503, 'Configura SYNAPSE_SECOND_BRAIN_PATH para conectar el vault.')
    const selected = source === 'vault' ? config.vaultPath : config.ebooksPath
    if (!selected || !path.isAbsolute(selected)) throw new BrainError(503, 'La fuente solicitada no tiene una ruta absoluta configurada.')
    try {
      const root = await realpath(selected)
      if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
      return { root, config }
    } catch { throw new BrainError(503, 'La fuente configurada no está disponible. Revisa la ruta y los permisos del servidor.') }
  }

  async status(): Promise<BrainStatus> {
    const config = await this.configuration()
    const result: BrainStatus = { configured: Boolean(config?.vaultPath), available: false, vaultName: config?.vaultName || (config?.vaultPath ? path.basename(config.vaultPath) : 'Segundo cerebro'), readOnly: true, ebooksConfigured: Boolean(config?.ebooksPath), ebooksAvailable: false }
    try { await this.root('vault'); result.available = true } catch (error) { result.message = error instanceof BrainError ? error.message : 'No se pudo consultar el vault.' }
    if (result.ebooksConfigured) { try { await this.root('ebooks'); result.ebooksAvailable = true } catch { /* Report the explicit availability flag. */ } }
    return result
  }

  /** Resolve and check each descendant. Symlinks/junctions are not traversed. */
  async openFile(source: BrainSource, relative: string): Promise<{ handle: FileHandle; entry: BrainEntry }> {
    validateBrainPath(relative)
    if (!allowed(relative, source)) throw new BrainError(415, 'Solo se admiten notas Markdown y formatos de ebook permitidos.')
    const { root } = await this.root(source)
    let candidate = root
    try {
      for (const segment of relative.split('/')) {
        candidate = path.join(candidate, segment)
        if ((await lstat(candidate)).isSymbolicLink() || !within(root, await realpath(candidate))) throw new BrainError(403, 'No se permiten enlaces fuera de las fuentes autorizadas.')
      }
      const before = await lstat(candidate)
      if (!before.isFile()) throw new BrainError(404, 'El archivo no está disponible.')
      const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
      try {
        const info = await handle.stat()
        if (!info.isFile() || info.ino !== before.ino || info.dev !== before.dev || !within(root, await realpath(candidate))) throw new BrainError(403, 'El archivo cambió durante la lectura. Actualiza la lista.')
        return { handle, entry: entryFor(source, relative, info) }
      } catch (error) { await handle.close(); throw error }
    } catch (error) {
      if (error instanceof BrainError) throw error
      const code = (error as NodeJS.ErrnoException).code
      throw new BrainError(code === 'ENOENT' ? 404 : 403, code === 'ENOENT' ? 'El archivo ya no existe. Actualiza la lista.' : 'No se pudo leer este archivo.')
    }
  }

  private async text(source: BrainSource, relative: string) {
    const file = await this.openFile(source, relative)
    try {
      if (file.entry.bytes > MAX_NOTE_BYTES) throw new BrainError(413, 'La nota supera el límite de lectura de 1 MiB. Ábrela en Obsidian.')
      const buffer = Buffer.alloc(Math.min(file.entry.bytes + 1, MAX_NOTE_BYTES + 1))
      let length = 0
      while (length < buffer.length) {
        const { bytesRead } = await file.handle.read(buffer, length, buffer.length - length, length)
        if (!bytesRead) break
        length += bytesRead
      }
      if (length > MAX_NOTE_BYTES) throw new BrainError(413, 'La nota supera el límite de lectura de 1 MiB. Ábrela en Obsidian.')
      if ((await file.handle.stat()).size > length) throw new BrainError(409, 'La nota cambió durante la lectura. Intenta abrirla otra vez.')
      return { entry: file.entry, content: buffer.subarray(0, length).toString('utf8').replace(/^\uFEFF/, '') }
    } finally { await file.handle.close() }
  }

  private async catalog(refresh = false) {
    const vault = await this.root('vault')
    let ebooks: Awaited<ReturnType<SecondBrain['root']>> | undefined
    const warnings: string[] = []
    if (vault.config.ebooksPath) { try { ebooks = await this.root('ebooks') } catch { warnings.push('La carpeta de ebooks no está disponible; se muestran las notas y archivos del vault.') } }
    const key = `${vault.root}\n${ebooks?.root ?? ''}`
    if (!refresh && this.cached?.key === key && Date.now() - this.cached.at < 10000) return this.cached
    if (this.scanning?.key === key) return this.scanning.promise
    const promise = (async () => {
      const entries: BrainEntry[] = []
      let skipped = false
      const walk = async (root: string, source: BrainSource, relative = '', depth = 0): Promise<void> => {
        if (depth > 32 || entries.length >= MAX_FILES) { skipped = true; return }
        const directory = path.join(root, relative)
        try {
          if ((await lstat(directory)).isSymbolicLink() || !within(root, await realpath(directory))) return
          const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
          for (const child of children) {
            if (entries.length >= MAX_FILES) { skipped = true; break }
            if (child.name.startsWith('.') || child.name === 'node_modules' || child.isSymbolicLink()) continue
            const next = relative ? `${relative}/${child.name}` : child.name
            if (child.isDirectory()) await walk(root, source, next, depth + 1)
            else if (child.isFile() && allowed(child.name, source)) {
              try { validateBrainPath(next); const info = await lstat(path.join(root, next)); if (info.isFile() && !info.isSymbolicLink()) entries.push(entryFor(source, next, info)) }
              catch { skipped = true }
            }
          }
        } catch { skipped = true }
      }
      await walk(vault.root, 'vault')
      if (ebooks && ebooks.root !== vault.root) await walk(ebooks.root, 'ebooks')
      if (skipped) warnings.push('El catálogo es parcial: hay rutas no legibles o se alcanzó el límite de 12 000 archivos o 32 niveles.')
      entries.sort((a, b) => a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
      const result = { key, at: Date.now(), entries, warnings, scannedAt: new Date().toISOString() }
      this.cached = result
      return result
    })()
    this.scanning = { key, promise }
    try { return await promise } finally { if (this.scanning?.promise === promise) this.scanning = undefined }
  }

  async list(options: { query?: string; kind?: string; limit?: number; offset?: number; refresh?: boolean } = {}): Promise<BrainCatalog> {
    const { query = '', kind = 'all', limit = 50, offset = 0, refresh = false } = options
    if (query.length > 200 || !['all', 'note', 'index', 'ebook'].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new BrainError(400, 'Los filtros o la paginación no son válidos.')
    const catalog = await this.catalog(refresh)
    const counts: BrainCatalog['counts'] = { note: 0, index: 0, ebook: 0 }
    for (const entry of catalog.entries) counts[entry.kind]++
    const candidates = catalog.entries.filter((entry) => kind === 'all' || entry.kind === kind)
    const terms = normal(query.trim()).split(/\s+/).filter(Boolean)
    const warnings = [...catalog.warnings]
    const results: (BrainEntry & { rank: number })[] = []
    let searchBytes = 0
    let incomplete = false
    for (const entry of candidates) {
      if (!terms.length) { results.push({ ...entry, rank: 0 }); continue }
      const title = normal(`${entry.title} ${entry.path}`)
      const titleMatches = terms.filter((term) => title.includes(term)).length
      let content = ''
      if (entry.extension === '.md' && titleMatches !== terms.length) {
        if (entry.bytes <= MAX_NOTE_BYTES && searchBytes + entry.bytes <= MAX_SEARCH_BYTES) {
          searchBytes += entry.bytes
          try { content = (await this.text(entry.source, entry.path)).content } catch { incomplete = true }
        } else incomplete = true
      }
      const searchable = `${title} ${normal(content)}`
      if (terms.every((term) => searchable.includes(term))) {
        const first = Math.max(0, normal(content).indexOf(terms[0]) - 65)
        results.push({ ...entry, rank: titleMatches, snippet: content ? content.slice(first, first + 220).replace(/\s+/g, ' ').trim() : undefined })
      }
    }
    if (incomplete) warnings.push('La búsqueda de contenido es parcial: límite de 1 MiB por nota, 32 MiB por consulta o archivos no legibles. Los nombres sí se buscan en todo el catálogo disponible.')
    results.sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id))
    return { items: results.slice(offset, offset + limit).map(({ rank: _rank, ...entry }) => entry), total: results.length, limit, offset, scannedAt: catalog.scannedAt, counts, warnings, readOnly: true }
  }

  async note(relative: string): Promise<BrainNote> {
    if (path.extname(relative).toLowerCase() !== '.md') throw new BrainError(415, 'Selecciona una nota Markdown.')
    const result = await this.text('vault', relative)
    const { config, root } = await this.root('vault')
    const vaultName = config.vaultName || path.basename(root)
    return { ...result, links: extractBrainLinks(result.content), obsidianUrl: `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relative)}`, readOnly: true }
  }

  async resolve(target: string, from: string): Promise<{ matches: BrainEntry[] }> {
    validateBrainPath(from)
    if (target.length > 2000) throw new BrainError(400, 'El enlace es demasiado largo.')
    let decoded: string
    try { decoded = decodeURIComponent(target.split('#')[0]) } catch { throw new BrainError(400, 'El enlace no es válido.') }
    if (!decoded) decoded = path.posix.basename(from)
    decoded = decoded.replace(/\\/g, '/')
    if (/^[a-z][a-z0-9+.-]*:|^\//i.test(decoded)) throw new BrainError(400, 'Solo se resuelven enlaces internos a las fuentes autorizadas.')
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(from), decoded))
    validateBrainPath(local)
    const catalog = await this.catalog()
    const possible = new Set([normal(local), normal(decoded), normal(`${local}.md`), normal(`${decoded}.md`)])
    const explicit = catalog.entries.filter((entry) => entry.source === 'vault' && possible.has(normal(entry.path)))
    if (explicit.length) return { matches: explicit.slice(0, 50) }
    const basename = normal(path.posix.basename(decoded))
    return { matches: catalog.entries.filter((entry) => normal(path.posix.basename(entry.path)) === basename || normal(path.posix.basename(entry.path)) === `${basename}.md`).slice(0, 50) }
  }
}
