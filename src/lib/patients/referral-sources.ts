/**
 * Sources de recommandation (« Recommandé par ») d'un patient.
 *
 * Deux mécanismes cohabitent sur la fiche patient :
 * - `referred_by_patient_id` : le patient a été envoyé par un autre patient ;
 * - `referred_by_source` : un canal d'acquisition, saisi sous forme de texte.
 *
 * Les canaux proposés par défaut sont figés ici. Le praticien peut en créer
 * d'autres (table `referral_sources`), affichés à la suite des canaux par
 * défaut sur le formulaire patient.
 */

/** Canaux proposés à tous les praticiens. */
export const DEFAULT_REFERRAL_SOURCES = [
  'Médecin',
  'Internet',
  'Réseaux sociaux',
  'Bouche à oreille',
] as const

/** Préfixe des sources saisies en texte libre via le bouton « Autre ». */
export const OTHER_SOURCE_PREFIX = 'Autre : '

/** Libellé affiché pour les patients envoyés par un autre patient. */
export const PATIENT_REFERRAL_LABEL = 'Recommandation patient'

/** Libellé affiché pour les patients sans source renseignée. */
export const UNKNOWN_SOURCE_LABEL = 'Non renseigné'

/**
 * Une source saisie en texte libre (bouton « Autre »). Le test porte sur le
 * préfixe exact pour ne pas confondre avec une catégorie personnalisée dont
 * le nom commencerait par « Autre ».
 */
export function isOtherSource(source: string | null | undefined): boolean {
  const value = (source || '').trim()
  return value === 'Autre' || /^Autre ?:/.test(value)
}

/**
 * Le texte libre saisi derrière « Autre : », sans son préfixe. La valeur n'est
 * pas rognée : elle alimente un champ de saisie, où une espace en fin de mot
 * doit rester possible.
 */
export function otherSourceText(source: string | null | undefined): string {
  return (source || '').replace(/^Autre ?: ?/, '')
}

/**
 * Libellé de statistique pour un patient : la recommandation par un autre
 * patient prime sur le canal. Le texte libre saisi via « Autre » est conservé
 * tel quel, c'est lui qui décrit réellement le canal d'acquisition.
 */
export function referralStatLabel(patient: {
  referred_by_source?: string | null
  referred_by_patient_id?: string | null
}): string {
  if (patient.referred_by_patient_id) return PATIENT_REFERRAL_LABEL
  const source = (patient.referred_by_source || '').trim()
  if (!source) return UNKNOWN_SOURCE_LABEL
  if (isOtherSource(source)) {
    const text = otherSourceText(source).trim()
    return text ? `Autre : ${text}` : 'Autre'
  }
  return source
}
