import type { IncomingMessage, ServerResponse } from 'node:http'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { BrainError, SecondBrain } from './second-brain.js'
import type { BrainSource } from '../shared/second-brain.js'

type RouteContext = {
  send: (res: ServerResponse, status: number, payload: unknown) => void
  requireSession: (req: IncomingMessage, res: ServerResponse, roles?: ['admin']) => { role: string } | null
}
export function parseBrainRange(value: string | undefined, size: number): { start: number; end: number } | null {
  if (value === undefined) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2]) || size < 1) throw new BrainError(416, 'El rango solicitado no es válido.')
  let start: number; let end: number
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) throw new BrainError(416, 'El rango solicitado no es válido.'); start = Math.max(0, size - suffix); end = size - 1 }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1 }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new BrainError(416, 'El rango solicitado no es válido.')
  return { start, end }
}

const defaultBrain = new SecondBrain()
export async function handleSecondBrainRoutes(req: IncomingMessage, res: ServerResponse, url: URL, context: RouteContext, brain = defaultBrain): Promise<boolean> {
  if (url.pathname !== '/api/second-brain' && !url.pathname.startsWith('/api/second-brain/')) return false
  const session = context.requireSession(req, res, ['admin'])
  if (!session) return true
  if (session.role !== 'admin') { context.send(res, 403, { error: 'Solo administradores pueden consultar el segundo cerebro.' }); return true }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    context.send(res, 405, { error: 'El segundo cerebro es de solo lectura.' }); return true
  }
  try {
    const sourceText = url.searchParams.get('source') ?? 'vault'
    if (sourceText !== 'vault' && sourceText !== 'ebooks') throw new BrainError(400, 'La fuente solicitada no es válida.')
    const source: BrainSource = sourceText
    const relative = url.searchParams.get('path') ?? ''
    if (url.pathname === '/api/second-brain/status') context.send(res, 200, await brain.status())
    else if (url.pathname === '/api/second-brain/files') {
      const limit = url.searchParams.get('limit') ?? '50'; const offset = url.searchParams.get('offset') ?? '0'
      if (!/^\d{1,3}$/.test(limit) || !/^\d{1,9}$/.test(offset)) throw new BrainError(400, 'La paginación no es válida.')
      context.send(res, 200, await brain.list({ query: url.searchParams.get('q') ?? '', kind: url.searchParams.get('kind') ?? 'all', limit: Number(limit), offset: Number(offset), refresh: url.searchParams.get('refresh') === 'true' }))
    } else if (url.pathname === '/api/second-brain/note') {
      if (source !== 'vault') throw new BrainError(400, 'Las notas se consultan en el vault.')
      context.send(res, 200, await brain.note(relative))
    } else if (url.pathname === '/api/second-brain/resolve') context.send(res, 200, await brain.resolve(url.searchParams.get('target') ?? '', url.searchParams.get('from') ?? ''))
    else if (url.pathname === '/api/second-brain/file') {
      const { handle, entry } = await brain.openFile(source, relative)
      let streamed = false
      try {
        let range: ReturnType<typeof parseBrainRange>
        try { range = parseBrainRange(typeof req.headers.range === 'string' ? req.headers.range : undefined, entry.bytes) }
        catch (error) { res.setHeader('Content-Range', `bytes */${entry.bytes}`); throw error }
        const name = path.posix.basename(entry.path)
        const asciiName = name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const encodedName = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)
        const inline = entry.extension === '.pdf'
        const types: Record<string, string> = { '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.mobi': 'application/x-mobipocket-ebook', '.md': 'text/plain; charset=utf-8' }
        res.writeHead(range ? 206 : 200, {
          'Content-Type': types[entry.extension] ?? 'application/octet-stream', 'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
          'Content-Length': range ? range.end - range.start + 1 : entry.bytes,
          ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${entry.bytes}` } : {}),
        })
        if (req.method === 'HEAD' || entry.bytes === 0) res.end()
        else {
          const stream = handle.createReadStream(range ? { start: range.start, end: range.end, autoClose: true } : { autoClose: true })
          streamed = true
          await pipeline(stream, res)
        }
      } finally { if (!streamed) await handle.close() }
    } else context.send(res, 404, { error: 'Ruta del segundo cerebro no encontrada.' })
  } catch (error) {
    if (res.headersSent) { res.destroy(); return true }
    context.send(res, error instanceof BrainError ? error.status : 500, { error: error instanceof BrainError ? error.message : 'No se pudo consultar el segundo cerebro.' })
  }
  return true
}
