/**
 * Barèmes fiscaux et sociaux, versionnés par année.
 *
 * ⚠️ Tous les taux ci-dessous changent chaque année. Ils sont volontairement
 * regroupés ici, sous forme de données pures, pour qu'une mise à jour annuelle
 * consiste à ajouter un bloc `TAX_CONFIG_20XX` sans toucher au moteur de calcul.
 *
 * Chaque valeur porte sa source. Ne pas modifier un taux sans mettre à jour
 * `verifiedOn` et la source correspondante.
 */

/**
 * Segment de barème « marginal » classique : le taux s'applique à la seule
 * fraction de l'assiette comprise dans le segment (comme le barème de l'IR).
 */
export interface MarginalBracket {
  /** Borne haute exprimée en multiples du Pass. `null` = illimité. */
  upToPass: number | null
  rate: number
}

/**
 * Segment de barème « progressif » façon Urssaf : le taux applicable dépend du
 * niveau de revenu, mais une fois déterminé il s'applique à la TOTALITÉ de
 * l'assiette. Entre `rateFrom` et `rateTo`, l'Urssaf interpole linéairement.
 */
export interface RampSegment {
  /** Borne haute exprimée en multiples du Pass. `null` = illimité. */
  upToPass: number | null
  rateFrom: number
  rateTo: number
}

export interface RampScale {
  segments: RampSegment[]
  /**
   * Certains barèmes Urssaf basculent sur un taux fixe appliqué à la seule part
   * du revenu au-delà d'un seuil (cas de la maladie au-delà de 3 Pass).
   */
  excess?: { abovePass: number; rate: number }
}

export interface IncomeTaxBracket {
  /** Borne haute du revenu imposable *par part*. `null` = illimité. */
  upTo: number | null
  rate: number
}

export interface TaxYearConfig {
  year: number
  /** Date de dernière vérification des barèmes face aux sources officielles. */
  verifiedOn: string
  sources: string[]

  /** Plafond annuel de la Sécurité sociale. */
  pass: number
  /** Smic horaire brut, sert d'assiette minimale pour la retraite de base. */
  smicHourly: number

  incomeTax: {
    /** Barème progressif appliqué au quotient familial. */
    brackets: IncomeTaxBracket[]
    /** Avantage maximal procuré par chaque demi-part additionnelle. */
    halfPartCap: number
    /** Plafond spécifique de la part entière du 1er enfant d'un parent isolé. */
    singleParentFirstChildCap: number
    /** Plafond de la demi-part « vieux parent » (art. 195 CGI). */
    veuvageHalfPartCap: number
    decote: {
      singleThreshold: number
      coupleThreshold: number
      singleBase: number
      coupleBase: number
      rate: number
    }
  }

  microBnc: {
    /** Abattement forfaitaire représentatif de frais, pour l'impôt. */
    abattementRate: number
    abattementMin: number
    /** Plafond de chiffre d'affaires du régime micro. */
    revenueCeiling: number
    /** Taux global de cotisations sociales, régime SSI (installation ≥ 2019). */
    socialRateSsi: number
    /** Taux global de cotisations sociales, régime Cipav (installation < 2019). */
    socialRateCipav: number
    /** Contribution à la formation professionnelle, en % du CA. */
    cfpRate: number
    /** Taux du versement fiscal libératoire pour les BNC. */
    versementLiberatoireRate: number
    /** Abattement Acre sur les cotisations, 1re année d'activité. */
    acreRate: number
  }

  reelBnc: {
    /**
     * Réforme de l'assiette sociale (LFSS 2024, en vigueur en 2026) :
     * assiette unique = revenu professionnel − abattement de 26 %, cet
     * abattement étant lui-même encadré par un plancher et un plafond.
     */
    assiette: {
      abattementRate: number
      abattementFloorPass: number
      abattementCapPass: number
    }
    maladie: RampScale
    /** Indemnités journalières (« maladie 2 »). */
    indemnitesJournalieres: { brackets: MarginalBracket[]; minBasePass: number }
    retraiteBase: { brackets: MarginalBracket[]; minBaseSmicHours: number }
    retraiteComplementaire: { brackets: MarginalBracket[] }
    invaliditeDeces: { brackets: MarginalBracket[]; minBasePass: number }
    allocationsFamiliales: RampScale
    csgCrds: { rate: number; deductibleRate: number }
    /** CFP forfaitaire, exprimée en % du Pass. */
    cfpRatePass: number
    acre: {
      /** Exonération d'un quart des cotisations sous ce seuil (en Pass). */
      fullBelowPass: number
      /** Exonération dégressive jusqu'à ce seuil, nulle au-delà (en Pass). */
      zeroAbovePass: number
      rate: number
    }
  }

  vat: {
    standardRate: number
    /** Seuil de franchise en base, prestations de services. */
    franchiseThreshold: number
    /** Seuil majoré (tolérance) au-delà duquel la TVA s'applique immédiatement. */
    franchiseToleranceThreshold: number
  }

  mileage: MileageScales

  /**
   * Plafonds de déduction des cotisations facultatives (Madelin, PER).
   *
   * Ces cotisations réduisent le bénéfice imposable, mais PAS l'assiette
   * sociale : le revenu brut social se calcule hors cotisations sociales
   * obligatoires et CSG déductible seulement, les cotisations facultatives
   * restant réintégrées.
   */
  optionalContributions: {
    retirement: {
      /** Part du bénéfice, dans la limite de 8 Pass. */
      baseRate: number
      /** Part supplémentaire sur la fraction du bénéfice entre 1 et 8 Pass. */
      surplusRate: number
      /** Plafond du bénéfice pris en compte, en Pass. */
      incomeCapPass: number
      /** Plancher de déduction, en Pass. */
      floorPass: number
    }
    prevoyance: {
      /** Part du bénéfice. */
      baseRate: number
      /** Part forfaitaire du Pass. */
      passRate: number
      /** Plafond global, exprimé en Pass. */
      capPass: number
    }
  }
}

/** Type de véhicule couvert par le barème kilométrique. */
export type VehicleKind = 'car' | 'motorcycle' | 'moped'

/**
 * Tranche du barème kilométrique : coût par kilomètre, éventuellement
 * augmenté d'un forfait, appliqué selon la distance annuelle parcourue.
 */
export interface MileageBand {
  /** Borne haute de distance annuelle, en km. `null` = illimité. */
  upToKm: number | null
  perKm: number
  /** Forfait ajouté au produit, propre à la tranche intermédiaire. */
  flat: number
}

export interface MileageScale {
  /** Puissance fiscale maximale couverte par ce barème. `null` = au-delà. */
  upToHp: number | null
  bands: MileageBand[]
}

export interface MileageScales {
  car: MileageScale[]
  motorcycle: MileageScale[]
  moped: MileageScale[]
  /** Majoration appliquée aux véhicules 100 % électriques. */
  electricBonus: number
}

/**
 * Barèmes 2026.
 *
 * Sur les cotisations du régime réel, 2026 est une année de bascule : la
 * réforme de l'assiette sociale (abattement unique de 26 %) s'applique à partir
 * d'avril 2026, avec la campagne de déclaration des revenus 2025.
 */
export const TAX_CONFIG_2026: TaxYearConfig = {
  year: 2026,
  verifiedOn: '2026-07-29',
  sources: [
    'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-ac-plnr.html',
    // Tableau « Actuel / Nouveau » des barèmes : c'est lui qui confirme que les
    // taux retenus ici sont bien ceux d'après la réforme de l'assiette sociale.
    'https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html',
    // Décret révisant le barème des cotisations en lien avec cette réforme.
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049888566',
    'https://www.service-public.gouv.fr/particuliers/actualites/A18045',
    'https://entreprendre.service-public.fr/vosdroits/F23267',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143451',
  ],

  pass: 48060,
  smicHourly: 12.02,

  incomeTax: {
    // Barème 2026 sur les revenus 2025 (loi de finances du 19 février 2026).
    brackets: [
      { upTo: 11600, rate: 0 },
      { upTo: 29579, rate: 0.11 },
      { upTo: 84577, rate: 0.3 },
      { upTo: 181917, rate: 0.41 },
      { upTo: null, rate: 0.45 },
    ],
    halfPartCap: 1807,
    singleParentFirstChildCap: 4262,
    veuvageHalfPartCap: 1079,
    decote: {
      singleThreshold: 1982,
      coupleThreshold: 3277,
      singleBase: 897,
      coupleBase: 1483,
      rate: 0.4525,
    },
  },

  microBnc: {
    abattementRate: 0.34,
    abattementMin: 305,
    revenueCeiling: 77700,
    socialRateSsi: 0.256,
    socialRateCipav: 0.232,
    cfpRate: 0.002,
    versementLiberatoireRate: 0.022,
    acreRate: 0.5,
  },

  reelBnc: {
    assiette: {
      abattementRate: 0.26,
      abattementFloorPass: 0.0176,
      abattementCapPass: 1.3,
    },
    // Maladie-maternité : taux progressif de 0 % à 8,50 % selon le revenu,
    // puis 6,50 % sur la seule part au-delà de 3 Pass.
    maladie: {
      segments: [
        { upToPass: 0.2, rateFrom: 0, rateTo: 0 },
        { upToPass: 0.4, rateFrom: 0, rateTo: 0.015 },
        { upToPass: 0.6, rateFrom: 0.015, rateTo: 0.04 },
        { upToPass: 1.1, rateFrom: 0.04, rateTo: 0.065 },
        { upToPass: 2, rateFrom: 0.065, rateTo: 0.077 },
        { upToPass: 3, rateFrom: 0.077, rateTo: 0.085 },
        { upToPass: null, rateFrom: 0.085, rateTo: 0.085 },
      ],
      excess: { abovePass: 3, rate: 0.065 },
    },
    indemnitesJournalieres: {
      brackets: [
        { upToPass: 5, rate: 0.005 },
        { upToPass: null, rate: 0 },
      ],
      minBasePass: 0.4,
    },
    retraiteBase: {
      brackets: [
        { upToPass: 1, rate: 0.1787 },
        { upToPass: null, rate: 0.0072 },
      ],
      minBaseSmicHours: 450,
    },
    retraiteComplementaire: {
      brackets: [
        { upToPass: 1, rate: 0.081 },
        { upToPass: 4, rate: 0.091 },
        { upToPass: null, rate: 0 },
      ],
    },
    invaliditeDeces: {
      brackets: [
        { upToPass: 1, rate: 0.013 },
        { upToPass: null, rate: 0 },
      ],
      minBasePass: 0.115,
    },
    allocationsFamiliales: {
      segments: [
        { upToPass: 1.1, rateFrom: 0, rateTo: 0 },
        { upToPass: 1.4, rateFrom: 0, rateTo: 0.031 },
        { upToPass: null, rateFrom: 0.031, rateTo: 0.031 },
      ],
    },
    csgCrds: { rate: 0.097, deductibleRate: 0.068 },
    cfpRatePass: 0.0025,
    acre: { fullBelowPass: 0.75, zeroAbovePass: 1, rate: 0.25 },
  },

  vat: {
    standardRate: 0.2,
    franchiseThreshold: 37500,
    franchiseToleranceThreshold: 41250,
  },

  // Barème kilométrique 2026 (revenus 2025). Non revalorisé depuis la hausse
  // de 5,4 % de 2023 : les montants 2024, 2025 et 2026 sont identiques.
  mileage: {
    car: [
      {
        upToHp: 3,
        bands: [
          { upToKm: 5000, perKm: 0.529, flat: 0 },
          { upToKm: 20000, perKm: 0.316, flat: 1065 },
          { upToKm: null, perKm: 0.37, flat: 0 },
        ],
      },
      {
        upToHp: 4,
        bands: [
          { upToKm: 5000, perKm: 0.606, flat: 0 },
          { upToKm: 20000, perKm: 0.34, flat: 1330 },
          { upToKm: null, perKm: 0.407, flat: 0 },
        ],
      },
      {
        upToHp: 5,
        bands: [
          { upToKm: 5000, perKm: 0.636, flat: 0 },
          { upToKm: 20000, perKm: 0.357, flat: 1395 },
          { upToKm: null, perKm: 0.427, flat: 0 },
        ],
      },
      {
        upToHp: 6,
        bands: [
          { upToKm: 5000, perKm: 0.665, flat: 0 },
          { upToKm: 20000, perKm: 0.374, flat: 1457 },
          { upToKm: null, perKm: 0.447, flat: 0 },
        ],
      },
      {
        upToHp: null,
        bands: [
          { upToKm: 5000, perKm: 0.697, flat: 0 },
          { upToKm: 20000, perKm: 0.394, flat: 1515 },
          { upToKm: null, perKm: 0.47, flat: 0 },
        ],
      },
    ],
    motorcycle: [
      {
        upToHp: 2,
        bands: [
          { upToKm: 3000, perKm: 0.395, flat: 0 },
          { upToKm: 6000, perKm: 0.099, flat: 891 },
          { upToKm: null, perKm: 0.248, flat: 0 },
        ],
      },
      {
        upToHp: 5,
        bands: [
          { upToKm: 3000, perKm: 0.468, flat: 0 },
          { upToKm: 6000, perKm: 0.082, flat: 1158 },
          { upToKm: null, perKm: 0.275, flat: 0 },
        ],
      },
      {
        upToHp: null,
        bands: [
          { upToKm: 3000, perKm: 0.606, flat: 0 },
          { upToKm: 6000, perKm: 0.079, flat: 1583 },
          { upToKm: null, perKm: 0.343, flat: 0 },
        ],
      },
    ],
    moped: [
      {
        upToHp: null,
        bands: [
          { upToKm: 3000, perKm: 0.315, flat: 0 },
          { upToKm: 6000, perKm: 0.079, flat: 711 },
          { upToKm: null, perKm: 0.198, flat: 0 },
        ],
      },
    ],
    electricBonus: 0.2,
  },

  optionalContributions: {
    retirement: {
      baseRate: 0.1,
      surplusRate: 0.15,
      incomeCapPass: 8,
      floorPass: 0.1,
    },
    prevoyance: {
      baseRate: 0.0375,
      passRate: 0.07,
      capPass: 0.24, // 3 % de 8 Pass
    },
  },
}

const CONFIGS: Record<number, TaxYearConfig> = {
  2026: TAX_CONFIG_2026,
}

/** Année la plus récente pour laquelle des barèmes sont disponibles. */
export const LATEST_TAX_YEAR = Math.max(...Object.keys(CONFIGS).map(Number))

/**
 * Barèmes applicables à une année donnée. Pour une année sans barème connu, on
 * retombe sur les plus récents disponibles : le résultat reste une estimation,
 * et l'appelant doit signaler que les barèmes ne sont pas ceux de l'année.
 */
export function getTaxConfig(year: number): TaxYearConfig {
  return CONFIGS[year] ?? CONFIGS[LATEST_TAX_YEAR]
}

/** Vrai si les barèmes de l'année demandée sont réellement connus. */
export function hasTaxConfig(year: number): boolean {
  return year in CONFIGS
}
