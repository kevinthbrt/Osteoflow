/**
 * Tutoriels : section « Tutoriels » de l'application (catalogue publié par le
 * site OsteoUpgrade). Les adresses ci-dessous ouvrent la page interne ; le
 * slug doit exister dans le catalogue du site (`lib/tutorials.ts` côté site).
 */
export const TUTORIALS = {
  all: '/tutorials',
  exercices: '/tutorials/exercices',
  doctolib: '/tutorials/doctolib',
  tableauDeBord: '/tutorials/tableau-de-bord',
  onglets: '/tutorials/onglets-et-recherche',
  consultation: '/tutorials/consultation',
} as const
