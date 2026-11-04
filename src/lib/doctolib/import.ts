/**
 * Import de l'agenda Doctolib Pro dans « Ma journée ».
 *
 * L'extension navigateur lit les rendez-vous du jour sur pro.doctolib.fr et
 * les envoie à Osteoflow sur le poste (jamais à un serveur extérieur). Ce
 * module contient la partie indépendante de l'interface : lecture de la
 * réponse Doctolib et association des rendez-vous aux patients du fichier.
 */

/** Rendez-vous tel que l'extension le transmet (sous-ensemble de la réponse Doctolib). */
export interface RawDoctolibAppointment {
  id?: unknown
  type?: unknown
  status?: unknown
  start_date?: unknown
  end_date?: unknown
  patient?: {
    first_name?: unknown
    last_name?: unknown
    maiden_name?: unknown
    birthdate?: unknown
    biological_sex?: unknown
    phone_number?: unknown
    email?: unknown
  } | null
}

export interface DoctolibAppointment {
  doctolibId: string
  start: string
  end: string | null
  firstName: string
  lastName: string
  maidenName: string | null
  /** AAAA-MM-JJ */
  birthDate: string | null
  gender: 'M' | 'F' | null
  phone: string | null
  email: string | null
}

/** Statuts Doctolib qui ne correspondent pas à un patient attendu. */
const EXCLUDED_STATUSES = new Set(['deleted', 'cancelled', 'canceled', 'no_show', 'rejected'])

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Garde les vrais rendez-vous patients (pas les absences ni les rendez-vous
 * annulés), triés par heure de début.
 */
export function parseDoctolibAppointments(raw: unknown): DoctolibAppointment[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)
      ? (raw as { data: unknown[] }).data
      : []

  const appointments: DoctolibAppointment[] = []
  for (const item of list as RawDoctolibAppointment[]) {
    if (!item || typeof item !== 'object') continue
    if (item.type !== undefined && item.type !== 'appt') continue
    const status = text(item.status)
    if (status && EXCLUDED_STATUSES.has(status)) continue
    const start = text(item.start_date)
    const firstName = text(item.patient?.first_name)
    const lastName = text(item.patient?.last_name)
    if (!start || !lastName) continue

    const birth = text(item.patient?.birthdate)
    const sex = text(item.patient?.biological_sex)
    appointments.push({
      doctolibId: text(item.id) ?? `${start}-${lastName}`,
      start,
      end: text(item.end_date),
      firstName: firstName ?? '',
      lastName,
      maidenName: text(item.patient?.maiden_name),
      birthDate: birth && /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
      gender: sex === 'female' ? 'F' : sex === 'male' ? 'M' : null,
      phone: text(item.patient?.phone_number),
      email: text(item.patient?.email),
    })
  }

  // Un même rendez-vous peut apparaître deux fois (déplacement en cours)
  const unique = new Map(appointments.map((appointment) => [appointment.doctolibId, appointment]))
  return Array.from(unique.values()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/** Minuscules, sans accents ni ponctuation : « Lé-a  D'Arc » → « le a d arc » */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

export interface MatchablePatient {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
}

export type MatchStatus = 'exact' | 'probable' | 'ambiguous' | 'none'

export interface PatientMatch {
  status: MatchStatus
  /** Patient retenu d'office (exact ou probable) */
  patientId: string | null
  /** Patients possibles, à proposer au choix */
  candidates: MatchablePatient[]
}

/**
 * Associe un rendez-vous Doctolib à un patient du fichier.
 *
 * - exact : même nom, même prénom, même date de naissance ;
 * - probable : un seul patient avec ce nom et ce prénom (date absente d'un
 *   côté), ou même nom et même date de naissance (prénom écrit autrement) ;
 * - ambiguous : plusieurs possibilités, ou date de naissance différente ;
 * - none : patient inconnu, à créer.
 */
export function matchPatient(appointment: DoctolibAppointment, patients: MatchablePatient[]): PatientMatch {
  const lastNames = [appointment.lastName, appointment.maidenName]
    .filter((name): name is string => !!name)
    .map(normalizeName)
  const first = normalizeName(appointment.firstName)
  const birth = appointment.birthDate

  const sameName = patients.filter(
    (patient) => lastNames.includes(normalizeName(patient.last_name)) && normalizeName(patient.first_name) === first
  )

  if (birth) {
    const exact = sameName.filter((patient) => patient.birth_date === birth)
    if (exact.length === 1) return { status: 'exact', patientId: exact[0].id, candidates: exact }
    if (exact.length > 1) return { status: 'ambiguous', patientId: null, candidates: exact }
  }

  if (sameName.length === 1) {
    const candidate = sameName[0]
    // Les deux dates sont connues et diffèrent : homonyme probable, on demande.
    if (birth && candidate.birth_date && candidate.birth_date !== birth) {
      return { status: 'ambiguous', patientId: null, candidates: sameName }
    }
    return { status: 'probable', patientId: candidate.id, candidates: sameName }
  }
  if (sameName.length > 1) return { status: 'ambiguous', patientId: null, candidates: sameName }

  if (birth) {
    const sameLastAndBirth = patients.filter(
      (patient) => lastNames.includes(normalizeName(patient.last_name)) && patient.birth_date === birth
    )
    if (sameLastAndBirth.length === 1) {
      return { status: 'probable', patientId: sameLastAndBirth[0].id, candidates: sameLastAndBirth }
    }
    if (sameLastAndBirth.length > 1) return { status: 'ambiguous', patientId: null, candidates: sameLastAndBirth }
  }

  return { status: 'none', patientId: null, candidates: [] }
}

/** Jour local (AAAA-MM-JJ) d'une date Doctolib avec fuseau, ex. 2026-10-26T08:40:00.000+01:00 */
export function localDay(isoDate: string): string {
  const match = isoDate.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : isoDate.slice(0, 10)
}

/** Heure locale affichée (HH:MM) telle que saisie dans Doctolib */
export function localTime(isoDate: string): string {
  const match = isoDate.match(/T(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : ''
}
