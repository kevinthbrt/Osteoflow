/** Types et règles partagés entre le serveur (catalogue) et les pages. */

export interface TutorialStep {
  title: string
  text: string
  image: string | null
}

export interface Tutorial {
  slug: string
  category: string
  addedAt: string | null
  kicker: string
  title: string
  summary: string
  intro: string
  duration: string
  availability: string
  page: string | null
  video: string | null
  poster: string | null
  steps: TutorialStep[]
  faq: { q: string; a: string }[]
}

export interface TutorialCatalog {
  categories: { id: string; label: string }[]
  tutorials: Tutorial[]
  /** D'où vient la liste : site (à jour), cache (dernière réponse) ou copie livrée */
  source: 'remote' | 'cache' | 'bundled'
}

/** Marqué « Nouveau » pendant 45 jours après sa mise en ligne. */
export function isRecent(addedAt: string | null, now = new Date()): boolean {
  if (!addedAt) return false
  const added = new Date(`${addedAt}T00:00:00`)
  if (Number.isNaN(added.getTime())) return false
  const days = (now.getTime() - added.getTime()) / 86_400_000
  return days >= 0 && days <= 45
}
