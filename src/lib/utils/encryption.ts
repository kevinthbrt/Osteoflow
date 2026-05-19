import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const ENCRYPTED_PREFIX = 'enc:'

export function encryptValue(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return ENCRYPTED_PREFIX + [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptValue(data: string, keyHex: string): string {
  if (!data.startsWith(ENCRYPTED_PREFIX)) return data // plaintext fallback for migration
  const payload = data.slice(ENCRYPTED_PREFIX.length)
  const [ivHex, authTagHex, encryptedHex] = payload.split(':')
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}

export function getOrCreateEncryptionKey(): string {
  const { getDatabase } = require('@/lib/database/connection')
  const db = getDatabase()
  const row = db.prepare("SELECT value FROM app_config WHERE key = 'email_encryption_key'").get() as { value: string } | undefined
  if (row?.value) return row.value
  const key = randomBytes(32).toString('hex')
  db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('email_encryption_key', ?)").run(key)
  return key
}
