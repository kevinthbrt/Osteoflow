import { getOrCreateEncryptionKey, decryptValue } from '@/lib/utils/encryption'

export interface DecryptedEmailSettings {
  id: string
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string
  smtp_password: string
  imap_host: string
  imap_port: number
  imap_secure: boolean
  imap_user: string
  imap_password: string
  from_name: string | null
  from_email: string
  sync_enabled: boolean
  is_verified: boolean
  last_sync_at: string | null
  last_sync_uid: number
}

export async function getDecryptedEmailSettings(practitionerId: string): Promise<DecryptedEmailSettings | null> {
  const { createClient } = await import('@/lib/db/server')
  const db = await createClient()

  const { data: settings, error } = await db
    .from('email_settings')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .single()

  if (error || !settings) return null

  const key = getOrCreateEncryptionKey()

  return {
    ...settings,
    smtp_password: decryptValue(settings.smtp_password, key),
    imap_password: decryptValue(settings.imap_password, key),
  } as DecryptedEmailSettings
}
