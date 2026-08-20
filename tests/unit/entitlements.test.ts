import { describe, it, expect } from 'vitest'
import { entitlementsFromLicense, parseEntitlements } from '@/lib/entitlements'

describe('entitlementsFromLicense', () => {
  it('utilise les droits stockés quand ils sont complets', () => {
    expect(entitlementsFromLicense('premium', { osteoflow: true, osteoupgrade: false }))
      .toEqual({ osteoflow: true, osteoupgrade: false })
  })

  it('ignore un objet incomplet et retombe sur le rôle', () => {
    // Un objet partiel ne doit pas être pris pour parole d'évangile : mieux
    // vaut le repli sur le rôle que d'inventer un `false` implicite.
    expect(entitlementsFromLicense('premium', { osteoflow: true } as any))
      .toEqual({ osteoflow: true, osteoupgrade: true })
  })

  describe('repli sur le rôle (licence antérieure, sans droits stockés)', () => {
    it('premium donne les deux', () => {
      expect(entitlementsFromLicense('premium', null)).toEqual({ osteoflow: true, osteoupgrade: true })
    })

    it('admin donne les deux', () => {
      expect(entitlementsFromLicense('admin', null)).toEqual({ osteoflow: true, osteoupgrade: true })
    })

    it('trial donne MyOsteoFlow seul', () => {
      // `trial` est le rôle miroir de l'offre MyOsteoFlow seule.
      expect(entitlementsFromLicense('trial', null)).toEqual({ osteoflow: true, osteoupgrade: false })
    })

    it('free ne donne rien', () => {
      expect(entitlementsFromLicense('free', null)).toEqual({ osteoflow: false, osteoupgrade: false })
    })

    it('un rôle inconnu ou absent ne donne rien', () => {
      expect(entitlementsFromLicense(null, null)).toEqual({ osteoflow: false, osteoupgrade: false })
      expect(entitlementsFromLicense('inconnu', null)).toEqual({ osteoflow: false, osteoupgrade: false })
    })
  })
})

describe('parseEntitlements', () => {
  it('lit un JSON valide', () => {
    expect(parseEntitlements('{"osteoflow":true,"osteoupgrade":false}'))
      .toEqual({ osteoflow: true, osteoupgrade: false })
  })

  it('ne lève jamais sur une valeur illisible', () => {
    // La valeur vient de la base locale : un enregistrement corrompu ne doit
    // pas empêcher l'application de démarrer.
    expect(parseEntitlements('pas du json')).toBeNull()
    expect(parseEntitlements('')).toBeNull()
    expect(parseEntitlements(null)).toBeNull()
    expect(parseEntitlements('"chaine"')).toBeNull()
  })
})
