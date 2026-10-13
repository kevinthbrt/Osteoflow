import { getDatabase } from '@/lib/database/connection'
import { featuresFromLicense, type Feature } from '@/lib/features'

/** Droit du compte connecté, lu dans la licence locale (côté serveur). */
export function hasFeature(feature: Feature): boolean {
  try {
    const rows = getDatabase()
      .prepare("SELECT key, value FROM app_config WHERE key IN ('license_role','license_features')")
      .all() as Array<{ key: string; value: string }>
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return featuresFromLicense(map.license_role, map.license_features).includes(feature)
  } catch {
    return false
  }
}
