import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { after, before, test } from 'node:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { brainConfiguration, BrainError, extractBrainLinks, SecondBrain, validateBrainPath } from '../server/second-brain'
import { handleSecondBrainRoutes, parseBrainRange } from '../server/second-brain-routes'

let folder: string
let vault: string
let ebooks: string
let brain: SecondBrain
const notePath = 'Biblioteca/Fichas/Retención de clientes.md'
const originalNote = '---\ntitle: Retención de clientes\n---\n# Retención\nCuidar la relación con los clientes.\n![[Libro Uno.PDF]]\n[[Notas relacionadas|Otra nota]]\n[PDF](../../Libros/Local.pdf)\n<script>alert("fixture")</script>\n'
before(async () => {
  folder = await mkdtemp(path.join(os.tmpdir(), 'synapse-brain-'))
  vault = path.join(folder, 'vault'); ebooks = path.join(folder, 'ebooks')
  await mkdir(path.join(vault, 'Biblioteca/Fichas'), { recursive: true })
  await mkdir(path.join(vault, 'Biblioteca/Libros'), { recursive: true })
  await mkdir(path.join(vault, '.obsidian'), { recursive: true })
  await mkdir(path.join(ebooks, 'otra'), { recursive: true })
  await writeFile(path.join(vault, notePath), originalNote)
  await writeFile(path.join(vault, 'Notas relacionadas.md'), '# Nota\nInformación verificable de prueba.')
  await writeFile(path.join(vault, 'Biblioteca/Libros/Local.pdf'), '%PDF-fixture-local')
  await writeFile(path.join(vault, '.obsidian/privado.md'), 'No se debe catalogar.')
  await writeFile(path.join(vault, 'executable.html'), '<script>not served</script>')
  await writeFile(path.join(ebooks, 'Libro Uno.PDF'), '%PDF-fixture-book')
  await writeFile(path.join(ebooks, 'otra/Duplicado.pdf'), '%PDF-fixture-duplicate-1')
  await writeFile(path.join(ebooks, 'Duplicado.pdf'), '%PDF-fixture-duplicate-2')
  await writeFile(path.join(ebooks, 'secreto.md'), 'La fuente de ebooks no admite notas.')
  brain = new SecondBrain(async () => ({ vaultPath: vault, ebooksPath: ebooks, vaultName: 'Wiki de prueba' }))
})
after(async () => {
  const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(folder))
  assert.ok(relative.startsWith('synapse-brain-') && !relative.includes(path.sep) && !path.isAbsolute(relative))
  await rm(folder, { recursive: true, force: true })
})

test('configuration has no production fallback and reports missing sources without paths', async () => {
  const noConfig = await brainConfiguration({ NODE_ENV: 'production' })
  assert.equal(noConfig, null)
  const status = await new SecondBrain(async () => null).status()
  assert.equal(status.configured, false)
  assert.equal(status.available, false)
  const missing = await new SecondBrain(async () => ({ vaultPath: path.join(folder, 'missing') })).status()
  assert.equal(missing.available, false)
  assert.ok(!missing.message?.includes(folder))
})

test('catalog reads two sources, recognizes uppercase PDFs and excludes hidden files and HTML', async () => {
  const result = await brain.list({ refresh: true })
  assert.equal(result.total, 6)
  assert.deepEqual(result.counts, { note: 1, index: 1, ebook: 4 })
  assert.equal(result.readOnly, true)
  assert.ok(result.items.some((item) => item.source === 'ebooks' && item.path === 'Libro Uno.PDF'))
  assert.ok(result.items.every((item) => !item.path.includes('privado') && !item.path.includes('secreto') && !item.path.endsWith('.html')))
  assert.ok(result.items.every((item) => !item.path.startsWith(folder)))
})

test('search reads note bodies with accents and filters ebooks by name with pagination', async () => {
  const result = await brain.list({ query: 'relacion clientes' })
  assert.equal(result.total, 1)
  assert.equal(result.items[0].path, notePath)
  assert.match(result.items[0].snippet ?? '', /relación/)
  assert.equal((await brain.list({ kind: 'ebook', query: 'Libro Uno' })).total, 1)
  const page = await brain.list({ limit: 2, offset: 2 })
  assert.equal(page.items.length, 2)
  assert.equal(page.total, 6)
  await assert.rejects(brain.list({ kind: 'anything' }), (error) => error instanceof BrainError && error.status === 400)
})

test('notes stay original, reflect edits directly and expose only navigable local references', async () => {
  const hash = (content: Buffer | string) => createHash('sha256').update(content).digest('hex')
  const before = hash(await readFile(path.join(vault, notePath)))
  const note = await brain.note(notePath)
  assert.equal(note.content, originalNote)
  assert.match(note.obsidianUrl, /^obsidian:\/\/open\?vault=Wiki%20de%20prueba&file=/)
  assert.equal(note.readOnly, true)
  assert.equal(note.links.length, 3)
  assert.equal(hash(await readFile(path.join(vault, notePath))), before)
  const alternate = path.join(vault, 'Notas relacionadas.md')
  await writeFile(alternate, '# Cambio\nLa nota actualizada permanece en el vault.')
  assert.match((await brain.note('Notas relacionadas.md')).content, /actualizada/)
})

test('Obsidian and relative Markdown links resolve across sources, duplicates remain explicit', async () => {
  assert.equal((await brain.resolve('Libro Uno.PDF', notePath)).matches[0].source, 'ebooks')
  assert.equal((await brain.resolve('Notas relacionadas#seccion', notePath)).matches[0].path, 'Notas relacionadas.md')
  assert.equal((await brain.resolve('../Libros/Local.pdf', notePath)).matches[0].path, 'Biblioteca/Libros/Local.pdf')
  assert.equal((await brain.resolve('Duplicado.pdf', notePath)).matches.length, 2)
  assert.equal((await brain.resolve('inexistente.pdf', notePath)).matches.length, 0)
  await assert.rejects(brain.resolve('file:///etc/passwd', notePath), (e) => e instanceof BrainError && e.status === 400)
  await assert.rejects(brain.resolve('../../../../outside.pdf', notePath), (e) => e instanceof BrainError && e.status === 400)
  assert.deepEqual(extractBrainLinks('[web](https://example.com) ![[Archivo.pdf|PDF]]'), [{ target: 'Archivo.pdf', label: 'PDF' }])
})

test('path traversal, absolute paths, ADS, hidden files and unsupported extensions are refused', async () => {
  for (const value of ['../outside.md', '/etc/passwd', 'C:/secrets.md', 'note.md:stream', '.env.md', '.obsidian/privado.md', 'folder//note.md', 'folder\\note.md', 'a\0.md']) {
    assert.throws(() => validateBrainPath(value), BrainError)
  }
  await assert.rejects(brain.note('../outside.md'), (e) => e instanceof BrainError && e.status === 400)
  await assert.rejects(brain.openFile('vault', 'executable.html'), (e) => e instanceof BrainError && e.status === 415)
})

test('directory symlinks/junctions are not traversed or readable', async () => {
  const outside = path.join(folder, 'outside')
  await mkdir(outside); await writeFile(path.join(outside, 'escaped.md'), 'Outside the vault.')
  await symlink(outside, path.join(vault, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(brain.note('escape/escaped.md'), (e) => e instanceof BrainError && e.status === 403)
  assert.ok(!(await brain.list({ refresh: true })).items.some((item) => item.path.includes('escaped')))
})

test('oversized notes are refused with an actionable limit', async () => {
  await writeFile(path.join(vault, 'large.md'), Buffer.alloc(1024 * 1024 + 1, 65))
  await assert.rejects(brain.note('large.md'), (e) => e instanceof BrainError && e.status === 413)
})

test('range parser supports PDF reads and rejects invalid, multiple and unsafe ranges', () => {
  assert.deepEqual(parseBrainRange('bytes=3-8', 10), { start: 3, end: 8 })
  assert.deepEqual(parseBrainRange('bytes=-3', 10), { start: 7, end: 9 })
  assert.deepEqual(parseBrainRange('bytes=8-', 10), { start: 8, end: 9 })
  for (const value of ['bytes=9-1', 'bytes=10-', 'bytes=0-1,3-4', 'bytes=-0', 'bytes=999999999999999999999-']) assert.throws(() => parseBrainRange(value, 10), BrainError)
  assert.equal(parseBrainRange(undefined, 0), null)
})

class MemoryResponse extends Writable {
  statusCode = 200
  headersSent = false
  headers: Record<string, unknown> = {}
  chunks: Buffer[] = []
  setHeader(name: string, value: unknown) { this.headers[name.toLowerCase()] = value; return this }
  writeHead(status: number, headers: Record<string, unknown> = {}) { this.statusCode = status; for (const [name, value] of Object.entries(headers)) this.setHeader(name, value); this.headersSent = true; return this }
  _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) { this.chunks.push(Buffer.from(chunk)); done() }
}
async function route(url: string, role: string | null = 'admin', method = 'GET', headers: Record<string, string> = {}) {
  const res = new MemoryResponse()
  const req = { method, headers } as IncomingMessage
  let payload: unknown
  const context = {
    send: (_res: ServerResponse, code: number, value: unknown) => { res.statusCode = code; payload = value; res.end() },
    requireSession: () => { if (!role) { res.statusCode = 401; res.end(); return null } return { role } },
  }
  const handled = await handleSecondBrainRoutes(req, res as unknown as ServerResponse, new URL(url, 'http://test.invalid'), context, brain)
  return { res, payload, handled }
}

test('routes refuse non-admin sessions and mutations before reading any file', async () => {
  for (const role of ['viewer', 'operator', 'approver']) assert.equal((await route('/api/second-brain/files', role)).res.statusCode, 403)
  assert.equal((await route('/api/second-brain/files', null)).res.statusCode, 401)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await route('/api/second-brain/note', 'admin', method)).res.statusCode, 405)
  assert.equal((await route('/api/other')).handled, false)
})

test('authorized routes return notes/catalog, stream original bytes, support HEAD and guard paths', async () => {
  const result = await route('/api/second-brain/files?kind=ebook&limit=2')
  assert.equal(result.res.statusCode, 200)
  assert.equal((result.payload as { items: unknown[] }).items.length, 2)
  const file = await route('/api/second-brain/file?source=ebooks&path=Libro%20Uno.PDF', 'admin', 'GET', { range: 'bytes=0-3' })
  assert.equal(file.res.statusCode, 206)
  assert.equal(Buffer.concat(file.res.chunks).toString(), '%PDF')
  assert.equal(file.res.headers['content-type'], 'application/pdf')
  assert.equal(file.res.headers['cache-control'], 'private, no-store')
  const head = await route('/api/second-brain/file?source=ebooks&path=Libro%20Uno.PDF', 'admin', 'HEAD')
  assert.equal(head.res.statusCode, 200)
  assert.equal(head.res.chunks.length, 0)
  assert.equal((await route('/api/second-brain/note?path=..%2Foutside.md')).res.statusCode, 400)
  assert.equal((await route('/api/second-brain/file?source=unknown&path=book.pdf')).res.statusCode, 400)
  assert.equal((await route('/api/second-brain/files?limit=1000')).res.statusCode, 400)
  const invalidRange = await route('/api/second-brain/file?source=ebooks&path=Libro%20Uno.PDF', 'admin', 'GET', { range: 'bytes=9999-' })
  assert.equal(invalidRange.res.statusCode, 416)
  assert.match(String(invalidRange.res.headers['content-range']), /^bytes \*\//)
})
