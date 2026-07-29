import type { TaxYearConfig } from './tax-config'
import type { IncomeTaxResult, MaritalStatus } from './types'

export interface HouseholdInput {
  maritalStatus: MaritalStatus
  dependents: number
}

/**
 * Nombre de parts du foyer fiscal.
 *
 * Chacun des deux premiers enfants ouvre une demi-part, chaque enfant à partir
 * du troisième ouvre une part entière. Le parent isolé bénéficie d'une part
 * entière — et non d'une demi-part — au titre du premier enfant.
 */
export function computeParts(household: HouseholdInput): number {
  const base = household.maritalStatus === 'couple' ? 2 : 1
  const children = Math.max(0, household.dependents)

  let extra = 0
  for (let rank = 1; rank <= children; rank++) {
    extra += rank <= 2 ? 0.5 : 1
  }

  // Majoration du parent isolé : le premier enfant compte pour une part entière.
  if (household.maritalStatus === 'single_parent' && children > 0) {
    extra += 0.5
  }

  return base + extra
}

/** Impôt brut résultant du barème progressif, pour un revenu donné par part. */
function applyScale(config: TaxYearConfig, incomePerPart: number): number {
  if (incomePerPart <= 0) return 0

  let tax = 0
  let floor = 0

  for (const bracket of config.incomeTax.brackets) {
    const ceiling = bracket.upTo ?? Infinity
    const slice = Math.max(0, Math.min(incomePerPart, ceiling) - floor)
    tax += slice * bracket.rate
    if (incomePerPart <= ceiling) break
    floor = ceiling
  }

  return tax
}

/** Taux marginal d'imposition applicable au revenu par part. */
function marginalRate(config: TaxYearConfig, incomePerPart: number): number {
  let rate = 0
  for (const bracket of config.incomeTax.brackets) {
    rate = bracket.rate
    if (bracket.upTo === null || incomePerPart <= bracket.upTo) break
  }
  return rate
}

/**
 * Avantage fiscal maximal procuré par les parts additionnelles.
 *
 * Le plafonnement du quotient familial limite la réduction d'impôt obtenue
 * grâce aux personnes à charge. Le parent isolé dispose d'un plafond spécifique,
 * plus élevé, pour la part entière attachée à son premier enfant.
 */
function maxQuotientAdvantage(
  config: TaxYearConfig,
  household: HouseholdInput,
  parts: number,
  baseParts: number,
): number {
  const { halfPartCap, singleParentFirstChildCap } = config.incomeTax

  if (household.maritalStatus === 'single_parent' && household.dependents > 0) {
    // La part entière du premier enfant relève de son propre plafond ; les
    // demi-parts restantes retombent sur le plafond de droit commun.
    const remainingHalfParts = (parts - baseParts - 1) / 0.5
    return singleParentFirstChildCap + Math.max(0, remainingHalfParts) * halfPartCap
  }

  const halfParts = (parts - baseParts) / 0.5
  return Math.max(0, halfParts) * halfPartCap
}

/** Décote applicable aux impôts modestes. */
function computeDecote(
  config: TaxYearConfig,
  tax: number,
  maritalStatus: MaritalStatus,
): number {
  const { decote } = config.incomeTax
  const isCouple = maritalStatus === 'couple'
  const threshold = isCouple ? decote.coupleThreshold : decote.singleThreshold

  if (tax >= threshold) return 0

  const base = isCouple ? decote.coupleBase : decote.singleBase
  return Math.min(tax, Math.max(0, base - tax * decote.rate))
}

/** Impôt dû par le foyer, plafonnement du quotient familial et décote inclus. */
function computeHouseholdTax(
  config: TaxYearConfig,
  taxableIncome: number,
  household: HouseholdInput,
): { total: number; grossTax: number; cappedTax: number; decote: number; parts: number } {
  const parts = computeParts(household)
  const baseParts = household.maritalStatus === 'couple' ? 2 : 1
  const income = Math.max(0, taxableIncome)

  const grossTax = applyScale(config, income / parts) * parts
  const taxWithoutDependents = applyScale(config, income / baseParts) * baseParts

  const advantage = taxWithoutDependents - grossTax
  const cap = maxQuotientAdvantage(config, household, parts, baseParts)
  const cappedTax = taxWithoutDependents - Math.min(advantage, cap)

  const decote = computeDecote(config, cappedTax, household.maritalStatus)

  return {
    total: Math.max(0, cappedTax - decote),
    grossTax,
    cappedTax,
    decote,
    parts,
  }
}

export interface IncomeTaxInput {
  /** Bénéfice imposable de l'activité libérale. */
  activityIncome: number
  /** Autres revenus nets imposables du foyer. */
  otherHouseholdIncome: number
  household: HouseholdInput
}

/**
 * Impôt sur le revenu du foyer, et part imputable à l'activité libérale.
 *
 * La part attribuable à l'activité est calculée par différence : impôt du foyer
 * avec l'activité, moins impôt du foyer sans elle. C'est le surcoût réel que
 * l'activité génère, donc le montant à provisionner — et non une répartition au
 * prorata, qui sous-estimerait l'impôt dès que le foyer a d'autres revenus.
 */
export function computeIncomeTax(
  config: TaxYearConfig,
  input: IncomeTaxInput,
): IncomeTaxResult {
  const other = Math.max(0, input.otherHouseholdIncome)
  const activity = Math.max(0, input.activityIncome)
  const taxableIncome = other + activity

  const withActivity = computeHouseholdTax(config, taxableIncome, input.household)
  const withoutActivity = computeHouseholdTax(config, other, input.household)

  return {
    taxableIncome,
    parts: withActivity.parts,
    grossTax: withActivity.grossTax,
    cappedTax: withActivity.cappedTax,
    decote: withActivity.decote,
    total: withActivity.total,
    attributableToActivity: Math.max(0, withActivity.total - withoutActivity.total),
    averageRate: taxableIncome > 0 ? withActivity.total / taxableIncome : 0,
    marginalRate: marginalRate(config, taxableIncome / withActivity.parts),
  }
}
