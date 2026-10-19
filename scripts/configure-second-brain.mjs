// Configures local development only. Originals are inspected, never modified.
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const values = process.argv.slice(2)
const get = (name) => { const index = values.indexOf(name); return index < 0 ? undefined : values[index + 1] }
const vaultPath = get('--vault')
const ebooksPath = get('--ebooks')
if (!vaultPath || !path.isAbsolute(vaultPath) || (ebooksPath && !path.isAbsolute(ebooksPath))) throw new Error('Use --vault <absolute path> and optionally --ebooks <absolute path>.')
const roots = { vaultPath: await realpath(vaultPath), ...(ebooksPath ? { ebooksPath: await realpath(ebooksPath) } : {}) }
for (const root of Object.values(roots)) if (!(await stat(root)).isDirectory()) throw new Error('Each source must be a directory.')
const folder = process.env.SYNAPSE_DATA_DIR ?? path.resolve('data')
await mkdir(folder, { recursive: true })
await writeFile(path.join(folder, 'second-brain-settings.json'), `${JSON.stringify({ ...roots, vaultName: get('--name') || path.basename(roots.vaultPath) }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
console.log('Local read-only sources configured. No source file was written. Production requires environment variables.')
