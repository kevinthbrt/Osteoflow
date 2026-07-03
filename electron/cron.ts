/**
 * Local cron system for MyOsteoFlow desktop.
 *
 * Replaces the Vercel/Supabase cron jobs with local timers.
 * Runs periodic tasks:
 *   1. Follow-up emails (J+7)    - every 15 minutes
 *   2. Inbox sync (IMAP)         - every 5 minutes
 *   3. Survey response sync      - every 10 minutes
 *   4. License heartbeat         - every 30 minutes
 *      Calls Osteoupgrade API to verify the subscription is still active.
 *      If expired or concurrent session detected, sends 'license-expired'
 *      IPC event to the renderer so it can warn and redirect the user.
 *
 * Uses Node.js http module instead of fetch() to avoid issues
 * with Electron's Chromium network stack in the main process.
 */

import http from 'http'
import { BrowserWindow, Notification } from 'electron'

let followUpInterval: NodeJS.Timeout | null = null
let inboxInterval: NodeJS.Timeout | null = null
let surveySyncInterval: NodeJS.Timeout | null = null
let licenseInterval: NodeJS.Timeout | null = null
let backupReminderInterval: NodeJS.Timeout | null = null
let campaignInterval: NodeJS.Timeout | null = null

const FOLLOW_UP_INTERVAL    = 15 * 60 * 1000  // 15 minutes
const INBOX_INTERVAL        =  5 * 60 * 1000  //  5 minutes
const SURVEY_SYNC_INTERVAL  = 10 * 60 * 1000  // 10 minutes
const LICENSE_CHECK_INTERVAL = 30 * 60 * 1000 // 30 minutes
const BACKUP_CHECK_INTERVAL  =      60 * 1000 //  1 minute (vérifie l'heure du rappel)
const CAMPAIGN_INTERVAL      =      20 * 1000 // 20 secondes (diffusions/relances en masse)

// Date (YYYY-MM-DD) du dernier rappel de sauvegarde affiché — évite de notifier
// plusieurs fois le même jour. Réinitialisé au redémarrage de l'application.
let backupReminderNotifiedDate: string | null = null

/**
 * Make a local HTTP request using Node's http module.
 * This is reliable in Electron's main process unlike fetch().
 */
function localRequest(
  port: number,
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: 30000,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body })
        })
      }
    )

    req.on('error', (err) => reject(err))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })

    req.end()
  })
}

/**
 * Start all cron jobs.
 */
export function startCronJobs(port: number): void {
  console.log('[Cron] Starting background tasks...')

  // Follow-up emails (J+7)
  setTimeout(() => {
    runFollowUp(port)
    followUpInterval = setInterval(() => runFollowUp(port), FOLLOW_UP_INTERVAL)
  }, 15_000)

  // Inbox sync
  setTimeout(() => {
    runInboxSync(port)
    inboxInterval = setInterval(() => runInboxSync(port), INBOX_INTERVAL)
  }, 20_000)

  // Survey response sync
  setTimeout(() => {
    runSurveySync(port)
    surveySyncInterval = setInterval(() => runSurveySync(port), SURVEY_SYNC_INTERVAL)
  }, 30_000)

  // License heartbeat — first check 60s after launch, then every 30 min
  // Delay avoids hitting the API before the app is fully initialised.
  setTimeout(() => {
    runLicenseCheck(port)
    licenseInterval = setInterval(() => runLicenseCheck(port), LICENSE_CHECK_INTERVAL)
  }, 60_000)

  // Backup reminder — checks every minute whether it's time for the daily
  // backup reminder notification (hour configurable in settings, default 8am).
  setTimeout(() => {
    runBackupReminder(port)
    backupReminderInterval = setInterval(() => runBackupReminder(port), BACKUP_CHECK_INTERVAL)
  }, 45_000)

  // Email campaigns (broadcast/relance) — drains pending recipients quickly
  // so mass sends to thousands of patients don't wait on the 15min follow-up tick.
  setTimeout(() => {
    runCampaignProcessing(port)
    campaignInterval = setInterval(() => runCampaignProcessing(port), CAMPAIGN_INTERVAL)
  }, 20_000)

  console.log(
    `[Cron] Follow-up: ${FOLLOW_UP_INTERVAL / 60000}min | ` +
    `Inbox: ${INBOX_INTERVAL / 60000}min | ` +
    `Survey sync: ${SURVEY_SYNC_INTERVAL / 60000}min | ` +
    `License: ${LICENSE_CHECK_INTERVAL / 60000}min | ` +
    `Campaigns: ${CAMPAIGN_INTERVAL / 1000}s`
  )
}

/**
 * Stop all cron jobs.
 */
export function stopCronJobs(): void {
  if (followUpInterval)  { clearInterval(followUpInterval);  followUpInterval  = null }
  if (inboxInterval)     { clearInterval(inboxInterval);     inboxInterval     = null }
  if (surveySyncInterval){ clearInterval(surveySyncInterval);surveySyncInterval= null }
  if (licenseInterval)   { clearInterval(licenseInterval);   licenseInterval   = null }
  if (backupReminderInterval) { clearInterval(backupReminderInterval); backupReminderInterval = null }
  if (campaignInterval)  { clearInterval(campaignInterval);  campaignInterval  = null }
  console.log('[Cron] Background tasks stopped')
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function runFollowUp(port: number): Promise<void> {
  try {
    const { status, body } = await localRequest(port, 'POST', '/api/emails/follow-up', {
      'Authorization': 'Bearer local-desktop-cron',
    })
    if (status >= 400) { console.error(`[Cron] Follow-up failed (HTTP ${status}):`, body); return }
    const data = JSON.parse(body)
    if (data.sent > 0) console.log(`[Cron] Sent ${data.sent} follow-up email(s)`)
  } catch (error) {
    console.error('[Cron] Follow-up error:', error instanceof Error ? error.message : error)
  }
}

async function runCampaignProcessing(port: number): Promise<void> {
  try {
    const { status, body } = await localRequest(port, 'POST', '/api/messages/campaigns/process', {
      'Authorization': 'Bearer local-desktop-cron',
    })
    if (status >= 400) { console.error(`[Cron] Campaign processing failed (HTTP ${status}):`, body); return }
    const data = JSON.parse(body)
    if (data.processed > 0) console.log(`[Cron] Processed ${data.processed} campaign recipient(s)`)
  } catch (error) {
    console.error('[Cron] Campaign processing error:', error instanceof Error ? error.message : error)
  }
}

async function runInboxSync(port: number): Promise<void> {
  try {
    const { status, body } = await localRequest(port, 'GET', '/api/emails/check-inbox?secret=local-desktop-cron')
    if (status >= 400) { console.error(`[Cron] Inbox sync failed (HTTP ${status}):`, body); return }
    const data = JSON.parse(body)
    if (data.total_emails_fetched > 0) {
      console.log(`[Cron] Synced ${data.total_emails_fetched} email(s), matched ${data.total_emails_matched}`)
      if (data.total_emails_matched > 0) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.webContents.send('inbox-synced', data.total_emails_matched)
      }
    }
  } catch (error) {
    console.error('[Cron] Inbox sync error:', error instanceof Error ? error.message : error)
  }
}

async function runSurveySync(port: number): Promise<void> {
  try {
    const { status, body } = await localRequest(port, 'POST', '/api/surveys/sync', {
      'Authorization': 'Bearer local-desktop-cron',
    })
    if (status >= 400) { console.error(`[Cron] Survey sync failed (HTTP ${status}):`, body); return }
    const data = JSON.parse(body)
    if (data.synced > 0) {
      console.log(`[Cron] Synced ${data.synced} survey response(s)`)
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('survey-synced', data.synced)
    }
  } catch (error) {
    console.error('[Cron] Survey sync error:', error instanceof Error ? error.message : error)
  }
}

/**
 * Daily backup reminder.
 *
 * Every minute, checks whether it is at/after the configured reminder hour
 * (default 8am, editable in settings) and shows a desktop notification once a
 * day inviting the user to generate a backup file. Skipped if a backup was
 * already made today. Clicking the notification focuses the app and asks the
 * renderer to open the backup reminder dialog.
 */
async function runBackupReminder(port: number): Promise<void> {
  try {
    const { status, body } = await localRequest(port, 'GET', '/api/settings/database/backup-status')
    if (status >= 400) return

    const data = JSON.parse(body) as {
      lastBackupDate: string | null
      reminderHour?: number
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Already reminded today → nothing to do
    if (backupReminderNotifiedDate === todayStr) return

    const reminderHour = Number.isFinite(data.reminderHour) ? (data.reminderHour as number) : 8
    if (now.getHours() < reminderHour) return

    // A backup was already made today → no need to remind
    if (data.lastBackupDate && data.lastBackupDate.split('T')[0] === todayStr) {
      backupReminderNotifiedDate = todayStr
      return
    }

    backupReminderNotifiedDate = todayStr

    if (!Notification.isSupported()) return

    const notif = new Notification({
      title: 'Sauvegarde MyOsteoFlow',
      body: 'Pensez à générer votre sauvegarde quotidienne et à la conserver sur un disque externe (jamais sur un cloud).',
      silent: false,
    })

    notif.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('open-backup-reminder')
      }
    })

    notif.show()
    console.log('[Cron] Backup reminder notification shown')
  } catch {
    // Offline or server not ready — ignore
  }
}

/**
 * License heartbeat.
 *
 * Calls the local Next.js API which in turn calls the Osteoupgrade verify
 * endpoint. Three possible outcomes:
 *   - valid: true         → all good, update last_verified_at
 *   - valid: false        → subscription expired or concurrent session
 *                           → send 'license-expired' IPC to renderer
 *   - valid: null (offline) → grace period applies, do nothing
 */
async function runLicenseCheck(port: number): Promise<void> {
  try {
    console.log('[Cron] Checking license...')
    const { status, body } = await localRequest(port, 'POST', '/api/license/online-verify')

    if (status >= 500) {
      console.error(`[Cron] License check server error (HTTP ${status})`)
      return
    }

    const data = JSON.parse(body)

    if (data.valid === false) {
      console.warn('[Cron] License invalid:', data.code, '-', data.error)
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        win.webContents.send('license-expired', {
          message: data.error || 'Votre abonnement Osteoupgrade a expiré.',
          code: data.code || 'UNKNOWN',
        })
      }
    } else if (data.valid === true) {
      console.log('[Cron] License valid')
    }
    // valid === null → offline, grace period in effect, nothing to do
  } catch (error) {
    // Network error — offline or Next.js not yet ready, safe to ignore
    console.log('[Cron] License check skipped (network unavailable)')
  }
}
