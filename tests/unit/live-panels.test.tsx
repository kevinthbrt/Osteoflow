import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LiveLineFeed } from '@/components/consultations/live/live-line-feed'
import { LiveChecklist } from '@/components/consultations/live/live-checklist'
import { applyOps, type LiveLine } from '@/lib/anamnesis-live'

const lines: LiveLine[] = applyOps([], [
  { op: 'add', id: 'a', axis: 'localisation', text: 'Lombaire basse' },
  { op: 'add', id: 'b', axis: 'lateralite', text: 'Gauche' },
  { op: 'add', id: 'c', axis: 'intensite', text: 'EVA 7/10' },
  { op: 'add', id: 'd', axis: 'irradiation', text: 'Descend sous le genou', confidence: 'low', verbatim: 'ça tire jusqu\'en bas de la jambe' },
])

const noop = () => {}

describe('fil de l\'anamnèse', () => {
  const html = renderToStaticMarkup(<LiveLineFeed lines={lines} onEdit={noop} onRemove={noop} />)

  it('affiche une ligne par fait, avec son symbole', () => {
    expect(html).toContain('Lombaire basse')
    expect(html).toContain('EVA 7/10')
    expect(html).toContain('📍')
    expect(html).toContain('↔️')
  })

  it('montre les mots du patient sous la ligne douteuse', () => {
    // L'apostrophe est échappée dans le markup, on vérifie la partie stable.
    expect(html).toContain('ça tire jusqu')
    expect(html).toContain('en bas de la jambe')
  })

  it('ne colore que ce qui appelle une réaction', () => {
    // Si tout est coloré, plus rien ne l'est. Le texte courant reste neutre.
    const plain = renderToStaticMarkup(
      <LiveLineFeed lines={[{ id: 'a', axis: 'localisation', text: 'Lombaire basse' }]} onEdit={noop} onRemove={noop} />,
    )
    expect(plain).toContain('text-foreground')
    expect(plain).not.toContain('text-red-')
    expect(plain).not.toContain('text-amber-')

    // Le doute de transcription et le drapeau rouge, eux, se voient.
    expect(html).toContain('text-amber-800')
    const flagged = renderToStaticMarkup(
      <LiveLineFeed lines={[{ id: 'r', axis: 'red_flag', text: 'Douleur nocturne' }]} onEdit={noop} onRemove={noop} />,
    )
    expect(flagged).toContain('text-red-800')
  })

  it('invite à parler quand rien n\'a encore été dit', () => {
    expect(renderToStaticMarkup(<LiveLineFeed lines={[]} onEdit={noop} onRemove={noop} />))
      .toContain('Lancez la dictée')
  })
})

describe('copilote', () => {
  const html = renderToStaticMarkup(
    <LiveChecklist lines={lines} redFlagsCleared={false} onClearRedFlags={noop} />,
  )

  it('réclame ce qui manque, et pas ce qui est couvert', () => {
    expect(html).toContain('Pas encore abordé')
    expect(html).toContain('Depuis combien de temps ?')
    // Les axes déjà couverts par une ligne ne sont pas réclamés.
    expect(html).not.toContain('Où exactement ?')
    expect(html).not.toContain('Sur une échelle de 0 à 10 ?')
    expect(html).not.toContain('jusqu&#x27;où ?')
  })

  it('ne propose jamais d\'hypothèse ni de diagnostic', () => {
    // Un panneau qui affiche une piste tôt oriente la suite de l'interrogatoire
    // vers sa confirmation. Le copilote dit ce qui manque, jamais ce que c'est.
    expect(html).not.toMatch(/hypoth|probab|\d\s*%/i)
    // La seule mention du diagnostic est celle qui s'en défend.
    expect(html).toContain('Aucune orientation diagnostique')
    expect(html.match(/diagnos/gi)).toHaveLength(1)
  })

  it('ne déclare pas un dépistage qui n\'a pas eu lieu', () => {
    expect(html).toContain('Dépistage non tranché')
    const cleared = renderToStaticMarkup(
      <LiveChecklist lines={lines} redFlagsCleared onClearRedFlags={noop} />,
    )
    expect(cleared).toContain('aucun retenu')
  })

  it('met le drapeau rouge détecté au-dessus de tout', () => {
    const flagged = renderToStaticMarkup(
      <LiveChecklist
        lines={applyOps(lines, [{ op: 'add', id: 'r', axis: 'red_flag', text: 'Douleur nocturne non soulagée' }])}
        redFlagsCleared
        onClearRedFlags={noop}
      />,
    )
    expect(flagged).toContain('1 drapeau rouge')
    expect(flagged).toContain('Douleur nocturne non soulagée')
    // Une case cochée ne doit pas masquer un signe réellement relevé.
    expect(flagged).not.toContain('aucun retenu')
  })

  it('signale la complétude quand tous les axes requis sont couverts', () => {
    const complete = applyOps([], [
      'motif', 'localisation', 'lateralite', 'anciennete', 'apparition', 'type',
      'intensite', 'horaire', 'irradiation', 'aggravant', 'soulageant',
      'evolution', 'traitement', 'retentissement',
    ].map((axis, i) => ({ op: 'add', id: `l${i}`, axis, text: 'renseigné' })))
    const html2 = renderToStaticMarkup(
      <LiveChecklist lines={complete} redFlagsCleared onClearRedFlags={noop} />,
    )
    expect(html2).toContain('Interrogatoire complet')
  })
})
