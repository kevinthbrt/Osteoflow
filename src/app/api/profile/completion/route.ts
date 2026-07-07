import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { getRegistrationLines } from '@/lib/practitioner/profession'

/**
 * GET /api/profile/completion
 *
 * Computes how complete the practitioner's setup is across five areas:
 *  - Profil praticien (identity + profession + registration number(s))
 *  - Cabinet (practice info + SIRET)
 *  - Facturation (at least one séance type, default rate, invoice prefix)
 *  - Email (email_settings row exists and is verified)
 *  - Objectifs (an annual revenue objective is defined + working weekdays are picked)
 *
 * Returns an overall percentage plus a per-area checklist used by the
 * dashboard ProfileCompletionWidget.
 */

interface CompletionArea {
  key: string
  label: string
  href: string
  complete: boolean
  missing: string[]
}

function notEmpty(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value != null
}

export async function GET() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: practitioner } = await db
    .from('practitioners')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
  }

  const p = practitioner as Record<string, unknown> & { id: string }

  // Count séance types (only active ones) and read the email settings in parallel.
  const [
    { count: sessionTypesCount },
    { data: emailSettings },
  ] = await Promise.all([
    db
      .from('session_types')
      .select('*', { count: 'exact', head: true })
      .eq('practitioner_id', p.id)
      .eq('is_active', true),
    db
      .from('email_settings')
      .select('is_verified')
      .eq('practitioner_id', p.id)
      .single(),
  ])

  // --- Profil praticien ---
  const profileMissing: string[] = []
  if (!notEmpty(p.first_name)) profileMissing.push('Prénom')
  if (!notEmpty(p.last_name)) profileMissing.push('Nom')
  if (!notEmpty(p.email)) profileMissing.push('Email')
  if (!notEmpty(p.phone)) profileMissing.push('Téléphone')
  if (!notEmpty(p.profession)) profileMissing.push('Profession')
  if (getRegistrationLines(p as { profession?: string | null; rpps?: string | null; rpe?: string | null; rne?: string | null }).length === 0) {
    profileMissing.push("Numéro d'enregistrement (RPPS / RPE / RNE)")
  }

  // --- Cabinet ---
  const practiceMissing: string[] = []
  if (!notEmpty(p.practice_name)) practiceMissing.push('Nom du cabinet')
  if (!notEmpty(p.address)) practiceMissing.push('Adresse')
  if (!notEmpty(p.city)) practiceMissing.push('Ville')
  if (!notEmpty(p.postal_code)) practiceMissing.push('Code postal')
  if (!notEmpty(p.siret)) practiceMissing.push('SIRET')
  if (!notEmpty(p.booking_url)) practiceMissing.push('Lien de prise de rendez-vous en ligne')

  // --- Facturation ---
  const billingMissing: string[] = []
  if ((sessionTypesCount || 0) < 1) billingMissing.push('Au moins un type de séance')
  if (!(typeof p.default_rate === 'number' && p.default_rate > 0)) billingMissing.push('Tarif par défaut')
  if (!notEmpty(p.invoice_prefix)) billingMissing.push('Préfixe de facture')

  // --- Email ---
  const emailMissing: string[] = []
  if (!emailSettings || !emailSettings.is_verified) {
    emailMissing.push("Configurer et vérifier l'envoi d'emails")
  }

  // --- Objectifs ---
  const objectivesMissing: string[] = []
  if (!(typeof p.annual_revenue_objective === 'number' && p.annual_revenue_objective > 0)) {
    objectivesMissing.push("Définir un objectif de chiffre d'affaires annuel")
  }
  if (!(Array.isArray(p.working_weekdays) && p.working_weekdays.length > 0)) {
    objectivesMissing.push('Choisir vos jours travaillés')
  }

  const areas: CompletionArea[] = [
    {
      key: 'profile',
      label: 'Profil praticien',
      href: '/settings?tab=profile',
      complete: profileMissing.length === 0,
      missing: profileMissing,
    },
    {
      key: 'practice',
      label: 'Cabinet',
      href: '/settings?tab=profile',
      complete: practiceMissing.length === 0,
      missing: practiceMissing,
    },
    {
      key: 'billing',
      label: 'Facturation',
      href: '/settings?tab=invoices',
      complete: billingMissing.length === 0,
      missing: billingMissing,
    },
    {
      key: 'email',
      label: 'Email',
      href: '/settings?tab=email-connection',
      complete: emailMissing.length === 0,
      missing: emailMissing,
    },
    {
      key: 'objectives',
      label: 'Objectifs',
      href: '/settings?tab=objectives',
      complete: objectivesMissing.length === 0,
      missing: objectivesMissing,
    },
  ]

  const completedCount = areas.filter((a) => a.complete).length
  const percentage = Math.round((completedCount / areas.length) * 100)

  return NextResponse.json({ percentage, completedCount, total: areas.length, areas })
}
