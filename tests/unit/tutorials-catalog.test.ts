import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'

let db: Database.Database
vi.mock('@/lib/database/connection', () => ({ getDatabase: () => db }))

import { getTutorialCatalog, parseCatalog, siteUrl } from '@/lib/tutorials/catalog'
import { isRecent } from '@/lib/tutorials/types'
import bundled from '@/data/tutorials-catalog.json'

const SITE = 'https://www.osteo-upgrade.fr'

function tutorial(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'facturation',
    category: 'gestion',
    addedAt: '2026-11-01',
    title: 'Facturer une séance',
    video: `${SITE}/tutoriels/videos/facturation.mp4`,
    steps: [{ title: 'Ouvrez la séance', text: 'Texte', image: `${SITE}/tutoriels/facturation/etape-1.webp` }],
    faq: [{ q: 'Question ?', a: 'Réponse.' }],
    ...overrides,
  }
}

describe('parseCatalog', () => {
  it('garde un tutoriel valide et ses rubriques', () => {
    const parsed = parseCatalog({ categories: [{ id: 'gestion', label: 'Gestion du cabinet' }], tutorials: [tutorial()] })
    expect(parsed?.tutorials).toHaveLength(1)
    expect(parsed?.categories).toEqual([{ id: 'gestion', label: 'Gestion du cabinet' }])
    expect(parsed?.tutorials[0].steps[0].image).toBe(`${SITE}/tutoriels/facturation/etape-1.webp`)
  })

  it('refuse les adresses hors du site, en http ou en javascript', () => {
    const parsed = parseCatalog({
      tutorials: [
        tutorial({
          video: 'https://evil.example.com/v.mp4',
          poster: 'http://www.osteo-upgrade.fr/p.webp',
          page: 'javascript:alert(1)',
        }),
      ],
    })
    const t = parsed!.tutorials[0]
    expect(t.video).toBeNull()
    expect(t.poster).toBeNull()
    expect(t.page).toBeNull()
  })

  it('ignore les entrées sans titre, au slug invalide ou en double', () => {
    const parsed = parseCatalog({
      tutorials: [tutorial(), tutorial(), tutorial({ slug: '../etc' }), tutorial({ slug: 'autre', title: '' }), 'texte', null],
    })
    expect(parsed?.tutorials.map((t) => t.slug)).toEqual(['facturation'])
  })

  it('range un tutoriel de rubrique inconnue dans « Autres » plutôt que de le perdre', () => {
    const parsed = parseCatalog({ categories: [], tutorials: [tutorial({ category: 'nouvelle' })] })
    expect(parsed?.categories).toEqual([{ id: 'nouvelle', label: 'Autres' }])
  })

  it('rejette un catalogue vide ou illisible', () => {
    expect(parseCatalog(null)).toBeNull()
    expect(parseCatalog({ tutorials: [] })).toBeNull()
    expect(parseCatalog({ tutorials: 'non' })).toBeNull()
  })

  it('accepte la copie livrée avec l’application', () => {
    expect(parseCatalog(bundled)?.tutorials.length).toBeGreaterThan(0)
  })
})

describe('siteUrl', () => {
  it('accepte le site avec ou sans www', () => {
    expect(siteUrl('https://osteo-upgrade.fr/a')).toBe('https://osteo-upgrade.fr/a')
    expect(siteUrl('https://www.osteo-upgrade.fr/a')).toBe('https://www.osteo-upgrade.fr/a')
    expect(siteUrl('https://osteo-upgrade.fr.evil.com/a')).toBeNull()
  })
})

describe('isRecent', () => {
  it('marque « Nouveau » pendant 45 jours', () => {
    const now = new Date('2026-11-20T12:00:00')
    expect(isRecent('2026-11-07', now)).toBe(true)
    expect(isRecent('2026-09-01', now)).toBe(false)
    expect(isRecent('2026-12-01', now)).toBe(false)
    expect(isRecent(null, now)).toBe(false)
  })
})

describe('getTutorialCatalog', () => {
  beforeEach(() => {
    db = new Database(':memory:')
    db.exec('CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT)')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lit le site, puis garde la réponse pour fonctionner hors ligne', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tutorials: [tutorial()] }))))
    const fresh = await getTutorialCatalog()
    expect(fresh.source).toBe('remote')

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('hors ligne') }))
    const offline = await getTutorialCatalog({ refresh: true })
    expect(offline.source).toBe('cache')
    expect(offline.tutorials[0].slug).toBe('facturation')
  })

  it('se rabat sur la copie livrée avant la première connexion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erreur', { status: 500 })))
    const catalog = await getTutorialCatalog()
    expect(catalog.source).toBe('bundled')
    expect(catalog.tutorials.length).toBeGreaterThan(0)
  })
})
