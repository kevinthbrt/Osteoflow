/**
 * Modèle des cartes d'anamnèse.
 *
 * Les cartes (sections) sont la source de vérité unique produite par l'IA. Le
 * texte markdown de l'anamnèse en est DÉRIVÉ (et non plus généré séparément),
 * afin de rester disponible pour les lettres, exports, recherche et
 * consultations passées, sans risque de divergence avec les cartes affichées.
 *
 * Ce module ne dépend d'aucun composant : les composants en dépendent. C'est ce
 * qui permet aux cartes, à l'enregistreur et à l'affichage en lecture seule de
 * partager un seul modèle plutôt que trois copies.
 */

export interface AnamnesisSection {
  id: string
  label: string
  icon: string
  /**
   * Couleur historiquement renvoyée par l'IA, une par rubrique. Elle ne pilote
   * plus l'habillage : cinq couleurs décoratives noyaient le seul signal qui
   * compte (les drapeaux rouges). Conservée pour ne pas invalider les
   * consultations déjà enregistrées, et ignorée à l'affichage.
   */
  color?: 'red' | 'green' | 'slate' | 'sky' | 'teal' | 'indigo' | 'stone'
  items: string[]
  allClear?: boolean
}

/** Marqueur posé par l'IA sur un terme dont la transcription reste incertaine. */
export const UNCERTAIN_MARKER = '[?]'

/** Valeur d'item signifiant « sujet non abordé dans la dictée ». */
export const NOT_COVERED = '—'

const SECTION_HEADINGS: Record<string, string> = {
  history: 'Histoire de la maladie',
  pain: 'Caractéristiques de la douleur',
  modulating: 'Facteurs modulants',
  history_past: 'Antécédents mentionnés',
  treatment: 'Traitements essayés',
  functional: 'Impact fonctionnel',
  red_flags: 'Drapeaux rouges',
}

/** Un item réellement renseigné (ni vide, ni le placeholder « non abordé »). */
export function isRealItem(item: string | null | undefined): boolean {
  const trimmed = (item ?? '').trim()
  return trimmed !== '' && trimmed !== NOT_COVERED
}

/** Les items réellement renseignés d'une section. */
export function realItems(section: AnamnesisSection): string[] {
  return (section.items ?? []).filter(isRealItem)
}

/**
 * Une rubrique « non abordée » : aucun item renseigné. Les drapeaux rouges n'en
 * sont jamais une, leur absence est elle-même une information.
 */
export function isNotCovered(section: AnamnesisSection): boolean {
  if (section.id === 'red_flags') return false
  return realItems(section).length === 0
}

/** Reconstruit le texte markdown de l'anamnèse à partir des cartes structurées. */
export function sectionsToMarkdown(sections: AnamnesisSection[]): string {
  const blocks: string[] = []

  for (const section of sections) {
    const heading = SECTION_HEADINGS[section.id] ?? section.label
    const items = realItems(section)

    if (section.id === 'red_flags') {
      if (section.allClear || items.length === 0) {
        blocks.push(`**${heading}**\n- Aucun identifié`)
      } else {
        blocks.push(`**${heading}**\n${items.map((i) => `- ${i}`).join('\n')}`)
      }
      continue
    }

    // Les rubriques vides (uniquement « — ») ne sont pas reportées dans le texte.
    if (items.length === 0) continue
    blocks.push(`**${heading}**\n${items.map((i) => `- ${i}`).join('\n')}`)
  }

  return blocks.join('\n\n')
}

/* ── Pastilles de synthèse ──────────────────────────────────────────────────
 *
 * Volontairement déterministes et extraites des cartes elles-mêmes, jamais
 * demandées à l'IA. Deux conséquences : une pastille ne peut pas contredire la
 * carte qu'elle résume, et les consultations déjà enregistrées en bénéficient
 * sans repasser par un appel IA. Ce qui n'est pas trouvé n'est pas affiché :
 * aucune valeur n'est inventée.
 */

export type RedFlagStatus = 'clear' | 'flagged' | 'unknown'

export interface AnamnesisVitals {
  /** Intensité douloureuse sur 10, si le praticien l'a chiffrée. */
  eva: number | null
  /** Ancienneté abrégée (« 4 j », « 3 sem. », « 2 mois », « ce jour »). */
  onset: string | null
  /** Latéralité de la plainte. */
  side: 'G' | 'D' | 'Bilat.' | null
  redFlags: RedFlagStatus
  /** Nombre de drapeaux rouges listés (0 si aucun). */
  redFlagCount: number
  /** Items portant le marqueur d'incertitude : ceux à confirmer de vive voix. */
  toConfirm: number
  /** Libellés des rubriques non abordées, dans l'ordre des cartes. */
  notCovered: string[]
}

function sectionById(sections: AnamnesisSection[], id: string): AnamnesisSection | undefined {
  return sections.find((s) => s.id === id)
}

/** Concatène les items réels de plusieurs rubriques, dans l'ordre donné. */
function textOf(sections: AnamnesisSection[], ids: string[]): string {
  const parts: string[] = []
  for (const id of ids) {
    const section = sectionById(sections, id)
    if (section) parts.push(...realItems(section))
  }
  return parts.join(' | ')
}

/**
 * Intensité chiffrée. On accepte « EVA 7 », « EVA : 7/10 » et le simple
 * « 7/10 », qui est la forme la plus fréquente en dictée.
 */
export function extractEva(text: string): number | null {
  const patterns = [
    /\bEVA\s*:?\s*(\d{1,2})\s*\/\s*10\b/i,
    /\bEVA\s*:?\s*(\d{1,2})\b/i,
    /(\d{1,2})\s*\/\s*10\b/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (Number.isInteger(value) && value >= 0 && value <= 10) return value
  }
  return null
}

const ONSET_UNITS: { pattern: RegExp; format: (n: number) => string }[] = [
  { pattern: /^(?:jours?|j)$/i, format: (n) => `${n} j` },
  { pattern: /^(?:semaines?|sem\.?)$/i, format: (n) => `${n} sem.` },
  { pattern: /^mois$/i, format: (n) => `${n} mois` },
  { pattern: /^(?:ans?|années?)$/i, format: (n) => `${n} ${n > 1 ? 'ans' : 'an'}` },
]

function formatOnset(count: number, unit: string): string | null {
  for (const { pattern, format } of ONSET_UNITS) {
    if (pattern.test(unit)) return format(count)
  }
  return null
}

/**
 * Ancienneté de la plainte. Les formes « J+4 » et « depuis 3 semaines » sont
 * cherchées en priorité car elles portent explicitement l'ancienneté ; un
 * nombre suivi d'une unité sans préposition ne sert que de dernier recours
 * (« lombalgie 3 mois »).
 */
export function extractOnset(text: string): string | null {
  const jPlus = text.match(/\bJ\s*\+\s*(\d{1,4})\b/i)
  if (jPlus) return `${Number(jPlus[1])} j`

  if (/\bavant-hier\b/i.test(text)) return '2 j'
  if (/\bhier\b/i.test(text)) return '1 j'
  if (/\b(?:ce matin|cette nuit|aujourd'hui|ce jour)\b/i.test(text)) return 'ce jour'

  const unit = '(jours?|j|semaines?|sem\\.?|mois|ans?|années?)'
  const anchored = new RegExp(`\\b(?:depuis|il y a|ça fait|ca fait)\\s+(?:environ\\s+|~\\s*|pr[eè]s de\\s+)?(\\d{1,4})\\s*${unit}\\b`, 'i')
  const loose = new RegExp(`\\b(\\d{1,4})\\s*${unit}\\b`, 'i')

  for (const pattern of [anchored, loose]) {
    const match = text.match(pattern)
    if (!match) continue
    const formatted = formatOnset(Number(match[1]), match[2])
    if (formatted) return formatted
  }
  return null
}

/**
 * Latéralité. Les abréviations « G » et « D » ne sont retenues qu'isolées, pour
 * ne pas confondre avec une initiale au milieu d'un mot.
 */
export function extractSide(text: string): AnamnesisVitals['side'] {
  if (/\bbilat[eé]ral/i.test(text) || /\bdes deux c[oô]t[eé]s\b/i.test(text) || /(?<![A-Za-zÀ-ÿ])G\s*\/\s*D(?![A-Za-zÀ-ÿ])/.test(text)) {
    return 'Bilat.'
  }
  const left = /\bgauches?\b/i.test(text) || /(?<![A-Za-zÀ-ÿ])G(?![A-Za-zÀ-ÿ])/.test(text)
  const right = /\bdroits?\b/i.test(text) || /\bdroites?\b/i.test(text) || /(?<![A-Za-zÀ-ÿ])D(?![A-Za-zÀ-ÿ])/.test(text)
  if (left && right) return 'Bilat.'
  if (left) return 'G'
  if (right) return 'D'
  return null
}

/**
 * Extrait les pastilles de synthèse d'un jeu de cartes.
 *
 * Chaque donnée est cherchée dans la rubrique où elle a un sens, et non dans
 * tout le texte : la latéralité vient de la douleur, pas d'un antécédent de
 * fracture du poignet droit.
 */
export function deriveAnamnesisVitals(sections: AnamnesisSection[] | null | undefined): AnamnesisVitals {
  const list = Array.isArray(sections) ? sections : []

  const painText = textOf(list, ['pain'])
  const historyText = textOf(list, ['history'])

  const eva = extractEva(painText) ?? extractEva(textOf(list, ['history', 'functional']))
  const onset = extractOnset(historyText) ?? extractOnset(painText)
  const side = extractSide(painText) ?? extractSide(historyText)

  const flags = sectionById(list, 'red_flags')
  const flagItems = flags ? realItems(flags) : []
  let redFlags: RedFlagStatus = 'unknown'
  let redFlagCount = 0
  if (flags) {
    // Aligné sur sectionsToMarkdown : une rubrique vide vaut « aucun identifié ».
    if (flags.allClear || flagItems.length === 0) {
      redFlags = 'clear'
    } else {
      redFlags = 'flagged'
      redFlagCount = flagItems.length
    }
  }

  let toConfirm = 0
  for (const section of list) {
    for (const item of realItems(section)) {
      if (item.includes(UNCERTAIN_MARKER)) toConfirm += 1
    }
  }

  const notCovered = list.filter(isNotCovered).map((s) => s.label)

  return { eva, onset, side, redFlags, redFlagCount, toConfirm, notCovered }
}
