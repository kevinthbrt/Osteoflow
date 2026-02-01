/**
 * Local cron system for Osteoflow desktop.
 *
 * Replaces the Vercel/Supabase cron jobs with local timers.
 * Runs two periodic tasks:
 *   1. Follow-up emails (J+7) - checks every 15 minutes
 *   2. Inbox sync (IMAP) - checks every 5 minutes
 *
 * Uses Node.js http module instead of fetch() to avoid issues
 * with Electron's Chromium network stack in the main process.
 */

import http from 'http'

let followUpInterval: NodeJS.Timeout | null = null
let inboxInterval: NodeJS.Timeout | null = null

const FOLLOW_UP_INTERVAL = 15 * 60 * 1000  // 15 minutes
const INBOX_INTERVAL = 5 * 60 * 1000       // 5 minutes

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
  // First run after 15 seconds, then every 15 minutes
  setTimeout(() => {
    runFollowUp(port)
    followUpInterval = setInterval(() => runFollowUp(port), FOLLOW_UP_INTERVAL)
  }, 15_000)

  // Inbox sync
  // First run after 20 seconds, then every 5 minutes
  setTimeout(() => {
    runInboxSync(port)
    inboxInterval = setInterval(() => runInboxSync(port), INBOX_INTERVAL)
  }, 20_000)

  console.log(`[Cron] Follow-up: every ${FOLLOW_UP_INTERVAL / 60000}min | Inbox: every ${INBOX_INTERVAL / 60000}min`)
}

/**
 * Stop all cron jobs.
 */
export function stopCronJobs(): void {
  if (followUpInterval) {
    clearInterval(followUpInterval)
    followUpInterval = null
  }
  if (inboxInterval) {
    clearInterval(inboxInterval)
    inboxInterval = null
  }
  console.log('[Cron] Background tasks stopped')
}

/**
 * Execute the follow-up email job.
 */
async function runFollowUp(port: number): Promise<void> {
  try {
    console.log('[Cron] Running follow-up email check...')
    const { status, body } = await localRequest(port, 'POST', '/api/emails/follow-up', {
      'Authorization': 'Bearer local-desktop-cron',
    })

    if (status >= 400) {
      console.error(`[Cron] Follow-up check failed (HTTP ${status}):`, body)
      return
    }

    try {
      const data = JSON.parse(body)
      if (data.sent && data.sent > 0) {
        console.log(`[Cron] Sent ${data.sent} follow-up email(s)`)
      } else {
        console.log('[Cron] Follow-up check complete - no emails to send')
      }
    } catch {
      console.log('[Cron] Follow-up check complete')
    }
  } catch (error) {
    console.error('[Cron] Follow-up check error:', error instanceof Error ? error.message : error)
  }
}

/**
 * Execute the inbox sync job.
 */
async function runInboxSync(port: number): Promise<void> {
  try {
    console.log('[Cron] Running inbox sync...')
    const { status, body } = await localRequest(port, 'GET', '/api/emails/check-inbox?secret=local-desktop-cron')

    if (status >= 400) {
      console.error(`[Cron] Inbox sync failed (HTTP ${status}):`, body)
      return
    }

    try {
      const data = JSON.parse(body)
      if (data.total_emails_fetched && data.total_emails_fetched > 0) {
        console.log(`[Cron] Synced ${data.total_emails_fetched} email(s), matched ${data.total_emails_matched}`)
      } else {
        console.log('[Cron] Inbox sync complete - no new emails')
      }
    } catch {
      console.log('[Cron] Inbox sync complete')
    }
  } catch (error) {
    console.error('[Cron] Inbox sync error:', error instanceof Error ? error.message : error)
  }
}
