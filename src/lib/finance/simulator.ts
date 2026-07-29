import { getTaxConfig, hasTaxConfig } from './tax-config'
import { computeVat } from './vat'
import { computeSocialCharges } from './social'
import { computeIncomeTax } from './income-tax'
import type { IncomeTaxResult, SimulationInput, SimulationResult } from './types'

/**
 * Simulation complète : des recettes encaissées jusqu'à la rémunération que le
 * praticien peut réellement se verser.
 *
 * L'enchaînement suit la logique de trésorerie plutôt que la logique comptable,
 * parce que la question posée est « combien puis-je me prendre » :
 *
 *   recettes encaissées
 *     − TVA à reverser        (encaissée pour le compte du Trésor)
 *     − charges décaissées    (TTC, la TVA non récupérable étant un coût)
 *     − cotisations sociales
 *     − impôt sur le revenu   (surcoût réel généré par l'activité)
 *     = disponible
 *
 * Le résultat est une estimation destinée à provisionner : il ne remplace pas
 * une déclaration, et ignore notamment les crédits et réductions d'impôt, les
 * déficits reportables et les revenus de capitaux du foyer.
 */
export function simulate(input: SimulationInput): SimulationResult {
  const config = getTaxConfig(input.year)
  const { settings, revenue, expenses } = input

  const vat = computeVat(
    config,
    settings.vatRegime,
    revenue,
    expenses.deductibleVat,
    settings.vatRate,
  )

  const revenueHt = vat.revenueExcludingVat

  // Assujetti : les charges sont retenues hors taxes, la TVA étant récupérée.
  // Sinon la TVA supportée reste à la charge du praticien et fait partie du coût.
  const deductibleExpenses =
    settings.vatRegime === 'assujetti'
      ? expenses.deductibleHt
      : expenses.deductibleHt + expenses.deductibleVat

  const grossProfit = revenueHt - deductibleExpenses

  const social = computeSocialCharges(config, {
    regime: settings.regime,
    retirementFund: settings.retirementFund,
    acre: settings.acre,
    base: settings.regime === 'micro_bnc' ? revenueHt : grossProfit,
  })

  const { incomeTax, activityTax } = computeActivityTax({
    input,
    revenueHt,
    grossProfit,
    socialTotal: social.total,
    csgDeductible: social.csgDeductible,
  })

  // Vue trésorerie : ce qui entre, moins tout ce qui doit ressortir.
  const availableIncome =
    revenue - vat.due - expenses.paidTtc - social.total - activityTax

  const safetyMargin = Math.max(0, availableIncome) * settings.safetyMarginRate
  const recommendedAnnualDraw = availableIncome - safetyMargin

  const months = Math.max(1, input.monthsElapsed)
  const monthlyProvisions = {
    social: social.total / months,
    incomeTax: activityTax / months,
    vat: vat.due / months,
    safety: safetyMargin / months,
    total: (social.total + activityTax + vat.due + safetyMargin) / months,
  }

  return {
    year: input.year,
    usesFallbackScales: !hasTaxConfig(input.year),
    scalesVerifiedOn: config.verifiedOn,

    vat,
    revenueHt,
    deductibleExpenses,
    grossProfit,
    social,
    incomeTax,

    availableIncome,
    safetyMargin,
    recommendedAnnualDraw,
    recommendedMonthlyDraw: recommendedAnnualDraw / months,

    monthlyProvisions,
    provisionRate:
      revenue > 0
        ? (social.total + activityTax + vat.due + safetyMargin) / revenue
        : 0,

    projection: buildProjection(input),
  }
}

/**
 * Impôt généré par l'activité.
 *
 * Le versement libératoire remplace le barème par un prélèvement forfaitaire
 * sur le chiffre d'affaires. Hors option, on repasse par le barème du foyer,
 * sur une base qui dépend du régime : abattement forfaitaire de 34 % en micro,
 * bénéfice réel diminué des cotisations en déclaration contrôlée.
 */
function computeActivityTax(args: {
  input: SimulationInput
  revenueHt: number
  grossProfit: number
  socialTotal: number
  csgDeductible: number
}): { incomeTax: IncomeTaxResult; activityTax: number } {
  const { input, revenueHt, grossProfit, socialTotal, csgDeductible } = args
  const config = getTaxConfig(input.year)
  const { settings } = input

  const household = {
    maritalStatus: settings.maritalStatus,
    dependents: settings.dependents,
  }

  if (settings.regime === 'micro_bnc' && settings.versementLiberatoire) {
    // L'activité est imposée à part ; le foyer reste imposé sur ses autres revenus.
    const incomeTax = computeIncomeTax(config, {
      activityIncome: 0,
      otherHouseholdIncome: settings.otherHouseholdIncome,
      household,
    })
    const flatTax = revenueHt * config.microBnc.versementLiberatoireRate

    return {
      incomeTax: { ...incomeTax, attributableToActivity: flatTax },
      activityTax: flatTax,
    }
  }

  const activityIncome =
    settings.regime === 'micro_bnc'
      ? microTaxableIncome(revenueHt, config.microBnc)
      : // Au réel, les cotisations sont déductibles, sauf la fraction non
        // déductible de la CSG-CRDS qu'il faut réintégrer.
        grossProfit - socialTotal + nonDeductibleCsg(csgDeductible, config)

  const incomeTax = computeIncomeTax(config, {
    activityIncome,
    otherHouseholdIncome: settings.otherHouseholdIncome,
    household,
  })

  return { incomeTax, activityTax: incomeTax.attributableToActivity }
}

/**
 * Bénéfice imposable en micro : le chiffre d'affaires diminué de l'abattement
 * forfaitaire de 34 %, qui ne peut être inférieur à 305 €.
 */
function microTaxableIncome(
  revenueHt: number,
  micro: { abattementRate: number; abattementMin: number },
): number {
  const abattement = Math.max(
    Math.min(revenueHt, micro.abattementMin),
    revenueHt * micro.abattementRate,
  )
  return Math.max(0, revenueHt - abattement)
}

/** Fraction de CSG-CRDS non déductible du revenu imposable. */
function nonDeductibleCsg(
  csgDeductible: number,
  config: ReturnType<typeof getTaxConfig>,
): number {
  if (csgDeductible <= 0) return 0
  const { rate, deductibleRate } = config.reelBnc.csgCrds
  const assiette = csgDeductible / deductibleRate
  return assiette * (rate - deductibleRate)
}

/**
 * Projection de fin d'année au rythme actuel.
 *
 * L'impôt et les cotisations n'étant pas proportionnels au revenu, la
 * projection rejoue la simulation complète sur des montants annualisés plutôt
 * que d'extrapoler le résultat obtenu sur la période.
 */
function buildProjection(input: SimulationInput): SimulationResult['projection'] {
  if (input.monthsElapsed >= 12 || input.monthsElapsed <= 0) return null

  const factor = 12 / input.monthsElapsed
  const projectedRevenue = input.revenue * factor

  const annualised = simulate({
    ...input,
    monthsElapsed: 12,
    revenue: projectedRevenue,
    expenses: {
      deductibleHt: input.expenses.deductibleHt * factor,
      deductibleVat: input.expenses.deductibleVat * factor,
      paidTtc: input.expenses.paidTtc * factor,
      byCategory: input.expenses.byCategory,
    },
  })

  return {
    revenue: projectedRevenue,
    availableIncome: annualised.availableIncome,
    monthlyDraw: annualised.recommendedAnnualDraw / 12,
  }
}
