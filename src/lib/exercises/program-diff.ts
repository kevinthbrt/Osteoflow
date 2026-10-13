import type { ExercisePrescriptionItem, ExercisePrescriptionItemDraft } from '@/types/exercise'

/** Résumé lisible des différences entre deux listes d'exercices. */
export function describeItemChanges(
  before: Array<Pick<ExercisePrescriptionItem, 'exercise_id' | 'exercise_name' | 'sets' | 'reps' | 'hold_time' | 'rest_time' | 'frequency'>>,
  after: Array<Pick<ExercisePrescriptionItemDraft, 'sets' | 'reps' | 'hold_time' | 'rest_time' | 'frequency'> & { exercise: { id: string; name: string } }>,
): string | null {
  const byId = new Map(before.map(i => [i.exercise_id, i]))
  const afterIds = new Set(after.map(d => d.exercise.id))
  const added = after.filter(d => !byId.has(d.exercise.id)).map(d => d.exercise.name)
  const removed = before.filter(i => !afterIds.has(i.exercise_id)).map(i => i.exercise_name)
  const dosed = after.filter(d => {
    const old = byId.get(d.exercise.id)
    if (!old) return false
    return (old.sets ?? null) !== (d.sets ?? null) || (old.reps || '') !== (d.reps || '') ||
      (old.hold_time ?? null) !== (d.hold_time ?? null) || (old.rest_time ?? null) !== (d.rest_time ?? null) ||
      (old.frequency || '') !== (d.frequency || '')
  }).map(d => d.exercise.name)
  const parts: string[] = []
  if (added.length) parts.push(`ajouté : ${added.join(', ')}`)
  if (removed.length) parts.push(`retiré : ${removed.join(', ')}`)
  if (dosed.length) parts.push(`dosage modifié : ${dosed.join(', ')}`)
  return parts.length ? parts.join(' ; ') : null
}

