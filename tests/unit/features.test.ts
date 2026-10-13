import { describe, expect, it } from 'vitest'
import { featuresFromLicense } from '@/lib/features'

describe('featuresFromLicense', () => {
  it('suit la liste envoyée par osteoupgrade', () => {
    expect(featuresFromLicense('premium', '["programmes"]')).toEqual(['programmes'])
    expect(featuresFromLicense('admin', '[]')).toEqual([])
  })

  it('ignore les fonctions inconnues', () => {
    expect(featuresFromLicense('premium', '["programmes","autre"]')).toEqual(['programmes'])
  })

  it('retombe sur le rôle sans liste stockée (connexion antérieure)', () => {
    expect(featuresFromLicense('admin', null)).toEqual(['programmes'])
    expect(featuresFromLicense('premium', null)).toEqual([])
    expect(featuresFromLicense('trial', 'illisible')).toEqual([])
  })
})
