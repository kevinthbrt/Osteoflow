import type { MarginalBracket, RampScale, TaxYearConfig } from './tax-config'
import type {
  FiscalRegime,
  RetirementFund,
  SocialContributionLine,
  SocialResult,
} from './types'

/**
 * Cotise sur un barème marginal : chaque tranche ne porte que sur la fraction
 * de l'assiette qu'elle couvre.
 */
function applyMarginalBrackets(
  base: number,
  brackets: MarginalBracket[],
  pass: number,
): number {
  let total = 0
  let floor = 0

  for (const bracket of brackets) {
    const ceiling = bracket.upToPass === null ? Infinity : bracket.upToPass * pass
    const slice = Math.max(0, Math.min(base, ceiling) - floor)
    if (slice === 0 && base <= floor) break
    total += slice * bracket.rate
    floor = ceiling
  }

  return total
}

/**
 * Cotise sur un barème progressif Urssaf : le niveau de revenu détermine un
 * taux unique, obtenu par interpolation linéaire dans le segment courant, qui
 * s'applique ensuite à la totalité de l'assiette.
 */
function rampRate(base: number, scale: RampScale, pass: number): number {
  let floor = 0

  for (const segment of scale.segments) {
    const ceiling = segment.upToPass === null ? Infinity : segment.upToPass * pass

    if (base <= ceiling) {
      if (ceiling === Infinity || ceiling === floor) return segment.rateTo
      const progress = (base - floor) / (ceiling - floor)
      return segment.rateFrom + (segment.rateTo - segment.rateFrom) * progress
    }

    floor = ceiling
  }

  return scale.segments[scale.segments.length - 1]?.rateTo ?? 0
}

function applyRampScale(base: number, scale: RampScale, pass: number): number {
  if (base <= 0) return 0

  if (scale.excess) {
    // Au-delà du seuil, la part excédentaire bascule sur un taux fixe.
    const threshold = scale.excess.abovePass * pass
    const capped = Math.min(base, threshold)
    const excess = Math.max(0, base - threshold)
    return capped * rampRate(capped, scale, pass) + excess * scale.excess.rate
  }

  return base * rampRate(base, scale, pass)
}

export interface SocialInput {
  regime: FiscalRegime
  retirementFund: RetirementFund
  acre: boolean
  /**
   * Régime micro : chiffre d'affaires hors taxes encaissé.
   * Régime réel : bénéfice avant cotisations (recettes − charges déductibles,
   * cotisations sociales exclues).
   */
  base: number
}

/**
 * Cotisations sociales de la période.
 *
 * En micro, tout est proportionnel au chiffre d'affaires : un taux global qui
 * couvre l'ensemble des risques, plus la contribution formation.
 *
 * Au réel, le calcul suit l'assiette unique issue de la réforme applicable en
 * 2026 : le revenu professionnel subit un abattement de 26 % (lui-même encadré
 * par un plancher et un plafond), et les cotisations comme la CSG-CRDS portent
 * sur ce même montant.
 */
export function computeSocialCharges(
  config: TaxYearConfig,
  input: SocialInput,
): SocialResult {
  return input.regime === 'micro_bnc'
    ? computeMicroSocial(config, input)
    : computeReelSocial(config, input)
}

function computeMicroSocial(
  config: TaxYearConfig,
  input: SocialInput,
): SocialResult {
  const { microBnc } = config
  const revenue = Math.max(0, input.base)

  const rate =
    input.retirementFund === 'cipav'
      ? microBnc.socialRateCipav
      : microBnc.socialRateSsi

  const grossContributions = revenue * rate
  const acreReduction = input.acre ? grossContributions * microBnc.acreRate : 0
  const contributions = grossContributions - acreReduction
  const cfp = revenue * microBnc.cfpRate

  const lines: SocialContributionLine[] = [
    {
      key: 'micro_social',
      label: 'Cotisations sociales',
      amount: contributions,
      detail: `${(rate * 100).toFixed(1)} % du CA${input.acre ? ' — Acre : −50 %' : ''}`,
    },
    {
      key: 'cfp',
      label: 'Formation professionnelle',
      amount: cfp,
      detail: `${(microBnc.cfpRate * 100).toFixed(1)} % du CA`,
    },
  ]

  return {
    assiette: revenue,
    lines,
    total: contributions + cfp,
    // En micro, la CSG est incluse dans le taux global et n'est pas déductible
    // du revenu imposable : l'abattement forfaitaire de 34 % couvre déjà tout.
    csgDeductible: 0,
    acreReduction,
  }
}

function computeReelSocial(
  config: TaxYearConfig,
  input: SocialInput,
): SocialResult {
  const { pass, smicHourly, reelBnc } = config
  const profit = Math.max(0, input.base)

  // Assiette unique : abattement de 26 %, plancher 1,76 % du Pass,
  // plafond 130 % du Pass.
  const rawAbattement = profit * reelBnc.assiette.abattementRate
  const abattement = Math.min(
    Math.max(rawAbattement, reelBnc.assiette.abattementFloorPass * pass),
    reelBnc.assiette.abattementCapPass * pass,
  )
  const assiette = Math.max(0, profit - abattement)

  // Assiettes minimales : certaines cotisations sont dues même à revenu faible.
  const ijBase = Math.max(assiette, reelBnc.indemnitesJournalieres.minBasePass * pass)
  const retraiteBase = Math.max(
    assiette,
    reelBnc.retraiteBase.minBaseSmicHours * smicHourly,
  )
  const invaliditeBase = Math.max(assiette, reelBnc.invaliditeDeces.minBasePass * pass)

  const maladie = applyRampScale(assiette, reelBnc.maladie, pass)
  const ij = applyMarginalBrackets(
    ijBase,
    reelBnc.indemnitesJournalieres.brackets,
    pass,
  )
  const retraite = applyMarginalBrackets(
    retraiteBase,
    reelBnc.retraiteBase.brackets,
    pass,
  )
  const retraiteComp = applyMarginalBrackets(
    assiette,
    reelBnc.retraiteComplementaire.brackets,
    pass,
  )
  const invalidite = applyMarginalBrackets(
    invaliditeBase,
    reelBnc.invaliditeDeces.brackets,
    pass,
  )
  const allocations = applyRampScale(assiette, reelBnc.allocationsFamiliales, pass)
  const csgCrds = assiette * reelBnc.csgCrds.rate
  const cfp = pass * reelBnc.cfpRatePass

  // L'Acre exonère un quart des cotisations de base la première année, de façon
  // dégressive entre 75 % et 100 % du Pass, nulle au-delà.
  const acreRate = input.acre ? acreExoneration(config, assiette) : 0
  const acreEligible = maladie + ij + allocations + retraite + invalidite
  const acreReduction = acreEligible * acreRate

  const lines: SocialContributionLine[] = [
    {
      key: 'maladie',
      label: 'Maladie-maternité',
      amount: maladie,
      detail: `${(rampRate(Math.min(assiette, 3 * pass), reelBnc.maladie, pass) * 100).toFixed(2)} % de l'assiette`,
    },
    {
      key: 'indemnites_journalieres',
      label: 'Indemnités journalières',
      amount: ij,
      detail: '0,50 % dans la limite de 5 Pass',
    },
    {
      key: 'retraite_base',
      label: 'Retraite de base',
      amount: retraite,
      detail: '17,87 % jusqu’à 1 Pass, puis 0,72 %',
    },
    {
      key: 'retraite_complementaire',
      label: 'Retraite complémentaire',
      amount: retraiteComp,
      detail: '8,10 % jusqu’à 1 Pass, puis 9,10 % jusqu’à 4 Pass',
    },
    {
      key: 'invalidite_deces',
      label: 'Invalidité-décès',
      amount: invalidite,
      detail: '1,30 % dans la limite de 1 Pass',
    },
    {
      key: 'allocations_familiales',
      label: 'Allocations familiales',
      amount: allocations,
      detail: `${(rampRate(assiette, reelBnc.allocationsFamiliales, pass) * 100).toFixed(2)} % de l'assiette`,
    },
    {
      key: 'csg_crds',
      label: 'CSG-CRDS',
      amount: csgCrds,
      detail: '9,70 % de l’assiette',
    },
    {
      key: 'cfp',
      label: 'Formation professionnelle',
      amount: cfp,
      detail: '0,25 % du Pass',
    },
  ]

  if (acreReduction > 0) {
    lines.push({
      key: 'acre',
      label: 'Exonération Acre',
      amount: -acreReduction,
      detail: `−${(acreRate * 100).toFixed(0)} % sur les cotisations de base`,
    })
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0)

  return {
    assiette,
    lines,
    total,
    csgDeductible: assiette * reelBnc.csgCrds.deductibleRate,
    acreReduction,
  }
}

/** Taux d'exonération Acre applicable, dégressif entre 75 % et 100 % du Pass. */
function acreExoneration(config: TaxYearConfig, assiette: number): number {
  const { pass, reelBnc } = config
  const full = reelBnc.acre.fullBelowPass * pass
  const zero = reelBnc.acre.zeroAbovePass * pass

  if (assiette <= full) return reelBnc.acre.rate
  if (assiette >= zero) return 0

  // Dégressivité linéaire entre les deux seuils.
  return reelBnc.acre.rate * ((zero - assiette) / (zero - full))
}
