import { describe, it, expect } from 'vitest'
import { TAX_CONFIG_2026 } from '@/lib/finance/tax-config'
import { computeIncomeTax, computeParts } from '@/lib/finance/income-tax'
import { computeSocialCharges } from '@/lib/finance/social'
import { computeVat } from '@/lib/finance/vat'
import { simulate } from '@/lib/finance/simulator'
import { computeMileageAllowance } from '@/lib/finance/mileage'
import { computeOptionalContributions } from '@/lib/finance/optional-contributions'
import { buildDepreciationSchedule, computeDepreciation } from '@/lib/finance/depreciation'
import { DEFAULT_FINANCE_SETTINGS } from '@/lib/finance/types'
import type { ExpenseTotals, FinanceSettings } from '@/lib/finance/types'

const config = TAX_CONFIG_2026

const noExpenses: ExpenseTotals = {
  deductibleHt: 0,
  deductibleVat: 0,
  paidTtc: 0,
  flatAllowances: 0,
  depreciation: 0,
  assetPurchases: 0,
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
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
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
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
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
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
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

describe('barème kilométrique', () => {
  it('reproduit l’exemple officiel : 4 000 km en 5 CV = 2 544 €', () => {
    const result = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 4000,
      electric: false,
    })

    expect(result.allowance).toBeCloseTo(2544, 2)
  })

  it('applique la formule à forfait de la tranche intermédiaire', () => {
    // 14 000 km en 5 CV : (14 000 × 0,357) + 1 395 = 6 393 €.
    const result = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 14000,
      electric: false,
    })

    expect(result.allowance).toBeCloseTo(6393, 2)
  })

  it('bascule sur la tranche haute au-delà de 20 000 km', () => {
    const result = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 25000,
      electric: false,
    })

    expect(result.allowance).toBeCloseTo(25000 * 0.427, 2)
  })

  it('retient le barème le plus élevé au-delà de 7 CV', () => {
    const sevenCv = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 7,
      annualKm: 4000,
      electric: false,
    })
    const tenCv = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 10,
      annualKm: 4000,
      electric: false,
    })

    expect(sevenCv.allowance).toBeCloseTo(4000 * 0.697, 2)
    expect(tenCv.allowance).toBeCloseTo(sevenCv.allowance, 2)
  })

  it('majore de 20 % les véhicules électriques', () => {
    const thermal = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 4000,
      electric: false,
    })
    const electric = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 4000,
      electric: true,
    })

    expect(electric.allowance).toBeCloseTo(thermal.allowance * 1.2, 2)
  })

  it('gère les deux-roues avec leurs propres tranches', () => {
    const moto = computeMileageAllowance(config, {
      kind: 'motorcycle',
      horsepower: 4,
      annualKm: 2000,
      electric: false,
    })
    const moped = computeMileageAllowance(config, {
      kind: 'moped',
      horsepower: 1,
      annualKm: 2000,
      electric: false,
    })

    expect(moto.allowance).toBeCloseTo(2000 * 0.468, 2)
    expect(moped.allowance).toBeCloseTo(2000 * 0.315, 2)
  })

  it('ne déduit rien sans kilomètres', () => {
    const result = computeMileageAllowance(config, {
      kind: 'car',
      horsepower: 5,
      annualKm: 0,
      electric: false,
    })

    expect(result.allowance).toBe(0)
  })
})

describe('cotisations facultatives Madelin et PER', () => {
  it('plafonne la retraite à 10 % du bénéfice majorés de 15 % au-delà du Pass', () => {
    const profit = 80000
    const result = computeOptionalContributions(config, {
      regime: 'reel_bnc',
      taxableProfit: profit,
      retirement: 100000,
      prevoyance: 0,
    })

    const expected = profit * 0.1 + (profit - config.pass) * 0.15
    const line = result.lines.find((l) => l.key === 'retirement')

    expect(line?.ceiling).toBeCloseTo(expected, 2)
    expect(line?.deducted).toBeCloseTo(expected, 2)
    expect(line?.excess).toBeCloseTo(100000 - expected, 2)
  })

  it('garantit un plancher de déduction de 10 % du Pass', () => {
    const result = computeOptionalContributions(config, {
      regime: 'reel_bnc',
      taxableProfit: 5000,
      retirement: 6000,
      prevoyance: 0,
    })

    const line = result.lines.find((l) => l.key === 'retirement')
    expect(line?.ceiling).toBeCloseTo(config.pass * 0.1, 2)
  })

  it('plafonne le bénéfice retenu à 8 Pass', () => {
    const huge = computeOptionalContributions(config, {
      regime: 'reel_bnc',
      taxableProfit: 900000,
      retirement: 200000,
      prevoyance: 0,
    })

    const cap = 8 * config.pass
    const expected = cap * 0.1 + (cap - config.pass) * 0.15
    const line = huge.lines.find((l) => l.key === 'retirement')

    expect(line?.ceiling).toBeCloseTo(expected, 2)
  })

  it('plafonne la prévoyance à 3 % de 8 Pass', () => {
    const result = computeOptionalContributions(config, {
      regime: 'reel_bnc',
      taxableProfit: 500000,
      retirement: 0,
      prevoyance: 50000,
    })

    const line = result.lines.find((l) => l.key === 'prevoyance')
    expect(line?.ceiling).toBeCloseTo(config.pass * 0.24, 2)
  })

  it('n’ouvre pas de volet prévoyance en micro-BNC', () => {
    const result = computeOptionalContributions(config, {
      regime: 'micro_bnc',
      taxableProfit: 40000,
      retirement: 3000,
      prevoyance: 2000,
    })

    expect(result.lines.map((l) => l.key)).toEqual(['retirement'])
  })
})

describe('intégration véhicule et cotisations facultatives', () => {
  it('déduit le barème kilométrique du bénéfice au régime réel', () => {
    const withVehicle = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        vehicle: { mode: 'mileage', kind: 'car', horsepower: 5, annualKm: 4000, electric: false },
      }),
      revenue: 80000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    const without = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 80000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(withVehicle.mileage?.allowance).toBeCloseTo(2544, 2)
    expect(withVehicle.grossProfit).toBeCloseTo(without.grossProfit - 2544, 2)
    expect(withVehicle.social.total).toBeLessThan(without.social.total)
  })

  it('alerte sur le cumul barème et charges de véhicule', () => {
    const result = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        vehicle: { mode: 'mileage', kind: 'car', horsepower: 5, annualKm: 8000, electric: false },
      }),
      revenue: 80000,
      expenses: {
        deductibleHt: 1200,
        deductibleVat: 240,
        paidTtc: 1440,
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: { vehicule: 1440 },
      },
      monthsElapsed: 12,
    })

    expect(result.warnings.map((w) => w.key)).toContain('mileage_double_count')
  })

  it('ignore le barème en micro-BNC, où l’abattement couvre déjà les frais', () => {
    const result = simulate({
      year: 2026,
      settings: settings({
        regime: 'micro_bnc',
        vehicle: { mode: 'mileage', kind: 'car', horsepower: 5, annualKm: 9000, electric: false },
      }),
      revenue: 60000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.mileage).toBeNull()
    expect(result.warnings.map((w) => w.key)).toContain('mileage_micro')
  })

  it('réduit l’impôt sans toucher aux cotisations sociales', () => {
    const withPer = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc', optionalRetirement: 5000 }),
      revenue: 90000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    const without = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    // Les cotisations facultatives sont réintégrées au revenu brut social :
    // l'Urssaf ne bouge pas, seul l'impôt baisse.
    expect(withPer.social.total).toBeCloseTo(without.social.total, 2)
    expect(withPer.incomeTax.attributableToActivity).toBeLessThan(
      without.incomeTax.attributableToActivity,
    )
    expect(withPer.optionalContributions?.taxSaving).toBeGreaterThan(0)
  })

  it('sort les versements de la trésorerie disponible', () => {
    const withPer = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc', optionalRetirement: 5000 }),
      revenue: 90000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    const without = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    const taxSaving = withPer.optionalContributions?.taxSaving ?? 0
    // Le versement sort en trésorerie, mais l'économie d'impôt en atténue le coût.
    expect(withPer.availableIncome).toBeCloseTo(
      without.availableIncome - 5000 + taxSaving,
      2,
    )
  })

  it('signale le dépassement du plafond de déduction', () => {
    const result = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc', optionalRetirement: 60000 }),
      revenue: 70000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(result.warnings.map((w) => w.key)).toContain('optional_excess')
    expect(result.optionalContributions?.totalExcess).toBeGreaterThan(0)
  })
})

describe('régularisation Urssaf d’une année antérieure', () => {
  const base = {
    year: 2026,
    revenue: 85000,
    expenses: {
      deductibleHt: 19947,
      deductibleVat: 0,
      paidTtc: 19947,
      flatAllowances: 0,
      depreciation: 0,
      assetPurchases: 0,
      byCategory: {},
    },
    monthsElapsed: 12,
  }

  it('ne réduit pas l’assiette sociale', () => {
    const withSettlement = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc', priorYearSocialSettlement: 6758 }),
    })
    const without = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc' }),
    })

    // Le revenu brut social est défini hors cotisations sociales : la
    // régularisation ne doit rien changer à l'Urssaf calculée.
    expect(withSettlement.social.assiette).toBeCloseTo(without.social.assiette, 2)
    expect(withSettlement.social.total).toBeCloseTo(without.social.total, 2)
  })

  it('réduit en revanche le revenu imposable et l’impôt', () => {
    const withSettlement = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc', priorYearSocialSettlement: 6758 }),
    })
    const without = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc' }),
    })

    expect(withSettlement.incomeTax.taxableIncome).toBeCloseTo(
      without.incomeTax.taxableIncome - 6758,
      2,
    )
    expect(withSettlement.incomeTax.total).toBeLessThan(without.incomeTax.total)
  })

  it('sort bien de la trésorerie', () => {
    const withSettlement = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc', priorYearSocialSettlement: 6758 }),
    })
    const without = simulate({
      ...base,
      settings: settings({ regime: 'reel_bnc' }),
    })

    const taxSaved = without.incomeTax.attributableToActivity -
      withSettlement.incomeTax.attributableToActivity
    expect(withSettlement.availableIncome).toBeCloseTo(
      without.availableIncome - 6758 + taxSaved,
      2,
    )
  })
})

describe('forfaits sans décaissement', () => {
  it('déduisent du bénéfice sans sortir de la trésorerie', () => {
    const withFlat = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 85000,
      expenses: {
        deductibleHt: 18657,
        deductibleVat: 0,
        paidTtc: 18657,
        flatAllowances: 1290,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    const withoutFlat = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 85000,
      expenses: {
        deductibleHt: 18657,
        deductibleVat: 0,
        paidTtc: 18657,
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    // Le forfait réduit l'assiette sociale...
    expect(withFlat.grossProfit).toBeCloseTo(withoutFlat.grossProfit - 1290, 2)
    expect(withFlat.social.total).toBeLessThan(withoutFlat.social.total)
    // ...mais laisse plus de trésorerie, puisque rien n'est décaissé.
    expect(withFlat.availableIncome).toBeGreaterThan(withoutFlat.availableIncome)
  })

  it('ne compte plus le barème kilométrique comme un décaissement', () => {
    const withMileage = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        vehicle: { mode: 'mileage', kind: 'car', horsepower: 5, annualKm: 4000, electric: false },
      }),
      revenue: 85000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    const without = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 85000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    // L'essence étant réglée à titre privé, le barème allège l'impôt et les
    // cotisations sans réduire la trésorerie de l'activité.
    expect(withMileage.grossProfit).toBeCloseTo(without.grossProfit - 2544, 2)
    expect(withMileage.availableIncome).toBeGreaterThan(without.availableIncome)
  })
})

describe('mode simplifié', () => {
  it('donne le même résultat que le mode réel à montants équivalents', () => {
    const simple = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        inputMode: 'simple',
        simple: { annualExpenses: 19947, annualExpensesVat: 0, flatAllowances: 1290, depreciation: 0 },
      }),
      revenue: 85000,
      expenses: {
        deductibleHt: 19947,
        deductibleVat: 0,
        paidTtc: 19947,
        flatAllowances: 1290,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    const real = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc', inputMode: 'real' }),
      revenue: 85000,
      expenses: {
        deductibleHt: 19947,
        deductibleVat: 0,
        paidTtc: 19947,
        flatAllowances: 1290,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    expect(simple.availableIncome).toBeCloseTo(real.availableIncome, 2)
  })

  it('n’annualise pas des charges déjà annuelles dans la projection', () => {
    const result = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        inputMode: 'simple',
        simple: { annualExpenses: 20000, annualExpensesVat: 0, flatAllowances: 0, depreciation: 0 },
      }),
      revenue: 40000,
      expenses: {
        deductibleHt: 20000,
        deductibleVat: 0,
        paidTtc: 20000,
        flatAllowances: 0,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 6,
    })

    // Recettes doublées, charges inchangées : le bénéfice projeté vaut
    // 80 000 − 20 000 et non 80 000 − 40 000.
    expect(result.projection?.revenue).toBeCloseTo(80000, 2)
  })
})

describe('identité de trésorerie de la cascade', () => {
  it('recettes − sorties réelles = disponible, poste par poste', () => {
    const revenue = 90986
    const r = simulate({
      year: 2026,
      settings: settings({
        regime: 'reel_bnc',
        safetyMarginRate: 0.05,
        optionalPrevoyance: 520,
        priorYearSocialSettlement: 6758,
        vehicle: { mode: 'mileage', kind: 'car', horsepower: 11, annualKm: 1620, electric: false },
      }),
      revenue,
      expenses: {
        deductibleHt: 15747,
        deductibleVat: 0,
        paidTtc: 15747,
        flatAllowances: 1290,
        depreciation: 0,
        assetPurchases: 0,
        byCategory: {},
      },
      monthsElapsed: 12,
    })

    // Reconstitution des charges décaissées par identité, comme le fait l'UI.
    const cashCharges =
      revenue - r.vat.due - r.social.total - r.incomeTax.attributableToActivity - r.availableIncome
    const paidOnly =
      cashCharges - r.priorYearSocialSettlement - (r.optionalContributions?.totalPaid ?? 0)

    // Les déductions sans décaissement n'apparaissent pas dans la trésorerie.
    expect(paidOnly).toBeCloseTo(15747, 1)

    // La cascade affichée somme exactement au disponible.
    const waterfall =
      revenue - r.vat.due - paidOnly - r.priorYearSocialSettlement -
      (r.optionalContributions?.totalPaid ?? 0) - r.social.total -
      r.incomeTax.attributableToActivity
    expect(waterfall).toBeCloseTo(r.availableIncome, 1)

    // Douze mois moyens redonnent le versement annuel recommandé.
    const monthRevenue = revenue / 12
    const monthDraw = monthRevenue - monthRevenue * r.provisionRate - cashCharges / 12
    expect(monthDraw * 12).toBeCloseTo(r.recommendedAnnualDraw, 0)
  })
})

describe('amortissement des immobilisations', () => {
  const table = {
    id: 'a1',
    label: 'Table de soin',
    category: 'table',
    serviceDate: '2026-07-01',
    amountHt: 3500,
    vatAmount: 700,
    durationYears: 7,
  }

  it('étale le coût sur la durée d’usage, prorata temporis la première année', () => {
    const schedule = buildDepreciationSchedule(table)

    // Mise en service au 1er juillet : 180 jours sur 360, soit une demi-annuité.
    const annuity = 3500 / 7
    expect(schedule[0].year).toBe(2026)
    expect(schedule[0].dotation).toBeCloseTo(annuity / 2, 2)
    expect(schedule[1].dotation).toBeCloseTo(annuity, 2)

    // Un exercice de plus que la durée, à cause du démarrage en cours d'année.
    expect(schedule).toHaveLength(8)
    expect(schedule[7].dotation).toBeCloseTo(annuity / 2, 2)
  })

  it('amortit exactement la base, sans reste', () => {
    const schedule = buildDepreciationSchedule(table)
    const total = schedule.reduce((sum, row) => sum + row.dotation, 0)

    expect(total).toBeCloseTo(3500, 2)
    expect(schedule[schedule.length - 1].residual).toBeCloseTo(0, 2)
  })

  it('amortit sur la durée exacte quand la mise en service est au 1er janvier', () => {
    const schedule = buildDepreciationSchedule({ ...table, serviceDate: '2026-01-01' })

    expect(schedule).toHaveLength(7)
    expect(schedule[0].dotation).toBeCloseTo(3500 / 7, 2)
  })

  it('sépare l’acquisition de la dotation sur l’année d’achat', () => {
    const acquisition = computeDepreciation([table], 2026)
    const later = computeDepreciation([table], 2028)

    // L'année de l'achat : décaissement intégral, mais demi-annuité déduite.
    expect(acquisition.totalPurchasesTtc).toBeCloseTo(4200, 2)
    expect(acquisition.totalDotation).toBeCloseTo(3500 / 7 / 2, 2)

    // Ensuite : plus aucun décaissement, mais une annuité pleine.
    expect(later.totalPurchasesTtc).toBe(0)
    expect(later.totalDotation).toBeCloseTo(3500 / 7, 2)
  })

  it('ne déduit plus rien une fois le bien totalement amorti', () => {
    expect(computeDepreciation([table], 2040).totalDotation).toBe(0)
  })

  it('ne déduit rien avant la mise en service', () => {
    expect(computeDepreciation([table], 2025).totalDotation).toBe(0)
  })

  it('déduit la dotation du bénéfice sans toucher à la trésorerie', () => {
    const withAsset = simulate({
      year: 2028,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: { ...noExpenses, depreciation: 500 },
      monthsElapsed: 12,
    })
    const without = simulate({
      year: 2028,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: noExpenses,
      monthsElapsed: 12,
    })

    expect(withAsset.grossProfit).toBeCloseTo(without.grossProfit - 500, 2)
    expect(withAsset.social.total).toBeLessThan(without.social.total)
    // Aucun décaissement : le disponible augmente, grâce à l'économie d'impôt.
    expect(withAsset.availableIncome).toBeGreaterThan(without.availableIncome)
  })

  it('sort l’acquisition de la trésorerie sans la déduire en totalité', () => {
    const buying = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: { ...noExpenses, depreciation: 250, assetPurchases: 4200 },
      monthsElapsed: 12,
    })
    const notBuying = simulate({
      year: 2026,
      settings: settings({ regime: 'reel_bnc' }),
      revenue: 90000,
      expenses: { ...noExpenses, depreciation: 250 },
      monthsElapsed: 12,
    })

    // Même bénéfice, mêmes cotisations : seule la trésorerie encaisse le choc.
    expect(buying.grossProfit).toBeCloseTo(notBuying.grossProfit, 2)
    expect(buying.social.total).toBeCloseTo(notBuying.social.total, 2)
    expect(buying.availableIncome).toBeCloseTo(notBuying.availableIncome - 4200, 2)
  })
})

describe('confrontation à un échéancier Urssaf 2026 réel', () => {
  // Dossier BNC réel, échéancier prévisionnel 2026 établi par un cabinet
  // d'expertise comptable (« Cotisation provisionnelle 2026 », total 2 655 €).
  //
  // Revenu brut social : 8 916 €. Il inclut la CFP, que le plan comptable
  // classe en « autres impôts » mais que l'Urssaf réintègre — c'est une
  // contribution sociale, pas une taxe déductible.
  const REVENU_BRUT = 8916

  const echeancier: Record<string, number> = {
    maladie: 0,
    indemnites_journalieres: 96,
    retraite_base: 1179,
    retraite_complementaire: 534,
    invalidite_deces: 86,
    allocations_familiales: 0,
    csg_crds: 640,
    cfp: 120,
  }

  const result = computeSocialCharges(config, {
    regime: 'reel_bnc',
    retirementFund: 'ssi',
    acre: false,
    base: REVENU_BRUT,
  })

  it('retient la même assiette après abattement de 26 %', () => {
    expect(result.assiette).toBeCloseTo(6598, 0)
  })

  it.each(Object.entries(echeancier))(
    'reproduit la ligne %s à l’euro près',
    (key, expected) => {
      const line = result.lines.find((l) => l.key === key)
      expect(line, `ligne ${key} absente`).toBeDefined()
      expect(Math.round(line!.amount)).toBe(expected)
    },
  )

  it('retombe sur le total de l’échéancier', () => {
    expect(Math.round(result.total)).toBe(2655)
  })

  it('applique le plancher des indemnités journalières comme l’Urssaf', () => {
    // 96 € = 0,50 % de 40 % du Pass, alors que l'assiette réelle est bien
    // inférieure : c'est l'assiette minimale qui s'applique.
    const line = result.lines.find((l) => l.key === 'indemnites_journalieres')
    expect(line?.amount).toBeCloseTo(0.4 * config.pass * 0.005, 0)
  })
})
