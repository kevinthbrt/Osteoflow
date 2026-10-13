import { encodeProgram, sessionsPerWeek, shortRef, type LinkProgram } from './patient-link-codec'
import type { ExercisePrescriptionItem } from '@/types/exercise'

/** Appli patient, hébergée par osteoupgrade. Le programme suit le « # ». */
export const PATIENT_APP_URL = process.env.PATIENT_APP_URL || 'https://www.osteo-upgrade.fr/programme'

/** Au-delà, le QR code devient trop dense pour être lu sur une feuille imprimée. */
export const MAX_QR_URL_LENGTH = 1800

const SUPABASE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

interface LibraryText { id: string; description: string | null; progression_regression: string | null }

/** Textes de la bibliothèque publique, pour ne pas les recopier dans le lien. */
async function fetchLibraryTexts(): Promise<Map<string, LibraryText> | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rehab_exercises?select=id,description,progression_regression&is_active=eq.true`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(5000) },
    )
    const rows = await res.json()
    if (!Array.isArray(rows)) return null
    return new Map((rows as LibraryText[]).map(r => [r.id, r]))
  } catch {
    return null
  }
}

interface PrescriptionForLink {
  id: string
  created_at: string
  weekly_routine?: string | null
  patient_intro?: string | null
  vigilance_points?: string | null
}

/**
 * Lien vers l'appli patient. Il ne contient ni le nom du patient ni le titre
 * du programme (qui peut nommer la pathologie) : seulement les exercices, leur
 * dosage et les conseils du praticien.
 */
export async function buildPatientLink(
  prescription: PrescriptionForLink,
  items: ExercisePrescriptionItem[],
  practitionerLabel: string,
): Promise<string> {
  const library = await fetchLibraryTexts()
  const differs = (value: string | null | undefined, reference: string | null | undefined) =>
    library == null || (value ?? '').trim() !== (reference ?? '').trim()

  const start = new Date(prescription.created_at)
  const program: LinkProgram = {
    v: 1,
    id: shortRef(prescription.id),
    pr: practitionerLabel,
    d: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    n: sessionsPerWeek(prescription.weekly_routine, items.map(i => i.frequency)),
    i: prescription.patient_intro || undefined,
    w: prescription.weekly_routine || undefined,
    g: prescription.vigilance_points || undefined,
    x: items.map(it => {
      const lib = library?.get(it.exercise_id)
      return {
        e: it.exercise_id,
        n: it.exercise_name,
        t: it.exercise_type,
        s: it.sets ?? undefined,
        r: it.reps || undefined,
        h: it.hold_time ?? undefined,
        p: it.rest_time ?? undefined,
        f: it.frequency || undefined,
        o: it.notes || undefined,
        d: differs(it.exercise_description, lib?.description) ? it.exercise_description : undefined,
        a: it.progression_regression && differs(it.progression_regression, lib?.progression_regression) ? it.progression_regression : undefined,
      }
    }),
  }
  return `${PATIENT_APP_URL}#${encodeProgram(JSON.parse(JSON.stringify(program)))}`
}
