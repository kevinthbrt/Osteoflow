#!/usr/bin/env node
/**
 * Wger Image Matcher
 *
 * Pour chaque exercice dans rehab_exercises sans illustration,
 * cherche une image correspondante sur wger.de et la télécharge.
 *
 * Requirements: Node 18+ (fetch natif — aucun npm install)
 *
 * Usage:
 *   cd /chemin/vers/osteoflow
 *
 *   # Aperçu sans écriture (recommandé en premier)
 *   SUPABASE_URL=https://chttutptqainrnrbrljf.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   DRY_RUN=true \
 *   node scripts/match-wger-images.mjs
 *
 *   # Import réel
 *   SUPABASE_URL=https://chttutptqainrnrbrljf.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/match-wger-images.mjs
 *
 * Variables optionnelles :
 *   DRY_RUN=true       Affiche les correspondances sans rien écrire
 *   DELAY_MS=500       Délai entre les appels Wger (défaut : 500ms)
 *   MIN_SCORE=0.25     Score minimum de correspondance (0-1, défaut : 0.25)
 */

const WGER_BASE   = 'https://wger.de/api/v2'
const BUCKET_NAME = 'exercise-illustrations'

const SUPABASE_URL     = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN          = process.env.DRY_RUN === 'true'
const DELAY_MS         = parseInt(process.env.DELAY_MS ?? '500', 10)
const MIN_SCORE        = parseFloat(process.env.MIN_SCORE ?? '0.25')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Supabase REST
// ---------------------------------------------------------------------------

function sbHeaders(extra = {}) {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, ...extra }
}

async function sbQuery(path, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}?${params}`, { headers: sbHeaders() })
  if (!res.ok) throw new Error(`Supabase query (${res.status}): ${await res.text()}`)
  return res.json()
}

async function sbUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase update (${res.status}): ${await res.text()}`)
}

async function sbEnsureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET_NAME, name: BUCKET_NAME, public: true }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`Bucket (${res.status}): ${await res.text()}`)
}

async function sbUpload(path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${path}`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buffer,
  })
  if (!res.ok) throw new Error(`Upload (${res.status}): ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`
}

// ---------------------------------------------------------------------------
// Correspondance de noms (sans dépendance externe)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'de','du','la','le','les','des','et','en','un','une','au','aux','par','pour',
  'sur','avec','sans','the','of','and','for','with','a','an','in','on','to',
  'exercise','exercice','stretching','étirement','renforcement','strengthening',
])

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // enlève les accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

function similarity(a, b) {
  const wa = new Set(normalize(a))
  const wb = new Set(normalize(b))
  if (wa.size === 0 || wb.size === 0) return 0
  const common = [...wa].filter(w => wb.has(w)).length
  return common / Math.max(wa.size, wb.size)
}

// ---------------------------------------------------------------------------
// Wger
// ---------------------------------------------------------------------------

async function wgerJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Wger HTTP ${res.status}: ${url}`)
  return res.json()
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function guessContentType(url) {
  if (/\.png(\?|$)/i.test(url))  return 'image/png'
  if (/\.gif(\?|$)/i.test(url))  return 'image/gif'
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp'
  return 'image/jpeg'
}

// Cherche sur Wger via l'API search (retourne les suggestions directement avec image)
async function searchWger(term) {
  const results = []
  for (const lang of ['fr', 'en']) {
    try {
      const url = `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(term)}&language=${lang}&format=json`
      const data = await wgerJson(url)
      if (data.suggestions?.length) {
        results.push(...data.suggestions.map(s => ({
          name:  s.value,
          image: s.data?.image ?? null,
          id:    s.data?.base_id ?? s.data?.id,
          score: similarity(term, s.value),
        })))
      }
    } catch { /* ignore erreurs réseau par langue */ }
  }
  // Déduplique par id et trie par score décroissant
  const seen = new Set()
  return results
    .filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(DRY_RUN ? '🔍  Mode aperçu (aucune écriture)' : '🚀  Mode import')
  console.log(`    Supabase : ${SUPABASE_URL}`)
  console.log(`    Score min: ${MIN_SCORE}\n`)

  // Récupère les exercices sans image
  const exercises = await sbQuery('rehab_exercises', 'select=id,name,region&illustration_url=is.null&order=name.asc')
  console.log(`📋  ${exercises.length} exercice(s) sans illustration\n`)

  if (exercises.length === 0) {
    console.log('✅  Tous les exercices ont déjà une illustration.')
    return
  }

  if (!DRY_RUN) await sbEnsureBucket()

  let matched   = 0
  let unmatched = 0
  let errors    = 0

  for (const exercise of exercises) {
    await sleep(DELAY_MS)

    let candidates = []
    try {
      candidates = await searchWger(exercise.name)
    } catch (err) {
      console.error(`❌  Recherche échouée pour "${exercise.name}": ${err.message}`)
      errors++
      continue
    }

    const best = candidates[0]

    if (!best || best.score < MIN_SCORE || !best.image) {
      console.log(`⚪  "${exercise.name}" → aucune correspondance${candidates[0] ? ` (meilleur: "${candidates[0].name}" score=${candidates[0].score.toFixed(2)})` : ''}`)
      unmatched++
      continue
    }

    console.log(`✅  "${exercise.name}"`)
    console.log(`    → "${best.name}" (score ${best.score.toFixed(2)})`)
    console.log(`    🖼️  ${best.image}`)

    if (DRY_RUN) { matched++; continue }

    try {
      const imgRes = await fetch(best.image)
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`)

      const buf         = await imgRes.arrayBuffer()
      const contentType = imgRes.headers.get('content-type') || guessContentType(best.image)
      const ext         = contentType.split('/')[1]?.split(';')[0] || 'jpg'
      const path        = `exercises/${exercise.id}.${ext}`

      const publicUrl = await sbUpload(path, buf, contentType)
      await sbUpdate('rehab_exercises', exercise.id, { illustration_url: publicUrl })

      matched++
    } catch (err) {
      console.error(`    ❌  Erreur image: ${err.message}`)
      errors++
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`✅  Correspondances trouvées : ${matched}`)
  console.log(`⚪  Sans correspondance       : ${unmatched}`)
  console.log(`❌  Erreurs                  : ${errors}`)

  if (unmatched > 0) {
    console.log('\nℹ️  Pour les exercices sans correspondance, tu peux :')
    console.log('   • Baisser le seuil : MIN_SCORE=0.1 node scripts/match-wger-images.mjs')
    console.log('   • Ajouter les images manuellement dans Supabase')
  }

  if (DRY_RUN && matched > 0) {
    console.log('\nRelance sans DRY_RUN=true pour appliquer les changements.')
  }
}

main().catch(err => {
  console.error('\n💥', err.message)
  process.exit(1)
})
