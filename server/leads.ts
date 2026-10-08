import type { LeadInput } from './types.js'

const allowedFields = new Set(['name', 'email', 'whatsapp', 'company', 'service', 'message', 'language', 'origin'])
const allowedOriginFields = new Set(['utm_source', 'utm_campaign', 'page'])

function invalid(field: string, detail: string): never {
  throw Object.assign(new Error(detail), { statusCode: 400, field })
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') invalid(field, 'Debe ser texto.')
  const normalized = value.trim()
  if (normalized.length > maxLength) invalid(field, `Máximo ${maxLength} caracteres.`)
  return normalized || null
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const result = optionalText(value, field, maxLength)
  if (!result) invalid(field, 'Es obligatorio.')
  return result
}

export function parseLead(input: Record<string, unknown>): LeadInput {
  for (const field of Object.keys(input)) if (!allowedFields.has(field)) invalid(field, 'Campo desconocido.')
  const name = requiredText(input.name, 'name', 120)
  const rawPhone = requiredText(input.whatsapp, 'whatsapp', 32)
  // Require an explicit country code; guessing one from a local number can merge different contacts.
  if (!/^\+[\d\s().-]+$/.test(rawPhone)) invalid('whatsapp', 'Usa formato internacional con prefijo + y código de país.')
  const phone = `+${rawPhone.slice(1).replace(/\D/g, '')}`
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) invalid('whatsapp', 'Número internacional inválido.')

  const email = optionalText(input.email, 'email', 254)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('email', 'Correo inválido.')
  const language = optionalText(input.language, 'language', 2)
  if (language && language !== 'es' && language !== 'en') invalid('language', 'Debe ser es o en.')

  const origin = input.origin === undefined || input.origin === null ? {} : input.origin
  if (typeof origin !== 'object' || Array.isArray(origin)) invalid('origin', 'Debe ser un objeto.')
  const source = origin as Record<string, unknown>
  for (const field of Object.keys(source)) if (!allowedOriginFields.has(field)) invalid(`origin.${field}`, 'Campo desconocido.')
  let page = optionalText(source.page, 'origin.page', 2048)
  if (page) {
    try {
      const parsed = new URL(page)
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) invalid('origin.page', 'Debe ser una URL HTTP o HTTPS.')
      // Query parameters and fragments can carry identifiers or tokens that are not needed for attribution.
      page = `${parsed.origin}${parsed.pathname}`
    } catch { invalid('origin.page', 'Debe ser una URL HTTP o HTTPS.') }
  }

  return {
    name, email, phone,
    company: optionalText(input.company, 'company', 160),
    service: optionalText(input.service, 'service', 160),
    message: optionalText(input.message, 'message', 5000),
    language: language as 'es' | 'en' | null,
    utmSource: optionalText(source.utm_source, 'origin.utm_source', 160),
    utmCampaign: optionalText(source.utm_campaign, 'origin.utm_campaign', 160),
    page,
  }
}
