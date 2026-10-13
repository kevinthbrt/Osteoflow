import { encodeProgram, sessionsPerWeek, shortRef, type LinkExercise, type LinkProgram } from './patient-link-codec'
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

interface PhaseForLink {
  title: string
  starts_after_days?: number | null
  weekly_routine?: string | null
  patient_intro?: string | null
  vigilance_points?: string | null
  items?: ExercisePrescriptionItem[]
}

interface ProgramForLink {
  id: string
  start_date: string
  content_updated_at: string
  phases: PhaseForLink[]
}

/**
 * Lien vers l'appli patient. Il ne contient ni le nom du patient ni le titre
 * du programme (qui peut nommer la pathologie) : seulement les étapes, les
 * exercices, leur dosage et les conseils du praticien.
 */
export async function buildPatientLink(program: ProgramForLink, practitionerLabel: string): Promise<string> {
  const library = await fetchLibraryTexts()
  const differs = (value: string | null | undefined, reference: string | null | undefined) =>
    library == null || (value ?? '').trim() !== (reference ?? '').trim()

  const toExercise = (it: ExercisePrescriptionItem): LinkExercise => {
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
  }

  const phases = [...program.phases].sort((a, b) => (a.starts_after_days ?? 0) - (b.starts_after_days ?? 0))
  const target = (ph: PhaseForLink) => sessionsPerWeek(ph.weekly_routine, (ph.items ?? []).map(i => i.frequency))
  const vigilance = [...phases].reverse().find(ph => ph.vigilance_points)?.vigilance_points
  const base = {
    v: 1 as const,
    id: shortRef(program.id),
    pr: practitionerLabel,
    d: program.start_date,
    u: program.content_updated_at,
    g: vigilance || undefined,
  }
  const link: LinkProgram = phases.length === 1 && !(phases[0].starts_after_days ?? 0)
    ? {
        ...base,
        n: target(phases[0]),
        i: phases[0].patient_intro || undefined,
        w: phases[0].weekly_routine || undefined,
        x: (phases[0].items ?? []).map(toExercise),
      }
    : {
        ...base,
        n: phases.length ? target(phases[0]) : 3,
        ph: phases.map((ph, k) => ({
          o: ph.starts_after_days ?? 0,
          l: phases.length > 1 ? `Étape ${k + 1}` : undefined,
          n: target(ph),
          i: ph.patient_intro || undefined,
          w: ph.weekly_routine || undefined,
          x: (ph.items ?? []).map(toExercise),
        })),
      }
  return `${PATIENT_APP_URL}#${encodeProgram(JSON.parse(JSON.stringify(link)))}`
}
