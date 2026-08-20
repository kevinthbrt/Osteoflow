/**
 * Droits d'accès rapportés par Osteoupgrade.
 *
 * Depuis le passage à trois offres, un compte peut avoir MyOsteoFlow sans
 * OsteoUpgrade (offre à 29,99 €). L'application doit donc masquer le contenu
 * OsteoUpgrade plutôt que de laisser l'utilisateur cliquer sur des widgets qui
 * répondront 403.
 */

export type Entitlements = {
  osteoflow: boolean
  osteoupgrade: boolean
}

/**
 * Droits déduits de ce que la base locale contient.
 *
 * Les binaires antérieurs ne stockaient que `license_role` : tant que
 * l'utilisateur ne s'est pas reconnecté, `entitlements` est absent et on
 * retombe sur le rôle. C'est volontairement permissif — mieux vaut afficher
 * un widget de trop que priver un abonné Premium de son contenu.
 *
 *   premium / admin → les deux (bundle, ou OsteoUpgrade seul côté serveur)
 *   trial           → MyOsteoFlow seul (rôle miroir de l'offre MyOsteoFlow)
 */
export function entitlementsFromLicense(
  role: string | null | undefined,
  stockes?: Partial<Entitlements> | null
): Entitlements {
  if (stockes && typeof stockes.osteoflow === 'boolean' && typeof stockes.osteoupgrade === 'boolean') {
    return { osteoflow: stockes.osteoflow, osteoupgrade: stockes.osteoupgrade }
  }

  if (role === 'premium' || role === 'admin') return { osteoflow: true, osteoupgrade: true }
  if (role === 'trial') return { osteoflow: true, osteoupgrade: false }
  return { osteoflow: false, osteoupgrade: false }
}

/** Analyse la valeur brute stockée en base locale (JSON), sans jamais lever. */
export function parseEntitlements(brut: string | null | undefined): Partial<Entitlements> | null {
  if (!brut) return null
  try {
    const v = JSON.parse(brut)
    return typeof v === 'object' && v !== null ? v : null
  } catch {
    return null
  }
}
