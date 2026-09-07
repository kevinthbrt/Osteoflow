import { describe, it, expect } from 'vitest'
import {
  isOtherSource,
  otherSourceText,
  referralStatLabel,
  PATIENT_REFERRAL_LABEL,
  UNKNOWN_SOURCE_LABEL,
} from '@/lib/patients/referral-sources'

describe('isOtherSource', () => {
  it('reconnaît le bouton « Autre » et sa saisie libre', () => {
    expect(isOtherSource('Autre')).toBe(true)
    expect(isOtherSource('Autre : ')).toBe(true)
    expect(isOtherSource('Autre : ma voisine')).toBe(true)
  })

  it('ne confond pas une catégorie personnalisée commençant par « Autre »', () => {
    expect(isOtherSource('Autre cabinet')).toBe(false)
    expect(isOtherSource('Médecin')).toBe(false)
    expect(isOtherSource(null)).toBe(false)
  })
})

describe('otherSourceText', () => {
  it('retire le préfixe sans rogner la saisie en cours', () => {
    expect(otherSourceText('Autre : Salle de sport ')).toBe('Salle de sport ')
    expect(otherSourceText('Autre : ')).toBe('')
  })
})

describe('referralStatLabel', () => {
  it('fait primer la recommandation par un patient', () => {
    expect(
      referralStatLabel({ referred_by_patient_id: 'abc', referred_by_source: 'Internet' })
    ).toBe(PATIENT_REFERRAL_LABEL)
  })

  it('renvoie le canal tel quel', () => {
    expect(referralStatLabel({ referred_by_source: 'Bouche à oreille' })).toBe('Bouche à oreille')
    expect(referralStatLabel({ referred_by_source: 'Salle de sport' })).toBe('Salle de sport')
  })

  it('conserve le texte libre saisi derrière « Autre »', () => {
    expect(referralStatLabel({ referred_by_source: 'Autre : ma voisine' })).toBe('Autre : ma voisine')
    expect(referralStatLabel({ referred_by_source: 'Autre : ' })).toBe('Autre')
  })

  it('regroupe les fiches sans source', () => {
    expect(referralStatLabel({ referred_by_source: '', referred_by_patient_id: null })).toBe(UNKNOWN_SOURCE_LABEL)
    expect(referralStatLabel({})).toBe(UNKNOWN_SOURCE_LABEL)
  })
})
