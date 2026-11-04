import { describe, it, expect } from 'vitest'
import {
  parseDoctolibAppointments,
  matchPatient,
  normalizeName,
  hasSimilarPatient,
  canAutoCreate,
  localDay,
  localTime,
  type DoctolibAppointment,
  type MatchablePatient,
} from '@/lib/doctolib/import'

// Données entièrement fictives, calquées sur la structure de la réponse
// pro.doctolib.fr/calendar_display/appointments
const appointment = (overrides: Record<string, unknown> = {}, patient: Record<string, unknown> = {}) => ({
  id: 'a1',
  type: 'appt',
  status: 'confirmed',
  start_date: '2026-10-26T10:00:00.000+01:00',
  end_date: '2026-10-26T10:40:00.000+01:00',
  patient: {
    first_name: 'Léa',
    last_name: 'Martin',
    maiden_name: null,
    birthdate: '1990-04-12',
    biological_sex: 'female',
    phone_number: '+33600000000',
    email: 'lea@example.com',
    ...patient,
  },
  ...overrides,
})

describe('parseDoctolibAppointments', () => {
  it('lit la réponse { data: [...] } et trie par heure', () => {
    const result = parseDoctolibAppointments({
      data: [
        appointment({ id: 'b', start_date: '2026-10-26T14:00:00.000+01:00' }, { first_name: 'Paul', last_name: 'Petit', biological_sex: 'male' }),
        appointment({ id: 'a' }),
      ],
    })
    expect(result.map((r) => r.doctolibId)).toEqual(['a', 'b'])
    expect(result[0]).toMatchObject({ firstName: 'Léa', lastName: 'Martin', birthDate: '1990-04-12', gender: 'F' })
    expect(result[1].gender).toBe('M')
  })

  it('écarte les rendez-vous annulés et ce qui n’est pas un rendez-vous patient', () => {
    const result = parseDoctolibAppointments({
      data: [
        appointment({ id: 'ok' }),
        appointment({ id: 'cancel', status: 'deleted' }),
        appointment({ id: 'absence', type: 'event' }),
        appointment({ id: 'sans-patient', patient: null }),
      ],
    })
    expect(result.map((r) => r.doctolibId)).toEqual(['ok'])
  })

  it('ignore une date de naissance mal formée et les doublons', () => {
    const result = parseDoctolibAppointments([
      appointment({}, { birthdate: '12/04/1990' }),
      appointment(),
    ])
    expect(result).toHaveLength(1)
  })

  it('renvoie une liste vide pour une réponse inattendue', () => {
    expect(parseDoctolibAppointments(null)).toEqual([])
    expect(parseDoctolibAppointments({ data: 'x' })).toEqual([])
  })
})

describe('normalizeName', () => {
  it('ignore accents, casse et ponctuation', () => {
    expect(normalizeName('  Lé-a  D’Arc ')).toBe('le a d arc')
    expect(normalizeName('MARTIN')).toBe(normalizeName('martin'))
  })
})

describe('matchPatient', () => {
  const base: DoctolibAppointment = parseDoctolibAppointments([appointment()])[0]
  const patients: MatchablePatient[] = [
    { id: 'p1', first_name: 'Lea', last_name: 'MARTIN', birth_date: '1990-04-12' },
    { id: 'p2', first_name: 'Paul', last_name: 'Petit', birth_date: '1970-01-01' },
  ]

  it('exact : nom, prénom et date de naissance identiques', () => {
    expect(matchPatient(base, patients)).toMatchObject({ status: 'exact', patientId: 'p1' })
  })

  it('probable : un seul homonyme sans date de naissance côté Doctolib', () => {
    expect(matchPatient({ ...base, birthDate: null }, patients)).toMatchObject({ status: 'probable', patientId: 'p1' })
  })

  it('ambigu : même nom mais date de naissance différente', () => {
    expect(matchPatient({ ...base, birthDate: '2001-01-01' }, patients)).toMatchObject({ status: 'ambiguous', patientId: null })
  })

  it('ambigu : deux homonymes sans date pour trancher', () => {
    const twins = [...patients, { id: 'p3', first_name: 'Léa', last_name: 'Martin', birth_date: null }]
    expect(matchPatient({ ...base, birthDate: null }, twins).status).toBe('ambiguous')
  })

  it('probable : prénom écrit autrement mais nom et date identiques', () => {
    expect(matchPatient({ ...base, firstName: 'Léa-Marie' }, patients)).toMatchObject({ status: 'probable', patientId: 'p1' })
  })

  it('reconnaît le nom de naissance', () => {
    const married = { ...base, lastName: 'Durand', maidenName: 'Martin' }
    expect(matchPatient(married, patients)).toMatchObject({ status: 'exact', patientId: 'p1' })
  })

  it('aucun : patient inconnu', () => {
    expect(matchPatient({ ...base, lastName: 'Inconnu' }, patients).status).toBe('none')
  })
})

describe('localDay / localTime', () => {
  it('garde le jour et l’heure saisis dans Doctolib, sans conversion de fuseau', () => {
    expect(localDay('2026-10-26T23:30:00.000+01:00')).toBe('2026-10-26')
    expect(localTime('2026-10-26T08:40:00.000+01:00')).toBe('08:40')
  })
})

describe('création automatique', () => {
  const nina = parseDoctolibAppointments([appointment({ id: 'n' }, { first_name: 'Nina', last_name: 'Garcia', birthdate: '1988-02-02' })])[0]
  const patients: MatchablePatient[] = [{ id: 'p1', first_name: 'Léa', last_name: 'Martin', birth_date: '1990-04-12' }]

  it('autorisée pour un inconnu complet', () => {
    expect(canAutoCreate(nina, patients)).toBe(true)
  })

  it('refusée si un dossier porte le même nom de famille', () => {
    expect(canAutoCreate({ ...nina, lastName: 'MARTIN' }, patients)).toBe(false)
    expect(hasSimilarPatient({ ...nina, maidenName: 'Martin' }, patients)).toBe(true)
  })

  it('refusée si même prénom et même date de naissance', () => {
    expect(canAutoCreate({ ...nina, firstName: 'Lea', birthDate: '1990-04-12' }, patients)).toBe(false)
  })

  it('refusée sans les champs obligatoires de la fiche', () => {
    expect(canAutoCreate({ ...nina, birthDate: null }, patients)).toBe(false)
    expect(canAutoCreate({ ...nina, phone: null }, patients)).toBe(false)
    expect(canAutoCreate({ ...nina, gender: null }, patients)).toBe(false)
  })
})
