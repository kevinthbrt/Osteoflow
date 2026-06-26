import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:3456'
const OUT_DIR = '/tmp/msg-screenshots'
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  console.log(`📸 ${name}`)
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'fr-FR',
  storageState: {
    cookies: [],
    origins: [{
      origin: BASE_URL,
      localStorage: [{ name: 'myosteoflow_last_seen_version', value: '1.11.1' }]
    }]
  }
})
const page = await ctx.newPage()
page.on('console', () => {})
page.on('pageerror', () => {})

await page.route('**/api/settings/database/backup-status', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ lastBackupDate: '2026-06-17', snoozedUntil: '2099-01-01' }),
  })
})

await page.route('**/api/profile/completion', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ percentage: 100, completedCount: 5, total: 5, areas: [] }),
  })
})

// ── Navigate to messages page ─────────────────────────────────────────────────
console.log('\n🎬 Messages')
await page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle', timeout: 30000 })
await wait(2000)
await page.keyboard.press('Escape')
await wait(400)

// Screenshot: conversation list (no thread open)
await shot(page, '01-messages-liste')

// Click the first conversation (Sophie DUPONT - unread)
const firstConv = page.locator('[data-testid="conversation-item"], .cursor-pointer').first()
// Try clicking by patient name text
const sophieConv = page.locator('text=Sophie').first()
if (await sophieConv.isVisible().catch(() => false)) {
  await sophieConv.click()
} else {
  // fallback: click first conversation item
  await page.locator('div[class*="cursor-pointer"]').first().click()
}
await wait(1500)

// Screenshot: thread open with Sophie DUPONT
await shot(page, '02-messages-thread-sophie')

// Scroll to bottom of thread to show latest messages
await page.evaluate(() => {
  const scrollable = document.querySelector('[class*="overflow-y-auto"]')
  if (scrollable) scrollable.scrollTop = scrollable.scrollHeight
})
await wait(500)
await shot(page, '03-messages-thread-bottom')

// Click into the reply textarea and type a response
const textarea = page.locator('textarea').first()
if (await textarea.isVisible().catch(() => false)) {
  await textarea.click()
  await textarea.fill('Bonjour Sophie, les tensions que vous ressentez apres le yoga sont tout a fait normales. Continuez les exercices et revenez me voir si cela persiste plus de 3 jours. Bon retablissement !')
  await wait(600)
  await shot(page, '04-messages-compose')
}

// Click Thomas BERNARD conversation
const thomasConv = page.locator('text=Thomas').first()
if (await thomasConv.isVisible().catch(() => false)) {
  await thomasConv.click()
  await wait(1200)
  await shot(page, '05-messages-thread-thomas')
}

await browser.close()
console.log(`\n✅ ${fs.readdirSync(OUT_DIR).length} screenshots → ${OUT_DIR}`)
