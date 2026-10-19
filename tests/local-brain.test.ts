import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LocalBrain, type LocalDirectory, type LocalFileHandle } from '../src/features/second-brain/local-brain'

const signal = () => new AbortController().signal
function file(name: string, content: string): LocalFileHandle {
  return { name, kind: 'file', getFile: async () => new File([content], name, { lastModified: 1700000000000 }) }
}
function dir(name: string, children: (LocalDirectory | LocalFileHandle)[]): LocalDirectory {
  return { name, kind: 'directory', async *values() { yield* children } }
}
function fixture() {
  const brain = new LocalBrain()
  brain.setDirectory('vault', dir('WIKI DMENTE DIGITAL', [
    dir('Fichas', [file('Retención.md', '# Retención\nEl seguimiento mejora la relación.\n[[Libro.PDF]]\n[Relacionado](../Nota.md)')]),
    file('Nota.md', '# Nota\nOtra idea.'), file('Peligro.html', '<script>bad</script>'), dir('.obsidian', [file('Oculta.md', 'private')]),
  ]))
  brain.setDirectory('ebooks', dir('EBOOKS', [file('Libro.PDF', '%PDF-test'), file('Libro.epub', 'EPUB-test'), file('Secreta.md', 'not an ebook')]))
  return brain
}

test('local read catalog excludes hidden/HTML and reads notes, links and originals without network', async () => {
  const originalFetch = globalThis.fetch; let requests = 0
  globalThis.fetch = async () => { requests++; throw new Error('Network forbidden in local mode') }
  try {
    const brain = fixture()
    const status = await brain.status(signal())
    assert.equal(status.vaultName, 'WIKI DMENTE DIGITAL')
    assert.equal(status.ebooksAvailable, true)
    const catalog = await brain.list(new URLSearchParams(), signal())
    assert.deepEqual(catalog.counts, { note: 1, index: 1, ebook: 2 })
    assert.equal(catalog.total, 4)
    const note = await brain.note('Fichas/Retención.md', signal())
    assert.match(note.content, /seguimiento/)
    assert.equal(note.links.length, 2)
    assert.match(note.obsidianUrl, /^obsidian:\/\/open\?vault=WIKI%20DMENTE%20DIGITAL&file=Fichas/)
    const resolved = await brain.resolve('Libro.PDF', note.entry.path, signal())
    assert.equal(resolved.matches.length, 1)
    assert.equal(await (await brain.original(resolved.matches[0], signal())).text(), '%PDF-test')
    assert.equal((await brain.resolve('../Nota.md', note.entry.path, signal())).matches[0].path, 'Nota.md')
    assert.equal(requests, 0)
  } finally { globalThis.fetch = originalFetch }
})

test('local search is accent-insensitive, searches Markdown bodies, filters and paginates', async () => {
  const brain = fixture()
  assert.equal((await brain.list(new URLSearchParams({ q: 'relacion', kind: 'index' }), signal())).total, 1)
  const books = await brain.list(new URLSearchParams({ kind: 'ebook', limit: '1', offset: '1' }), signal())
  assert.equal(books.total, 2); assert.equal(books.items.length, 1)
  assert.equal((await brain.list(new URLSearchParams({ q: 'PDF-test' }), signal())).total, 0)
})

test('local references never escape selected handles; oversized notes, cancellation and disconnect are explicit', async () => {
  const brain = fixture(); await brain.list(new URLSearchParams(), signal())
  for (const target of ['https://example.com/a.pdf', 'C:/outside.pdf', '../../../outside.pdf', '/etc/passwd']) await assert.rejects(brain.resolve(target, 'Fichas/Retención.md', signal()))
  await assert.rejects(brain.note('../Nota.md', signal()))
  const abort = new AbortController(); abort.abort()
  await assert.rejects(brain.list(new URLSearchParams(), abort.signal), error => (error as Error).name === 'AbortError')
  brain.setDirectory('vault', dir('vault', [file('Large.md', 'x'.repeat(1024 * 1024 + 1))]))
  await brain.list(new URLSearchParams(), signal())
  await assert.rejects(brain.note('Large.md', signal()), /1 MiB/)
  brain.disconnect()
  assert.equal((await brain.list(new URLSearchParams(), signal())).total, 0)
  assert.equal((await brain.status(signal())).configured, false)
})

test('picker requests only read permission and a cancelled picker preserves the selected roots', async () => {
  const originalWindow = (globalThis as Record<string, unknown>).window
  const calls: unknown[] = []
  const root = dir('chosen', [])
  ;(globalThis as Record<string, unknown>).window = { showDirectoryPicker: async (options: unknown) => { calls.push(options); return root } }
  try {
    const brain = new LocalBrain(); await brain.connect('vault')
    assert.deepEqual(calls, [{ id: 'synapse-vault', mode: 'read' }])
    ;(globalThis as Record<string, unknown>).window = { showDirectoryPicker: async () => { throw new DOMException('cancelled', 'AbortError') } }
    await assert.rejects(brain.connect('vault'))
    assert.equal((await brain.status(signal())).vaultName, 'chosen')
  } finally {
    if (originalWindow === undefined) delete (globalThis as Record<string, unknown>).window
    else (globalThis as Record<string, unknown>).window = originalWindow
  }
})
