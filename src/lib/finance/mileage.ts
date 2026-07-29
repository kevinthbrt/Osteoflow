import type { MileageScale, TaxYearConfig, VehicleKind } from './tax-config'

export interface MileageInput {
  kind: VehicleKind
  /** Puissance fiscale (champ P.6 de la carte grise). */
  horsepower: number
  /** Kilomètres professionnels parcourus dans l'année. */
  annualKm: number
  electric: boolean
}

export interface MileageResult {
  allowance: number
  /** Coût moyen au kilomètre, une fois la majoration appliquée. */
  effectivePerKm: number
  /** Libellé de la formule appliquée, pour justifier le montant. */
  formula: string
  electricBonus: number
}

/** Barème correspondant à la puissance fiscale du véhicule. */
function selectScale(scales: MileageScale[], horsepower: number): MileageScale {
  return (
    scales.find((scale) => scale.upToHp !== null && horsepower <= scale.upToHp) ??
    scales[scales.length - 1]
  )
}

/**
 * Frais de véhicule évalués au barème kilométrique.
 *
 * Le barème est forfaitaire et non marginal : la tranche est déterminée par la
 * distance annuelle totale, puis sa formule s'applique à l'intégralité des
 * kilomètres. Il couvre déjà le carburant, l'entretien, l'assurance, la
 * dépréciation et les pneumatiques — ces dépenses ne peuvent donc pas être
 * déduites en plus. Restent déductibles séparément : péages, stationnement et
 * intérêts d'emprunt du véhicule.
 */
export function computeMileageAllowance(
  config: TaxYearConfig,
  input: MileageInput,
): MileageResult {
  const km = Math.max(0, input.annualKm)
  if (km === 0) {
    return { allowance: 0, effectivePerKm: 0, formula: '—', electricBonus: 0 }
  }

  const scale = selectScale(config.mileage[input.kind], Math.max(1, input.horsepower))

  const band =
    scale.bands.find((candidate) => candidate.upToKm !== null && km <= candidate.upToKm) ??
    scale.bands[scale.bands.length - 1]

  const base = km * band.perKm + band.flat
  const electricBonus = input.electric ? base * config.mileage.electricBonus : 0

  const flatPart = band.flat > 0 ? ` + ${band.flat}` : ''
  return {
    allowance: base + electricBonus,
    effectivePerKm: (base + electricBonus) / km,
    formula: `${km.toLocaleString('fr-FR')} km × ${band.perKm}${flatPart}${
      input.electric ? ' , majoré de 20 % (électrique)' : ''
    }`,
    electricBonus,
  }
}
