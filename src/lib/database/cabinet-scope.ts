/**
 * Périmètre cabinet (multi-cabinet) pour MyOsteoFlow desktop.
 *
 * Un "cabinet" = une ligne `practitioners` (id = identifiant du cabinet).
 * Les cabinets d'un même propriétaire partagent le même `owner_id`.
 *
 * Par défaut, chaque cabinet est CLOISONNÉ : il ne voit que ses propres
 * données. L'utilisateur peut activer le PARTAGE catégorie par catégorie
 * (patients, consultations, compta) — les données sont alors mises en commun
 * entre tous ses cabinets (même owner_id).
 *
 * Dépendances imposées : consultations ⇒ patients, compta ⇒ consultations.
 *
 * Toutes les lectures se font en SQL brut (pas via le query-builder) pour
 * éviter toute récursion de scoping.
 */

import { getDatabase } from './connection'

export type ShareCategory = 'patients' | 'consultations' | 'compta' | 'objectifs' | 'stats'

type DB = ReturnType<typeof getDatabase>

/** Catégories actuellement partagées entre les cabinets. */
export function getSharedCategories(db: DB = getDatabase()): ShareCategory[] {
  try {
    const row = db
      .prepare("SELECT value FROM app_config WHERE key = 'cabinet_shared_categories'")
      .get() as { value?: string } | undefined
    if (!row?.value) return []
    const parsed = JSON.parse(row.value)
    return Array.isArray(parsed) ? (parsed as ShareCategory[]) : []
  } catch {
    return []
  }
}

/** Identifiant (practitioners.id) du cabinet actif. */
export function getActiveCabinetId(db: DB = getDatabase()): string | null {
  try {
    const cfg = db
      .prepare("SELECT value FROM app_config WHERE key = 'current_user_id'")
      .get() as { value?: string } | undefined
    if (!cfg?.value) return null
    const p = db
      .prepare('SELECT id FROM practitioners WHERE user_id = ?')
      .get(cfg.value) as { id?: string } | undefined
    return p?.id ?? null
  } catch {
    return null
  }
}

/** Tous les cabinets (practitioners.id) du propriétaire du cabinet actif. */
export function getOwnerCabinetIds(db: DB = getDatabase()): string[] {
  const activeId = getActiveCabinetId(db)
  if (!activeId) return []
  try {
    const owner = db
      .prepare('SELECT owner_id FROM practitioners WHERE id = ?')
      .get(activeId) as { owner_id?: string } | undefined
    if (!owner?.owner_id) return [activeId]
    const rows = db
      .prepare('SELECT id FROM practitioners WHERE owner_id = ?')
      .all(owner.owner_id) as Array<{ id: string }>
    return rows.length ? rows.map((r) => r.id) : [activeId]
  } catch {
    return [activeId]
  }
}

/**
 * Liste des cabinets (practitioners.id) à inclure pour une catégorie donnée.
 * - Partagée  → tous les cabinets du propriétaire.
 * - Cloisonnée → uniquement le cabinet actif.
 * Renvoie [] si aucun cabinet actif (ex. avant connexion) → pas de scoping.
 */
export function getScopeCabinetIds(category: ShareCategory, db: DB = getDatabase()): string[] {
  const activeId = getActiveCabinetId(db)
  if (!activeId) return []
  if (getSharedCategories(db).includes(category)) {
    const ids = getOwnerCabinetIds(db)
    return ids.length ? ids : [activeId]
  }
  return [activeId]
}
