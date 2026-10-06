// Loads every project's status file into Synapse.
//
//   npm run sync:states -- "C:\Users\diego\Documents\DIEGOSAN" [más carpetas] [--dry-run] [--domain agency] [--exclude TEXTO]...
//
// It walks the folders, takes the status file of each project folder (PROYECTO_ESTADO.md,
// ESTADO_PROYECTO.md, "Estado proyecto X.md"...; the newest one when a folder has several), reads it
// here and sends the result to Synapse over MCP. Needs SYNAPSE_MCP_TOKEN (a token with write scope);
// SYNAPSE_URL defaults to production. Running it again is safe: unchanged files change nothing.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { isProjectStateFile, parseProjectState } from '../server/project-state.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const domainIndex = args.indexOf('--domain')
const domain = domainIndex >= 0 ? args[domainIndex + 1] : 'agency'
const excludes = args.flatMap((arg, index) => (arg === '--exclude' && args[index + 1] ? [args[index + 1].toLowerCase()] : []))
const roots = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--domain' && args[index - 1] !== '--exclude')
const url = (process.env.SYNAPSE_URL ?? 'https://synapse.dmentedigital.co').replace(/\/$/, '')
const token = process.env.SYNAPSE_MCP_WRITE_TOKEN ?? process.env.SYNAPSE_MCP_TOKEN ?? ''
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.claude', '.cursor', '.agent', '.pnpm-store', 'tmp'])
const MAX_DEPTH = 4

function slug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^\d+[\s_.-]+/, '').replace(/^proyecto\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

/** One status file per folder: the most recently modified wins. */
function find(dir: string, depth: number, found: string[]): void {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  const candidates = entries.filter((entry) => entry.isFile() && isProjectStateFile(entry.name)).map((entry) => path.join(dir, entry.name))
  if (candidates.length) found.push(candidates.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0])
  if (depth >= MAX_DEPTH) return
  for (const entry of entries) if (entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith('.')) find(path.join(dir, entry.name), depth + 1, found)
}

// Folders that hold copies or documents of a project, not a project of their own: the project is the folder above.
const GENERIC = /^(claude outputs?|outputs?|docs?|documentos|documentacion|backup|respaldo|archivo|old|estado)$/i
function projectFolder(file: string): string {
  let dir = path.dirname(file)
  while (GENERIC.test(path.basename(dir)) && path.dirname(dir) !== dir) dir = path.dirname(dir)
  return path.basename(dir)
}

type Candidate = { file: string; folder: string; projectId: string; state: ReturnType<typeof parseProjectState> }
function read(file: string): Candidate {
  const state = parseProjectState(readFileSync(file, 'utf8'))
  const folder = projectFolder(file)
  return { file, folder, projectId: state.projectId ?? slug(folder), state }
}

async function send({ file, folder, projectId, state }: Candidate): Promise<string> {
  const label = `${projectId}  ←  ${file}`
  if (!projectId) return `OMITIDO (sin identificador)  ${file}`
  if (dryRun) return `SIMULADO  ${label}  [${state.generalStatus ?? 'sin estado general'}]`
  const response = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'synapse_import_project_state', arguments: { projectId, name: state.title ?? folder, domain, sourcePath: file, state } } }) })
  const body = await response.json().catch(() => ({})) as { result?: { structuredContent?: { created: boolean; changed: boolean } }; error?: { message?: string } }
  if (!response.ok || body.error || !body.result?.structuredContent) return `ERROR  ${label}  ${body.error?.message ?? `HTTP ${response.status}`}`
  const { created, changed } = body.result.structuredContent
  return `${created ? 'CREADO' : changed ? 'ACTUALIZADO' : 'SIN CAMBIOS'}  ${label}`
}

if (!roots.length) { console.error('Indica al menos una carpeta donde buscar los archivos de estado.'); process.exit(1) }
if (!dryRun && !token) { console.error('Falta SYNAPSE_MCP_TOKEN (o SYNAPSE_MCP_WRITE_TOKEN) en el entorno. Usa --dry-run para solo ver qué se enviaría.'); process.exit(1) }
const files: string[] = []
for (const root of roots) find(path.resolve(root), 0, files)
// Several status files can describe the same project (copies, dated versions): the newest one speaks for it.
const byProject = new Map<string, Candidate>()
for (const file of files.filter((item) => !excludes.some((text) => item.toLowerCase().includes(text)))) {
  const candidate = read(file)
  const current = byProject.get(candidate.projectId)
  if (!current || statSync(candidate.file).mtimeMs > statSync(current.file).mtimeMs) byProject.set(candidate.projectId, candidate)
}
console.log(`${byProject.size} proyectos con archivo de estado (${files.length} archivos encontrados)${dryRun ? ' — simulación, no se envía nada' : ` → ${url}`}`)
let failed = 0
for (const candidate of byProject.values()) {
  const line = await send(candidate)
  if (line.startsWith('ERROR')) failed += 1
  console.log(line)
}
process.exit(failed ? 1 : 0)
