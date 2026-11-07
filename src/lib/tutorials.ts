/**
 * Tutoriels en ligne (site OsteoUpgrade) : captures, vidéo et questions
 * fréquentes pour chaque fonctionnalité. Ouverts dans le navigateur.
 */
const BASE = `${process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'}/tutoriels`

export const TUTORIALS = {
  all: BASE,
  exercices: `${BASE}/exercices`,
  doctolib: `${BASE}/doctolib`,
  tableauDeBord: `${BASE}/tableau-de-bord`,
  onglets: `${BASE}/onglets-et-recherche`,
  consultation: `${BASE}/consultation`,
} as const
