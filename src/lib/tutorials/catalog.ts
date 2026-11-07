import { getDatabase } from '@/lib/database/connection'
import bundled from '@/data/tutorials-catalog.json'
import type { Tutorial, TutorialCatalog } from '@/lib/tutorials/types'

export type { Tutorial, TutorialCatalog, TutorialStep } from '@/lib/tutorials/types'
export { isRecent } from '@/lib/tutorials/types'

/**
 * Catalogue des tutoriels, publié par le site OsteoUpgrade
 * (`/tutoriels/catalogue.json`). Un tutoriel mis en ligne sur le site apparaît
 * ici sans nouvelle version de MyOsteoflow. La dernière réponse est gardée sur
 * le poste ; avant la première connexion, la copie livrée avec l'application
 * prend le relais.
 *
 * Tout ce qui vient du site est revérifié : textes bornés, et seules des
 * adresses https du site sont gardées (vidéos, images, pages).
 */
const SITE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'
const CACHE_KEY = 'tutorials_catalog'
const REFRESH_MS = 6 * 60 * 60 * 1000
const ALLOWED_HOSTS = ['www.osteo-upgrade.fr', 'osteo-upgrade.fr']

function text(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function siteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ALLOWED_HOSTS.includes(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

const SLUG = /^[a-z0-9-]{1,60}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Garde ce qui est exploitable, ignore le reste sans échouer. */
export function parseCatalog(raw: unknown): Omit<TutorialCatalog, 'source'> | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as { categories?: unknown; tutorials?: unknown }
  if (!Array.isArray(data.tutorials)) return null

  const tutorials: Tutorial[] = []
  const seen = new Set<string>()
  for (const item of data.tutorials.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const slug = text(t.slug, 60)
    const title = text(t.title, 200)
    if (!SLUG.test(slug) || !title || seen.has(slug)) continue
    seen.add(slug)
    const addedAt = text(t.addedAt, 10)
    tutorials.push({
      slug,
      category: text(t.category, 60) || 'autres',
      addedAt: DATE.test(addedAt) ? addedAt : null,
      kicker: text(t.kicker, 120),
      title,
      summary: text(t.summary, 500),
      intro: text(t.intro),
      duration: text(t.duration, 20),
      availability: text(t.availability, 500),
      page: siteUrl(t.page),
      video: siteUrl(t.video),
      poster: siteUrl(t.poster),
      steps: (Array.isArray(t.steps) ? t.steps : []).slice(0, 40).flatMap((s) => {
        if (!s || typeof s !== 'object') return []
        const step = s as Record<string, unknown>
        const stepTitle = text(step.title, 200)
        return stepTitle ? [{ title: stepTitle, text: text(step.text), image: siteUrl(step.image) }] : []
      }),
      faq: (Array.isArray(t.faq) ? t.faq : []).slice(0, 30).flatMap((f) => {
        if (!f || typeof f !== 'object') return []
        const entry = f as Record<string, unknown>
        const q = text(entry.q, 300)
        const a = text(entry.a)
        return q && a ? [{ q, a }] : []
      }),
    })
  }
  if (tutorials.length === 0) return null

  const categories: { id: string; label: string }[] = []
  for (const c of Array.isArray(data.categories) ? data.categories : []) {
    if (!c || typeof c !== 'object') continue
    const id = text((c as Record<string, unknown>).id, 60)
    const label = text((c as Record<string, unknown>).label, 80)
    if (id && label && !categories.some((x) => x.id === id)) categories.push({ id, label })
  }
  // Une rubrique inconnue ne doit pas faire disparaître ses tutoriels.
  for (const t of tutorials) {
    if (!categories.some((c) => c.id === t.category)) categories.push({ id: t.category, label: 'Autres' })
  }
  return { categories: categories.filter((c) => tutorials.some((t) => t.category === c.id)), tutorials }
}

function readCache(): (Omit<TutorialCatalog, 'source'> & { checkedAt: number }) | null {
  try {
    const row = getDatabase().prepare('SELECT value FROM app_config WHERE key = ?').get(CACHE_KEY) as { value: string } | undefined
    if (!row) return null
    const stored = JSON.parse(row.value) as { checkedAt?: number; catalog?: unknown }
    const catalog = parseCatalog(stored.catalog)
    return catalog ? { ...catalog, checkedAt: Number(stored.checkedAt) || 0 } : null
  } catch {
    return null
  }
}

function bundledCatalog(): TutorialCatalog {
  const catalog = parseCatalog(bundled)
  return { categories: catalog?.categories ?? [], tutorials: catalog?.tutorials ?? [], source: 'bundled' }
}

export async function getTutorialCatalog(options: { refresh?: boolean } = {}): Promise<TutorialCatalog> {
  const cached = readCache()
  if (cached && !options.refresh && Date.now() - cached.checkedAt < REFRESH_MS) {
    return { categories: cached.categories, tutorials: cached.tutorials, source: 'cache' }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${SITE_URL}/tutoriels/catalogue.json`, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) throw new Error(String(res.status))
    const catalog = parseCatalog(await res.json())
    if (!catalog) throw new Error('catalogue illisible')
    getDatabase()
      .prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)')
      .run(CACHE_KEY, JSON.stringify({ checkedAt: Date.now(), catalog }))
    return { ...catalog, source: 'remote' }
  } catch {
    return cached ? { categories: cached.categories, tutorials: cached.tutorials, source: 'cache' } : bundledCatalog()
  }
}
