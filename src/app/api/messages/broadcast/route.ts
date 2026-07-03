import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    const { createClient } = await import('@/lib/db/server')
    const { getDatabase } = await import('@/lib/database/connection')
    const { groupPatientsByEmail } = await import('@/lib/email/recipient-grouping')
    const { getBroadcastRecipients } = await import('@/lib/patients/broadcast-recipients')

    const { content, activeSinceDate } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: 'Le contenu du message est requis' },
        { status: 400 }
      )
    }

    if (activeSinceDate && Number.isNaN(new Date(activeSinceDate).getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    }

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
      .select('*')
      .eq('practitioner_id', practitioner.id)
      .eq('is_verified', true)
      .single()

    if (!emailSettings) {
      return NextResponse.json(
        { error: 'Aucun paramètre email configuré. Configurez vos emails dans les paramètres.' },
        { status: 400 }
      )
    }

    const patientsWithEmail = getBroadcastRecipients(practitioner.id, activeSinceDate)

    if (patientsWithEmail.length === 0) {
      return NextResponse.json(
        { error: 'Aucun patient avec une adresse email trouvé' },
        { status: 400 }
      )
    }

    const subject = `Message de ${practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}`

    // Patients sharing the same address (e.g. a parent's email used for
    // several children) get grouped so only one physical email is sent per
    // address, while every patient's conversation still records the message.
    const recipientGroups = groupPatientsByEmail(patientsWithEmail)
    const deduplicated = patientsWithEmail.length - recipientGroups.length

    // Sending happens in the background (see campaign-processor.ts, triggered by
    // the app's cron every ~20s) so this request returns instantly regardless of
    // list size — a synchronous loop over thousands of patients would otherwise
    // time out and hammer the SMTP server with one connection per email.
    const rawDb = getDatabase()
    const campaignId = randomUUID()
    const nowIso = new Date().toISOString()

    const insertCampaign = rawDb.prepare(
      `INSERT INTO email_campaigns (id, practitioner_id, type, subject, content, status, total_recipients, created_at)
       VALUES (?, ?, 'broadcast', ?, ?, 'pending', ?, ?)`
    )
    const insertRecipient = rawDb.prepare(
      `INSERT INTO email_campaign_recipients (id, campaign_id, patient_id, email, status, linked_patient_ids, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    )

    const tx = rawDb.transaction(() => {
      insertCampaign.run(campaignId, practitioner.id, subject, content, recipientGroups.length, nowIso)
      for (const group of recipientGroups) {
        insertRecipient.run(
          randomUUID(),
          campaignId,
          group.primaryId,
          group.email,
          group.linkedIds.length > 0 ? JSON.stringify(group.linkedIds) : null,
          nowIso
        )
      }
    })
    tx()

    // Kick off the first batch immediately instead of waiting for the next
    // cron tick, without blocking this response on the actual sending.
    import('@/lib/email/campaign-processor')
      .then(({ processCampaignBatch }) => processCampaignBatch())
      .catch((e) => console.error('[Broadcast] Immediate processing kick failed:', e))

    return NextResponse.json({
      success: true,
      campaignId,
      total: recipientGroups.length,
      deduplicated,
    })
  } catch (error) {
    console.error('Error in broadcast:', error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de la diffusion" },
      { status: 500 }
    )
  }
}
