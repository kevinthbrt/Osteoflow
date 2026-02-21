/**
 * Offline license verification for Osteoflow desktop application.
 *
 * Uses ECDSA P-256 signatures — no server required.
 * The private key is kept secret by the developer and used to sign licenses.
 * Only the public key is embedded here.
 *
 * License key format: <base64url(payload_json)>.<base64url(signature_der)>
 */

import { createVerify } from 'crypto'
import fs from 'fs'
import path from 'path'

// ─── Public key (embedded, safe to distribute) ────────────────────────────────
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

export function getLicenseFilePath(userData: string): string {
  return path.join(userData, 'license.key')
}

export function readStoredLicense(userData: string): string | null {
  try {
    const filePath = getLicenseFilePath(userData)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim()
    }
  } catch {
    // File unreadable
  }
  return null
}

/**
 * Check whether the app has a valid stored license.
 * Returns the verification result so the caller can inspect the payload or error.
 */
export function checkStoredLicense(userData: string): LicenseResult {
  const stored = readStoredLicense(userData)
  if (!stored) {
    return { valid: false, error: 'Aucune licence trouvée' }
  }
  return verifyLicense(stored)
}
