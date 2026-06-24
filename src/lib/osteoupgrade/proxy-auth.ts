import { getDatabase } from '@/lib/database/connection'

/**
 * En-têtes d'authentification par JETON de session pour les appels au proxy
 * osteoupgrade (`/api/osteoflow/*`).
 *
 * CF2 étape 2 : on envoie le jeton de session personnel (déjà obtenu au login,
 * stocké dans app_config) EN PLUS du secret partagé existant. Le serveur
 * (étape 1) préfère le jeton quand il est présent et n'a plus à faire confiance
 * à l'email transmis. Quand le serveur sera passé "jeton uniquement" (étape 3),
 * le secret pourra être retiré.
 */
export function getOsteoflowAuthHeaders(): Record<string, string> {
  try {
    const db = getDatabase()
    const rows = db
      .prepare("SELECT key, value FROM app_config WHERE key IN ('license_token','license_device_id')")
      .all() as Array<{ key: string; value: string }>
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    const headers: Record<string, string> = {}
    if (map.license_token) headers['x-osteoflow-token'] = map.license_token
    if (map.license_device_id) headers['x-osteoflow-device-id'] = map.license_device_id
    return headers
  } catch {
    return {}
  }
}
