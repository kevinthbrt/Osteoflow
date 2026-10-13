import type { FullReport, WeekSummary } from './patient-link-codec'

/**
 * Indicateur d'utilisation de l'appli patient. Sans serveur, Osteoflow ne
 * voit l'activité du patient qu'à travers les bilans importés : l'indicateur
 * le dit, et date toujours ce qu'il affiche.
 */
export type UsageLevel = 'ended' | 'not_sent' | 'waiting' | 'active' | 'low' | 'inactive'

export interface Usage {
  level: UsageLevel
  label: string
  detail: string | null
}

export interface UsageProgram {
  status: 'active' | 'ended'
  start_date: string
  link_sent_at: string | null
}

export interface UsageReport {
  /** date d'import dans Osteoflow */
  created_at: string
  weeks: WeekSummary[]
  report?: FullReport
}

const DAY = 864e5
const frDay = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + 'T12:00:00') - Date.parse(a.slice(0, 10) + 'T12:00:00')) / DAY)
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00`) + n * DAY).toISOString().slice(0, 10)

export function computeUsage(program: UsageProgram, latest: UsageReport | null, today: string, target = 3): Usage {
  if (program.status === 'ended') return { level: 'ended', label: 'Programme arrêté', detail: null }
  if (!latest) {
    if (!program.link_sent_at) return { level: 'not_sent', label: 'Lien pas encore envoyé', detail: 'Envoyez le programme par email, SMS ou PDF pour que le patient l’ouvre sur son téléphone.' }
    return { level: 'waiting', label: 'En attente d’un bilan', detail: `Lien envoyé le ${frDay(program.link_sent_at)}. L’utilisation n’est visible qu’une fois un bilan importé.` }
  }

  const age = daysBetween(latest.created_at, today)
  const freshness = age > 21 ? ` Dernier bilan il y a ${age} jours.` : ''

  // Dernier jour d'activité : connu au jour près avec un bilan complet.
  let lastActive: string | null = null
  let reportDay = latest.created_at.slice(0, 10)
  if (latest.report) {
    reportDay = latest.report.at
    const active = latest.report.days.filter(d => d.x || d.m != null)
    if (active.length) lastActive = addDays(latest.report.s, Math.max(...active.map(d => d.o)))
  }

  const weeks = latest.weeks.slice(-2)
  const done = weeks.reduce((a, w) => a + w.done, 0)
  if (done === 0 && (!latest.report || !lastActive)) {
    return { level: 'inactive', label: 'N’utilise pas l’appli', detail: `Aucune séance dans le bilan du ${frDay(reportDay)}.${freshness}` }
  }
  if (lastActive && daysBetween(lastActive, reportDay) > 7) {
    return { level: 'inactive', label: 'A décroché', detail: `Dernière activité le ${frDay(lastActive)}, bilan du ${frDay(reportDay)}.${freshness}` }
  }
  const perWeek = weeks.length ? done / weeks.length : 0
  const rate = `${String(Math.round(perWeek * 10) / 10).replace('.', ',')} séance${perWeek >= 2 ? 's' : ''} par semaine sur ${target} visées`
  if (perWeek >= target * 0.6) return { level: 'active', label: 'Utilise l’appli', detail: `${rate}, bilan du ${frDay(reportDay)}.${freshness}` }
  return { level: 'low', label: 'Utilise peu l’appli', detail: `${rate}, bilan du ${frDay(reportDay)}.${freshness}` }
}
