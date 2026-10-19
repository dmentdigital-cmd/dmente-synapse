import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ServerResponse } from 'node:http'
import vm from 'node:vm'
import { test } from 'node:test'
import { serveStatic } from '../server/static-files.js'

test('missing assets return uncached 404s while SPA routes keep the HTML shell', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'synapse-startup-'))
  try {
    await mkdir(path.join(folder, 'assets'))
    await writeFile(path.join(folder, 'index.html'), '<main>shell</main>')
    await writeFile(path.join(folder, 'startup.js'), '/* recovery */')
    await writeFile(path.join(folder, 'assets/index-abcdefgh.js'), '/* application */')
    async function request(url: string) {
      const result = { status: 0, headers: {} as Record<string, string>, body: '' }
      const response = { writeHead(status: number, headers: Record<string, string>) { result.status = status; result.headers = headers }, end(body: Buffer | string) { result.body = body.toString() } } as unknown as ServerResponse
      await serveStatic(folder, url, response)
      return result
    }
    for (const url of ['/assets/old.js', '/assets/old.css', '/icons/missing.png', '/startup-old.js']) {
      const result = await request(url)
      assert.equal(result.status, 404)
      assert.equal(result.headers['Cache-Control'], 'no-store')
      assert.ok(!result.body.includes('<main>'))
    }
    assert.equal((await request('/projects/example')).body, '<main>shell</main>')
    assert.equal((await request('/startup.js')).headers['Cache-Control'], 'no-cache')
    assert.equal((await request('/assets/index-abcdefgh.js')).headers['Content-Type'], 'text/javascript; charset=utf-8')
    assert.match((await request('/assets/index-abcdefgh.js')).headers['Cache-Control'], /immutable/)
    assert.equal((await request('/%2e%2e/outside.js')).status, 403)
    assert.equal((await request('/%zz')).status, 400)
  } finally {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(folder))
    assert.ok(relative.startsWith('synapse-startup-') && !relative.includes(path.sep) && !path.isAbsolute(relative))
    await rm(folder, { recursive: true, force: true })
  }
})

async function workerHarness() {
  const listeners = new Map<string, (event: any) => void>()
  const entries = new Map<string, Response>()
  const deleted: string[] = []; let fetches = 0
  let network = new Response('export default 1', { headers: { 'Content-Type': 'text/javascript' } })
  let offline = false; let cacheFull = false
  const key = (request: Request | string) => typeof request === 'string' ? request : request.url
  const cache = {
    match: async (request: Request | string) => entries.get(key(request))?.clone(),
    put: async (request: Request | string, response: Response) => { if (cacheFull) throw new Error('quota'); entries.set(key(request), response.clone()) },
    delete: async (request: Request | string) => entries.delete(key(request)),
    addAll: async () => undefined,
  }
  vm.runInNewContext(await readFile('public/sw.js', 'utf8'), {
    URL, Response,
    self: { location: { origin: 'https://synapse.test' }, addEventListener: (name: string, callback: (event: any) => void) => listeners.set(name, callback), skipWaiting: async () => undefined, clients: { claim: async () => undefined } },
    caches: { open: async () => cache, match: cache.match, keys: async () => ['dmente-synapse-shell-v5', 'dmente-synapse-shell-v6', 'unrelated-cache'], delete: async (name: string) => { deleted.push(name); return true } },
    fetch: async () => { fetches++; if (offline) throw new Error('offline'); return network.clone() },
  })
  return { listeners, entries, deleted, setNetwork: (response: Response) => { network = response }, setOffline: () => { offline = true }, setCacheFull: () => { cacheFull = true }, fetches: () => fetches,
    request: async (pathname: string, mode = 'cors') => {
      let response: Promise<Response> | undefined
      const request = { url: `https://synapse.test${pathname}`, method: 'GET', mode }
      listeners.get('fetch')!({ request, respondWith: (value: Promise<Response>) => { response = value } })
      return response
    },
  }
}

test('service worker discards HTML cached as JavaScript and retrieves the actual module', async () => {
  const worker = await workerHarness()
  worker.entries.set('https://synapse.test/assets/index-broken.js', new Response('<html>wrong shell</html>', { headers: { 'Content-Type': 'text/html' } }))
  assert.equal(await (await worker.request('/assets/index-broken.js'))!.text(), 'export default 1')
  assert.equal(worker.fetches(), 1)
  assert.equal(worker.entries.get('https://synapse.test/assets/index-broken.js')!.headers.get('Content-Type'), 'text/javascript')
})

test('service worker does not cache HTML module responses and never intercepts the API', async () => {
  const worker = await workerHarness()
  worker.setNetwork(new Response('<html>wrong</html>', { headers: { 'Content-Type': 'text/html' } }))
  await worker.request('/assets/missing.js')
  assert.equal(worker.entries.size, 0)
  assert.equal(await worker.request('/api/second-brain/status'), undefined)
  worker.entries.set('https://synapse.test/startup.js', new Response('stale'))
  worker.setNetwork(new Response('fresh startup', { headers: { 'Content-Type': 'text/javascript' } }))
  assert.equal(await (await worker.request('/startup.js'))!.text(), 'fresh startup')
})

test('service worker only removes its old shell caches and handles offline startup and full storage', async () => {
  const worker = await workerHarness()
  let activation: Promise<unknown> | undefined
  worker.listeners.get('activate')!({ waitUntil: (promise: Promise<unknown>) => { activation = promise } })
  await activation
  assert.deepEqual(worker.deleted, ['dmente-synapse-shell-v5'])
  worker.setCacheFull()
  assert.equal((await worker.request('/assets/valid.js'))!.status, 200)
  worker.setOffline()
  assert.equal((await worker.request('/', 'navigate'))!.status, 503)
})

test('recovery starts independently of React, reloads at most once, and leaves mounted UI alone', async () => {
  const callbacks = new Map<string, (...args: any[]) => void>()
  const storage = new Map<string, string>(); const deleted: string[] = []
  let mounted = false; let reloads = 0
  const root = { children: [{}], querySelector: () => mounted ? null : {}, replaceChildren: () => undefined }
  const element = () => ({ style: {}, setAttribute() {}, addEventListener() {}, append() {}, textContent: '' })
  const window = { addEventListener: (name: string, callback: (...args: any[]) => void) => callbacks.set(name, callback), setTimeout: (callback: () => void) => { callbacks.set('timeout', callback) }, location: { reload: () => { reloads++ } }, caches: {} }
  let scriptUrl = ''
  vm.runInNewContext(await readFile('public/startup.js', 'utf8'), {
    window, document: { getElementById: () => root, createElement: element }, HTMLScriptElement: class {},
    navigator: { serviceWorker: { addEventListener: (name: string, callback: (...args: any[]) => void) => callbacks.set(name, callback), register: async (url: string) => { scriptUrl = url; return { update: async () => undefined } }, getRegistration: async () => ({ update: async () => undefined }) } },
    caches: { keys: async () => ['dmente-synapse-shell-v5', 'other-app'], delete: async (name: string) => { deleted.push(name); return true } },
    sessionStorage: { getItem: (name: string) => storage.get(name), setItem: (name: string, value: string) => storage.set(name, value) },
  })
  assert.equal(scriptUrl, '/sw.js?v=4')
  callbacks.get('controllerchange')!()
  callbacks.get('controllerchange')!()
  assert.equal(reloads, 1)
  mounted = true
  callbacks.get('timeout')!()
  assert.equal(deleted.length, 0)
  mounted = false
  callbacks.get('timeout')!()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(deleted, ['dmente-synapse-shell-v5'])
  assert.equal(reloads, 1)
})
