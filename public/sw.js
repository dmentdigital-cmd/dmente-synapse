const CACHE_NAME = 'dmente-synapse-shell-v6'
const SHELL = ['/', '/manifest.webmanifest', '/assets/dmente-synapse-icon.png', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('dmente-synapse-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

function validAsset(request, response) {
  if (!response?.ok) return false
  const pathname = new URL(request.url).pathname
  const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase()
  if (pathname.endsWith('.js')) return ['text/javascript', 'application/javascript'].includes(type)
  if (pathname.endsWith('.css')) return type === 'text/css'
  // Only a navigation may populate the HTML shell.
  return type !== 'text/html'
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/mcp') return
  if (url.pathname === '/startup.js' || url.pathname === '/sw.js') {
    event.respondWith(fetch(request, { cache: 'no-store' }))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
        const copy = response.clone()
        try { await (await caches.open(CACHE_NAME)).put('/', copy) } catch { /* Storage limits must not block the network response. */ }
      }
      return response
    }).catch(async () => (await caches.match('/')) || new Response('Synapse necesita conexión para iniciar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
    return
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (validAsset(request, cached)) return cached
    if (cached) await cache.delete(request)
    const response = await fetch(request)
    if (validAsset(request, response)) {
      try { await cache.put(request, response.clone()) } catch { /* A full cache must not break loading. */ }
    }
    return response
  })())
})
