/**
 * Background processor for email campaigns (mass broadcast / patient relaunch).
 *
 * Recipients are sent in small batches instead of all at once so that:
 *  - creating a campaign for thousands of patients returns instantly (no HTTP
 *    request ever waits on the actual sending)
 *  - a single pooled SMTP connection is reused per batch instead of opening
 *    and closing one connection per email
 *  - the cron can call this repeatedly (see server-cron.ts / electron/cron.ts)
 *    until every recipient has been processed
 */

import { randomUUID } from 'crypto'
import { getDatabase } from '@/lib/database/connection'
import { getDecryptedEmailSettings } from './get-email-settings'
import { sendBulkEmails, createHtmlEmail } from './smtp-service'
import { createPatientRelaunchHtmlEmail, replaceTemplateVariables } from './templates'
import { joinNames } from './recipient-grouping'
import { resolveBookingCta } from './contact-cta'
import { getProfessionLabel } from '@/lib/practitioner/profession'

const BATCH_SIZE = 25

// Gmail's free-account cap is 500 recipients/day. We stay under it so the
// practitioner's other transactional emails (factures, suivi J+7, conseils
// post-séance...) — which don't go through campaigns — always have headroom
// to send on the same day. Once the cap is hit, remaining recipients simply
// stay 'pending' and get picked up again once the daily count resets.
export const DAILY_SEND_LIMIT = 450

interface CampaignRow {
  id: string
  practitioner_id: string
  type: 'broadcast' | 'relaunch'
  subject: string
  content: string
  status: string
  include_booking_button: number
}

interface RecipientRow {
  id: string
  patient_id: string
  email: string
  linked_patient_ids: string | null
}

function allPatientIds(recipient: RecipientRow): string[] {
  const linked: string[] = recipient.linked_patient_ids ? JSON.parse(recipient.linked_patient_ids) : []
  return [recipient.patient_id, ...linked]
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getSentTodayCount(db: ReturnType<typeof getDatabase>, practitionerId: string, todayIso: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM email_campaign_recipients r
       JOIN email_campaigns c ON c.id = r.campaign_id
       WHERE c.practitioner_id = ? AND r.status = 'sent' AND r.sent_at >= ?`
    )
    .get(practitionerId, todayIso) as { c: number }
  return row.c
}

/**
 * Public helper for API routes: tells the UI whether a campaign is currently
 * paused waiting for tomorrow's Gmail quota, so it can show the right message
 * instead of looking stuck.
 */
export function getDailySendStatus(practitionerId: string): { sentToday: number; remainingToday: number; limitReached: boolean } {
  const db = getDatabase()
  const sentToday = getSentTodayCount(db, practitionerId, startOfTodayIso())
  const remainingToday = Math.max(0, DAILY_SEND_LIMIT - sentToday)
  return { sentToday, remainingToday, limitReached: remainingToday === 0 }
}

/**
 * Process one batch (up to BATCH_SIZE recipients, capped by the remaining
 * daily budget) for every campaign that still has pending recipients. Safe
 * to call repeatedly/concurrently — each call only claims recipients that
 * are still 'pending' at read time.
 */
export async function processCampaignBatch(): Promise<{ processed: number }> {
  const db = getDatabase()
  const todayIso = startOfTodayIso()

  const activeCampaigns = db
    .prepare(`SELECT * FROM email_campaigns WHERE status IN ('pending', 'processing') ORDER BY created_at ASC`)
    .all() as CampaignRow[]

  let totalProcessed = 0
  // Tracks how many emails have gone out today per practitioner across this
  // run, so several campaigns for the same practitioner share one budget.
  const sentTodayByPractitioner = new Map<string, number>()

  for (const campaign of activeCampaigns) {
    if (!sentTodayByPractitioner.has(campaign.practitioner_id)) {
      sentTodayByPractitioner.set(campaign.practitioner_id, getSentTodayCount(db, campaign.practitioner_id, todayIso))
    }
    const remainingBudget = DAILY_SEND_LIMIT - (sentTodayByPractitioner.get(campaign.practitioner_id) || 0)

    if (remainingBudget <= 0) {
      // Daily cap reached — leave this campaign's remaining recipients
      // pending, it resumes automatically once the count rolls over.
      continue
    }

    const pending = db
      .prepare(`SELECT id, patient_id, email, linked_patient_ids FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT ?`)
      .all(campaign.id, Math.min(BATCH_SIZE, remainingBudget)) as RecipientRow[]

    if (pending.length === 0) {
      finalizeCampaignIfDone(db, campaign.id)
      continue
    }

    if (campaign.status === 'pending') {
      db.prepare(`UPDATE email_campaigns SET status = 'processing' WHERE id = ?`).run(campaign.id)
    }

    const practitioner = db.prepare(`SELECT * FROM practitioners WHERE id = ?`).get(campaign.practitioner_id) as
      | Record<string, unknown>
      | undefined

    if (!practitioner) {
      failCampaign(db, campaign.id, 'Praticien introuvable')
      continue
    }

    const emailSettings = await getDecryptedEmailSettings(campaign.practitioner_id)
    if (!emailSettings || !emailSettings.is_verified) {
      failCampaign(db, campaign.id, 'Aucun paramètre email vérifié')
      continue
    }

    const practitionerName = `${practitioner.first_name} ${practitioner.last_name}`
    const specialty = getProfessionLabel(
      practitioner.profession as string | null | undefined,
      practitioner.specialty as string | null | undefined
    )

    const patientNames = new Map<string, string>()
    if (campaign.type === 'relaunch') {
      const ids = pending.flatMap(allPatientIds)
      const placeholders = ids.map(() => '?').join(',')
      const rows = db
        .prepare(`SELECT id, first_name FROM patients WHERE id IN (${placeholders})`)
        .all(...ids) as Array<{ id: string; first_name: string }>
      for (const row of rows) patientNames.set(row.id, row.first_name)
    }

    const sendItems = pending.map((recipient) => {
      if (campaign.type === 'relaunch') {
        // When several patients share this address (e.g. siblings under a
        // parent's email), greet all of them by name in one email instead
        // of picking one arbitrarily.
        const greetingName = joinNames(allPatientIds(recipient).map((id) => patientNames.get(id) || ''))
        const bodyText = replaceTemplateVariables(campaign.content, {
          patient_first_name: greetingName,
        })
        const html = createPatientRelaunchHtmlEmail({
          bodyText,
          practitionerName,
          practiceName: practitioner.practice_name as string | null,
          specialty,
          primaryColor: (practitioner.primary_color as string) || '#2563eb',
          bookingUrl: practitioner.booking_url as string | null,
          contactEmail: practitioner.email as string | null,
          contactPhone: practitioner.phone as string | null,
        })
        return { recipient, html, textContent: bodyText }
      }

      const cta = campaign.include_booking_button
        ? resolveBookingCta({
            booking_url: practitioner.booking_url as string | null,
            email: practitioner.email as string | null,
            phone: practitioner.phone as string | null,
          }) || undefined
        : undefined
      const html = createHtmlEmail(campaign.content, practitioner as Record<string, string | undefined>, { cta })
      return { recipient, html, textContent: campaign.content }
    })

    const results = await sendBulkEmails(
      {
        smtp_host: emailSettings.smtp_host,
        smtp_port: emailSettings.smtp_port,
        smtp_secure: emailSettings.smtp_secure,
        smtp_user: emailSettings.smtp_user,
        smtp_password: emailSettings.smtp_password,
        from_name: emailSettings.from_name || undefined,
        from_email: emailSettings.from_email,
      },
      campaign.subject,
      sendItems.map((item) => ({ to: item.recipient.email, html: item.html }))
    )

    let batchSent = 0
    let batchFailed = 0
    const nowIso = new Date().toISOString()

    for (let i = 0; i < sendItems.length; i++) {
      const { recipient, textContent } = sendItems[i]
      const result = results[i]

      if (result.success) {
        batchSent++

        // One physical email may cover several patients sharing this address
        // (e.g. siblings under a parent's email) — log the message and update
        // relaunch tracking for every one of them, not just the primary.
        let firstMessageId: string | null = null
        for (const patientId of allPatientIds(recipient)) {
          let conversationId: string
          const existingConv = db
            .prepare(`SELECT id FROM conversations WHERE practitioner_id = ? AND patient_id = ? LIMIT 1`)
            .get(campaign.practitioner_id, patientId) as { id: string } | undefined

          if (existingConv) {
            conversationId = existingConv.id
          } else {
            conversationId = randomUUID()
            db.prepare(`INSERT INTO conversations (id, practitioner_id, patient_id, subject) VALUES (?, ?, ?, ?)`).run(
              conversationId,
              campaign.practitioner_id,
              patientId,
              campaign.type === 'relaunch' ? 'Relance patient' : 'Diffusion'
            )
          }

          const messageId = randomUUID()
          db.prepare(
            `INSERT INTO messages (id, conversation_id, content, direction, channel, status, sent_at, email_subject, email_message_id, to_email, from_email)
             VALUES (?, ?, ?, 'outgoing', 'email', 'sent', ?, ?, ?, ?, ?)`
          ).run(
            messageId,
            conversationId,
            textContent,
            nowIso,
            campaign.subject,
            result.messageId || null,
            recipient.email,
            emailSettings.from_email
          )
          firstMessageId = firstMessageId || messageId

          db.prepare(`UPDATE conversations SET last_message_at = ? WHERE id = ?`).run(nowIso, conversationId)

          if (campaign.type === 'relaunch') {
            db.prepare(
              `UPDATE patients SET last_relaunch_sent_at = ?, relaunch_count = COALESCE(relaunch_count, 0) + 1 WHERE id = ?`
            ).run(nowIso, patientId)
          }
        }

        db.prepare(`UPDATE email_campaign_recipients SET status = 'sent', sent_at = ?, message_id = ? WHERE id = ?`).run(
          nowIso,
          firstMessageId,
          recipient.id
        )
      } else {
        batchFailed++
        db.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error_message = ? WHERE id = ?`).run(
          result.error || 'Erreur inconnue',
          recipient.id
        )
      }
    }

    db.prepare(`UPDATE email_campaigns SET sent_count = sent_count + ?, failed_count = failed_count + ? WHERE id = ?`).run(
      batchSent,
      batchFailed,
      campaign.id
    )

    sentTodayByPractitioner.set(
      campaign.practitioner_id,
      (sentTodayByPractitioner.get(campaign.practitioner_id) || 0) + batchSent
    )

    totalProcessed += pending.length
    finalizeCampaignIfDone(db, campaign.id)
  }

  return { processed: totalProcessed }
}

function finalizeCampaignIfDone(db: ReturnType<typeof getDatabase>, campaignId: string): void {
  const remaining = db
    .prepare(`SELECT COUNT(*) as c FROM email_campaign_recipients WHERE campaign_id = ? AND status = 'pending'`)
    .get(campaignId) as { c: number }
  if (remaining.c === 0) {
    db.prepare(`UPDATE email_campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ? AND status != 'completed'`).run(
      campaignId
    )
  }
}

function failCampaign(db: ReturnType<typeof getDatabase>, campaignId: string, message: string): void {
  db.prepare(`UPDATE email_campaigns SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`).run(
    message,
    campaignId
  )
  db.prepare(`UPDATE email_campaign_recipients SET status = 'failed', error_message = ? WHERE campaign_id = ? AND status = 'pending'`).run(
    message,
    campaignId
  )
}
