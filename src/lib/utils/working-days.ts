/**
 * Shared helpers for estimating "where you should be by now" against a
 * revenue objective, based on which weekdays are actually worked.
 * Used by the dashboard Progression widget and the Objectifs page so both
 * report the same expected amount for a given day.
 */

/**
 * Resolve the set of worked weekdays (1=Mon ... 7=Sun). Falls back to an
 * approximation (the first `workingDaysPerWeek` weekdays) when the
 * practitioner hasn't picked specific days in settings yet.
 */
export function resolveWorkingWeekdays(
  workingWeekdays: number[] | null | undefined,
  workingDaysPerWeek: number
): Set<number> {
  if (workingWeekdays && workingWeekdays.length > 0) {
    return new Set(workingWeekdays)
  }
  return new Set(Array.from({ length: workingDaysPerWeek }, (_, i) => i + 1))
}

/**
 * Fraction (0–1) of working days elapsed in [start, endExclusive).
 */
export function workingDayRatio(
  start: Date,
  endExclusive: Date,
  todayStart: Date,
  workingWeekdays: Set<number>
): number {
  let total = 0
  let elapsed = 0
  const cursor = new Date(start)
  while (cursor < endExclusive) {
    const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay() // 1=Mon ... 7=Sun
    if (workingWeekdays.has(weekday)) {
      total++
      if (cursor < todayStart) elapsed++
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return total > 0 ? elapsed / total : 0
}
