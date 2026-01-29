/**
 * Local cron system for Osteoflow desktop.
 *
 * Replaces the Vercel/Supabase cron jobs with local timers.
 * Runs two periodic tasks:
 *   1. Follow-up emails (J+7) - checks every 15 minutes
 *   2. Inbox sync (IMAP) - checks every 5 minutes
 */

let followUpInterval: NodeJS.Timeout | null = null
let inboxInterval: NodeJS.Timeout | null = null

const FOLLOW_UP_INTERVAL = 15 * 60 * 1000  // 15 minutes
const INBOX_INTERVAL = 5 * 60 * 1000       // 5 minutes

/**
 * Start all cron jobs.
 */
export function startCronJobs(port: number): void {
  console.log('[Cron] Starting background tasks...')

  // Follow-up emails (J+7)
  // First run after 30 seconds, then every 15 minutes
  setTimeout(() => {
    runFollowUp(port)
    followUpInterval = setInterval(() => runFollowUp(port), FOLLOW_UP_INTERVAL)
  }, 30_000)

  // Inbox sync
  // First run after 10 seconds, then every 5 minutes
  setTimeout(() => {
    runInboxSync(port)
    inboxInterval = setInterval(() => runInboxSync(port), INBOX_INTERVAL)
  }, 10_000)

  console.log('[Cron] Background tasks scheduled')
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
 * Calls the existing API route which handles finding pending follow-ups and sending emails.
 */
async function runFollowUp(port: number): Promise<void> {
  try {
    console.log('[Cron] Running follow-up email check...')
    const response = await fetch(`http://localhost:${port}/api/emails/follow-up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Use a local secret to bypass auth in the API route
        'Authorization': 'Bearer local-desktop-cron',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Cron] Follow-up check failed:', response.status, text)
      return
    }

    const data = await response.json()
    if (data.sent > 0) {
      console.log(`[Cron] Sent ${data.sent} follow-up email(s)`)
    }
  } catch (error) {
    console.error('[Cron] Follow-up check error:', error)
  }
}

/**
 * Execute the inbox sync job.
 * Calls the existing API route which syncs emails via IMAP.
 */
async function runInboxSync(port: number): Promise<void> {
  try {
    console.log('[Cron] Running inbox sync...')
    const response = await fetch(`http://localhost:${port}/api/emails/check-inbox?secret=local-desktop-cron`)

    if (!response.ok) {
      const text = await response.text()
      console.error('[Cron] Inbox sync failed:', response.status, text)
      return
    }

    const data = await response.json()
    if (data.newMessages > 0) {
      console.log(`[Cron] Synced ${data.newMessages} new message(s)`)
    }
  } catch (error) {
    console.error('[Cron] Inbox sync error:', error)
  }
}
