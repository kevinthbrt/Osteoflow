import { NextResponse } from 'next/server'
import { SIGNALS } from '@/lib/reasoning/signals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROXY_URL = 'https://osteoupgrade.vercel.app/api/osteoflow/extract-signals'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Traduit une anamnèse dictée en signaux du vocabulaire clinique.
 *
 * Le vocabulaire est envoyé avec la requête plutôt que dupliqué côté proxy :
 * il vit dans `src/lib/reasoning/signals.ts` et doit rester la seule source de
 * vérité. Comme il est identique d'un appel à l'autre, il sert aussi de préfixe
 * de cache.
 *
 * Deux modes, comme pour la transcription : proxy centralisé en production,
 * clé Anthropic locale en développement.
 */

const SYSTEM_PROMPT = `Tu es un extracteur de faits cliniques pour ostéopathes francophones.

Tu reçois le texte d'une anamnèse dictée. Tu dois le traduire en signaux issus
EXCLUSIVEMENT du vocabulaire fourni. Tu n'interprètes pas, tu ne diagnostiques
pas, tu ne déduis rien qui ne soit pas dit : tu relèves.

RÉPONDS UNIQUEMENT EN JSON valide :
{
  "signals": [
    { "id": "identifiant.exact.du.vocabulaire", "value": true, "verbatim": "les mots du patient qui le justifient" }
  ]
}

Règles absolues :
- "id" doit être un identifiant du vocabulaire fourni, copié caractère pour
  caractère. Tout autre identifiant est ignoré : n'en invente jamais.
- "value" vaut true si le fait est affirmé, false s'il est explicitement nié
  ("pas de fièvre", "ça ne descend pas sous le genou"). Un fait dont le texte ne
  parle pas ne figure PAS dans la réponse — l'absence de mention n'est pas une
  négation.
- "verbatim" cite le passage du texte qui justifie le signal, sans le
  reformuler. C'est ce qui permet au praticien de vérifier.
- Dans le doute, n'extrais pas. Un signal faux coûte plus cher qu'un signal
  manquant : il oriente le raisonnement dans une mauvaise direction.
- Aucun texte avant ou après le JSON.

Quand une liste « déjà relevé » accompagne le texte, celui-ci est la suite de
l'anamnèse et non son intégralité. Ne renvoie alors que ce que ce passage
ajoute ou contredit : un signal déjà relevé et simplement répété n'a pas à
figurer dans la réponse, un signal déjà relevé que ce passage contredit doit y
figurer avec sa nouvelle valeur.`

export interface ExtractedSignal {
  id: string
  value: boolean
  verbatim?: string
}

function vocabulary(): { id: string; label: string }[] {
  return Object.entries(SIGNALS).map(([id, definition]) => ({ id, label: definition.label }))
}

/** Le vocabulaire fait foi : tout identifiant inconnu est écarté sans discussion. */
function sanitize(raw: unknown): ExtractedSignal[] {
  const allowed = new Set(Object.keys(SIGNALS))
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (signal): signal is ExtractedSignal =>
        typeof signal === 'object' &&
        signal !== null &&
        typeof (signal as { id?: unknown }).id === 'string' &&
        typeof (signal as { value?: unknown }).value === 'boolean' &&
        allowed.has((signal as { id: string }).id),
    )
    .map((signal) => ({
      id: signal.id,
      value: signal.value,
      verbatim: typeof signal.verbatim === 'string' ? signal.verbatim.slice(0, 300) : undefined,
    }))
}

/** Rappel compact de ce qui est déjà relevé, pour ne pas le faire redire. */
function knownBlock(known: ExtractedSignal[]): string {
  if (known.length === 0) return ''
  return `Déjà relevé :\n${known.map((signal) => `${signal.id} = ${signal.value}`).join('\n')}\n\n`
}

async function extractViaProxy(
  text: string,
  reason: string | undefined,
  secret: string,
  known: ExtractedSignal[],
): Promise<ExtractedSignal[]> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-osteoflow-secret': secret },
    body: JSON.stringify({ text, reason, known, vocabulary: vocabulary() }),
    signal: AbortSignal.timeout(50000),
  })
  if (!res.ok) throw new Error(`Proxy error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return sanitize(data.signals)
}

async function extractViaAnthropic(
  text: string,
  reason: string | undefined,
  apiKey: string,
  known: ExtractedSignal[],
): Promise<ExtractedSignal[]> {
  const vocabularyText = `Vocabulaire (${Object.keys(SIGNALS).length} signaux) :\n${vocabulary()
    .map((entry) => `${entry.id} = ${entry.label}`)
    .join('\n')}`

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: vocabularyText, cache_control: { type: 'ephemeral', ttl: '1h' } },
      ],
      messages: [
        {
          role: 'user',
          content: `${reason ? `Motif de consultation : ${reason}\n\n` : ''}${knownBlock(known)}${
            known.length > 0 ? 'Suite de l\'anamnèse' : 'Anamnèse'
          } :\n${text}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(50000),
  })

  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const content: string = (
    data.content?.find((block: { type: string }) => block.type === 'text')?.text ?? ''
  ).trim()
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1) return []
  try {
    return sanitize(JSON.parse(content.slice(start, end + 1)).signals)
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string
      reason?: string
      known?: ExtractedSignal[]
    }
    const { text, reason } = body
    if (!text?.trim()) return NextResponse.json({ signals: [] })
    const known = sanitize(body.known)

    const proxySecret = process.env.OSTEOFLOW_PROXY_SECRET
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (proxySecret) {
      return NextResponse.json({ signals: await extractViaProxy(text, reason, proxySecret, known) })
    }
    if (anthropicKey) {
      return NextResponse.json({
        signals: await extractViaAnthropic(text, reason, anthropicKey, known),
      })
    }
    // Sans configuration IA, le copilote fonctionne quand même : le praticien
    // répond lui-même aux questions proposées.
    return NextResponse.json({ signals: [], unconfigured: true })
  } catch (err) {
    console.error('[extract-signals]', err)
    return NextResponse.json({ error: 'Extraction indisponible.' }, { status: 502 })
  }
}
