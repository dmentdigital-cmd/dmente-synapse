import { SecondBrain } from '../server/second-brain.js'

// Read-only diagnostic: no server, listener, database import or file writes.
const brain = new SecondBrain()
const status = await brain.status()
if (!status.available) throw new Error(status.message || 'El vault no está disponible.')
const catalog = await brain.list({ limit: 1, refresh: true })
const indexes = await brain.list({ kind: 'index', limit: 1 })
const note = indexes.items[0] ? await brain.note(indexes.items[0].path) : null
const firstLink = note?.links[0]
const resolved = firstLink && note ? await brain.resolve(firstLink.target, note.entry.path) : null
console.log(JSON.stringify({ status, counts: catalog.counts, total: catalog.total, warnings: catalog.warnings,
  sampleIndexRead: Boolean(note), sampleIndexLinkCount: note?.links.length ?? 0,
  sampleFirstLinkMatches: resolved?.matches.length ?? null }, null, 2))
