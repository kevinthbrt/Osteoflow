import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')
    const { getRelaunchCandidates } = await import('@/lib/patients/relaunch')
    const { defaultEmailTemplates, replaceTemplateVariables } = await import('@/lib/email/templates')

    const { months } = await request.json()
    const monthsValue = Math.max(1, Number(months) || 3)

    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: practitioner } = await db
      .from('practitioners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Praticien non trouvé' }, { status: 404 })
    }

    const { data: emailSettings } = await db
      .from('email_settings')
      .select('id')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (!emailSettings) {
      return NextResponse.json(
        { error: 'Aucun paramètre email configuré. Configurez vos emails dans les paramètres.' },
        { status: 400 }
      )
    }

    const candidates = getRelaunchCandidates(practitioner.id, monthsValue, practitioner.relaunch_since_date)

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'Aucun patient à relancer sur cette période' }, { status: 400 })
    }

    const template = defaultEmailTemplates.patient_relaunch
    const subject = replaceTemplateVariables(template.subject, {
      practice_name: practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`,
    })

    const rawDb = getDatabase()
    const campaignId = randomUUID()
    const nowIso = new Date().toISOString()

    const insertCampaign = rawDb.prepare(
      `INSERT INTO email_campaigns (id, practitioner_id, type, subject, content, status, total_recipients, created_at)
       VALUES (?, ?, 'relaunch', ?, ?, 'pending', ?, ?)`
    )
    const insertRecipient = rawDb.prepare(
      `INSERT INTO email_campaign_recipients (id, campaign_id, patient_id, email, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
    )

    const tx = rawDb.transaction(() => {
      insertCampaign.run(campaignId, practitioner.id, subject, template.body, candidates.length, nowIso)
      for (const patient of candidates) {
        insertRecipient.run(randomUUID(), campaignId, patient.id, patient.email, nowIso)
      }
    })
    tx()

    import('@/lib/email/campaign-processor')
      .then(({ processCampaignBatch }) => processCampaignBatch())
      .catch((e) => console.error('[Relaunch] Immediate processing kick failed:', e))

    return NextResponse.json({ success: true, campaignId, total: candidates.length })
  } catch (error) {
    console.error('Error creating relaunch campaign:', error)
    return NextResponse.json({ error: 'Erreur lors du lancement de la relance' }, { status: 500 })
  }
}
