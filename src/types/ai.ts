export interface PatientFieldsDetected {
  profession?: string
  sport_activity?: string
  primary_physician?: string
  pregnancy_due_date?: string
  // Antécédents : chaque champ peut contenir plusieurs entrées distinctes.
  // On les représente en tableau pour créer une ligne par antécédent dans
  // medical_history_entries (chaque élément = une entrée du dossier).
  surgical_history?: string[]
  trauma_history?: string[]
  medical_history?: string[]
  family_history?: string[]
}

/** Clés d'antécédents (valeurs en tableau, une entrée par élément). */
export const HISTORY_FIELD_KEYS = [
  'surgical_history',
  'trauma_history',
  'medical_history',
  'family_history',
] as const
