/** Jours (AAAA-MM-JJ, heure locale) utiles à l'agenda de la semaine. */
export function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysTo(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return dayString(d)
}

/**
 * Semaine affichée : du lundi au dimanche de la semaine en cours. Le
 * dimanche, on montre déjà la semaine qui vient.
 */
export function displayedWeek(now = new Date()): { start: string; end: string; days: string[] } {
  const today = dayString(now)
  const weekday = (now.getDay() + 6) % 7 // lundi = 0
  const start = weekday === 6 ? addDaysTo(today, 1) : addDaysTo(today, -weekday)
  const days = Array.from({ length: 7 }, (_, index) => addDaysTo(start, index))
  return { start, end: days[6], days }
}
