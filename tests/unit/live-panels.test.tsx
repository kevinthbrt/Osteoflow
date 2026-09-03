import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LiveLineFeed } from '@/components/consultations/live/live-line-feed'
import { LiveChecklist } from '@/components/consultations/live/live-checklist'
import { LivePatientPanel } from '@/components/consultations/live/live-patient-panel'
import { applyOps, type LiveLine } from '@/lib/anamnesis-live'

const lines: LiveLine[] = applyOps([], [
  { op: 'add', id: 'a', axis: 'localisation', text: 'Lombaire basse' },
  { op: 'add', id: 'b', axis: 'lateralite', text: 'Gauche' },
  { op: 'add', id: 'c', axis: 'intensite', text: 'EVA 7/10' },
  { op: 'add', id: 'd', axis: 'irradiation', text: 'Descend sous le genou', confidence: 'low', verbatim: 'ça tire jusqu\'en bas de la jambe' },
])

const noop = () => {}

describe('fil de l\'anamnèse', () => {
  const html = renderToStaticMarkup(<LiveLineFeed lines={lines} onEdit={noop} onRemove={noop} onAdd={noop} />)

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
      <LiveLineFeed lines={[{ id: 'a', axis: 'localisation', text: 'Lombaire basse' }]} onEdit={noop} onRemove={noop} onAdd={noop} />,
    )
    expect(plain).toContain('text-foreground')
    expect(plain).not.toContain('text-red-')
    expect(plain).not.toContain('text-amber-')

    // Le doute de transcription et le drapeau rouge, eux, se voient.
    expect(html).toContain('text-amber-800')
    const flagged = renderToStaticMarkup(
      <LiveLineFeed lines={[{ id: 'r', axis: 'red_flag', text: 'Douleur nocturne' }]} onEdit={noop} onRemove={noop} onAdd={noop} />,
    )
    expect(flagged).toContain('text-red-800')
  })

  it('invite à parler quand rien n\'a encore été dit', () => {
    expect(renderToStaticMarkup(<LiveLineFeed lines={[]} onEdit={noop} onRemove={noop} onAdd={noop} />))
      .toContain('Lancez la dictée')
  })
})

describe('copilote', () => {
  const html = renderToStaticMarkup(
    <LiveChecklist lines={lines} redFlagsCleared={false} onClearRedFlags={noop} dismissedAxes={[]} onDismissAxis={noop} onRestoreAxes={noop} />,
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
      <LiveChecklist lines={lines} redFlagsCleared onClearRedFlags={noop} dismissedAxes={[]} onDismissAxis={noop} onRestoreAxes={noop} />,
    )
    expect(cleared).toContain('aucun retenu')
  })

  it('met le drapeau rouge détecté au-dessus de tout', () => {
    const flagged = renderToStaticMarkup(
      <LiveChecklist
        lines={applyOps(lines, [{ op: 'add', id: 'r', axis: 'red_flag', text: 'Douleur nocturne non soulagée' }])}
        redFlagsCleared
        onClearRedFlags={noop} dismissedAxes={[]} onDismissAxis={noop} onRestoreAxes={noop}
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
      <LiveChecklist lines={complete} redFlagsCleared onClearRedFlags={noop} dismissedAxes={[]} onDismissAxis={noop} onRestoreAxes={noop} />,
    )
    expect(html2).toContain('Interrogatoire complet')
  })
})

describe('axes écartés', () => {
  it('retire de la liste un axe jugé sans objet', () => {
    // Sans porte de sortie, un axe qui ne s'applique pas au patient reste
    // réclamé indéfiniment et le copilote devient un bruit qu'on cesse de lire.
    const html = renderToStaticMarkup(
      <LiveChecklist
        lines={lines}
        redFlagsCleared
        onClearRedFlags={noop}
        dismissedAxes={['anciennete', 'horaire']}
        onDismissAxis={noop}
        onRestoreAxes={noop}
      />,
    )
    expect(html).not.toContain('Depuis combien de temps ?')
    expect(html).not.toContain('Nocturne ? Matinale ?')
    expect(html).toContain('2 axes écartés, rétablir')
    // Les autres restent réclamés.
    expect(html).toContain('Brutale ou progressive ?')
  })
})

describe('dossier patient', () => {
  const html = renderToStaticMarkup(
    <LivePatientPanel
      patient={{ fullName: 'Camille Roux', age: 42, gender: 'F', profession: 'Infirmière', sportActivity: 'Course' }}
      history={[
        { id: 'v1', history_type: 'medical', description: 'Anticoagulants au long cours', is_vigilance: 1 },
        { id: 'h1', history_type: 'surgical', description: 'Appendicectomie 2018' },
        { id: 'h2', history_type: 'traumatic', description: 'Fracture poignet droit 2015' },
      ]}
      pastConsultations={[
        { id: 'c1', date_time: '2026-08-12T10:00:00', reason: 'Cervicalgie', anamnesis_summary: 'Cervicalgie mécanique, EVA 5/10.' },
      ]}
    />,
  )

  it('affiche l\'identité utile en consultation', () => {
    expect(html).toContain('Camille Roux')
    expect(html).toContain('42 ans')
    expect(html).toContain('Infirmière')
  })

  it('met la vigilance au-dessus des autres antécédents', () => {
    // C'est ce qui peut changer la conduite de la séance : ça ne doit pas se
    // chercher au milieu d'une liste.
    expect(html).toContain('Anticoagulants au long cours')
    expect(html.indexOf('Anticoagulants au long cours')).toBeLessThan(html.indexOf('Appendicectomie 2018'))
    expect(html).toContain('Vigilance')
  })

  it('groupe les antécédents par nature', () => {
    expect(html).toContain('Chirurgicaux')
    expect(html).toContain('Traumatiques')
    expect(html).toContain('Fracture poignet droit 2015')
  })

  it('résume les consultations passées avec leur phrase de synthèse', () => {
    expect(html).toContain('12/08/2026')
    expect(html).toContain('Cervicalgie')
    expect(html).toContain('Cervicalgie mécanique, EVA 5/10.')
  })

  it('le dit quand il n\'y a pas d\'historique', () => {
    const first = renderToStaticMarkup(
      <LivePatientPanel
        patient={{ fullName: 'Jean Dupont', age: 30, gender: 'M' }}
        history={[]}
        pastConsultations={[]}
      />,
    )
    expect(first).toContain('Première consultation.')
    expect(first).not.toContain('Vigilance')
  })
})
