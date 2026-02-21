/**
 * Offline license verification — Next.js side (API routes).
 *
 * Mirror of electron/license.ts; kept separate because Electron main and
 * Next.js server have different module resolution paths.
 *
 * License key format: <base64url(payload_json)>.<base64url(signature_der)>
 */

import { createVerify } from 'crypto'
import fs from 'fs'
import path from 'path'

// ─── Public key (same key as in electron/license.ts) ──────────────────────────
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0TMee4/Q0l9oW+yeb+sM2JKkaml5
UL2trqaWA1e5iDBl1KPwJ1c/EZ1X6xPsCTrXQo51F3VTl96q6j7q2W5qBQ==
-----END PUBLIC KEY-----`

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LicensePayload {
  customer: string
  email: string
  issuedAt: string
  expiresAt: string | null
  version: string
}

export interface LicenseResult {
  valid: boolean
  payload?: LicensePayload
  error?: string
}

// ─── Verification ─────────────────────────────────────────────────────────────

export function verifyLicense(licenseKey: string): LicenseResult {
  try {
    const trimmed = licenseKey.trim()
    const dotIndex = trimmed.lastIndexOf('.')
    if (dotIndex === -1) {
      return { valid: false, error: 'Format de licence invalide' }
    }

    const payloadB64 = trimmed.slice(0, dotIndex)
    const signatureB64 = trimmed.slice(dotIndex + 1)

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const payload: LicensePayload = JSON.parse(payloadJson)

    if (!payload.customer || !payload.email || !payload.issuedAt) {
      return { valid: false, error: 'Données de licence incomplètes' }
    }

    // Check expiry
    if (payload.expiresAt) {
      const expiry = new Date(payload.expiresAt)
      if (expiry < new Date()) {
        return { valid: false, error: `Licence expirée le ${expiry.toLocaleDateString('fr-FR')}` }
      }
    }

    // Verify ECDSA signature
    const verify = createVerify('SHA256')
    verify.update(payloadJson)
    verify.end()
    const isValid = verify.verify(PUBLIC_KEY, signatureB64, 'base64url')

    if (!isValid) {
      return { valid: false, error: 'Signature de licence invalide' }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, error: 'Clé de licence invalide' }
  }
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

/**
 * Path to the license file.
 * Uses ELECTRON_USERDATA env var set by the Electron main process.
 * Falls back gracefully when running outside Electron (e.g. Vercel).
 */
export function getLicenseFilePath(): string | null {
  const userData = process.env.ELECTRON_USERDATA
  if (!userData) return null
  return path.join(userData, 'license.key')
}

export function storeLicense(licenseKey: string): void {
  const filePath = getLicenseFilePath()
  if (!filePath) throw new Error('ELECTRON_USERDATA non défini')
  fs.writeFileSync(filePath, licenseKey.trim(), 'utf-8')
}

export function readStoredLicense(): string | null {
  const filePath = getLicenseFilePath()
  if (!filePath) return null
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim()
    }
  } catch {
    // Unreadable
  }
  return null
}
