import { describe, expect, it } from 'vitest'
import { SIGNALS, type SignalId } from '@/lib/reasoning'
import { CAS_EXTRACTION, type CasExtraction } from './extraction-cases'

/**
 * Évaluation de l'extraction sur de vraies anamnèses.
 *
 * Ne tourne pas dans la suite habituelle : elle appelle l'API et coûte de
 * l'argent. Elle sert à trancher le choix du modèle sur pièces plutôt que sur
 * intuition.
 *
 *   ANTHROPIC_API_KEY=sk-... npx vitest run tests/eval --config vitest.eval.config.ts
 *   EXTRACTION_MODEL=claude-opus-5 ANTHROPIC_API_KEY=sk-... npx vitest run tests/eval --config vitest.eval.config.ts
 *
 * Trois mesures, et la troisième est la plus importante :
 * - le rappel, part des signaux attendus effectivement relevés ;
 * - la précision sur les interdits, les confusions qu'un modèle pressé commet ;
 * - les inventions, signaux hors de tout ce qui était prévu — c'est ce qui
 *   ferait raisonner le copilote sur du vide.
 */

const MODEL = process.env.EXTRACTION_MODEL ?? 'claude-haiku-4-5'
const KEY = process.env.ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `Tu es un extracteur de faits cliniques pour ostéopathes francophones.

Tu reçois le texte d'une anamnèse dictée. Tu dois le traduire en signaux issus
EXCLUSIVEMENT du vocabulaire fourni. Tu n'interprètes pas, tu ne diagnostiques
pas, tu ne déduis rien qui ne soit pas dit : tu relèves.

RÉPONDS UNIQUEMENT EN JSON valide :
{ "signals": [ { "id": "identifiant.exact", "value": true, "verbatim": "les mots du patient" } ] }

Règles absolues :
- "id" doit être un identifiant du vocabulaire fourni, copié caractère pour caractère.
- "value" vaut true si le fait est affirmé, false s'il est explicitement nié.
  Un fait dont le texte ne parle pas ne figure PAS dans la réponse.
- "verbatim" cite le passage qui justifie le signal, sans le reformuler.
- Dans le doute, n'extrais pas.
- Aucun texte avant ou après le JSON.`

function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|fable)-/.test(model)
}

async function extract(cas: CasExtraction): Promise<Map<SignalId, boolean>> {
  const vocabulaire = Object.entries(SIGNALS)
    .map(([id, definition]) => `${id} = ${definition.label}`)
    .join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      ...(supportsEffort(MODEL) ? { output_config: { effort: 'low' } } : {}),
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        {
          type: 'text',
          text: `Vocabulaire :\n${vocabulaire}`,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        { role: 'user', content: `Motif : ${cas.motif}\n\nAnamnèse :\n${cas.anamnese}` },
      ],
    }),
  })

  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const texte: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
  const debut = texte.indexOf('{')
  const fin = texte.lastIndexOf('}')
  if (debut === -1) return new Map()

  const releve = new Map<SignalId, boolean>()
  for (const signal of JSON.parse(texte.slice(debut, fin + 1)).signals ?? []) {
    if (typeof signal?.id === 'string' && typeof signal?.value === 'boolean') {
      releve.set(signal.id as SignalId, signal.value)
    }
  }
  return releve
}

describe.skipIf(!KEY)(`extraction — ${MODEL}`, () => {
  it(
    'relève ce qu\'un praticien attendrait, sans rien inventer',
    async () => {
      let attendus = 0
      let trouves = 0
      let interditsViolés = 0
      let inventions = 0
      const details: string[] = []

      for (const cas of CAS_EXTRACTION) {
        const releve = await extract(cas)
        const prevus = new Set<string>([
          ...Object.keys(cas.attendus),
          ...(cas.interdits ?? []),
        ])

        const manquants: string[] = []
        for (const [id, valeur] of Object.entries(cas.attendus) as [SignalId, boolean][]) {
          attendus += 1
          if (releve.get(id) === valeur) trouves += 1
          else manquants.push(`${id}=${valeur}`)
        }

        const faux = (cas.interdits ?? []).filter((id) => releve.has(id))
        interditsViolés += faux.length

        const horsSujet = [...releve.keys()].filter((id) => !prevus.has(id))
        inventions += horsSujet.length

        details.push(
          `\n  ${cas.nom}` +
            `\n    manqués   : ${manquants.length ? manquants.join(', ') : '—'}` +
            `\n    à tort    : ${faux.length ? faux.join(', ') : '—'}` +
            `\n    hors liste: ${horsSujet.length ? horsSujet.slice(0, 6).join(', ') : '—'}`,
        )
      }

      const rappel = Math.round((trouves / attendus) * 100)
      console.log(
        `\n═══ ${MODEL} ═══` +
          `\n  rappel            : ${rappel} % (${trouves}/${attendus})` +
          `\n  relevés à tort    : ${interditsViolés}` +
          `\n  hors liste prévue : ${inventions}` +
          details.join(''),
      )

      // Garde-fou : sous ce seuil, le copilote passerait à côté de trop de choses.
      expect(rappel).toBeGreaterThanOrEqual(70)
      expect(interditsViolés).toBeLessThanOrEqual(3)
    },
    240_000,
  )
})
