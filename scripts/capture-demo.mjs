import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:3456'
const OUT_DIR = '/tmp/demo-screenshots'
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
  // Pre-set localStorage to suppress WhatsNewDialog
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

// Suppress backup-reminder dialog
await page.route('**/api/settings/database/backup-status', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ lastBackupDate: '2026-06-17', snoozedUntil: '2099-01-01' }),
  })
})

// Suppress profile completion widget (return 100%)
await page.route('**/api/profile/completion', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ percentage: 100, completedCount: 5, total: 5, areas: [] }),
  })
})

// Helper: go to page and wait for it to be clean
async function nav(url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await wait(2000)
  // Dismiss any modal with Escape (won't work on CGU but CGU should be gone now)
  await page.keyboard.press('Escape')
  await wait(400)
}

// ── 1. Dashboard ──────────────────────────────────────────────────────────
console.log('\n🎬 Dashboard')
await nav(`${BASE_URL}/dashboard`)
await shot(page, '01-dashboard')
await page.evaluate(() => window.scrollBy(0, 320))
await wait(600)
await shot(page, '02-dashboard-bottom')

// ── 2. Patients ────────────────────────────────────────────────────────────
console.log('\n🎬 Patients')
await nav(`${BASE_URL}/patients`)
await shot(page, '03-patients-list')

// Get a patient ID from the page
const patHref = await page.locator('table tbody tr a, tbody tr a').first().getAttribute('href').catch(() => null)
if (patHref) {
  await nav(`${BASE_URL}${patHref}`)
  await shot(page, '04-patient-fiche')
}

// ── 3. Consultation ────────────────────────────────────────────────────────
console.log('\n🎬 Consultations')
await nav(`${BASE_URL}/consultations`)
await shot(page, '05-consultations')

// Get consultation IDs directly from DB via API
const cResp = await page.goto(`${BASE_URL}/api/consultations?limit=1`, { timeout: 10000 }).catch(() => null)
let consultId = null
if (cResp) {
  const body = await page.evaluate(() => document.body.innerText).catch(() => '')
  try {
    const data = JSON.parse(body)
    consultId = data?.data?.[0]?.id || data?.[0]?.id
  } catch {}
}

// Fallback: get from patient page
if (!consultId && patHref) {
  await nav(`${BASE_URL}${patHref}?tab=consultations`)
  const editLink = await page.locator('a[href*="/consultations/"][href*="/edit"]').first().getAttribute('href').catch(() => null)
  if (editLink) consultId = editLink.split('/')[2]
}

if (consultId) {
  await nav(`${BASE_URL}/consultations/${consultId}/edit`)
  await shot(page, '06-consultation-detail')
  await page.evaluate(() => window.scrollBy(0, 450))
  await wait(600)
  await shot(page, '07-structuration-ia')
  await page.evaluate(() => window.scrollBy(0, 450))
  await wait(600)
  await shot(page, '08-hypotheses-cliniques')
}

// ── 4. Communication (courriers IA) ─────────────────────────────────────────
console.log('\n🎬 Communication')
await nav(`${BASE_URL}/communication`)
await shot(page, '09-communication-courriers')

// ── 5. Statistiques ──────────────────────────────────────────────────────
console.log('\n🎬 Statistiques')
await nav(`${BASE_URL}/statistics`)
await shot(page, '10-statistiques')
await page.evaluate(() => window.scrollBy(0, 380))
await wait(600)
await shot(page, '11-statistiques-graphiques')

// ── 6. Questionnaires ────────────────────────────────────────────────────
console.log('\n🎬 Questionnaires')
await nav(`${BASE_URL}/surveys`)
await shot(page, '12-questionnaires')

await browser.close()
console.log(`\n✅ ${fs.readdirSync(OUT_DIR).length} screenshots → ${OUT_DIR}`)
