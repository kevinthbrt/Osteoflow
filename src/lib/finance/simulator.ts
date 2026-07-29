import { getTaxConfig, hasTaxConfig } from './tax-config'
import { computeVat } from './vat'
import { computeSocialCharges } from './social'
import { computeIncomeTax } from './income-tax'
import { computeMileageAllowance } from './mileage'
import { computeOptionalContributions } from './optional-contributions'
import type {
  IncomeTaxResult,
  MileageSummary,
  OptionalContributionsSummary,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from './types'

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
 *     − frais de véhicule
 *     − cotisations facultatives
 *     − cotisations sociales
 *     − impôt sur le revenu   (surcoût réel généré par l'activité)
 *     = disponible
 *
 * Le résultat est une estimation destinée à provisionner : il ne remplace pas
 * une déclaration, et ignore notamment les crédits et réductions d'impôt, les
 * déficits reportables, les amortissements et les revenus de capitaux du foyer.
 */
export function simulate(input: SimulationInput): SimulationResult {
  const config = getTaxConfig(input.year)
  const { settings, revenue, expenses } = input
  const warnings: SimulationWarning[] = []

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
  const recordedExpenses =
    settings.vatRegime === 'assujetti'
      ? expenses.deductibleHt
      : expenses.deductibleHt + expenses.deductibleVat

  const mileage = buildMileage(config, input, warnings, expenses.byCategory)
  const mileageAllowance = mileage?.allowance ?? 0

  const deductibleExpenses = recordedExpenses + mileageAllowance
  const grossProfit = revenueHt - deductibleExpenses

  const social = computeSocialCharges(config, {
    regime: settings.regime,
    retirementFund: settings.retirementFund,
    acre: settings.acre,
    // Les cotisations facultatives ne réduisent PAS l'assiette sociale :
    // elles sont réintégrées au revenu brut social.
    base: settings.regime === 'micro_bnc' ? revenueHt : grossProfit,
  })

  const { incomeTax, activityTax, optionalContributions } = computeActivityTax({
    input,
    revenueHt,
    grossProfit,
    socialTotal: social.total,
    csgDeductible: social.csgDeductible,
    warnings,
  })

  // Vue trésorerie : ce qui entre, moins tout ce qui doit ressortir. Les frais
  // de véhicule au barème remplacent les dépenses réelles non saisies (essence,
  // entretien, assurance) : les compter en sortie garde la trésorerie honnête.
  const optionalPaid = optionalContributions?.totalPaid ?? 0
  const availableIncome =
    revenue -
    vat.due -
    expenses.paidTtc -
    mileageAllowance -
    optionalPaid -
    social.total -
    activityTax

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

  if (settings.regime === 'reel_bnc' && recordedExpenses === 0) {
    warnings.push({
      key: 'no_expenses',
      severity: 'warning',
      message:
        'Aucune charge saisie en déclaration contrôlée : le bénéfice est surévalué, donc les cotisations et l’impôt aussi.',
    })
  }

  return {
    year: input.year,
    usesFallbackScales: !hasTaxConfig(input.year),
    scalesVerifiedOn: config.verifiedOn,

    vat,
    revenueHt,
    deductibleExpenses,
    mileage,
    grossProfit,
    optionalContributions,
    warnings,
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
 * Frais de véhicule au barème kilométrique.
 *
 * Le barème couvrant déjà carburant, entretien, assurance et dépréciation, les
 * saisir en plus revient à les déduire deux fois : on le signale plutôt que de
 * corriger silencieusement une saisie que le praticien devra justifier.
 */
function buildMileage(
  config: ReturnType<typeof getTaxConfig>,
  input: SimulationInput,
  warnings: SimulationWarning[],
  byCategory: Record<string, number>,
): MileageSummary | null {
  const { vehicle, regime } = input.settings
  if (vehicle.mode !== 'mileage' || vehicle.annualKm <= 0) return null

  if (regime === 'micro_bnc') {
    warnings.push({
      key: 'mileage_micro',
      severity: 'info',
      message:
        'En micro-BNC, l’abattement forfaitaire de 34 % couvre déjà vos frais : le barème kilométrique ne se déduit pas en plus.',
    })
    return null
  }

  const result = computeMileageAllowance(config, {
    kind: vehicle.kind,
    horsepower: vehicle.horsepower,
    annualKm: vehicle.annualKm,
    electric: vehicle.electric,
  })

  if ((byCategory['vehicule'] ?? 0) > 0) {
    warnings.push({
      key: 'mileage_double_count',
      severity: 'warning',
      message:
        'Vous cumulez le barème kilométrique et des charges « Véhicule et déplacements ». Le barème couvre déjà carburant, entretien, assurance et dépréciation : seuls péages, stationnement et intérêts d’emprunt se déduisent en plus.',
    })
  }

  return {
    allowance: result.allowance,
    effectivePerKm: result.effectivePerKm,
    formula: result.formula,
    annualKm: vehicle.annualKm,
  }
}

/**
 * Impôt généré par l'activité, et effet des cotisations facultatives.
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
  warnings: SimulationWarning[]
}): {
  incomeTax: IncomeTaxResult
  activityTax: number
  optionalContributions: OptionalContributionsSummary | null
} {
  const { input, revenueHt, grossProfit, socialTotal, csgDeductible, warnings } = args
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

    if (settings.optionalRetirement > 0) {
      warnings.push({
        key: 'optional_with_vfl',
        severity: 'info',
        message:
          'Sous versement libératoire, vos versements retraite ne procurent aucune économie d’impôt sur l’activité : celle-ci est déjà imposée forfaitairement.',
      })
    }

    return {
      incomeTax: { ...incomeTax, attributableToActivity: flatTax },
      activityTax: flatTax,
      optionalContributions: null,
    }
  }

  const profitBeforeOptional =
    settings.regime === 'micro_bnc'
      ? microTaxableIncome(revenueHt, config.microBnc)
      : // Au réel, les cotisations sont déductibles, sauf la fraction non
        // déductible de la CSG-CRDS qu'il faut réintégrer.
        grossProfit - socialTotal + nonDeductibleCsg(csgDeductible, config)

  const optional = computeOptionalContributions(config, {
    regime: settings.regime,
    taxableProfit: profitBeforeOptional,
    retirement: settings.optionalRetirement,
    prevoyance: settings.optionalPrevoyance,
  })

  if (settings.regime === 'micro_bnc' && settings.optionalPrevoyance > 0) {
    warnings.push({
      key: 'prevoyance_micro',
      severity: 'info',
      message:
        'En micro-BNC, la prévoyance Madelin n’est pas déductible : l’abattement de 34 % est réputé couvrir toutes vos charges.',
    })
  }

  if (optional.totalExcess > 0) {
    warnings.push({
      key: 'optional_excess',
      severity: 'warning',
      message:
        'Une partie de vos versements dépasse le plafond de déduction : cet excédent ne réduit pas votre impôt.',
    })
  }

  const incomeTax = computeIncomeTax(config, {
    activityIncome: profitBeforeOptional - optional.totalDeducted,
    otherHouseholdIncome: settings.otherHouseholdIncome,
    household,
  })

  // Économie réelle : l'impôt qu'on aurait payé sans ces versements, moins celui
  // effectivement dû. Cela capture l'effet de tranche, qu'un simple taux marginal
  // approximerait mal quand la déduction fait changer de tranche.
  const withoutOptional =
    optional.totalDeducted > 0
      ? computeIncomeTax(config, {
          activityIncome: profitBeforeOptional,
          otherHouseholdIncome: settings.otherHouseholdIncome,
          household,
        })
      : incomeTax

  return {
    incomeTax,
    activityTax: incomeTax.attributableToActivity,
    optionalContributions: {
      lines: optional.lines,
      totalPaid: optional.totalPaid,
      totalDeducted: optional.totalDeducted,
      totalExcess: optional.totalExcess,
      taxSaving: Math.max(
        0,
        withoutOptional.attributableToActivity - incomeTax.attributableToActivity,
      ),
    },
  }
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
 * que d'extrapoler le résultat obtenu sur la période. Les frais de véhicule et
 * les cotisations facultatives sont eux déjà annuels : ils ne sont pas mis à
 * l'échelle.
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
