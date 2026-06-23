/**
 * Notarize the macOS app after code signing.
 * Called by electron-builder via `afterSign` hook.
 *
 * Set these env vars in CI (GitHub Actions secrets):
 *   APPLE_ID                  — your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — app-specific password from appleid.apple.com
 *   APPLE_TEAM_ID             — 10-char team ID from developer.apple.com/account
 */

const path = require('path')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Skip on local dev builds where credentials aren't available.
  if (!process.env.APPLE_ID) {
    console.log('[notarize] APPLE_ID not set — skipping notarization (local build)')
    return
  }

  const { notarize } = require('@electron/notarize')
  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`[notarize] Notarizing ${appPath} …`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  })
  console.log('[notarize] Done.')
}
