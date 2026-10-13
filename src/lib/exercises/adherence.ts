import {
  decodeFullReport, decodeShortCode, shortRef, summarizeWeeks,
  type FullReport, type WeekSummary,
} from './patient-link-codec'

export type ParsedReport =
  | { kind: 'full'; ref: string; report: FullReport; weeks: WeekSummary[] }
  | { kind: 'short'; ref: string; weeks: WeekSummary[] }

/** Lit un bilan scanné, collé ou tapé : bilan complet d'abord, puis code court. */
export function parseReportInput(input: string): ParsedReport | null {
  const full = decodeFullReport(input)
  if (full) return { kind: 'full', ref: full.id, report: full, weeks: summarizeWeeks(full) }
  const short = decodeShortCode(input)
  if (short) return { kind: 'short', ref: short.ref4, weeks: short.weeks }
  return null
}

/** Le bilan vient-il bien du programme de cette prescription ? */
export function matchesPrescription(parsed: ParsedReport, prescriptionId: string): boolean {
  return shortRef(prescriptionId).startsWith(parsed.ref.toLowerCase())
}

/** Phrase de synthèse affichée dans le dossier. */
export function reportHeadline(weeks: WeekSummary[], target?: number): string {
  if (weeks.length === 0) return 'Aucune donnée'
  const done = weeks.reduce((a, w) => a + w.done, 0)
  const parts = [`${done} séance${done > 1 ? 's' : ''} en ${weeks.length} semaine${weeks.length > 1 ? 's' : ''}${target ? ` (objectif ${target} par semaine)` : ''}`]
  const mornings = weeks.map(w => w.morning).filter((v): v is number => v != null)
  if (mornings.length) {
    const f = (v: number) => String(v).replace('.', ',')
    parts.push(mornings.length > 1 ? `douleur au réveil ${f(mornings[0])} puis ${f(mornings[mornings.length - 1])} sur 10` : `douleur au réveil ${f(mornings[0])} sur 10`)
  }
  const max = Math.max(-1, ...weeks.map(w => w.maxPain ?? -1))
  if (max >= 0) parts.push(`douleur maximale en séance ${max} sur 10`)
  return parts.join(', ')
}
