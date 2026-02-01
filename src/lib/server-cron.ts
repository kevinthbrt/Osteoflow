/**
 * Server-side cron that runs within the Next.js process.
 * Works both with and without Electron.
 *
 * Call initServerCron() from any server route to start.
 * Uses internal HTTP calls to trigger the existing API routes.
 */

import http from 'http'

const FOLLOW_UP_INTERVAL = 15 * 60 * 1000 // 15 minutes
const INBOX_INTERVAL = 5 * 60 * 1000 // 5 minutes
const STARTUP_DELAY = 15_000 // 15 seconds after init
const PORT = 3456

let initialized = false

function localRequest(
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        timeout: 60000,
      },
      (res) => {
        let body = ''
        res.on('data', (chunk: string) => {
          body += chunk
        })
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
 * Initialize cron jobs. Safe to call multiple times — only runs once.
 */
export function initServerCron(): void {
  if (initialized) return
  initialized = true

  console.log('[ServerCron] Initializing background tasks...')

  setTimeout(() => {
    console.log('[ServerCron] Starting background tasks')

    // Follow-up emails - first run then every 15 min
    runFollowUp()
    setInterval(runFollowUp, FOLLOW_UP_INTERVAL)

    // Inbox sync - first run then every 5 min
    runInboxSync()
    setInterval(runInboxSync, INBOX_INTERVAL)

    console.log(
      `[ServerCron] Follow-up: every ${FOLLOW_UP_INTERVAL / 60000}min | Inbox: every ${INBOX_INTERVAL / 60000}min`
    )
  }, STARTUP_DELAY)
}

async function runFollowUp(): Promise<void> {
  try {
    console.log('[ServerCron] Running follow-up email check...')
    const { status, body } = await localRequest('POST', '/api/emails/follow-up', {
      Authorization: 'Bearer local-desktop-cron',
    })

    if (status >= 400) {
      console.error(`[ServerCron] Follow-up failed (HTTP ${status}):`, body)
      return
    }

    try {
      const data = JSON.parse(body)
      if (data.sent && data.sent > 0) {
        console.log(`[ServerCron] Sent ${data.sent} follow-up email(s)`)
      } else {
        console.log('[ServerCron] Follow-up check complete - no emails to send')
      }
    } catch {
      console.log('[ServerCron] Follow-up check complete')
    }
  } catch (error) {
    console.error(
      '[ServerCron] Follow-up error:',
      error instanceof Error ? error.message : error
    )
  }
}

async function runInboxSync(): Promise<void> {
  try {
    console.log('[ServerCron] Running inbox sync...')
    const { status, body } = await localRequest(
      'GET',
      '/api/emails/check-inbox?secret=local-desktop-cron'
    )

    if (status >= 400) {
      console.error(`[ServerCron] Inbox sync failed (HTTP ${status}):`, body)
      return
    }

    try {
      const data = JSON.parse(body)
      if (data.total_emails_fetched && data.total_emails_fetched > 0) {
        console.log(
          `[ServerCron] Synced ${data.total_emails_fetched} email(s), matched ${data.total_emails_matched}`
        )
      } else {
        console.log('[ServerCron] Inbox sync complete - no new emails')
      }
    } catch {
      console.log('[ServerCron] Inbox sync complete')
    }
  } catch (error) {
    console.error(
      '[ServerCron] Inbox sync error:',
      error instanceof Error ? error.message : error
    )
  }
}
