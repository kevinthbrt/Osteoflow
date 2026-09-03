/**
 * Modèle du mode consultation : l'anamnèse se construit ligne par ligne pendant
 * que le patient parle, au lieu d'être structurée en bloc à la fin.
 *
 * Deux couches, volontairement séparées :
 *
 * 1. Les LIGNES sont écrites en texte libre par l'IA. Aucun vocabulaire imposé :
 *    c'est ce qu'un modèle fait le mieux, et le contraindre abîmerait la
 *    formulation. Chaque ligne porte seulement l'axe qu'elle couvre.
 * 2. La CHECKLIST est fixe, générique et versionnée ici. Elle seule permet de
 *    dire ce qui manque : on ne détecte pas une absence sans savoir ce qu'on
 *    attend. La laisser à l'IA donnerait un pense-bête qui change d'avis d'une
 *    consultation à l'autre, et qui omettrait en silence.
 *
 * Ce module ne dépend d'aucun composant et ne fait aucun appel réseau.
 */

import type { AnamnesisSection } from '@/lib/anamnesis'

/* ── Axes ────────────────────────────────────────────────────────────────── */

export type AxisId =
  | 'motif'
  | 'localisation'
  | 'lateralite'
  | 'anciennete'
  | 'apparition'
  | 'type'
  | 'intensite'
  | 'horaire'
  | 'irradiation'
  | 'aggravant'
  | 'soulageant'
  | 'evolution'
  | 'traitement'
  | 'antecedent'
  | 'retentissement'
  | 'red_flag'

export interface Axis {
  id: AxisId
  /** Symbole en tête de ligne. Il porte le repérage, pas la couleur. */
  icon: string
  label: string
  /** Question type, affichée par le copilote quand l'axe n'est pas couvert. */
  prompt: string
  /**
   * Attendu dans toute anamnèse complète, quelle que soit la région. Les axes
   * non requis (antécédents) n'ont pas à être réclamés : leur absence n'est pas
   * un oubli.
   */
  required: boolean
}

/**
 * Les axes d'une anamnèse, dans l'ordre de lecture clinique. C'est cet ordre qui
 * range les lignes à l'écran : le patient parle dans le désordre, la synthèse se
 * lit dans l'ordre.
 *
 * Générique et non régionale : c'est ce qui la rend maintenable. Une liste par
 * pathologie demanderait un développement par région et se périmerait.
 */
export const AXES: Axis[] = [
  { id: 'motif',          icon: '🎯', label: 'Motif',            prompt: 'Motif de consultation',                    required: true },
  { id: 'localisation',   icon: '📍', label: 'Localisation',     prompt: 'Où exactement ?',                          required: true },
  { id: 'lateralite',     icon: '↔️', label: 'Latéralité',       prompt: 'À droite, à gauche, des deux côtés ?',     required: true },
  { id: 'anciennete',     icon: '⏱️', label: 'Ancienneté',       prompt: 'Depuis combien de temps ?',                required: true },
  { id: 'apparition',     icon: '⚡', label: 'Apparition',       prompt: 'Brutale ou progressive ? À quelle occasion ?', required: true },
  { id: 'type',           icon: '🔥', label: 'Type',             prompt: 'Comment la décrire ? Brûlure, décharge, raideur ?', required: true },
  { id: 'intensite',      icon: '📊', label: 'Intensité',        prompt: 'Sur une échelle de 0 à 10 ?',              required: true },
  { id: 'horaire',        icon: '🌙', label: 'Horaire',          prompt: 'Nocturne ? Matinale ? Soulagée par le repos ?', required: true },
  { id: 'irradiation',    icon: '↘️', label: 'Irradiation',      prompt: 'La douleur descend-elle ? Jusqu\'où ?',    required: true },
  { id: 'aggravant',      icon: '⬆️', label: 'Aggravants',       prompt: 'Qu\'est-ce qui aggrave ?',                 required: true },
  { id: 'soulageant',     icon: '⬇️', label: 'Soulageants',      prompt: 'Qu\'est-ce qui soulage ?',                 required: true },
  { id: 'evolution',      icon: '📈', label: 'Évolution',        prompt: 'Ça s\'améliore, ça stagne, ça empire ?',   required: true },
  { id: 'traitement',     icon: '💊', label: 'Traitements',      prompt: 'Qu\'avez-vous déjà essayé ?',              required: true },
  { id: 'antecedent',     icon: '📋', label: 'Antécédents',      prompt: 'Antécédents en rapport ?',                 required: false },
  { id: 'retentissement', icon: '🚶', label: 'Retentissement',   prompt: 'Conséquences au travail, dans le sport, le sommeil ?', required: true },
  { id: 'red_flag',       icon: '🚩', label: 'Drapeau rouge',    prompt: 'Signal d\'alerte',                         required: false },
]

const AXIS_BY_ID = new Map<string, Axis>(AXES.map((a) => [a.id, a]))
const AXIS_ORDER = new Map<string, number>(AXES.map((a, i) => [a.id, i]))

export function getAxis(id: string): Axis | undefined {
  return AXIS_BY_ID.get(id)
}

/** Identifiants d'axes acceptés, transmis à l'IA pour qu'elle n'en invente pas. */
export const AXIS_IDS: string[] = AXES.map((a) => a.id)

/**
 * Familles de drapeaux rouges à dépister, reprises du prompt de structuration.
 * Affichées en pense-bête tant que le dépistage n'a pas été tranché. Fixes et
 * versionnées : le jour où l'on vous demande pourquoi un signe n'a pas été
 * cherché, une liste écrite est une réponse, « l'IA ne me l'a pas proposé » non.
 */
export const RED_FLAG_CHECKS: string[] = [
  'Douleur nocturne non mécanique, non soulagée par le repos, réveils douloureux',
  'Amaigrissement inexpliqué, fièvre, sueurs nocturnes, altération de l\'état général',
  'Antécédent ou suspicion de cancer, douleur récente',
  'Déficit neurologique : faiblesse motrice, anesthésie, paresthésies progressives',
  'Troubles sphinctériens, anesthésie en selle (urgence, queue de cheval)',
  'Traumatisme à haute énergie, suspicion de fracture, ostéoporose, corticothérapie',
  'Douleur thoracique, dyspnée, palpitations, signes cardiovasculaires',
  'Céphalée brutale en coup de tonnerre, troubles visuels, vertiges, dysarthrie',
  'Signes infectieux, immunodépression, toxicomanie intraveineuse',
  'Âge inférieur à 20 ans ou supérieur à 55 ans, douleur rachidienne récente',
]

/* ── Lignes ──────────────────────────────────────────────────────────────── */

export interface LiveLine {
  /** Identifiant stable : c'est lui qui permet de corriger une ligne au lieu d'en empiler une deuxième. */
  id: string
  axis: AxisId
  text: string
  /** « low » signale un terme dont la transcription reste douteuse. */
  confidence?: 'high' | 'low'
  /** Les mots du patient qui justifient la ligne, pour lever le doute sans deviner. */
  verbatim?: string
  /** Posé quand une ligne vient d'être ajoutée ou corrigée, pour la signaler brièvement. */
  touchedAt?: number
  /** Vrai dès que le praticien a modifié la ligne : l'IA ne la réécrit plus. */
  edited?: boolean
}

export type LiveOp =
  | { op: 'add'; id: string; axis: string; text: string; confidence?: 'high' | 'low'; verbatim?: string }
  | { op: 'update'; id: string; axis?: string; text?: string; confidence?: 'high' | 'low'; verbatim?: string }
  | { op: 'remove'; id: string }

function isValidAxis(axis: unknown): axis is AxisId {
  return typeof axis === 'string' && AXIS_BY_ID.has(axis)
}

/** Range les lignes dans l'ordre de lecture clinique, stable à l'intérieur d'un axe. */
function sortLines(lines: LiveLine[]): LiveLine[] {
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const byAxis = (AXIS_ORDER.get(a.line.axis) ?? 99) - (AXIS_ORDER.get(b.line.axis) ?? 99)
      return byAxis !== 0 ? byAxis : a.index - b.index
    })
    .map((entry) => entry.line)
}

/**
 * Applique les opérations renvoyées par l'IA sur l'état courant des lignes.
 *
 * Le point central est la correction : « c'est à gauche, ah non pardon à
 * droite » doit réécrire la ligne existante et non en ajouter une seconde qui
 * contredirait la première. C'est pourquoi l'IA reçoit les lignes déjà posées
 * avec leur identifiant et peut renvoyer `update` ou `remove`.
 *
 * Une ligne corrigée à la main par le praticien n'est plus touchée : entre son
 * jugement et celui du modèle, c'est le sien qui fait foi.
 */
export function applyOps(lines: LiveLine[], ops: unknown, now = Date.now()): LiveLine[] {
  if (!Array.isArray(ops)) return lines
  const next = [...lines]

  for (const raw of ops) {
    if (!raw || typeof raw !== 'object') continue
    const op = raw as Partial<LiveOp> & { id?: unknown; op?: unknown }
    const id = typeof op.id === 'string' ? op.id : null
    if (!id) continue

    const index = next.findIndex((l) => l.id === id)

    if (op.op === 'remove') {
      if (index >= 0 && !next[index].edited) next.splice(index, 1)
      continue
    }

    const text = typeof (op as { text?: unknown }).text === 'string' ? (op as { text: string }).text.trim() : undefined
    const axis = (op as { axis?: unknown }).axis
    const confidence = (op as { confidence?: unknown }).confidence === 'low' ? 'low' as const : 'high' as const
    const verbatim = typeof (op as { verbatim?: unknown }).verbatim === 'string' ? (op as { verbatim: string }).verbatim : undefined

    if (index >= 0) {
      // Le praticien a tranché sur cette ligne : le modèle ne repasse pas dessus.
      if (next[index].edited) continue
      next[index] = {
        ...next[index],
        ...(isValidAxis(axis) ? { axis } : {}),
        ...(text ? { text } : {}),
        confidence,
        ...(verbatim ? { verbatim } : {}),
        touchedAt: now,
      }
      continue
    }

    // Un `update` visant une ligne inconnue est traité comme un ajout dès qu'il
    // porte de quoi en construire une : perdre un fait coûte plus cher que de
    // tolérer une opération mal étiquetée.
    if (!isValidAxis(axis) || !text) continue
    next.push({ id, axis, text, confidence, verbatim, touchedAt: now })
  }

  return sortLines(next)
}

/**
 * Remplace les identifiants inventés par le modèle pour les lignes ajoutées.
 *
 * Le modèle produit des identifiants courts (« n1 », « l3 ») qui se répètent
 * d'un passage au suivant. Deux lignes finiraient par partager un identifiant,
 * et corriger l'une réécrirait l'autre. On leur substitue un identifiant unique,
 * qui est celui renvoyé ensuite dans l'état, si bien que les `update` des
 * passages suivants retombent sur la bonne ligne.
 *
 * Le remplacement s'applique aussi aux autres opérations du MÊME lot : un modèle
 * qui ajoute puis corrige dans la même réponse doit rester cohérent.
 */
export function remapAddedIds<T extends { op?: unknown; id?: unknown }>(
  ops: T[],
  newId: () => string,
): T[] {
  const remap = new Map<string, string>()
  for (const op of ops) {
    if (op?.op === 'add' && typeof op.id === 'string' && !remap.has(op.id)) {
      remap.set(op.id, newId())
    }
  }
  if (remap.size === 0) return ops
  return ops.map((op) =>
    op && typeof op.id === 'string' && remap.has(op.id) ? { ...op, id: remap.get(op.id) as string } : op,
  )
}

/** Axes couverts par au moins une ligne. */
export function coveredAxes(lines: LiveLine[]): Set<AxisId> {
  return new Set(lines.map((l) => l.axis))
}

/** Axes requis qu'aucune ligne ne couvre encore : ce que le copilote réclame. */
export function missingAxes(lines: LiveLine[]): Axis[] {
  const covered = coveredAxes(lines)
  return AXES.filter((a) => a.required && !covered.has(a.id))
}

/* ── Pont vers le format enregistré ──────────────────────────────────────── */

/**
 * Chaque axe rejoint la rubrique où il vivait déjà. Le mode consultation est une
 * nouvelle façon de SAISIR l'anamnèse, pas un nouveau format : lettres, exports,
 * recherche, hypothèses et consultations passées continuent de lire des cartes.
 */
const AXIS_TO_SECTION: Record<AxisId, string | null> = {
  motif: null, // devient le motif de la consultation, pas une ligne de carte
  localisation: 'pain',
  lateralite: 'pain',
  type: 'pain',
  intensite: 'pain',
  horaire: 'pain',
  irradiation: 'pain',
  anciennete: 'history',
  apparition: 'history',
  evolution: 'history',
  aggravant: 'modulating',
  soulageant: 'modulating',
  antecedent: 'history_past',
  traitement: 'treatment',
  retentissement: 'functional',
  red_flag: 'red_flags',
}

const SECTION_TEMPLATES: { id: string; label: string; icon: string }[] = [
  { id: 'history', label: 'Histoire', icon: '⚡' },
  { id: 'pain', label: 'Douleur', icon: '📍' },
  { id: 'modulating', label: 'Modulants', icon: '↕️' },
  { id: 'history_past', label: 'Antécédents', icon: '📋' },
  { id: 'treatment', label: 'Traitements', icon: '💊' },
  { id: 'functional', label: 'Impact fonctionnel', icon: '🚶' },
  { id: 'red_flags', label: 'Drapeaux rouges', icon: '🚩' },
]

/** Le motif retenu : la ligne d'axe « motif », s'il y en a une. */
export function linesToReason(lines: LiveLine[]): string {
  return lines.find((l) => l.axis === 'motif')?.text ?? ''
}

/**
 * Convertit les lignes en cartes, au format déjà enregistré.
 *
 * `redFlagsCleared` porte la décision du praticien : sans drapeau listé, une
 * rubrique vide est ambiguë (pas dépisté ou dépisté négatif ?). Seul un
 * dépistage explicitement tranché vaut « aucun identifié ».
 */
export function linesToSections(lines: LiveLine[], redFlagsCleared = false): AnamnesisSection[] {
  const byAxis = new Map<string, LiveLine[]>()
  for (const line of sortLines(lines)) {
    const sectionId = AXIS_TO_SECTION[line.axis]
    if (!sectionId) continue
    const bucket = byAxis.get(sectionId) ?? []
    bucket.push(line)
    byAxis.set(sectionId, bucket)
  }

  return SECTION_TEMPLATES.map((template) => {
    const own = byAxis.get(template.id) ?? []
    const items = own.map((line) => {
      const axis = AXIS_BY_ID.get(line.axis)
      // Le préfixe rend la carte lisible hors du mode consultation, où le
      // symbole en tête de ligne n'existe plus.
      return axis && template.id !== 'red_flags' ? `${axis.label} : ${line.text}` : line.text
    })

    if (template.id === 'red_flags') {
      return { ...template, items, allClear: items.length === 0 && redFlagsCleared }
    }
    // Rubrique non abordée : le placeholder est la convention déjà en place.
    return { ...template, items: items.length > 0 ? items : ['—'] }
  })
}
