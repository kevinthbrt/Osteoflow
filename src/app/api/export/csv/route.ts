/**
 * Export CSV des données du cabinet.
 *
 * Le praticien coche les jeux de données et les colonnes voulues ; la route
 * renvoie un fichier CSV par jeu de données, que le navigateur enregistre
 * localement. Rien ne sort de la machine : la base est locale et la réponse
 * ne quitte pas l'application.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { EXPORT_DATASETS } from '@/lib/export/datasets'
import { buildDatasetCsv, ExportError, type ExportResult } from '@/lib/export/build-export'

export const dynamic = 'force-dynamic'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')

const requestSchema = z.object({
  datasets: z
    .array(
      z.object({
        dataset: z.enum(EXPORT_DATASETS.map((d) => d.key) as [string, ...string[]]),
        fields: z.array(z.string()).min(1, 'Sélectionnez au moins une colonne'),
      }),
    )
    .min(1, 'Sélectionnez au moins un type de données'),
  startDate: isoDate.nullish(),
  endDate: isoDate.nullish(),
  includeArchived: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const db = await createClient()
    const {
      data: { user },
    } = await db.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: practitioner } = await db
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien introuvable' }, { status: 404 })
    }

    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Requête invalide' },
        { status: 400 },
      )
    }

    const { datasets, startDate, endDate, includeArchived } = parsed.data

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: 'La date de début doit précéder la date de fin' },
        { status: 400 },
      )
    }

    const files: ExportResult[] = datasets.map((selection) =>
      buildDatasetCsv(
        {
          dataset: selection.dataset,
          fields: selection.fields,
          startDate,
          endDate,
          includeArchived,
        },
        practitioner.id as string,
      ),
    )

    return NextResponse.json({ files })
  } catch (error) {
    if (error instanceof ExportError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[export/csv POST]', error)
    return NextResponse.json({ error: "Erreur lors de la génération de l'export" }, { status: 500 })
  }
}
