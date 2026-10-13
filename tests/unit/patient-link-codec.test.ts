/**
 * Le lien patient et le bilan voyagent sans serveur : ils doivent se décoder à
 * l'identique de l'autre côté (appli patient d'osteoupgrade), et le code court
 * tapé à la main doit refuser les fautes de frappe plutôt que d'afficher un
 * faux bilan.
 */
import { describe, it, expect } from 'vitest'
import {
  encodeProgram, decodeProgram, shortRef, sessionsPerWeek,
  encodeFullReport, decodeFullReport, summarizeWeeks,
  encodeShortCode, decodeShortCode, activePhase,
  type LinkProgram, type FullReport,
} from '@/lib/exercises/patient-link-codec'

const program: LinkProgram = {
  v: 1,
  id: shortRef('9ffd64b4-4ce2-4835-a8b7-f73d543640e8'),
  pr: 'Kevin Thubert, ostéopathe',
  d: '2026-09-29',
  n: 3,
  i: 'Votre tendon a besoin d’être rechargé progressivement.',
  w: 'Un jour sur deux, environ 15 minutes.',
  x: [
    { e: 'a1', n: 'Calf raise lourd lent (HSR)', t: 'renfo', s: 3, r: '15 (puis 12, 10, 8, 6)', h: null, p: 150, f: '3 fois par semaine', o: 'Douleur jusqu’à 5/10 acceptable.' },
    { e: 'b2', n: 'Isométrie mollet debout', s: 5, r: '1', h: 45, p: 120, d: 'Description modifiée par le praticien.' },
  ],
}

const report: FullReport = {
  v: 1, id: program.id, s: '2026-09-29', at: '2026-10-13', n: 3,
  days: [
    { o: 0, m: 5, x: true, p: 4 }, { o: 1, m: 5, x: false, p: null },
    { o: 2, m: 4, x: true, p: 4 }, { o: 4, m: 4, x: true, p: 3 },
    { o: 7, m: 4, x: true, p: 4 }, { o: 8, m: null, x: false, p: null },
    { o: 9, m: 3, x: true, p: 3 }, { o: 13, m: 2, x: false, p: null },
  ],
}

describe('programme dans le lien', () => {
  it('se décode à l’identique, accents compris', () => {
    const token = encodeProgram(program)
    expect(token).toMatch(/^1\.[A-Za-z0-9_-]+$/)
    expect(decodeProgram(token)).toEqual(program)
    expect(decodeProgram('#' + token)).toEqual(program)
  })

  it('reste assez court pour un QR code imprimé', () => {
    expect(encodeProgram(program).length).toBeLessThan(900)
  })

  it('refuse un lien abîmé', () => {
    expect(decodeProgram('1.abc')).toBeNull()
    expect(decodeProgram('rien')).toBeNull()
  })
})

describe('séances par semaine', () => {
  it('lit la routine puis les fréquences', () => {
    expect(sessionsPerWeek('3 fois par semaine, 1 jour de repos entre deux', [])).toBe(3)
    expect(sessionsPerWeek('Un jour sur deux', [])).toBe(3)
    expect(sessionsPerWeek(null, ['2 fois par semaine', '1 fois par jour'])).toBe(7)
    expect(sessionsPerWeek(null, [null])).toBe(3)
  })
})

describe('bilan complet', () => {
  it('se retrouve dans un texte collé', () => {
    const text = `Bonjour, voici mon bilan : ${encodeFullReport(report)} Merci !`
    expect(decodeFullReport(text)).toEqual(report)
  })

  it('se résume par semaine', () => {
    expect(summarizeWeeks(report)).toEqual([
      { week: 0, done: 3, morning: 4.5, maxPain: 4 },
      { week: 1, done: 2, morning: 3, maxPain: 4 },
    ])
  })
})

describe('code court', () => {
  it('fait l’aller-retour', () => {
    const weeks = summarizeWeeks(report)
    const code = encodeShortCode(program.id, weeks)
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{1,4})+$/)
    const back = decodeShortCode(code.toLowerCase().replace(/-/g, ' '))
    expect(back).toEqual({ ref4: program.id.slice(0, 4), weeks })
  })

  it('tient en moins de 30 caractères sur 8 semaines', () => {
    const weeks = Array.from({ length: 8 }, (_, w) => ({ week: w + 4, done: 3, morning: 2.5, maxPain: 4 }))
    const code = encodeShortCode(program.id, weeks)
    expect(code.replace(/-/g, '').length).toBeLessThanOrEqual(28)
    expect(decodeShortCode(code)?.weeks).toEqual(weeks)
  })

  it('refuse toute faute de frappe sur un caractère', () => {
    const code = encodeShortCode(program.id, summarizeWeeks(report)).replace(/-/g, '')
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < code.length; i++) {
      for (const c of alphabet) {
        if (c === code[i]) continue
        const typo = code.slice(0, i) + c + code.slice(i + 1)
        expect(decodeShortCode(typo)).toBeNull()
      }
    }
  })

  it('accepte O pour 0 et I ou L pour 1', () => {
    const code = encodeShortCode(program.id, summarizeWeeks(report))
    const sloppy = code.replace(/0/g, 'O').replace(/1/g, 'l')
    expect(decodeShortCode(sloppy)).not.toBeNull()
  })
})

describe('étapes planifiées', () => {
  const phased: LinkProgram = {
    v: 1, id: 'abcd1234', pr: 'Kevin Thubert, ostéopathe', d: '2026-10-01', u: '2026-10-10T09:00:00.000Z', n: 3,
    g: 'Arrêtez si la douleur dépasse 5 sur 10',
    ph: [
      { o: 14, l: 'Charge lourde', n: 3, x: [{ e: 'b', n: 'Calf raise lourd lent (HSR)', s: 3, r: '15' }] },
      { o: 0, l: 'Isométrie', n: 7, w: 'Tous les jours', x: [{ e: 'a', n: 'Isométrie mollet debout', s: 5, h: 45 }] },
    ],
  }

  it('se décode, avec ou sans exercices à plat', () => {
    expect(decodeProgram(encodeProgram(phased))).toEqual(phased)
  })

  it('choisit l’étape selon la date', () => {
    expect(activePhase(phased, '2026-09-25').l).toBe('Isométrie')
    const first = activePhase(phased, '2026-10-05')
    expect(first).toMatchObject({ index: 0, total: 2, l: 'Isométrie', n: 7, startsOn: '2026-10-01', next: { startsOn: '2026-10-15', l: 'Charge lourde' } })
    const second = activePhase(phased, '2026-10-15')
    expect(second).toMatchObject({ index: 1, l: 'Charge lourde', n: 3, next: null })
  })

  it('traite un programme sans étapes comme une seule étape', () => {
    expect(activePhase(program, '2026-12-01')).toMatchObject({ index: 0, total: 1, n: 3, x: program.x, next: null })
  })
})
