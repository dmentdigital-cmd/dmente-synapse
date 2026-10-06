// Reads a project's status file (PROYECTO_ESTADO.md, ESTADO_PROYECTO.md, "Estado proyecto X.md"...).
// The files are written by people and agents and do not share one template, so this looks for the
// ideas they have in common instead of exact headings. Pure: no database, no file access.

export type ProjectStateSections = { completed: string[]; inProgress: string[]; pending: string[]; nextSteps: string[] }
export type ParsedProjectState = {
  title: string | null
  projectId: string | null
  updatedLabel: string | null
  generalStatus: string | null
  progress: number | null
  nextAction: string | null
  mainBlocker: string | null
  sourceDriveFolder: string | null
  sourceDriveFile: string | null
  obsidianNote: string | null
  sections: ProjectStateSections
}

const MAX_ITEMS = 30
const MAX_ITEM_LENGTH = 300
const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Some files were saved as UTF-8 read as Latin-1 ("CreaciÃ³n"). Undo it when that yields clean text. */
export function repairEncoding(text: string): string {
  if (!/Ã[\u0080-¿]|â€|ðŸ/.test(text)) return text
  const repaired = Buffer.from(text, 'latin1').toString('utf8')
  return repaired.includes('�') ? text : repaired
}

const cleanInline = (value: string) => value.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
const empty = (value: string) => /^(ninguno|ninguna|n\/a|na|no|no aplica|sin definir|sin bloqueos?|-|—)?\.?$/i.test(value.trim())

function bucketFor(heading: string): keyof ProjectStateSections | null {
  if (/completad|terminad|hecho|finalizad/.test(heading)) return 'completed'
  if (/en progreso|en curso|en desarrollo|trabajando/.test(heading)) return 'inProgress'
  if (/proximos? pasos?|siguientes? pasos?|proximas? acciones?|continuacion/.test(heading)) return 'nextSteps'
  if (/pendiente|por hacer|backlog/.test(heading)) return 'pending'
  return null
}

export function parseProjectState(markdown: string): ParsedProjectState {
  const state: ParsedProjectState = { title: null, projectId: null, updatedLabel: null, generalStatus: null, progress: null, nextAction: null, mainBlocker: null, sourceDriveFolder: null, sourceDriveFile: null, obsidianNote: null, sections: { completed: [], inProgress: [], pending: [], nextSteps: [] } }
  let bucket: keyof ProjectStateSections | null = null
  let bucketLevel = 0
  let statusFollows = false // set by a heading like "Estado general": its first line of text is the status
  for (const raw of repairEncoding(markdown).split(/\r?\n/)) {
    const line = raw.trimEnd()
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const text = cleanInline(heading[2]).replace(/^[^\p{L}\p{N}]+/u, '')
      if (level === 1 && !state.title) state.title = text.replace(/^estado\s+(del\s+)?proyecto\s*[:\-–—]?\s*/i, '').trim() || text
      statusFollows = /^(\d+[.)]\s*)?estado (general|actual)/.test(plain(text))
      const next = bucketFor(plain(text))
      // "Inmediato" or "Corto plazo" under "Próximos pasos" still belong to it; a sibling heading ends it.
      if (next) { bucket = next; bucketLevel = level } else if (level <= bucketLevel) { bucket = null; bucketLevel = 0 }
      continue
    }
    if (statusFollows && line.trim() && !/^[-|>*_=\s]+$/.test(line) && !line.trimStart().startsWith('|')) {
      statusFollows = false
      state.generalStatus ??= cleanInline(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')).slice(0, 600) || null
    }
    // "**Clave:** valor", "clave: valor" and two-column table rows ("| Status | EN DESARROLLO |").
    const pair = line.match(/^\s*(?:[-*]\s+)?\*\*([^*:]{2,40}):\*\*\s*(.+)$/) ?? line.match(/^([A-Za-zÁÉÍÓÚáéíóúñ]{4,24}):\s*(.+)$/) ?? line.match(/^\|\s*([^|]{2,40}?)\s*\|\s*([^|]+?)\s*\|\s*$/)
    if (pair) {
      const key = plain(pair[1]).replace(/[^a-z]/g, '')
      const value = cleanInline(pair[2])
      if (key === 'estadogeneral' || key === 'estado' || key === 'status' || key === 'estadoactual' || key === 'fase') state.generalStatus ??= value.slice(0, 600)
      else if (key === 'progreso' || key === 'avance' || key === 'progresogeneral') {
        const percent = value.match(/(\d{1,3})\s*%/)
        if (percent) { if (state.progress === null) state.progress = Math.min(100, Number(percent[1])) } else if (key === 'progresogeneral') state.generalStatus ??= value.slice(0, 600)
      }
      else if (key === 'ultimaactualizacion' || key === 'actualizado') state.updatedLabel = value.slice(0, 80) // the last one in the file is the freshest
      else if (key === 'projectid') state.projectId ??= value.slice(0, 120)
      else if (key === 'proximaaccion' || key === 'siguienteaccion') { if (!empty(value)) state.nextAction ??= value.slice(0, 2000) }
      else if (key === 'bloqueoprincipal' || key === 'bloqueo') { if (!empty(value)) state.mainBlocker ??= value.slice(0, 2000) }
      else if (key === 'sourcedrivefolder') state.sourceDriveFolder ??= value.slice(0, 1000)
      else if (key === 'sourcedrivefile') state.sourceDriveFile ??= value.slice(0, 1000)
      else if (key === 'obsidiannote') { if (!empty(value)) state.obsidianNote ??= value.slice(0, 500) }
      if (key !== 'estado' || !bucket) continue
    }
    if (!bucket) continue
    // Only top-level bullets: nested ones are detail of the item above.
    const item = line.match(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+)$/)
    if (item && state.sections[bucket].length < MAX_ITEMS) {
      const text = cleanInline(item[1])
      if (text) state.sections[bucket].push(text.length > MAX_ITEM_LENGTH ? `${text.slice(0, MAX_ITEM_LENGTH - 1)}…` : text)
    }
  }
  return state
}

/** File names that mean "this project's status", whatever the exact wording or separators. */
export function isProjectStateFile(name: string): boolean {
  const base = plain(name)
  return /\.md$/.test(base) && /(^|[\s_.-])estado([\s_.-]|$)/.test(base) && (/proyecto/.test(base) || /^estado[\s_.-]/.test(base) || base === 'estado.md')
}
