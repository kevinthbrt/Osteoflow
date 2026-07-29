/**
 * Catégories de charges professionnelles.
 *
 * Calées sur les postes réellement rencontrés en cabinet d'ostéopathie, avec
 * une quote-part déductible par défaut : 100 % pour les charges purement
 * professionnelles, moins pour les postes à usage mixte que l'administration
 * n'admet qu'au prorata de l'usage professionnel.
 */
export interface ExpenseCategory {
  key: string
  label: string
  /** Quote-part professionnelle proposée par défaut, en %. */
  defaultDeductibleShare: number
  /** Taux de TVA le plus courant sur ce poste. */
  defaultVatRate: number
  hint?: string
  /**
   * Forfait déduit sans décaissement professionnel correspondant : il réduit le
   * bénéfice mais ne sort pas de la trésorerie de l'activité.
   */
  isFlatAllowance?: boolean
  /**
   * Faux pour les cotisations sociales : elles se déduisent du résultat fiscal
   * mais pas de l'assiette sociale, laquelle est définie hors cotisations.
   * Les traiter comme une charge ordinaire minorerait l'Urssaf calculée.
   */
  reducesSocialBase?: boolean
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    key: 'local',
    label: 'Loyer et charges du cabinet',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
    hint: 'Loyer, charges locatives, taxe foncière si vous êtes propriétaire',
  },
  {
    key: 'retrocession',
    label: 'Rétrocession et redevance de collaboration',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
    hint: 'Redevance versée au titulaire. Soumise à TVA même si vos actes en sont exonérés',
  },
  {
    key: 'assurance',
    label: 'Assurances professionnelles',
    defaultDeductibleShare: 100,
    defaultVatRate: 0,
    hint: 'RCP, multirisque du local, prévoyance',
  },
  {
    key: 'cotisations_pro',
    label: 'Cotisations syndicales et registre',
    defaultDeductibleShare: 100,
    defaultVatRate: 0,
  },
  {
    key: 'materiel',
    label: 'Matériel et petit équipement',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
    hint: 'Table, consommables, linge. Au-delà de 500 € HT, le bien s’amortit',
  },
  {
    key: 'logiciel',
    label: 'Logiciels et abonnements',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'honoraires',
    label: 'Comptable et honoraires',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'vehicule',
    label: 'Véhicule et déplacements',
    defaultDeductibleShare: 50,
    defaultVatRate: 0.2,
    hint: 'Au réel ou au barème kilométrique, jamais les deux sur la même année',
  },
  {
    key: 'telecom',
    label: 'Téléphone et internet',
    defaultDeductibleShare: 50,
    defaultVatRate: 0.2,
    hint: 'À hauteur de l’usage professionnel si la ligne est aussi personnelle',
  },
  {
    key: 'formation',
    label: 'Formation continue',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'communication',
    label: 'Communication et site internet',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'fournitures',
    label: 'Fournitures et administratif',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'banque',
    label: 'Frais bancaires et terminal',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
  {
    key: 'impots_taxes',
    label: 'Impôts et taxes déductibles',
    defaultDeductibleShare: 100,
    defaultVatRate: 0,
    hint: 'CFE notamment. L’impôt sur le revenu n’est jamais déductible',
  },
  {
    key: 'cotisations_sociales',
    label: 'Cotisations sociales Urssaf',
    defaultDeductibleShare: 100,
    defaultVatRate: 0,
    reducesSocialBase: false,
    hint: 'Appels et régularisations Urssaf. Déductibles de votre impôt, mais pas de l’assiette qui sert à calculer ces mêmes cotisations',
  },
  {
    key: 'forfait_blanchissage',
    label: 'Forfait blanchissage',
    defaultDeductibleShare: 100,
    defaultVatRate: 0,
    isFlatAllowance: true,
    hint: 'Linge professionnel lavé à domicile, évalué forfaitairement (usage courant : environ 6 € par jour travaillé). Déduit du bénéfice, sans décaissement',
  },
  {
    key: 'autre',
    label: 'Autre',
    defaultDeductibleShare: 100,
    defaultVatRate: 0.2,
  },
]

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.key, category.label]),
)

export function getExpenseCategory(key: string): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find((category) => category.key === key)
}

/** Vrai si la catégorie réduit l'assiette des cotisations sociales. */
export function reducesSocialBase(key: string): boolean {
  return getExpenseCategory(key)?.reducesSocialBase !== false
}

/** Vrai si la catégorie est un forfait déduit sans décaissement. */
export function isFlatAllowance(key: string): boolean {
  return getExpenseCategory(key)?.isFlatAllowance === true
}

export const EXPENSE_RECURRENCE_LABELS: Record<string, string> = {
  once: 'Ponctuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
}
