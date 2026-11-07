/**
 * Notarize the macOS app after code signing.
 * Called by electron-builder via `afterSign` hook (its built-in notarization
 * is turned off in package.json: `mac.notarize: false`).
 *
 * Set these env vars in CI (GitHub Actions secrets):
 *   APPLE_ID                    : your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD : app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               : 10-char team ID from developer.apple.com/account
 *
 * Stapling attaches Apple's ticket to the app so Gatekeeper can check it
 * offline. It fetches the ticket from Apple's CloudKit, which regularly drops
 * the connection from CI runners ("Error 68"). The default retries are only a
 * few seconds apart, so we retry for several minutes, and if stapling still
 * fails we carry on: the app is notarized, and Gatekeeper checks the ticket
 * online on first launch.
 */

const path = require('path')

const STAPLE_ATTEMPTS = 8
const STAPLE_DELAY_MS = 30_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Skip on local dev builds where credentials aren't available.
  if (!process.env.APPLE_ID) {
    console.log('[notarize] APPLE_ID not set, skipping notarization (local build)')
    return
  }

  const { notarizeAndWaitForNotaryTool } = require('@electron/notarize/lib/notarytool')
  const { stapleApp } = require('@electron/notarize/lib/staple')
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`[notarize] Notarizing ${appPath} …`)
  await notarizeAndWaitForNotaryTool({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
  console.log('[notarize] Notarized.')

  for (let attempt = 1; attempt <= STAPLE_ATTEMPTS; attempt++) {
    try {
      await stapleApp({ appPath })
      console.log('[notarize] Ticket stapled.')
      return
    } catch (error) {
      const last = attempt === STAPLE_ATTEMPTS
      console.warn(`[notarize] Stapling failed (attempt ${attempt}/${STAPLE_ATTEMPTS}): ${error.message.split('\n')[0]}`)
      if (!last) await sleep(STAPLE_DELAY_MS)
    }
  }
  console.warn('[notarize] Could not staple the ticket. The app is notarized; Gatekeeper will check it online.')
}
