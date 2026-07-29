import { describe, it, expect } from 'vitest'
import { TAX_CONFIG_2026 } from '@/lib/finance/tax-config'
import { computeIncomeTax, computeParts } from '@/lib/finance/income-tax'
import { computeSocialCharges } from '@/lib/finance/social'
import { computeVat } from '@/lib/finance/vat'
import { simulate } from '@/lib/finance/simulator'
import { DEFAULT_FINANCE_SETTINGS } from '@/lib/finance/types'
import type { ExpenseTotals, FinanceSettings } from '@/lib/finance/types'

const config = TAX_CONFIG_2026

const noExpenses: ExpenseTotals = {
  deductibleHt: 0,
  deductibleVat: 0,
  paidTtc: 0,
  byCategory: {},
}

function settings(overrides: Partial<FinanceSettings> = {}): FinanceSettings {
  return { ...DEFAULT_FINANCE_SETTINGS, safetyMarginRate: 0, ...overrides }
}

describe('quotient familial', () => {
  it('attribue une demi-part aux deux premiers enfants, une part ensuite', () => {
    expect(computeParts({ maritalStatus: 'single', dependents: 0 })).toBe(1)
    expect(computeParts({ maritalStatus: 'couple', dependents: 0 })).toBe(2)
    expect(computeParts({ maritalStatus: 'couple', dependents: 2 })).toBe(3)
    expect(computeParts({ maritalStatus: 'couple', dependents: 3 })).toBe(4)
  })

  it('accorde une part entière au premier enfant du parent isolé', () => {
    expect(computeParts({ maritalStatus: 'single_parent', dependents: 1 })).toBe(2)
    expect(computeParts({ maritalStatus: 'single_parent', dependents: 2 })).toBe(2.5)
  })
})

describe('barème de l’impôt sur le revenu 2026', () => {
  it('reproduit l’exemple officiel : 30 000 € pour une part ≈ 2 104 €', () => {
    // Exemple publié par service-public.gouv.fr pour le barème 2026.
    const result = computeIncomeTax(config, {
      activityIncome: 30000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'single', dependents: 0 },
    })

    expect(result.total).toBeCloseTo(2104, 0)
    expect(result.marginalRate).toBe(0.3)
  })

  it('n’impose pas un revenu sous le seuil d’entrée', () => {
    const result = computeIncomeTax(config, {
      activityIncome: 11000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'single', dependents: 0 },
    })

    expect(result.total).toBe(0)
  })

  it('applique la décote juste au-dessus du seuil d’imposition', () => {
    const result = computeIncomeTax(config, {
      activityIncome: 16000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'single', dependents: 0 },
    })

    // Impôt brut = (16 000 − 11 600) × 11 % = 484 €, sous le seuil de décote.
    expect(result.cappedTax).toBeCloseTo(484, 0)
    expect(result.decote).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(result.cappedTax)
  })

  it('plafonne l’avantage procuré par les demi-parts', () => {
    const withoutChildren = computeIncomeTax(config, {
      activityIncome: 120000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'couple', dependents: 0 },
    })
    const withChildren = computeIncomeTax(config, {
      activityIncome: 120000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'couple', dependents: 2 },
    })

    const advantage = withoutChildren.total - withChildren.total
    // Deux demi-parts, plafonnées à 1 807 € chacune.
    expect(advantage).toBeCloseTo(2 * config.incomeTax.halfPartCap, 0)
  })

  it('impute à l’activité le surcoût réel, pas une part au prorata', () => {
    const result = computeIncomeTax(config, {
      activityIncome: 40000,
      otherHouseholdIncome: 40000,
      household: { maritalStatus: 'couple', dependents: 0 },
    })

    const alone = computeIncomeTax(config, {
      activityIncome: 40000,
      otherHouseholdIncome: 0,
      household: { maritalStatus: 'couple', dependents: 0 },
    })

    // Les autres revenus du foyer poussent l'activité dans des tranches plus
    // hautes : son coût fiscal marginal dépasse ce qu'elle coûterait seule.
    expect(result.attributableToActivity).toBeGreaterThan(alone.total)
    expect(result.attributableToActivity).toBeLessThan(result.total)
  })
})

describe('cotisations sociales', () => {
  it('applique le taux global micro-BNC au chiffre d’affaires', () => {
    const result = computeSocialCharges(config, {
      regime: 'micro_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 50000,
    })

    // 25,6 % de cotisations + 0,2 % de CFP.
    expect(result.total).toBeCloseTo(50000 * (0.256 + 0.002), 2)
  })

  it('applique le taux Cipav aux praticiens installés avant 2019', () => {
    const cipav = computeSocialCharges(config, {
      regime: 'micro_bnc',
      retirementFund: 'cipav',
      acre: false,
      base: 50000,
    })

    expect(cipav.total).toBeCloseTo(50000 * (0.232 + 0.002), 2)
  })

  it('réduit de moitié les cotisations micro sous Acre', () => {
    const withAcre = computeSocialCharges(config, {
      regime: 'micro_bnc',
      retirementFund: 'ssi',
      acre: true,
      base: 40000,
    })

    expect(withAcre.acreReduction).toBeCloseTo(40000 * 0.256 * 0.5, 2)
  })

  it('applique l’abattement d’assiette de 26 % au régime réel', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 60000,
    })

    // Abattement de 26 %, entre le plancher (846 €) et le plafond (62 478 €).
    expect(result.assiette).toBeCloseTo(60000 * 0.74, 2)
  })

  it('plafonne l’abattement d’assiette à 130 % du Pass', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 400000,
    })

    const cap = 1.3 * config.pass
    expect(result.assiette).toBeCloseTo(400000 - cap, 2)
  })

  it('respecte le plancher d’abattement sur les revenus très faibles', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 2000,
    })

    const floor = 0.0176 * config.pass
    expect(result.assiette).toBeCloseTo(2000 - floor, 2)
  })

  it('calcule la retraite de base sur deux tranches de Pass', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 100000,
    })

    // 26 % de 100 000 € reste sous le plafond d'abattement : assiette = 74 000 €.
    const assiette = 100000 * 0.74
    const expected = config.pass * 0.1787 + (assiette - config.pass) * 0.0072
    const line = result.lines.find((l) => l.key === 'retraite_base')

    expect(line?.amount).toBeCloseTo(expected, 2)
  })

  it('n’appelle pas d’allocations familiales sous 110 % du Pass', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 40000,
    })

    const line = result.lines.find((l) => l.key === 'allocations_familiales')
    expect(line?.amount).toBe(0)
  })

  it('maintient les cotisations minimales sur un revenu nul', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 0,
    })

    // Retraite de base, invalidité-décès et indemnités journalières restent dues.
    expect(result.total).toBeGreaterThan(1000)
  })

  it('situe la charge globale du réel dans la fourchette attendue', () => {
    const result = computeSocialCharges(config, {
      regime: 'reel_bnc',
      retirementFund: 'ssi',
      acre: false,
      base: 60000,
    })

    const rate = result.total / 60000
    expect(rate).toBeGreaterThan(0.25)
    expect(rate).toBeLessThan(0.45)
  })
})

describe('TVA', () => {
  it('ne collecte rien pour un praticien exonéré', () => {
    const result = computeVat(config, 'exonere', 80000, 1200, 0.2)

    expect(result.collected).toBe(0)
    expect(result.due).toBe(0)
    expect(result.revenueExcludingVat).toBe(80000)
    expect(result.franchiseWarning).toBe('none')
  })

  it('isole la TVA collectée sur des recettes TTC', () => {
    const result = computeVat(config, 'assujetti', 60000, 800, 0.2)

    expect(result.revenueExcludingVat).toBeCloseTo(50000, 2)
    expect(result.collected).toBeCloseTo(10000, 2)
    expect(result.due).toBeCloseTo(9200, 2)
  })

  it('reporte un crédit quand la TVA déductible dépasse la collectée', () => {
    const result = computeVat(config, 'assujetti', 1200, 500, 0.2)

    expect(result.due).toBe(0)
    expect(result.credit).toBeCloseTo(300, 2)
  })

  it('alerte sur le franchissement des seuils de franchise', () => {
    expect(computeVat(config, 'franchise', 30000, 0, 0.2).franchiseWarning).toBe('none')
    expect(computeVat(config, 'franchise', 35000, 0, 0.2).franchiseWarning).toBe(
      'approaching',
    )
    expect(computeVat(config, 'franchise', 39000, 0, 0.2).franchiseWarning).toBe(
      'exceeded',
    )
    expect(computeVat(config, 'franchise', 45000, 0, 0.2).franchiseWarning).toBe(
      'tolerance_exceeded',
    )
  })
})

describe('simulation complète', () => {
  it('déduit cotisations et impôt du disponible en micro-BNC', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc', retirementFund: 'ssi' }),
      revenue: 60000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.social.total).toBeCloseTo(60000 * 0.258, 2)
    expect(result.availableIncome).toBeCloseTo(
      60000 - result.social.total - result.incomeTax.attributableToActivity,
      2,
    )
    expect(result.availableIncome).toBeLessThan(60000)
    expect(result.recommendedMonthlyDraw).toBeCloseTo(result.availableIncome / 12, 2)
  })

  it('ignore les charges dans l’assiette micro mais pas dans la trésorerie', () => {
    const withExpenses = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc' }),
      revenue: 60000,
      expenses: {
        deductibleHt: 10000,
        deductibleVat: 2000,
        paidTtc: 12000,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    const withoutExpenses = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc' }),
      revenue: 60000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    // Le forfait micro ignore les charges réelles : mêmes cotisations, même impôt.
    expect(withExpenses.social.total).toBeCloseTo(withoutExpenses.social.total, 2)
    // Mais elles sortent bien de la trésorerie.
    expect(withExpenses.availableIncome).toBeCloseTo(
      withoutExpenses.availableIncome - 12000,
      2,
    )
  })

  it('déduit les charges de l’assiette au régime réel', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: {
        deductibleHt: 20000,
        deductibleVat: 4000,
        paidTtc: 24000,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    // Non assujetti : la TVA supportée n'est pas récupérable, elle fait partie
    // du coût déductible.
    expect(result.deductibleExpenses).toBeCloseTo(24000, 2)
    expect(result.grossProfit).toBeCloseTo(66000, 2)
  })

  it('retient les charges hors taxes quand le praticien est assujetti', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc', vatRegime: 'assujetti' }),
      revenue: 120000,
      expenses: {
        deductibleHt: 20000,
        deductibleVat: 4000,
        paidTtc: 24000,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    expect(result.revenueHt).toBeCloseTo(100000, 2)
    expect(result.deductibleExpenses).toBeCloseTo(20000, 2)
    expect(result.vat.due).toBeCloseTo(20000 - 4000, 2)
    // La TVA reversée ne fait pas partie du revenu disponible.
    expect(result.availableIncome).toBeCloseTo(
      120000 - 16000 - 24000 - result.social.total - result.incomeTax.attributableToActivity,
      2,
    )
  })

  it('remplace le barème par le prélèvement forfaitaire sous versement libératoire', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc', versementLiberatoire: true }),
      revenue: 55000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.incomeTax.attributableToActivity).toBeCloseTo(55000 * 0.022, 2)
  })

  it('annualise la projection en rejouant le calcul, sans extrapoler le résultat', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc' }),
      revenue: 30000,
      expenses: noExpenses,
      monthsElapsed: 6,
    })

    expect(result.projection).not.toBeNull()
    expect(result.projection?.revenue).toBeCloseTo(60000, 2)

    // L'impôt étant progressif, doubler le CA plus que double le disponible perdu :
    // la projection ne peut pas valoir exactement deux fois le semestre.
    expect(result.projection?.availableIncome).not.toBeCloseTo(
      result.availableIncome * 2,
      2,
    )
  })

  it('met de côté la marge de sécurité demandée', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'micro_bnc', safetyMarginRate: 0.1 }),
      revenue: 60000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.safetyMargin).toBeCloseTo(result.availableIncome * 0.1, 2)
    expect(result.recommendedAnnualDraw).toBeCloseTo(
      result.availableIncome - result.safetyMargin,
      2,
    )
  })

  it('signale que les barèmes d’une année inconnue sont ceux d’une autre', () => {
    const result = simulate({
      year: 2031,
      settings: settings(),
      revenue: 50000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.usesFallbackScales).toBe(true)
  })
})
