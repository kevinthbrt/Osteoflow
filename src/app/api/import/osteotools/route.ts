/**
 * Import d'un export OsteoTools (archive .zip chiffrée + mot de passe).
 *
 * Tout se passe sur la machine du praticien : l'archive est envoyée au
 * serveur local de l'application (127.0.0.1), déchiffrée en mémoire et
 * écrite dans sa base. Aucune donnée ne sort du poste.
 *
 * `action=analyze` : simulation complète (rien n'est enregistré) pour
 * afficher ce qui va être créé ou complété et faire confirmer les modes de
 * règlement. `action=import` : écriture réelle, en une seule transaction.
 */

import { NextResponse } from 'next/server'
import path from 'path'
import { checkLocalApiToken } from '@/lib/local-api-auth'
import { getAppDataDir, getDatabase } from '@/lib/database/connection'
import { getActiveCabinetId } from '@/lib/database/cabinet-scope'
import { readOsteoToolsArchive, OsteoToolsArchiveError } from '@/lib/import/osteotools/archive'
import { buildOsteoToolsPlan, type PaymentTarget } from '@/lib/import/osteotools/transform'
import { applyOsteoToolsPlan } from '@/lib/import/osteotools/apply'

export const dynamic = 'force-dynamic'

const TARGETS: PaymentTarget[] = ['card', 'cash', 'check', 'transfer', 'other', 'free']
const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024

export async function POST(request: Request) {
  const authError = checkLocalApiToken(request)
  if (authError) return authError

  const { getCurrentUser } = await import('@/lib/database/auth')
  if (!getCurrentUser()) return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 })

  const db = getDatabase()
  const practitionerId = getActiveCabinetId(db)
  if (!practitionerId) return NextResponse.json({ error: 'Cabinet introuvable.' }, { status: 400 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Envoi illisible.' }, { status: 400 })
  }

  const file = form.get('file')
  const password = String(form.get('password') || '').trim()
  const action = form.get('action') === 'import' ? 'import' : 'analyze'
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Archive manquante.' }, { status: 400 })
  if (file.size > MAX_ARCHIVE_SIZE) return NextResponse.json({ error: 'Archive trop volumineuse.' }, { status: 400 })

  let archive
  try {
    archive = await readOsteoToolsArchive(new Uint8Array(await file.arrayBuffer()), password || undefined)
  } catch (err) {
    if (err instanceof OsteoToolsArchiveError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    console.error('[import osteotools] lecture', err)
    return NextResponse.json({ error: 'Impossible de lire l\'archive.' }, { status: 400 })
  }

  const plan = buildOsteoToolsPlan(archive.tables, archive.files)

  const paymentTargets: Record<string, PaymentTarget> = {}
  for (const mode of plan.paymentModes) paymentTargets[mode.code] = mode.suggested
  try {
    const sent = JSON.parse(String(form.get('paymentTargets') || '{}')) as Record<string, string>
    for (const [code, target] of Object.entries(sent)) {
      if (TARGETS.includes(target as PaymentTarget)) paymentTargets[code] = target as PaymentTarget
    }
  } catch {
    // correspondance par défaut
  }

  // Copie de sécurité de la base, à côté du fichier d'origine, avant toute
  // écriture : permet de revenir en arrière via « Restaurer une sauvegarde ».
  let backupPath: string | null = null
  if (action === 'import') {
    try {
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
      backupPath = `${db.name}.avant-import-osteotools-${stamp}`
      await db.backup(backupPath)
    } catch (err) {
      console.error('[import osteotools] sauvegarde', err)
      return NextResponse.json(
        { error: 'La copie de sécurité de votre base a échoué : import annulé, rien n\'a été modifié.' },
        { status: 500 }
      )
    }
  }

  try {
    const report = applyOsteoToolsPlan(db, plan, {
      practitionerId,
      paymentTargets,
      files: archive.files,
      attachmentsDir: path.join(getAppDataDir(), 'attachments'),
      dryRun: action === 'analyze',
    })
    return NextResponse.json({
      action,
      stats: plan.stats,
      paymentModes: plan.paymentModes.map((m) => ({ ...m, target: paymentTargets[m.code] })),
      report,
      backupPath,
    })
  } catch (err) {
    console.error('[import osteotools] écriture', err)
    return NextResponse.json(
      { error: 'L\'import a échoué, rien n\'a été modifié dans votre base. Contactez le support.' },
      { status: 500 }
    )
  }
}
