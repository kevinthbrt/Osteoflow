import { getDatabase } from '@/lib/database/connection'
import { DOCTOLIB_EXTENSION_PUBLISHED, DOCTOLIB_EXTENSION_STORE_URL } from '@/lib/doctolib/config'

/**
 * Publication de l'extension, annoncée par le site OsteoUpgrade
 * (`/myosteoflow/doctolib-extension.json`). Elle permet d'activer la mise en
 * route chez tous les utilisateurs dès la validation par Google, sans
 * attendre une nouvelle version d'Osteoflow. La dernière réponse est gardée
 * sur le poste pour fonctionner hors ligne.
 */
const SITE_URL = process.env.NEXT_PUBLIC_OSTEOUPGRADE_URL || 'https://www.osteo-upgrade.fr'
const CACHE_KEY = 'doctolib_remote_availability'
const REFRESH_MS = 6 * 60 * 60 * 1000

export interface DoctolibAvailability {
  published: boolean
  storeUrl: string | null
}

/** Seules des adresses du Chrome Web Store ou du store Edge sont acceptées. */
export function cleanStoreUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const allowed = ['chromewebstore.google.com', 'chrome.google.com', 'microsoftedge.microsoft.com']
    return url.protocol === 'https:' && allowed.includes(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function readCache(): (DoctolibAvailability & { checkedAt: number }) | null {
  try {
    const row = getDatabase().prepare('SELECT value FROM app_config WHERE key = ?').get(CACHE_KEY) as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  } catch {
    return null
  }
}

export async function getDoctolibAvailability(): Promise<DoctolibAvailability> {
  if (DOCTOLIB_EXTENSION_PUBLISHED) return { published: true, storeUrl: DOCTOLIB_EXTENSION_STORE_URL }
  const cached = readCache()
  if (cached && Date.now() - cached.checkedAt < REFRESH_MS) return { published: cached.published, storeUrl: cached.storeUrl }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${SITE_URL}/myosteoflow/doctolib-extension.json`, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { published?: unknown; storeUrl?: unknown }
    const storeUrl = cleanStoreUrl(data.storeUrl)
    const fresh = { published: data.published === true && !!storeUrl, storeUrl, checkedAt: Date.now() }
    getDatabase().prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(CACHE_KEY, JSON.stringify(fresh))
    return { published: fresh.published, storeUrl: fresh.storeUrl }
  } catch {
    return cached ? { published: cached.published, storeUrl: cached.storeUrl } : { published: false, storeUrl: null }
  }
}
