/**
 * Fonctions en accès restreint, annoncées par osteoupgrade avec la licence.
 *
 * `programmes` : onglet Exercices par étapes, lien et QR code de l'appli
 * patient, import des bilans, assistant IA. Réservé aux administrateurs
 * pendant la phase de test. osteoupgrade reste l'autorité : il renvoie la
 * liste à chaque vérification de licence et refuse lui-même les appels IA.
 */

export type Feature = 'programmes'

/**
 * Liste stockée en base locale ; à défaut (connexion antérieure à cette
 * version), repli sur le rôle, comme le fait le serveur.
 */
export function featuresFromLicense(role: string | null | undefined, stored: string | null | undefined): Feature[] {
  if (stored) {
    try {
      const v = JSON.parse(stored)
      if (Array.isArray(v)) return v.filter((f): f is Feature => f === 'programmes')
    } catch { /* valeur illisible : repli sur le rôle */ }
  }
  return role === 'admin' ? ['programmes'] : []
}
