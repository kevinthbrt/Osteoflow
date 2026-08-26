import { describe, it, expect } from 'vitest'
import { creerAssembleur } from '@/components/consultations/use-continuous-dictation'

/**
 * L'ordre du compte rendu.
 *
 * La dictée continue envoie les segments à la suite mais ils reviennent quand
 * ils reviennent : un passage court transcrit vite double un passage long parti
 * avant lui. Publier dans l'ordre d'arrivée intervertirait des phrases — sur un
 * compte rendu médical, c'est le genre d'erreur qui ne se voit qu'à la
 * relecture, des semaines plus tard.
 */
describe('assemblage des segments dictés', () => {
  function assembler() {
    const publies: string[] = []
    const assembleur = creerAssembleur((texte) => publies.push(texte))
    return { publies, assembleur }
  }

  it('publie dans l\'ordre quand les segments reviennent dans l\'ordre', () => {
    const { publies, assembleur } = assembler()
    const a = assembleur.reserver()
    const b = assembleur.reserver()
    assembleur.deposer(a, 'le patient a mal')
    assembleur.deposer(b, 'depuis deux semaines')
    expect(publies).toEqual(['le patient a mal', 'depuis deux semaines'])
  })

  it('retient un segment en avance jusqu\'à ce que son tour vienne', () => {
    const { publies, assembleur } = assembler()
    const a = assembleur.reserver()
    const b = assembleur.reserver()

    // Le second revient le premier : rien ne doit sortir.
    assembleur.deposer(b, 'depuis deux semaines')
    expect(publies).toEqual([])

    assembleur.deposer(a, 'le patient a mal')
    expect(publies).toEqual(['le patient a mal', 'depuis deux semaines'])
  })

  it('libère toute la file d\'un coup quand le segment manquant arrive', () => {
    const { publies, assembleur } = assembler()
    const numeros = [0, 1, 2, 3].map(() => assembleur.reserver())

    assembleur.deposer(numeros[3], 'quatre')
    assembleur.deposer(numeros[1], 'deux')
    assembleur.deposer(numeros[2], 'trois')
    expect(publies).toEqual([])

    assembleur.deposer(numeros[0], 'un')
    expect(publies).toEqual(['un', 'deux', 'trois', 'quatre'])
  })

  it('ne bloque pas la suite quand un segment est perdu', () => {
    // Un échec réseau publie une chaîne vide : le texte a un trou, mais tout ce
    // qui suit sort quand même. L'inverse — retenir la file — perdrait la fin
    // de la consultation sans que personne ne s'en aperçoive.
    const { publies, assembleur } = assembler()
    const a = assembleur.reserver()
    const b = assembleur.reserver()

    assembleur.deposer(b, 'la suite')
    assembleur.deposer(a, '')
    expect(publies).toEqual(['la suite'])
  })

  it('ne publie jamais de segment vide', () => {
    const { publies, assembleur } = assembler()
    const a = assembleur.reserver()
    const b = assembleur.reserver()
    assembleur.deposer(a, '')
    assembleur.deposer(b, '')
    expect(publies).toEqual([])
  })

  it('repart de zéro d\'une dictée à l\'autre', () => {
    const { publies, assembleur } = assembler()
    assembleur.deposer(assembleur.reserver(), 'première dictée')
    assembleur.reinitialiser()

    const a = assembleur.reserver()
    expect(a).toBe(0)
    assembleur.deposer(a, 'seconde dictée')
    expect(publies).toEqual(['première dictée', 'seconde dictée'])
  })

  it('tient un entrelacement quelconque de N segments', () => {
    // Balayage : quel que soit l'ordre de retour, le texte final est le même.
    const ordres = [
      [0, 1, 2, 3, 4],
      [4, 3, 2, 1, 0],
      [2, 0, 4, 1, 3],
      [1, 0, 3, 2, 4],
    ]
    for (const ordre of ordres) {
      const { publies, assembleur } = assembler()
      const numeros = ordre.map(() => assembleur.reserver())
      for (const index of ordre) assembleur.deposer(numeros[index], `s${index}`)
      expect(publies, ordre.join(',')).toEqual(['s0', 's1', 's2', 's3', 's4'])
    }
  })
})
