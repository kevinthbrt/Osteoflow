import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://localhost:3456'
const OUT_DIR = '/tmp/ex-screenshots'
fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
  console.log(`📸 ${name}`)
}

// Realistic AI-generated exercise prescription for L5-S1 discogenic lombalgie
const MOCK_AI_RESPONSE = {
  title: 'Programme lombaire - Lombalgie discogenique L5-S1',
  clinical_notes: 'EBP : Pour la lombalgie chronique discogenique, les recommandations HAS 2019 et Cochrane privilegient le renforcement du gainage profond (transverse, multifide) et les exercices de stabilisation lombaire. Le niveau 2 est indique ici (phase subaigue amelioree) : stabilisation active avant le renforcement fonctionnel. Eviction des exercices en flexion repetes et des charges axiales. Programme de McKenzie adapte associe a la stabilisation segmentaire.',
  patient_intro: 'Bonjour Thomas,\n\nSuite a notre consultation, voici votre programme d\'exercices personnalise pour votre lombalgie. Ces exercices ont ete selectionnes pour renforcer les muscles profonds de votre dos et soulager la pression sur votre disque L5-S1.\n\nCommencez doucement, respectez les pauses et ne forcez jamais si la douleur depasse 3/10. Ce programme est a faire 3 fois par semaine, en alternance avec des jours de repos.',
  vigilance_points: '• Arreter immediatement si douleur > 3/10 durant l\'exercice\n• Arreter si fourmillements ou engourdissements dans la jambe augmentent\n• Ne pas faire les exercices en phase aigue (EVA > 6/10)\n• Consulter si apparition de troubles urinaires ou intestinaux',
  weekly_routine: '3 seances par semaine (ex: lundi, mercredi, vendredi) avec au moins 1 jour de repos entre chaque seance. Duree totale : 25 minutes environ.',
  items: [
    {
      exercise: {
        id: 'ex-1',
        name: 'Activation du transverse abdominal (drawing-in)',
        description: 'En decubitus dorsal, genoux flechis, pieds a plat. Inspirez, puis en expirant, rentrez doucement le nombril vers la colonne sans bloquer la respiration. Maintenez la contraction legere tout en respirant normalement. Cet exercice active le muscle stabilisateur profond du rachis sans augmenter la pression intradiscale.',
        region: 'Rachis lombaire',
        type: 'Stabilisation',
        level: 2,
        illustration_url: null,
        nerve_target: 'L5-S1 (decompression)',
        progression_regression: 'Progression : ajouter bascule du bassin. Regression : position semi-assise si douleur.'
      },
      sets: 3,
      reps: '10',
      hold_time: 10,
      rest_time: 30,
      frequency: '3 fois/semaine',
      notes: 'Contraction legere a 30% du max, ne pas bloquer la respiration. Sentir le ventre se creuser doucement.'
    },
    {
      exercise: {
        id: 'ex-2',
        name: 'Pont fessier (hip bridge)',
        description: 'Decubitus dorsal, genoux flechis a 90 degres, pieds a plat ecarte largeur du bassin. Activez le transverse, puis soulevez le bassin jusqu\'a aligner hanches-genoux-epaules. Maintenez la position en respirant. Cet exercice renforce les fessiers et les ischio-jambiers, musculature synergiste du rachis lombaire, sans contrainte discale en compression.',
        region: 'Rachis lombaire / Fessiers',
        type: 'Stabilisation',
        level: 2,
        illustration_url: null,
        nerve_target: null,
        progression_regression: 'Progression : pont sur un pied. Regression : amplitude reduite si douleur.'
      },
      sets: 3,
      reps: '12',
      hold_time: 5,
      rest_time: 45,
      frequency: '3 fois/semaine',
      notes: 'Ne creusez pas le bas du dos au sommet du mouvement. Posture neutre tout au long.'
    },
    {
      exercise: {
        id: 'ex-3',
        name: 'Bird-dog (chien d\'arret)',
        description: 'A quatre pattes, mains sous les epaules, genoux sous les hanches. Activez le gainage, puis etendez simultanement le bras droit et la jambe gauche en gardant le bassin horizontal. Revenez lentement. Alternez les cotes. Cet exercice de stabilisation segmentaire sollicite les multifides et les muscles extenseurs sans cisaillement lombaire.',
        region: 'Rachis lombaire',
        type: 'Stabilisation',
        level: 2,
        illustration_url: null,
        nerve_target: null,
        progression_regression: 'Progression : ajouter un poids a la cheville. Regression : extension du bras seul si instabilite.'
      },
      sets: 3,
      reps: '8',
      hold_time: 3,
      rest_time: 45,
      frequency: '3 fois/semaine',
      notes: 'Gardez le regard vers le bas, ne levez pas la tete. Le bassin doit rester parfaitement horizontal.'
    },
    {
      exercise: {
        id: 'ex-4',
        name: 'Extension McKenzie en decubitus (cobra passif)',
        description: 'Allonge sur le ventre, mains a plat sous les epaules. Poussez doucement sur les mains pour sureleever le buste, en laissant le bas du dos se detendre passivement. Le bassin reste au sol. Maintenez 10 secondes, expirez en redescendant. Cet exercice en extension reduit la protrusion discale posterieure caracteristique de la hernie L5-S1.',
        region: 'Rachis lombaire',
        type: 'Mobilisation',
        level: 2,
        illustration_url: null,
        nerve_target: 'S1 (centralisation de la douleur)',
        progression_regression: 'Progression : position debout extension. Regression : extension en appui sur les coudes si inconfort.'
      },
      sets: 3,
      reps: '10',
      hold_time: 10,
      rest_time: 30,
      frequency: '3 fois/semaine',
      notes: 'Douleur qui se centralise (remonte du pied vers le lombaire) est un signe positif. Arreter si douleur se radicalise davantage.'
    },
    {
      exercise: {
        id: 'ex-5',
        name: 'Gainage lateral (side plank) sur genoux',
        description: 'Allonge sur le cote, appui sur l\'avant-bras et le genou flechis. Soulevez le bassin pour aligner tete-epaule-genou. Contractez les fessiers et le carre des lombes du cote portant. Maintenez la position. Cet exercice renforce le carre des lombes et les obliques de facon isometrique, stabilisant le rachis en situation reelle de contrainte laterale.',
        region: 'Rachis lombaire / Obliques',
        type: 'Stabilisation',
        level: 2,
        illustration_url: null,
        nerve_target: null,
        progression_regression: 'Progression : gainage sur pied. Regression : amplitude reduite ou appui sur la main si inconfort.'
      },
      sets: 2,
      reps: null,
      hold_time: 20,
      rest_time: 45,
      frequency: '3 fois/semaine',
      notes: 'Chaque cote. Ne laissez pas le bassin s\'affaisser. Respirez normalement pendant l\'effort.'
    }
  ]
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

// Suppress dialogs
await page.route('**/api/settings/database/backup-status', route => {
  route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ lastBackupDate: '2026-06-17', snoozedUntil: '2099-01-01' }) })
})
await page.route('**/api/profile/completion', route => {
  route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ percentage: 100, completedCount: 5, total: 5, areas: [] }) })
})

// Mock the AI exercise generation endpoint
await page.route('**/api/ai/generate-exercise-prescription', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_AI_RESPONSE),
  })
})

// Get consultation id from DB via API
const CONSULT_ID = '4031c9a5-aeed-40da-9c41-ec160e62db8c'

// ── 1. Navigate to the consultation page ─────────────────────────────────────
console.log('\n🎬 Fiche exercices IA')
await page.goto(`${BASE_URL}/consultations/${CONSULT_ID}/edit`, { waitUntil: 'networkidle', timeout: 30000 })
await wait(2000)
await page.keyboard.press('Escape')
await wait(400)

// Scroll to exercise section
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await wait(800)
await shot(page, '01-consultation-avec-section-exercices')

// ── 2. Click the IA button to open the dialog ─────────────────────────────────
const iaBtn = page.locator('button:has-text("IA")').first()
await iaBtn.scrollIntoViewIfNeeded()
await wait(300)
await iaBtn.click()
await wait(1200)

// ── 3. Dialog config step with patient factors pre-filled ─────────────────────
await shot(page, '02-dialog-config-facteurs-patient')

// Type the diagnostic
const diagTextarea = page.locator('textarea#diagnostic, textarea[id="diagnostic"]').first()
if (await diagTextarea.isVisible().catch(() => false)) {
  await diagTextarea.fill('Lombalgie chronique discogenique L5-S1 moderee - composante musculaire paravertebrale droite predominante - contexte sedentaire professionnel aggravant - indication programme de stabilisation segmentaire')
  await wait(500)
}

// Set level to 2 (already default)
await shot(page, '03-dialog-config-diagnostic-rempli')

// Set duration to 25 min
const rangeInput = page.locator('input[type="range"]').first()
if (await rangeInput.isVisible().catch(() => false)) {
  await rangeInput.evaluate(el => { el.value = '25'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  await wait(300)
}

await shot(page, '04-dialog-config-pret-a-generer')

// ── 4. Click "Generer le programme" ──────────────────────────────────────────
const genBtn = page.locator('button:has-text("Générer le programme"), button:has-text("Generer")').first()
await genBtn.click()
await wait(2500) // Wait for mock response

// ── 5. Preview step: title + patient message ──────────────────────────────────
await shot(page, '05-preview-titre-message-patient')

// Scroll down to see exercises
await page.evaluate(() => {
  const scrollable = document.querySelector('[class*="overflow-y-auto"]')
  if (scrollable) scrollable.scrollTop = 400
})
await wait(500)
await shot(page, '06-preview-liste-exercices')

// Scroll more to see more exercises
await page.evaluate(() => {
  const scrollable = document.querySelector('[class*="overflow-y-auto"]')
  if (scrollable) scrollable.scrollTop = 900
})
await wait(500)
await shot(page, '07-preview-exercices-suite')

// Click on first exercise edit button to expand it
await page.evaluate(() => {
  const scrollable = document.querySelector('[class*="overflow-y-auto"]')
  if (scrollable) scrollable.scrollTop = 300
})
await wait(400)

const editBtn = page.locator('button[title="Modifier les paramètres"]').first()
if (await editBtn.isVisible().catch(() => false)) {
  await editBtn.click()
  await wait(500)
  await shot(page, '08-preview-exercice-detail-editable')
}

// Scroll back up to see full preview header
await page.evaluate(() => {
  const scrollable = document.querySelector('[class*="overflow-y-auto"]')
  if (scrollable) scrollable.scrollTop = 0
})
await wait(400)

// Open clinical notes section (EBP)
const ebpBtn = page.locator('button:has-text("Justification clinique EBP")').first()
if (await ebpBtn.isVisible().catch(() => false)) {
  await ebpBtn.click()
  await wait(400)
  await shot(page, '09-justification-clinique-ebp')
}

await browser.close()
console.log(`\n✅ ${fs.readdirSync(OUT_DIR).length} screenshots → ${OUT_DIR}`)
