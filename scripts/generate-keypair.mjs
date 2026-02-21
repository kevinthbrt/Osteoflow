/**
 * Generate a new ECDSA P-256 key pair for Osteoflow license signing.
 *
 * Run once to create your keys:
 *   node scripts/generate-keypair.mjs
 *
 * IMPORTANT:
 *  - Save the private key somewhere safe (password manager, encrypted drive).
 *  - Paste the public key into electron/license.ts AND src/lib/license.ts.
 *  - NEVER commit the private key to git (*.pem is already in .gitignore).
 */

import { generateKeyPairSync } from 'crypto'
import { writeFileSync } from 'fs'

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const privateKeyPath = new URL('./osteoflow_private.pem', import.meta.url).pathname
writeFileSync(privateKeyPath, privateKey, 'utf-8')

console.log('──────────────────────────────────────────────────')
console.log('✓  Clé privée sauvegardée dans scripts/osteoflow_private.pem')
console.log('   → Gardez-la en lieu sûr, ne la commitez JAMAIS.')
console.log('')
console.log('Clé publique (à copier dans electron/license.ts et src/lib/license.ts):')
console.log('──────────────────────────────────────────────────')
console.log(publicKey)
