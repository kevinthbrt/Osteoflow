import type { TaxYearConfig } from './tax-config'
import type { FiscalRegime } from './types'

export interface OptionalContributionsInput {
  regime: FiscalRegime
  /** Bénéfice imposable avant déduction des cotisations facultatives. */
  taxableProfit: number
  /** Versements annuels sur un contrat retraite Madelin ou un PER. */
  retirement: number
  /** Cotisations de prévoyance et de complémentaire santé Madelin. */
  prevoyance: number
}

export interface OptionalContributionLine {
  key: 'retirement' | 'prevoyance'
  label: string
  paid: number
  ceiling: number
  deducted: number
  /** Fraction versée au-delà du plafond, donc non déductible. */
  excess: number
}

export interface OptionalContributionsResult {
  lines: OptionalContributionLine[]
  /** Total déductible du bénéfice imposable. */
  totalDeducted: number
  totalPaid: number
  totalExcess: number
}

/**
 * Plafond de déduction des versements retraite (Madelin ou PER).
 *
 * 10 % du bénéfice retenu dans la limite de 8 Pass, majorés de 15 % de la
 * fraction de ce bénéfice comprise entre 1 et 8 Pass, sans pouvoir être
 * inférieur à 10 % du Pass.
 */
function retirementCeiling(config: TaxYearConfig, profit: number): number {
  const { pass, optionalContributions } = config
  const { baseRate, surplusRate, incomeCapPass, floorPass } =
    optionalContributions.retirement

  const cappedProfit = Math.min(Math.max(0, profit), incomeCapPass * pass)
  const surplusBase = Math.max(0, cappedProfit - pass)

  const ceiling = cappedProfit * baseRate + surplusBase * surplusRate
  return Math.max(ceiling, pass * floorPass)
}

/**
 * Plafond de déduction des cotisations de prévoyance et de santé.
 *
 * 3,75 % du bénéfice majorés de 7 % du Pass, le tout plafonné à 3 % de 8 Pass.
 */
function prevoyanceCeiling(config: TaxYearConfig, profit: number): number {
  const { pass, optionalContributions } = config
  const { baseRate, passRate, capPass } = optionalContributions.prevoyance

  const ceiling = Math.max(0, profit) * baseRate + pass * passRate
  return Math.min(ceiling, pass * capPass)
}

/**
 * Cotisations facultatives déductibles.
 *
 * Deux points souvent mal compris, et traités ici explicitement :
 *
 * 1. Ces versements réduisent le bénéfice IMPOSABLE, mais pas l'assiette
 *    sociale. Le revenu brut social se calcule hors cotisations sociales
 *    obligatoires et CSG déductible uniquement ; les cotisations facultatives
 *    y restent réintégrées. Elles allègent donc l'impôt, jamais l'Urssaf.
 *
 * 2. En micro-BNC, l'abattement forfaitaire de 34 % est réputé couvrir toutes
 *    les charges : rien ne se déduit du bénéfice professionnel. Seuls les
 *    versements retraite restent déductibles, au niveau du revenu global du
 *    foyer et non du BNC — d'où l'absence de volet prévoyance dans ce régime.
 */
export function computeOptionalContributions(
  config: TaxYearConfig,
  input: OptionalContributionsInput,
): OptionalContributionsResult {
  const profit = Math.max(0, input.taxableProfit)
  const lines: OptionalContributionLine[] = []

  const retirementPaid = Math.max(0, input.retirement)
  const retirementCap = retirementCeiling(config, profit)
  lines.push({
    key: 'retirement',
    label: 'Retraite (Madelin ou PER)',
    paid: retirementPaid,
    ceiling: retirementCap,
    deducted: Math.min(retirementPaid, retirementCap),
    excess: Math.max(0, retirementPaid - retirementCap),
  })

  if (input.regime === 'reel_bnc') {
    const prevoyancePaid = Math.max(0, input.prevoyance)
    const prevoyanceCap = prevoyanceCeiling(config, profit)
    lines.push({
      key: 'prevoyance',
      label: 'Prévoyance et santé (Madelin)',
      paid: prevoyancePaid,
      ceiling: prevoyanceCap,
      deducted: Math.min(prevoyancePaid, prevoyanceCap),
      excess: Math.max(0, prevoyancePaid - prevoyanceCap),
    })
  }

  return {
    lines,
    totalDeducted: lines.reduce((sum, line) => sum + line.deducted, 0),
    totalPaid: lines.reduce((sum, line) => sum + line.paid, 0),
    totalExcess: lines.reduce((sum, line) => sum + line.excess, 0),
  }
}
