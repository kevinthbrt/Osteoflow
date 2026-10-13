import type { ProgramView } from './programs'
import type { WeekSummary } from './patient-link-codec'
import { sessionsPerWeek } from './patient-link-codec'

/** Une ligne par semaine, en prenant le bilan le plus récent qui la couvre. */
export function mergeReportWeeks(program: Pick<ProgramView, 'reports'>): WeekSummary[] {
  const byWeek = new Map<number, WeekSummary>()
  for (const r of [...program.reports].reverse()) for (const w of r.weeks) byWeek.set(w.week, w)
  return [...byWeek.values()].sort((a, b) => a.week - b.week)
}

/**
 * Ce que l'IA reçoit d'un programme : étapes, exercices, dosage, suivi par
 * semaine et dernières modifications. Ni nom, ni coordonnées du patient.
 */
export function programAiPayload(program: ProgramView) {
  const current = program.phases[program.current_phase]
  const week = Math.max(1, Math.floor((Date.now() - Date.parse(`${program.start_date}T12:00:00`)) / (7 * 864e5)) + 1)
  return {
    title: program.title,
    start_date: program.start_date,
    current_week: week,
    current_phase: program.current_phase,
    target_per_week: current ? sessionsPerWeek(current.weekly_routine, (current.items ?? []).map(i => i.frequency)) : undefined,
    phases: program.phases.map(ph => ({
      title: ph.title,
      starts_after_days: ph.starts_after_days ?? 0,
      weekly_routine: ph.weekly_routine,
      items: (ph.items ?? []).map(it => ({
        exercise_id: it.exercise_id, name: it.exercise_name, sets: it.sets, reps: it.reps,
        hold_time: it.hold_time, rest_time: it.rest_time, frequency: it.frequency, notes: it.notes,
      })),
    })),
    weeks: mergeReportWeeks(program).slice(-8),
    changes: program.changes.slice(0, 8).map(c => c.note),
  }
}

/** Version texte, jointe à la génération d'une nouvelle étape. */
export function programContextText(program: ProgramView, newPhaseStartsAfterDays: number): string {
  const p = programAiPayload(program)
  const lines = [`Programme : ${p.title}, commencé le ${p.start_date}. La nouvelle étape commencera la semaine ${Math.floor(newPhaseStartsAfterDays / 7) + 1}.`]
  p.phases.forEach((ph, k) => {
    lines.push(`Étape ${k + 1} : ${ph.title}, dès la semaine ${Math.floor(ph.starts_after_days / 7) + 1}${ph.weekly_routine ? ` (${ph.weekly_routine})` : ''}`)
    for (const it of ph.items) {
      const dose = [it.sets != null && it.reps ? `${it.sets} × ${it.reps}` : it.reps, it.hold_time ? `maintien ${it.hold_time} s` : null, it.frequency].filter(Boolean).join(', ')
      lines.push(`- ${it.name}${dose ? ` : ${dose}` : ''}`)
    }
  })
  if (p.weeks.length) {
    lines.push('Suivi rapporté par le patient :')
    for (const w of p.weeks) lines.push(`- Semaine ${w.week + 1} : ${w.done} séance(s)${p.target_per_week ? ` sur ${p.target_per_week} visées` : ''}, douleur au réveil ${w.morning ?? 'non notée'}/10, douleur maximale en séance ${w.maxPain ?? 'non notée'}/10`)
  } else {
    lines.push('Aucun bilan importé : l’observance n’est pas connue.')
  }
  if (p.changes.length) lines.push(`Dernières modifications : ${p.changes.slice(0, 5).join(' ; ')}`)
  return lines.join('\n')
}
