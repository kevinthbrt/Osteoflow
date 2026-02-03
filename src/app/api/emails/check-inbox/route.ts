import { NextResponse } from 'next/server'

// This endpoint is called by cron to check all practitioners' inboxes
// GET /api/emails/check-inbox?secret=CRON_SECRET

export async function GET(request: Request) {
  const startTime = Date.now()

  // Verify cron secret
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  // Accept both env CRON_SECRET and local desktop cron secret
  if (secret !== 'local-desktop-cron' && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { createServiceClient } = await import('@/lib/db/server')
    const { fetchNewEmails, htmlToPlainText, extractReplyContent } = await import('@/lib/email/imap-service')
    const db = await createServiceClient()
    // Fetch all practitioners with enabled email sync
    const { data: emailSettings, error: settingsError } = await db
      .from('email_settings')
      .select(`
        id,
        practitioner_id,
        imap_host,
        imap_port,
        imap_secure,
        imap_user,
        imap_password,
        from_email,
        last_sync_uid,
        sync_enabled
      `)
      .eq('sync_enabled', true)
      .eq('is_verified', true)

    if (settingsError) {
      console.error('Error fetching email settings:', settingsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!emailSettings || emailSettings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No practitioners with email sync enabled',
        processed: 0,
        duration: Date.now() - startTime,
      })
    }

    const results: Array<{
      practitioner_id: string
      emails_fetched: number
      emails_matched: number
      error?: string
    }> = []

    // Process each practitioner's inbox
    for (const settings of emailSettings) {
      try {
        // Fetch new emails from IMAP
        const fetchResult = await fetchNewEmails(
          {
            imap_host: settings.imap_host,
            imap_port: settings.imap_port,
            imap_secure: settings.imap_secure,
            imap_user: settings.imap_user,
            imap_password: settings.imap_password,
          },
          settings.last_sync_uid || 0
        )

        if (!fetchResult.success) {
          // Update error status
          await db
            .from('email_settings')
            .update({
              last_error: fetchResult.error,
              last_error_at: new Date().toISOString(),
            })
            .eq('id', settings.id)

          results.push({
            practitioner_id: settings.practitioner_id,
            emails_fetched: 0,
            emails_matched: 0,
            error: fetchResult.error,
          })
          continue
        }

        let matchedCount = 0

        // Process each email
        for (const email of fetchResult.emails) {
          // Check if this email is already processed (by external_email_id)
          const { data: existingMsg } = await db
            .from('messages')
            .select('id')
            .eq('external_email_id', email.messageId)
            .single()

          if (existingMsg) {
            continue // Already processed
          }

          // Try to find a matching patient by email
          const { data: patient } = await db
            .from('patients')
            .select('id, first_name, last_name, email')
            .eq('practitioner_id', settings.practitioner_id)
            .eq('email', email.from.email)
            .single()

          // Find or create a conversation
          let conversationId: string

          if (patient) {
            // Patient found - find or create patient conversation
            const { data: existingConversation } = await db
              .from('conversations')
              .select('id')
              .eq('practitioner_id', settings.practitioner_id)
              .eq('patient_id', patient.id)
              .single()

            if (existingConversation) {
              conversationId = existingConversation.id
            } else {
              // Create new patient conversation
              const { data: newConversation, error: convError } = await db
                .from('conversations')
                .insert({
                  practitioner_id: settings.practitioner_id,
                  patient_id: patient.id,
                  subject: `Conversation avec ${patient.first_name} ${patient.last_name}`,
                  last_message_at: email.date.toISOString(),
                  unread_count: 1,
                })
                .select('id')
                .single()

              if (convError || !newConversation) {
                console.error('Error creating conversation:', convError)
                continue
              }

              conversationId = newConversation.id
            }
          } else {
            // Unknown sender - find or create external conversation
            const { data: existingExtConv } = await db
              .from('conversations')
              .select('id')
              .eq('practitioner_id', settings.practitioner_id)
              .eq('external_email', email.from.email)
              .is('patient_id', null)
              .single()

            if (existingExtConv) {
              conversationId = existingExtConv.id
            } else {
              // Extract name from email (e.g., "John Doe <john@example.com>" -> "John Doe")
              const senderName = email.from.name || email.from.email.split('@')[0]

              // Create new external conversation
              const { data: newExtConv, error: extConvError } = await db
                .from('conversations')
                .insert({
                  practitioner_id: settings.practitioner_id,
                  patient_id: null, // No linked patient
                  external_email: email.from.email,
                  external_name: senderName,
                  subject: `Conversation avec ${senderName}`,
                  last_message_at: email.date.toISOString(),
                  unread_count: 1,
                })
                .select('id')
                .single()

              if (extConvError || !newExtConv) {
                console.error('Error creating external conversation:', extConvError)
                continue
              }

              conversationId = newExtConv.id
            }
          }

          // Extract message content
          let content = email.textContent || ''
          if (!content && email.htmlContent) {
            content = htmlToPlainText(email.htmlContent)
          }

          // Extract just the reply (remove quoted text)
          content = extractReplyContent(content)

          if (!content.trim()) {
            content = '(contenu vide ou pièce jointe uniquement)'
          }

          // Create the message
          const { error: msgError } = await db.from('messages').insert({
            conversation_id: conversationId,
            content: content.substring(0, 10000), // Limit content length
            direction: 'incoming',
            channel: 'email',
            status: 'delivered',
            sent_at: email.date.toISOString(),
            delivered_at: new Date().toISOString(),
            email_subject: email.subject,
            external_email_id: email.messageId,
            from_email: email.from.email,
            to_email: settings.from_email,
          })

          if (msgError) {
            console.error('Error creating message:', msgError)
            continue
          }

          // Update conversation's last_message_at and increment unread_count
          const { data: conv } = await db
            .from('conversations')
            .select('unread_count')
            .eq('id', conversationId)
            .single()

          await db
            .from('conversations')
            .update({
              last_message_at: email.date.toISOString(),
              unread_count: ((conv?.unread_count as number) || 0) + 1,
            })
            .eq('id', conversationId)

          matchedCount++
        }

        // Update last sync UID and clear error
        await db
          .from('email_settings')
          .update({
            last_sync_uid: fetchResult.lastUid,
            last_sync_at: new Date().toISOString(),
            last_error: null,
            last_error_at: null,
          })
          .eq('id', settings.id)

        results.push({
          practitioner_id: settings.practitioner_id,
          emails_fetched: fetchResult.emails.length,
          emails_matched: matchedCount,
        })
      } catch (error) {
        console.error(`Error processing inbox for ${settings.practitioner_id}:`, error)
        results.push({
          practitioner_id: settings.practitioner_id,
          emails_fetched: 0,
          emails_matched: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const totalFetched = results.reduce((sum, r) => sum + r.emails_fetched, 0)
    const totalMatched = results.reduce((sum, r) => sum + r.emails_matched, 0)

    return NextResponse.json({
      success: true,
      processed: emailSettings.length,
      total_emails_fetched: totalFetched,
      total_emails_matched: totalMatched,
      duration: Date.now() - startTime,
      results,
    })
  } catch (error) {
    console.error('Check inbox error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
