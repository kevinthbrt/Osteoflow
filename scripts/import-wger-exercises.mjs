#!/usr/bin/env node
/**
 * Wger Exercise Import Script
 *
 * Fetches exercises + illustrations from wger.de (open source, CC-BY-SA 3.0),
 * uploads images to Supabase Storage, and inserts records into rehab_exercises.
 *
 * Requirements: Node 18+ (uses built-in fetch — no npm install needed)
 *
 * Usage:
 *   SUPABASE_URL=https://chttutptqainrnrbrljf.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/import-wger-exercises.mjs
 *
 * Optional env vars:
 *   DRY_RUN=true        Preview what would be imported, no writes
 *   LIMIT=50            Stop after importing N exercises (useful for testing)
 *   DELAY_MS=400        Milliseconds between Wger API calls (default: 400)
 *
 * Your Supabase URL and service role key can be found in:
 * Supabase Dashboard → Project Settings → API
 *
 * The script is idempotent: re-running skips exercises already in the DB.
 */

const WGER_BASE   = 'https://wger.de/api/v2'
const BUCKET_NAME = 'exercise-illustrations'

const SUPABASE_URL      = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN           = process.env.DRY_RUN === 'true'
const LIMIT             = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity
const DELAY_MS          = process.env.DELAY_MS ? parseInt(process.env.DELAY_MS, 10) : 400

// Wger language IDs
const LANG_FR = 19
const LANG_EN = 2

// Wger category name → osteoflow region (best-effort mapping)
// Unmapped categories are imported with region=null — update them manually afterwards
const CATEGORY_TO_REGION = {
  'Back':      'Lombaires',
  'Shoulders': 'Épaule',
  'Arms':      'Coude',
  'Legs':      'Hanche',
  'Calves':    'Cheville',
  'Neck':      'Cervicales',
  'Chest':     null,   // no direct osteopathy equivalent
  'Abs':       null,
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (no SDK required)
// ---------------------------------------------------------------------------

function supaHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  }
}

async function sbQuery(path, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${path}${params ? `?${params}` : ''}`
  const res = await fetch(url, { headers: supaHeaders() })
  if (!res.ok) throw new Error(`Supabase query failed (${res.status}): ${await res.text()}`)
  return res.json()
}

async function sbInsert(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`Insert into ${table} failed (${res.status}): ${await res.text()}`)
}

async function sbEnsureBucket() {
  // Try to create; 409 = already exists → fine
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET_NAME, name: BUCKET_NAME, public: true }),
  })
  if (!res.ok && res.status !== 409) {
    throw new Error(`Create bucket failed (${res.status}): ${await res.text()}`)
  }
  return res.status === 409 ? 'exists' : 'created'
}

async function sbUpload(storagePath, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`
}

// ---------------------------------------------------------------------------
// Wger helpers
// ---------------------------------------------------------------------------

async function wgerJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Wger HTTP ${res.status}: ${url}`)
  return res.json()
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function stripHtml(html) {
  return html?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null
}

function pickTranslation(translations) {
  return (
    translations?.find(t => t.language === LANG_FR) ||
    translations?.find(t => t.language === LANG_EN) ||
    null
  )
}

function guessContentType(url) {
  if (url.endsWith('.png'))  return 'image/png'
  if (url.endsWith('.gif'))  return 'image/gif'
  if (url.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
    process.exit(1)
  }

  console.log(DRY_RUN ? '🔍  DRY RUN — no writes' : '🚀  Import mode')
  console.log(`    Supabase: ${SUPABASE_URL}`)
  console.log(`    Bucket  : ${BUCKET_NAME}`)
  if (LIMIT < Infinity) console.log(`    Limit   : ${LIMIT}`)
  console.log()

  // Ensure bucket
  if (!DRY_RUN) {
    const status = await sbEnsureBucket()
    console.log(`Storage bucket "${BUCKET_NAME}": ${status}`)
  }

  // Load existing names to skip duplicates
  const existingNames = new Set()
  if (!DRY_RUN) {
    const rows = await sbQuery('rehab_exercises', 'select=name')
    rows.forEach(r => existingNames.add(r.name))
    console.log(`Already in DB: ${existingNames.size} exercises\n`)
  }

  let imported = 0
  let skipped  = 0
  let errors   = 0

  // Paginate through all exercises from Wger
  let nextUrl = `${WGER_BASE}/exerciseinfo/?format=json&limit=100`

  while (nextUrl) {
    if (imported >= LIMIT) break

    const page = await wgerJson(nextUrl)
    process.stdout.write(`📄 Page (${page.results.length} exercises): `)

    for (const exercise of page.results) {
      if (imported >= LIMIT) break

      const tr = pickTranslation(exercise.translations)
      if (!tr?.name?.trim()) { skipped++; process.stdout.write('·'); continue }

      const name = tr.name.trim()

      if (existingNames.has(name)) { skipped++; process.stdout.write('·'); continue }

      // Need at least one image
      const mainImg = exercise.images?.find(img => img.is_main) ?? exercise.images?.[0]
      if (!mainImg) { skipped++; process.stdout.write('·'); continue }

      const region      = CATEGORY_TO_REGION[exercise.category?.name] ?? null
      const description = stripHtml(tr.description)

      if (region === undefined) {
        // Unknown category — warn once
        console.log(`\n⚠️  Unknown Wger category: "${exercise.category?.name}" — importing with region=null`)
      }

      if (DRY_RUN) {
        console.log(`\n[DRY] ${name} | region=${region ?? '—'} | img=${mainImg.image}`)
        imported++
        continue
      }

      let illustrationUrl = null
      try {
        const imgRes = await fetch(mainImg.image)
        if (imgRes.ok) {
          const buf         = await imgRes.arrayBuffer()
          const contentType = imgRes.headers.get('content-type') || guessContentType(mainImg.image)
          const ext         = contentType.split('/')[1]?.split(';')[0] || 'jpg'
          const path        = `wger/${exercise.id}/${mainImg.id}.${ext}`
          illustrationUrl   = await sbUpload(path, buf, contentType)
        }
      } catch (imgErr) {
        console.warn(`\n⚠️  Image error for "${name}": ${imgErr.message}`)
      }

      try {
        await sbInsert('rehab_exercises', {
          name,
          region,
          type:             'renfo',     // default — update manually per exercise
          level:            1,
          description,
          illustration_url: illustrationUrl,
          is_active:        true,
          created_by:       null,
        })
        existingNames.add(name)
        process.stdout.write('✓')
        imported++
      } catch (insertErr) {
        console.error(`\n❌ Insert failed for "${name}": ${insertErr.message}`)
        errors++
      }

      await sleep(DELAY_MS)
    }

    console.log()
    nextUrl = page.next
    if (nextUrl && imported < LIMIT) await sleep(DELAY_MS)
  }

  console.log('\n' + '─'.repeat(40))
  console.log(`✅  Imported : ${imported}`)
  console.log(`⏭️   Skipped  : ${skipped}  (no name, no image, or already exists)`)
  console.log(`❌  Errors   : ${errors}`)
  if (DRY_RUN) console.log('\nRun without DRY_RUN=true to write to Supabase.')
}

main().catch(err => {
  console.error('\n💥', err.message)
  process.exit(1)
})
