import { NextResponse } from 'next/server'
import { getDatabase } from '@/lib/database/connection'

export const dynamic = 'force-dynamic'

/**
 * Brouillons de consultation, un par patient : plusieurs séances peuvent être
 * ouvertes en même temps (onglets patients) sans s'écraser.
 *
 * Clé en base : `consultation_draft:<patientId>`. L'ancienne clé unique
 * `consultation_draft` est reprise automatiquement à la première lecture.
 */
const LEGACY_KEY = 'consultation_draft'
const PREFIX = 'consultation_draft:'

type Db = ReturnType<typeof getDatabase>

interface StoredDraft {
  patient_id?: string
  savedAt?: string
  [key: string]: unknown
}

function parse(value: string): StoredDraft | null {
  try {
    return JSON.parse(value) as StoredDraft
  } catch {
    return null
  }
}

function migrateLegacy(db: Db) {
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(LEGACY_KEY) as { value: string } | undefined
  if (!row) return
  const draft = parse(row.value)
  if (draft?.patient_id) {
    // Un brouillon plus récent déjà enregistré par patient l'emporte.
    db.prepare('INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)').run(PREFIX + draft.patient_id, row.value)
  }
  db.prepare('DELETE FROM app_config WHERE key = ?').run(LEGACY_KEY)
}

function allDrafts(db: Db): StoredDraft[] {
  const rows = db.prepare('SELECT value FROM app_config WHERE key LIKE ?').all(`${PREFIX}%`) as Array<{ value: string }>
  return rows
    .map((row) => parse(row.value))
    .filter((draft): draft is StoredDraft => !!draft?.patient_id)
    .sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))
}

/**
 * GET ?patientId=…  → le brouillon de ce patient
 * GET ?list=1       → la liste légère des brouillons (patient et date)
 * GET               → le brouillon le plus récent (reprise après verrouillage)
 */
export async function GET(request: Request) {
  const db = getDatabase()
  migrateLegacy(db)
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')

  if (patientId) {
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(PREFIX + patientId) as { value: string } | undefined
    return NextResponse.json({ draft: row ? parse(row.value) : null })
  }

  const drafts = allDrafts(db)
  if (searchParams.get('list')) {
    return NextResponse.json({
      drafts: drafts.map((draft) => ({
        patient_id: draft.patient_id,
        savedAt: draft.savedAt ?? null,
        // Un brouillon vide (séance ouverte sans rien saisir) ne compte pas
        hasContent: ['reason', 'anamnesis', 'examination', 'advice'].some(
          (field) => typeof draft[field] === 'string' && (draft[field] as string).trim().length > 0
        ),
      })),
    })
  }
  return NextResponse.json({ draft: drafts[0] ?? null })
}

export async function POST(request: Request) {
  const draft = (await request.json()) as StoredDraft
  if (!draft?.patient_id || typeof draft.patient_id !== 'string') {
    return NextResponse.json({ error: 'patient_id manquant' }, { status: 400 })
  }
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(
    PREFIX + draft.patient_id,
    JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
  )
  return NextResponse.json({ success: true })
}

/** DELETE ?patientId=… supprime le brouillon de ce patient, et lui seul. */
export async function DELETE(request: Request) {
  const db = getDatabase()
  const patientId = new URL(request.url).searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId manquant' }, { status: 400 })
  }
  db.prepare('DELETE FROM app_config WHERE key = ?').run(PREFIX + patientId)
  // Ancien format : ne le supprimer que s'il concerne ce patient.
  const legacy = db.prepare('SELECT value FROM app_config WHERE key = ?').get(LEGACY_KEY) as { value: string } | undefined
  if (legacy && parse(legacy.value)?.patient_id === patientId) {
    db.prepare('DELETE FROM app_config WHERE key = ?').run(LEGACY_KEY)
  }
  return NextResponse.json({ success: true })
}
