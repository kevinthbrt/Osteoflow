import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { testSmtpConnection } from '@/lib/email/smtp-service'
import { testImapConnection } from '@/lib/email/imap-service'
import { emailSettingsSchema } from '@/lib/validations/settings'

// GET /api/emails/settings - Get current email settings
export async function GET() {
  const db = await createClient()

  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get practitioner
  const { data: practitioner } = await db
    .from('practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
  }

  // Get email settings (without password for security)
  const { data: settings, error } = await db
    .from('email_settings')
    .select(`
      id,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      imap_host,
      imap_port,
      imap_secure,
      imap_user,
      from_name,
      from_email,
      sync_enabled,
      is_verified,
      last_sync_at,
      last_error,
      last_error_at,
      created_at,
      updated_at
    `)
    .eq('practitioner_id', practitioner.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching email settings:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ settings: settings || null })
}

// POST /api/emails/settings - Create or update email settings
export async function POST(request: Request) {
  const db = await createClient()

  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get practitioner
  const { data: practitioner } = await db
    .from('practitioners')
    .select('id, first_name, last_name, practice_name')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
  }

  const body = await request.json()

  // Validate input
  const validation = emailSettingsSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation error', details: validation.error.errors },
      { status: 400 }
    )
  }

  const data = validation.data

  // Test connections before saving
  const smtpTest = await testSmtpConnection({
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    smtp_secure: data.smtp_secure,
    smtp_user: data.smtp_user,
    smtp_password: data.smtp_password,
    from_email: data.from_email,
  })

  if (!smtpTest.success) {
    return NextResponse.json(
      {
        error: 'SMTP connection failed',
        details: smtpTest.error,
        field: 'smtp',
      },
      { status: 400 }
    )
  }

  const imapTest = await testImapConnection({
    imap_host: data.imap_host,
    imap_port: data.imap_port,
    imap_secure: data.imap_secure,
    imap_user: data.imap_user,
    imap_password: data.imap_password,
  })

  if (!imapTest.success) {
    return NextResponse.json(
      {
        error: 'IMAP connection failed',
        details: imapTest.error,
        field: 'imap',
      },
      { status: 400 }
    )
  }

  // Check if settings already exist
  const { data: existingSettings } = await db
    .from('email_settings')
    .select('id')
    .eq('practitioner_id', practitioner.id)
    .single()

  // Default from_name if not provided
  const fromName = data.from_name || [practitioner.first_name, practitioner.last_name].filter(Boolean).join(' ') || practitioner.practice_name

  const settingsData = {
    practitioner_id: practitioner.id,
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port,
    smtp_secure: data.smtp_secure,
    smtp_user: data.smtp_user,
    smtp_password: data.smtp_password,
    imap_host: data.imap_host,
    imap_port: data.imap_port,
    imap_secure: data.imap_secure,
    imap_user: data.imap_user,
    imap_password: data.imap_password,
    from_name: fromName,
    from_email: data.from_email,
    sync_enabled: data.sync_enabled,
    is_verified: true,
    last_error: null,
    last_error_at: null,
  }

  let result
  if (existingSettings) {
    // Update existing
    const { data: updated, error } = await db
      .from('email_settings')
      .update(settingsData)
      .eq('id', existingSettings.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating email settings:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    result = updated
  } else {
    // Insert new
    const { data: inserted, error } = await db
      .from('email_settings')
      .insert(settingsData)
      .select()
      .single()

    if (error) {
      console.error('Error creating email settings:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    result = inserted
  }

  // Return without passwords
  const { smtp_password: _sp, imap_password: _ip, ...safeResult } = result

  return NextResponse.json({
    success: true,
    settings: safeResult,
    message: 'Connexion email configurée avec succès',
  })
}

// DELETE /api/emails/settings - Remove email settings
export async function DELETE() {
  const db = await createClient()

  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get practitioner
  const { data: practitioner } = await db
    .from('practitioners')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) {
    return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
  }

  const { error } = await db
    .from('email_settings')
    .delete()
    .eq('practitioner_id', practitioner.id)

  if (error) {
    console.error('Error deleting email settings:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Configuration email supprimée',
  })
}
