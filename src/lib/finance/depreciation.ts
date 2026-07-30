/**
 * Amortissement des immobilisations.
 *
 * Un bien durable de plus de 500 € HT ne se déduit pas en une fois : son coût
 * est étalé sur sa durée d'usage. Chaque exercice supporte une « dotation aux
 * amortissements », déductible du bénéfice — alors que la trésorerie, elle, est
 * sortie en totalité l'année de l'achat. Les deux effets sont donc portés par
 * des exercices différents, et le simulateur les traite séparément.
 *
 * Seul l'amortissement linéaire est modélisé : c'est le mode de droit commun,
 * et le seul applicable au matériel courant d'un cabinet.
 */

/** Durées d'usage admises, par nature de bien. */
export interface AssetCategory {
  key: string
  label: string
  /** Durée d'amortissement usuelle, en années. */
  defaultDuration: number
  defaultVatRate: number
  hint?: string
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    key: 'table',
    label: 'Table de soin',
    defaultDuration: 7,
    defaultVatRate: 0.2,
    hint: 'De 5 à 10 ans selon l’usage',
  },
  {
    key: 'materiel_medical',
    label: 'Matériel médical et technique',
    defaultDuration: 5,
    defaultVatRate: 0.2,
  },
  {
    key: 'mobilier',
    label: 'Mobilier',
    defaultDuration: 10,
    defaultVatRate: 0.2,
  },
  {
    key: 'informatique',
    label: 'Matériel informatique',
    defaultDuration: 3,
    defaultVatRate: 0.2,
    hint: 'Ordinateur, tablette, imprimante',
  },
  {
    key: 'agencement',
    label: 'Agencements et installations',
    defaultDuration: 10,
    defaultVatRate: 0.2,
    hint: 'Travaux d’aménagement du cabinet',
  },
  {
    key: 'vehicule',
    label: 'Véhicule',
    defaultDuration: 5,
    defaultVatRate: 0.2,
    hint: 'Incompatible avec le barème kilométrique : au barème, la dépréciation est déjà couverte',
  },
  {
    key: 'autre_immo',
    label: 'Autre immobilisation',
    defaultDuration: 5,
    defaultVatRate: 0.2,
  },
]

export function getAssetCategory(key: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((category) => category.key === key)
}

export const ASSET_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((category) => [category.key, category.label]),
)

/** Seuil au-delà duquel un bien doit être immobilisé plutôt que passé en charge. */
export const CAPITALISATION_THRESHOLD = 500

export interface FixedAsset {
  id: string
  label: string
  category: string
  /** Date de mise en service, qui déclenche l'amortissement. */
  serviceDate: string
  /** Base amortissable, hors taxes. */
  amountHt: number
  /** TVA supportée, récupérable si le praticien est assujetti. */
  vatAmount: number
  durationYears: number
}

export interface DepreciationYear {
  year: number
  dotation: number
  /** Amortissements cumulés à la clôture de l'exercice. */
  accumulated: number
  /** Valeur nette comptable à la clôture. */
  residual: number
}

/**
 * Plan d'amortissement complet, année par année.
 *
 * Le premier exercice est réduit au prorata temporis, décompté depuis la mise
 * en service selon la convention de l'année commerciale : douze mois de trente
 * jours, soit trois cent soixante jours. Le reliquat tombe sur un exercice
 * supplémentaire en fin de plan, ce qui est la conséquence normale d'un
 * démarrage en cours d'année.
 */
export function buildDepreciationSchedule(asset: FixedAsset): DepreciationYear[] {
  const base = Math.max(0, asset.amountHt)
  const duration = Math.max(1, Math.round(asset.durationYears))
  if (base === 0) return []

  const start = new Date(asset.serviceDate)
  if (Number.isNaN(start.getTime())) return []

  const annuity = base / duration
  const firstYearRatio = remainingYearFraction(start)

  const schedule: DepreciationYear[] = []
  let remaining = base
  let accumulated = 0
  let year = start.getFullYear()
  let dotation = Math.min(annuity * firstYearRatio, remaining)

  // Un centime résiduel ne justifie pas un exercice de plus.
  while (remaining > 0.005) {
    accumulated += dotation
    remaining -= dotation
    schedule.push({
      year,
      dotation,
      accumulated,
      residual: Math.max(0, remaining),
    })
    year += 1
    dotation = Math.min(annuity, remaining)
  }

  return schedule
}

/**
 * Fraction de l'exercice restant à courir depuis la mise en service, selon la
 * convention de l'année commerciale (mois de trente jours).
 */
function remainingYearFraction(serviceDate: Date): number {
  const month = serviceDate.getMonth() + 1
  const day = Math.min(serviceDate.getDate(), 30)
  const elapsedDays = (month - 1) * 30 + (day - 1)
  return Math.min(1, Math.max(0, (360 - elapsedDays) / 360))
}

export interface AssetDepreciationLine {
  assetId: string
  label: string
  category: string
  amountHt: number
  durationYears: number
  serviceDate: string
  /** Dotation de l'exercice demandé. */
  dotation: number
  accumulated: number
  residual: number
  /** Vrai si l'exercice demandé est celui de la mise en service. */
  isFirstYear: boolean
  /** Vrai si le bien achève son amortissement sur cet exercice. */
  isFinalYear: boolean
}

export interface DepreciationResult {
  lines: AssetDepreciationLine[]
  /** Dotation totale de l'exercice, déductible du bénéfice. */
  totalDotation: number
  /** Décaissements d'acquisition de l'exercice, toutes taxes comprises. */
  totalPurchasesTtc: number
  /** TVA supportée sur les acquisitions de l'exercice. */
  purchasesVat: number
  /** Valeur nette comptable totale à la clôture. */
  totalResidual: number
}

/** Dotations, acquisitions et valeurs résiduelles pour un exercice donné. */
export function computeDepreciation(
  assets: FixedAsset[],
  year: number,
): DepreciationResult {
  const lines: AssetDepreciationLine[] = []
  let totalDotation = 0
  let totalPurchasesTtc = 0
  let purchasesVat = 0
  let totalResidual = 0

  for (const asset of assets) {
    const schedule = buildDepreciationSchedule(asset)
    if (schedule.length === 0) continue

    const acquisitionYear = new Date(asset.serviceDate).getFullYear()
    if (acquisitionYear === year) {
      totalPurchasesTtc += asset.amountHt + asset.vatAmount
      purchasesVat += asset.vatAmount
    }

    const entry = schedule.find((row) => row.year === year)
    // Bien déjà totalement amorti, ou pas encore mis en service.
    if (!entry) {
      const last = schedule[schedule.length - 1]
      if (year > last.year) totalResidual += 0
      continue
    }

    totalDotation += entry.dotation
    totalResidual += entry.residual

    lines.push({
      assetId: asset.id,
      label: asset.label,
      category: asset.category,
      amountHt: asset.amountHt,
      durationYears: asset.durationYears,
      serviceDate: asset.serviceDate,
      dotation: entry.dotation,
      accumulated: entry.accumulated,
      residual: entry.residual,
      isFirstYear: acquisitionYear === year,
      isFinalYear: entry.year === schedule[schedule.length - 1].year,
    })
  }

  lines.sort((a, b) => b.dotation - a.dotation)

  return { lines, totalDotation, totalPurchasesTtc, purchasesVat, totalResidual }
}
