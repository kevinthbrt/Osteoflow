import { describe, it, expect } from 'vitest'
import { envoiIncremental } from '@/components/consultations/use-live-signals'

/**
 * Le coût de l'analyse en direct.
 *
 * Relire tout le texte à chaque passage ferait grossir l'appel à mesure que
 * l'anamnèse s'allonge — un texte de vingt lignes analysé cinquante fois
 * coûterait cinquante fois vingt lignes, pour une information qui n'augmente
 * que du dernier passage. C'est cette fonction qui décide de ce qui part, et
 * c'est elle qui tient la facture.
 */
describe('envoi incrémental à l\'analyse', () => {
  it('envoie tout au premier passage', () => {
    const decision = envoiIncremental('le patient a mal en bas du dos', '')
    expect(decision).toEqual({ envoi: 'le patient a mal en bas du dos', suite: false })
  })

  it('n\'envoie que la suite quand le texte est prolongé', () => {
    const deja = 'a'.repeat(500)
    const texte = deja + ' et la douleur descend dans la fesse droite'
    const decision = envoiIncremental(texte, deja)!

    expect(decision.suite).toBe(true)
    expect(decision.envoi).toContain('descend dans la fesse droite')
    // La suite est bornée par le recouvrement, pas par la longueur du texte :
    // c'est ce qui empêche le coût de croître avec l'anamnèse.
    expect(decision.envoi.length).toBeLessThan(300)
  })

  it('garde un recouvrement pour ne pas couper un élément en deux', () => {
    const deja = 'le patient dit avoir mal depuis deux semaines'
    const texte = `${deja} et ça descend dans la jambe gauche`
    const decision = envoiIncremental(texte, deja)!
    // La fin du texte déjà analysé est renvoyée avec la suite : un élément à
    // cheval sur deux envois reste lisible.
    expect(decision.envoi).toContain('deux semaines')
  })

  it('reprend tout quand le texte a été réécrit en amont', () => {
    // Le praticien a corrigé une phrase au milieu : les repères ne valent plus
    // rien, et analyser la « suite » raisonnerait sur une version qui n'existe
    // plus.
    const deja = 'le patient a mal au genou'
    const texte = 'le patient a mal au dos depuis deux semaines'
    const decision = envoiIncremental(texte, deja)!
    expect(decision.suite).toBe(false)
    expect(decision.envoi).toBe(texte)
  })

  it('reprend tout quand on le demande explicitement', () => {
    const deja = 'le patient a mal'
    const texte = `${deja} depuis deux semaines et ça descend dans la jambe`
    const decision = envoiIncremental(texte, deja, { complet: true })!
    expect(decision.suite).toBe(false)
    expect(decision.envoi).toBe(texte)
  })

  it('n\'envoie rien pour une suite qui ne porte rien', () => {
    // Trois mots de plus ne valent pas un appel : on attend le passage suivant.
    const deja = 'le patient a mal en bas du dos depuis deux semaines'
    expect(envoiIncremental(`${deja} oui`, deja)).toBeNull()
  })

  it('n\'envoie rien sur un texte vide', () => {
    expect(envoiIncremental('', '')).toBeNull()
    expect(envoiIncremental('   ', '')).toBeNull()
  })

  it('borne le volume envoyé sur une anamnèse entière', () => {
    // Une vraie anamnèse dictée : une quarantaine de passages de quelques
    // lignes. C'est là que le découpage se paie — sur un texte plus court que
    // le recouvrement, il n'y a rien à économiser, et c'est normal.
    const passages = Array.from(
      { length: 40 },
      (_, i) =>
        ` le patient précise au passage numéro ${i} que la douleur se modifie selon la position et qu'elle le gêne surtout en fin de journée.`,
    )

    let texte = ''
    let analyse = ''
    let totalEnvoye = 0
    let appels = 0

    for (const passage of passages) {
      texte += passage
      const decision = envoiIncremental(texte, analyse)
      if (!decision) continue
      appels += 1
      totalEnvoye += decision.envoi.length
      analyse = texte
    }

    expect(analyse).toBe(texte)

    // Sans découpage, chaque passage renverrait tout depuis le début : le
    // volume croîtrait avec le carré du nombre de passages.
    const sansDecoupage = passages.reduce(
      (total, _, index) => total + passages.slice(0, index + 1).join('').length,
      0,
    )
    // Avec découpage, il croît avec le texte, plus un recouvrement par appel.
    expect(totalEnvoye).toBeLessThanOrEqual(texte.length + appels * 200)
    expect(totalEnvoye).toBeLessThan(sansDecoupage / 2)
  })
})
