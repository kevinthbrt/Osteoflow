import type { VehicleKind } from './tax-config'

export type { VehicleKind }

/** Régime fiscal du praticien. */
export type FiscalRegime = 'micro_bnc' | 'reel_bnc'

/**
 * Caisse de retraite. Les ostéopathes installés avant 2019 sont restés à la
 * Cipav ; ceux installés depuis relèvent du régime général des indépendants.
 */
export type RetirementFund = 'ssi' | 'cipav'

/**
 * Régime de TVA.
 *
 * - `exonere` : actes de soins exonérés au titre de l'art. 261-4-1° du CGI.
 *   C'est le cas des ostéopathes titulaires du titre, pour leurs actes à
 *   finalité thérapeutique — quel que soit leur chiffre d'affaires.
 * - `franchise` : praticien dans le champ de la TVA mais sous les seuils de
 *   franchise en base. Cas des étiopathes, naturopathes et autres praticiens
 *   non réglementés qui n'ont pas encore dépassé les seuils.
 * - `assujetti` : TVA collectée sur les prestations, TVA déductible sur les
 *   charges, solde à reverser.
 */
export type VatRegime = 'exonere' | 'franchise' | 'assujetti'

/** Situation de famille, pour le calcul du quotient familial. */
export type MaritalStatus = 'single' | 'couple' | 'single_parent'

export interface FinanceSettings {
  regime: FiscalRegime
  retirementFund: RetirementFund
  vatRegime: VatRegime
  vatRate: number
  /** Option pour le versement fiscal libératoire (micro uniquement). */
  versementLiberatoire: boolean
  /** Bénéficiaire de l'Acre (1re année d'activité). */
  acre: boolean
  maritalStatus: MaritalStatus
  /** Nombre d'enfants à charge. */
  dependents: number
  /** Revenus nets imposables du foyer autres que l'activité (salaires du conjoint…). */
  otherHouseholdIncome: number
  /** Marge de sécurité appliquée aux provisions, en %. */
  safetyMarginRate: number
  /** Rémunération nette mensuelle visée, pour le suivi d'objectif. */
  targetMonthlyDraw: number | null
  vehicle: VehicleSettings
  /** Versements annuels retraite Madelin ou PER. */
  optionalRetirement: number
  /** Cotisations annuelles de prévoyance et santé Madelin. */
  optionalPrevoyance: number
}

/**
 * Traitement des frais de véhicule.
 *
 * Le choix est exclusif et vaut pour l'année entière et tous les véhicules :
 * soit le barème kilométrique, soit les frais réels, jamais les deux.
 */
export type VehicleMode = 'none' | 'mileage' | 'actual'

export interface VehicleSettings {
  mode: VehicleMode
  kind: VehicleKind
  /** Puissance fiscale, champ P.6 de la carte grise. */
  horsepower: number
  annualKm: number
  electric: boolean
}

export const DEFAULT_VEHICLE_SETTINGS: VehicleSettings = {
  mode: 'none',
  kind: 'car',
  horsepower: 5,
  annualKm: 0,
  electric: false,
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  regime: 'micro_bnc',
  retirementFund: 'ssi',
  vatRegime: 'exonere',
  vatRate: 0.2,
  versementLiberatoire: false,
  acre: false,
  maritalStatus: 'single',
  dependents: 0,
  otherHouseholdIncome: 0,
  safetyMarginRate: 0.05,
  targetMonthlyDraw: null,
  vehicle: DEFAULT_VEHICLE_SETTINGS,
  optionalRetirement: 0,
  optionalPrevoyance: 0,
}

/** Une ligne de charge professionnelle. */
export interface Expense {
  id: string
  date: string
  label: string
  category: string
  /** Montant hors taxes. */
  amountHt: number
  /** Taux de TVA appliqué (0 si non soumis). */
  vatRate: number
  /** TVA supportée sur la charge. */
  vatAmount: number
  /** Montant toutes taxes comprises. */
  amountTtc: number
  /**
   * Quote-part professionnelle déductible, en % : 100 pour une charge
   * intégralement professionnelle, moins pour un usage mixte (téléphone,
   * véhicule, local à domicile…).
   */
  deductibleShare: number
  recurrence: ExpenseRecurrence
  paymentMethod: string | null
  notes: string | null
}

export type ExpenseRecurrence = 'once' | 'monthly' | 'quarterly' | 'yearly'

export interface VatResult {
  regime: VatRegime
  /** TVA collectée sur les recettes. */
  collected: number
  /** TVA déductible sur les charges. */
  deductible: number
  /** Solde à reverser au Trésor (jamais négatif ici : un crédit est reporté). */
  due: number
  /** Crédit de TVA reportable, le cas échéant. */
  credit: number
  /** Recettes hors taxes, seule base pertinente pour le résultat. */
  revenueExcludingVat: number
  /** Alerte de franchissement des seuils de franchise en base. */
  franchiseWarning: 'none' | 'approaching' | 'exceeded' | 'tolerance_exceeded'
}

export interface SocialContributionLine {
  key: string
  label: string
  amount: number
  /** Détail affichable de l'assiette et du taux. */
  detail?: string
}

export interface SocialResult {
  /** Assiette retenue pour le calcul. */
  assiette: number
  lines: SocialContributionLine[]
  total: number
  /** Part de CSG déductible du revenu imposable. */
  csgDeductible: number
  /** Réduction Acre appliquée. */
  acreReduction: number
}

export interface IncomeTaxResult {
  /** Revenu net imposable du foyer. */
  taxableIncome: number
  parts: number
  /** Impôt avant plafonnement du quotient familial et décote. */
  grossTax: number
  /** Impôt après plafonnement du quotient familial. */
  cappedTax: number
  decote: number
  /** Impôt final dû par le foyer. */
  total: number
  /** Part de l'impôt imputable à l'activité libérale. */
  attributableToActivity: number
  /** Taux moyen d'imposition du foyer. */
  averageRate: number
  /** Taux marginal d'imposition. */
  marginalRate: number
}

export interface MileageSummary {
  allowance: number
  effectivePerKm: number
  formula: string
  annualKm: number
}

export interface OptionalContributionsSummary {
  lines: Array<{
    key: string
    label: string
    paid: number
    ceiling: number
    deducted: number
    excess: number
  }>
  totalPaid: number
  totalDeducted: number
  totalExcess: number
  /** Économie d'impôt réellement procurée par ces versements. */
  taxSaving: number
}

export interface SimulationWarning {
  key: string
  severity: 'info' | 'warning'
  message: string
}

export interface SimulationInput {
  year: number
  settings: FinanceSettings
  /** Recettes encaissées sur la période, TTC si le praticien est assujetti. */
  revenue: number
  /** Charges professionnelles de la période. */
  expenses: ExpenseTotals
  /** Nombre de mois couverts par la période, pour les projections. */
  monthsElapsed: number
}

export interface ExpenseTotals {
  /** Total HT des charges, quote-part professionnelle appliquée. */
  deductibleHt: number
  /** TVA déductible correspondante. */
  deductibleVat: number
  /** Total TTC réellement décaissé, toutes charges confondues. */
  paidTtc: number
  byCategory: Record<string, number>
}

export interface SimulationResult {
  year: number
  /** Vrai si les barèmes utilisés ne sont pas ceux de l'année demandée. */
  usesFallbackScales: boolean
  scalesVerifiedOn: string

  vat: VatResult
  /** Recettes hors taxes. */
  revenueHt: number
  /** Charges déductibles retenues (HT si assujetti, TTC sinon). */
  deductibleExpenses: number
  /** Frais de véhicule au barème kilométrique, le cas échéant. */
  mileage: MileageSummary | null
  /** Bénéfice avant cotisations sociales. */
  grossProfit: number
  /** Cotisations facultatives Madelin et PER. */
  optionalContributions: OptionalContributionsSummary | null
  /** Anomalies détectées dans la saisie, à corriger avant de se fier au calcul. */
  warnings: SimulationWarning[]

  social: SocialResult
  incomeTax: IncomeTaxResult

  /** Revenu disponible : ce qui reste réellement au praticien sur l'année. */
  availableIncome: number
  /** Provision de sécurité mise de côté en plus. */
  safetyMargin: number
  /** Rémunération nette annuelle recommandée. */
  recommendedAnnualDraw: number
  /** Rémunération nette mensuelle recommandée. */
  recommendedMonthlyDraw: number

  /** Ce qu'il faut mettre de côté chaque mois, poste par poste. */
  monthlyProvisions: {
    social: number
    incomeTax: number
    vat: number
    safety: number
    total: number
  }
  /** Part du chiffre d'affaires à provisionner, en %. */
  provisionRate: number

  /** Projection annuelle si le rythme actuel se poursuit. */
  projection: {
    revenue: number
    availableIncome: number
    monthlyDraw: number
  } | null
}
