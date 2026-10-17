import nodemailer from 'nodemailer'
import { database } from './db.js'
import { projectsDigest, type ProjectActor } from './projects.js'
import type { Domain } from './types.js'

const db = database()
db.exec(`CREATE TABLE IF NOT EXISTS daily_project_reports (
  report_date TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  body TEXT NOT NULL,
  exception_count INTEGER NOT NULL,
  email_sent_at TEXT,
  email_attempted_at TEXT,
  email_error TEXT
)`)

const zone = 'America/Bogota'
const defaultDomains: Domain[] = ['agency', 'projects', 'technology', 'sales', 'marketing', 'product']
const allowedDomains = new Set((process.env.SYNAPSE_DAILY_REPORT_DOMAINS?.split(',').map((value) => value.trim()).filter(Boolean) ?? defaultDomains) as Domain[])
const actor: ProjectActor = { source: 'daily-project-report', allowDomain: (domain) => allowedDomains.has(domain) }
const recipient = process.env.SYNAPSE_DAILY_REPORT_TO?.trim() || 'diego@dmentedigital.co'

function bogotaNow(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')), minute: Number(part('minute')) }
}

type StoredReport = { report_date: string; generated_at: string; body: string; exception_count: number; email_sent_at: string | null; email_attempted_at: string | null; email_error: string | null }
const latest = () => db.prepare('SELECT * FROM daily_project_reports ORDER BY report_date DESC LIMIT 1').get() as StoredReport | undefined

export function latestDailyProjectReport() {
  const report = latest()
  return report ? { date: report.report_date, generatedAt: report.generated_at, body: report.body, exceptionCount: report.exception_count, emailSentAt: report.email_sent_at, emailError: report.email_error } : null
}

export function generateDailyProjectReport(now = new Date()) {
  const local = bogotaNow(now)
  const existing = db.prepare('SELECT * FROM daily_project_reports WHERE report_date = ?').get(local.date) as StoredReport | undefined
  if (existing) return latestDailyProjectReport()
  const digest = projectsDigest(actor, now.getTime())
  const lines = [`Informe de excepciones de Synapse`, `Fecha: ${local.date} (${zone})`, `Excepciones: ${digest.exceptions.length}`, '']
  if (!digest.exceptions.length) lines.push('No se registran proyectos o tareas bloqueados ni próximas acciones pendientes en los proyectos activos visibles.')
  for (const item of digest.exceptions) {
    const label = { blocked_project: 'Proyecto bloqueado', blocked_task: 'Tarea bloqueada', missing_project_action: 'Proyecto sin próxima acción', missing_task_action: 'Tarea sin próxima acción' }[item.type]
    lines.push(`- ${label}: ${item.projectName} | ${item.title}${item.owner ? ` | Responsable: ${item.owner}` : ''}`)
  }
  const body = lines.join('\n')
  db.prepare('INSERT INTO daily_project_reports (report_date, generated_at, body, exception_count) VALUES (?, ?, ?, ?)')
    .run(local.date, now.toISOString(), body, digest.exceptions.length)
  return latestDailyProjectReport()
}

let busy = false
export async function tickDailyProjectReport(now = new Date()) {
  if (busy) return
  const local = bogotaNow(now)
  if (local.hour < 9 || local.hour === 9 && local.minute < 15) return
  busy = true
  try {
    generateDailyProjectReport(now)
    const stored = latest()
    if (!stored || stored.report_date !== local.date || stored.email_sent_at) return
    const host = process.env.SYNAPSE_SMTP_HOST?.trim()
    const port = Number(process.env.SYNAPSE_SMTP_PORT ?? 587)
    const user = process.env.SYNAPSE_SMTP_USER?.trim()
    const password = process.env.SYNAPSE_SMTP_PASSWORD
    const from = process.env.SYNAPSE_SMTP_FROM?.trim()
    if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65535) return
    if (stored.email_attempted_at && now.getTime() - Date.parse(stored.email_attempted_at) < 3_600_000) return
    db.prepare('UPDATE daily_project_reports SET email_attempted_at = ?, email_error = NULL WHERE report_date = ?').run(now.toISOString(), local.date)
    try {
      const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465, auth: { user, pass: password } })
      await transport.sendMail({ from, to: recipient, subject: `Synapse | Excepciones ${local.date}`, text: stored.body })
      db.prepare('UPDATE daily_project_reports SET email_sent_at = ?, email_error = NULL WHERE report_date = ?').run(new Date().toISOString(), local.date)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error SMTP desconocido'
      db.prepare('UPDATE daily_project_reports SET email_error = ? WHERE report_date = ?').run(message.slice(0, 500), local.date)
      console.error('[Synapse] No se pudo enviar el informe diario por SMTP')
    }
  } finally { busy = false }
}

export function startDailyProjectReportScheduler() {
  let activeTick: Promise<void> | null = null
  const run = () => {
    if (activeTick) return
    activeTick = tickDailyProjectReport()
      .catch(() => console.error('[Synapse] Falló la generación del informe diario'))
      .finally(() => { activeTick = null })
  }
  run()
  const timer = setInterval(run, 60_000)
  timer.unref()
  return async () => {
    clearInterval(timer)
    await activeTick
  }
}
