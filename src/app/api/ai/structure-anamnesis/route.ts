import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Tu es un assistant clinique pour ostéopathes francophones.
Tu reçois la transcription brute d'une anamnèse (prise en charge d'un patient) et tu dois la structurer.

RÉPONDS UNIQUEMENT EN JSON valide avec ce format exact — rien avant, rien après :
{
  "reason": "motif principal en 1 ligne courte (ex: Lombalgie basse droite chronique d'apparition progressive)",
  "anamnesis": "anamnèse structurée complète"
}

Pour le champ "anamnesis", rédige un texte structuré avec ces sections (saute une ligne entre chaque) :
Histoire de la maladie : [chronologie, circonstances d'apparition, évolution]
Caractéristiques : localisation — type de douleur — intensité EVA x/10 — irradiations
Facteurs modulants : aggravants : [...] / soulageants : [...]
Antécédents mentionnés : [antécédents pertinents cités]
Traitements essayés : [médicaments, kiné, etc.]
Impact fonctionnel : [travail, sommeil, activités]
Drapeaux rouges : [aucun identifié à l'anamnèse — ou liste si présents]

Règles absolues :
- Style médical professionnel et concis, vocabulaire ostéopathique
- Si une information n'est pas mentionnée : écrire "—"
- Ne jamais inventer ou supposer des informations non dites explicitement
- Corriger les erreurs de transcription évidentes (homophones, mots déformés)
- Répondre uniquement en français`

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json()

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Clé API Anthropic non configurée sur le serveur." }, { status: 500 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Transcription de l'anamnèse :\n\n${transcript}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[AI structure]', res.status, err)
      return NextResponse.json(
        { error: `Erreur API Anthropic (${res.status}).` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const content = data.content?.[0]?.text ?? ''

    let parsed: { reason: string; anamnesis: string }
    try {
      const json = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      parsed = JSON.parse(json)
    } catch {
      parsed = { reason: '', anamnesis: content }
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[AI structure]', err)
    return NextResponse.json({ error: 'Erreur lors de la structuration.' }, { status: 500 })
  }
}
