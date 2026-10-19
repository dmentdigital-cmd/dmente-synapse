import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { ServerResponse } from 'node:http'

function contentType(filePath: string): string {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' } as Record<string, string>)[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export async function serveStatic(distDir: string, pathname: string, res: ServerResponse): Promise<void> {
  const fail = (status: number, message: string) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(message)
  }
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { fail(400, 'Bad request'); return }
  const requested = path.resolve(distDir, `.${decoded === '/' ? '/index.html' : decoded}`)
  if (requested !== distDir && !requested.startsWith(`${distDir}${path.sep}`)) { fail(403, 'Forbidden'); return }
  let filePath = requested
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('not a file')
  } catch {
    // SPA routes may use the shell. Missing scripts/styles must stay real 404s.
    if (path.extname(decoded) || decoded.startsWith('/assets/') || decoded.startsWith('/icons/')) { fail(404, 'Not found'); return }
    filePath = path.join(distDir, 'index.html')
  }
  try {
    const file = await readFile(filePath)
    const isEntryPoint = ['index.html', 'sw.js', 'startup.js'].includes(path.basename(filePath))
    const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`) && /-[\w-]{8,}\.(js|css)$/.test(filePath)
    res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': isEntryPoint ? 'no-cache' : isHashedAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=3600' })
    res.end(file)
  } catch { fail(404, 'Not found') }
}
