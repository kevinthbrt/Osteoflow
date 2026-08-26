import {
  EXCLUSIVE_GROUPS,
  exclusiveGroupOf,
  exclusiveMembers,
  signalLabel,
  signalQuestion,
  type SignalId,
} from './signals'
import type {
  ActionDefinition,
  Criterion,
  HypothesisDefinition,
  HypothesisStatus,
  ReasoningInput,
  ReasoningResult,
  ScoredHypothesis,
  SignalExpr,
  SuggestedAction,
  Tribool,
} from './types'

type SignalSet = Partial<Record<SignalId, boolean>>

function byIdOf(definitions: HypothesisDefinition[]): Map<string, HypothesisDefinition> {
  return new Map(definitions.map((definition) => [definition.id, definition]))
}

function valueOf(id: SignalId, signals: SignalSet): Tribool {
  const value = signals[id]
  if (value === undefined) return 'unknown'
  return value ? 'yes' : 'no'
}

/**
 * Évaluation en logique ternaire (Kleene). La règle qui compte : `all` peut
 * conclure « non » sans connaître tous ses membres, et `any` peut conclure
 * « oui » de même. C'est ce qui permet d'écarter une hypothèse dès le premier
 * élément dirimant, sans attendre un interrogatoire complet.
 */
export function evaluate(expr: SignalExpr, signals: SignalSet): Tribool {
  if (typeof expr === 'string') return valueOf(expr, signals)

  if ('not' in expr) {
    const inner = evaluate(expr.not, signals)
    if (inner === 'yes') return 'no'
    if (inner === 'no') return 'yes'
    return 'unknown'
  }

  if ('all' in expr) {
    let unknown = false
    for (const member of expr.all) {
      const value = evaluate(member, signals)
      if (value === 'no') return 'no'
      if (value === 'unknown') unknown = true
    }
    return unknown ? 'unknown' : 'yes'
  }

  if ('any' in expr) {
    let unknown = false
    for (const member of expr.any) {
      const value = evaluate(member, signals)
      if (value === 'yes') return 'yes'
      if (value === 'unknown') unknown = true
    }
    return unknown ? 'unknown' : 'no'
  }

  // atLeast : le seuil peut être atteint ou devenu inatteignable avant d'avoir
  // tout renseigné.
  let confirmed = 0
  let undecided = 0
  for (const member of expr.among) {
    const value = evaluate(member, signals)
    if (value === 'yes') confirmed += 1
    else if (value === 'unknown') undecided += 1
  }
  if (confirmed >= expr.atLeast) return 'yes'
  if (confirmed + undecided < expr.atLeast) return 'no'
  return 'unknown'
}

/**
 * Signaux qui peuvent encore changer la valeur d'une expression.
 *
 * `signalsOf` répond « quels signaux cette expression mentionne » ; ici on
 * demande « lesquels reste-t-il à chercher ». La nuance est décisive : dans
 * `all(not(RADICULAIRE), localisation)`, une fois l'irradiation écartée, plus
 * rien ne sert de demander si la douleur descend sous le genou — cette branche
 * est tranchée. Sans ce filtre, le copilote réclame des signes dont il n'a plus
 * l'usage, et il les réclame en priorité puisqu'ils pèsent lourd.
 */
export function openSignalsOf(expr: SignalExpr, signals: SignalSet): SignalId[] {
  const found = new Set<SignalId>()

  const walk = (node: SignalExpr) => {
    const value = evaluate(node, signals)
    if (value !== 'unknown') return

    if (typeof node === 'string') {
      found.add(node)
      return
    }
    if ('not' in node) return walk(node.not)
    if ('all' in node) return node.all.forEach(walk)
    if ('any' in node) return node.any.forEach(walk)
    node.among.forEach(walk)
  }

  walk(expr)
  return [...found]
}

/** Signaux mentionnés par une expression, sans doublon. */
export function signalsOf(expr: SignalExpr): SignalId[] {
  const found = new Set<SignalId>()
  const walk = (node: SignalExpr) => {
    if (typeof node === 'string') {
      found.add(node)
      return
    }
    if ('not' in node) return walk(node.not)
    if ('all' in node) return node.all.forEach(walk)
    if ('any' in node) return node.any.forEach(walk)
    node.among.forEach(walk)
  }
  walk(expr)
  return [...found]
}

/**
 * Échelle de conversion d'un rapport de vraisemblance en points de score.
 *
 * Multiplier des rapports revient à additionner leurs logarithmes : on reste
 * donc dans un score additif, mais chaque contribution devient dérivée d'une
 * valeur publiée au lieu d'être choisie à la main. Le facteur cale l'échelle
 * sur celle des poids ordinaux qui subsistent — un LR+ de 30 pèse une
 * vingtaine de points, un LR− de 0,3 en retire sept.
 */
const ECHELLE_LR = 4

/** Points apportés par un critère, selon qu'il repose sur un LR ou un poids. */
function contribution(criterion: Criterion, value: Tribool): number | null {
  if (criterion.lr) {
    if (value === 'yes') return ECHELLE_LR * Math.log2(criterion.lr.positive)
    if (value === 'no' && criterion.lr.negative !== undefined) {
      return ECHELLE_LR * Math.log2(criterion.lr.negative)
    }
    return null
  }
  if (value === 'yes' && criterion.weight !== undefined) return criterion.weight
  return null
}

/** Meilleur apport encore atteignable par un critère indécis. */
function apportPotentiel(criterion: Criterion): number {
  if (criterion.lr) return Math.max(0, ECHELLE_LR * Math.log2(criterion.lr.positive))
  return Math.max(0, criterion.weight ?? 0)
}

function statusOf(definition: HypothesisDefinition, signals: SignalSet): HypothesisStatus {
  if (!definition.requires) return 'retained'
  const gate = evaluate(definition.requires, signals)
  if (gate === 'no') return 'excluded'
  if (gate === 'unknown') return 'pending'
  return 'retained'
}

export function scoreHypothesis(
  definition: HypothesisDefinition,
  signals: SignalSet,
): ScoredHypothesis {
  const status = statusOf(definition, signals)
  const argumentsFor: string[] = []
  const argumentsAgainst: string[] = []
  const unexplored: string[] = []
  let score = 0
  let reachable = 0

  for (const criterion of definition.criteria) {
    const value = evaluate(criterion.when, signals)
    const apport = contribution(criterion, value)

    if (apport !== null) {
      score += apport
      if (apport >= 0) argumentsFor.push(criterion.label)
      else argumentsAgainst.push(criterion.label)
    } else if (value === 'unknown') {
      unexplored.push(criterion.label)
      reachable += apportPotentiel(criterion)
    }
  }

  score = Math.round(score * 10) / 10
  reachable = Math.round(reachable * 10) / 10

  return {
    id: definition.id,
    label: definition.label,
    region: definition.region,
    kind: definition.kind,
    status,
    score: status === 'excluded' ? 0 : score,
    potential: status === 'excluded' ? 0 : score + reachable,
    argumentsFor,
    argumentsAgainst,
    unexplored,
    note: definition.note,
  }
}

/** Les retenues passent devant les en-attente ; à statut égal, le score tranche. */
const STATUS_RANK: Record<HypothesisStatus, number> = { retained: 0, pending: 1, excluded: 2 }

function compareHypotheses(a: ScoredHypothesis, b: ScoredHypothesis): number {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
  if (b.score !== a.score) return b.score - a.score
  if (b.potential !== a.potential) return b.potential - a.potential
  return a.label.localeCompare(b.label, 'fr')
}

/** Critères d'une hypothèse encore indécidables, avec le poids qu'ils mettent en jeu. */
function openCriteria(definition: HypothesisDefinition, signals: SignalSet): Criterion[] {
  const open = definition.criteria.filter(
    (criterion) => evaluate(criterion.when, signals) === 'unknown',
  )
  if (definition.requires && evaluate(definition.requires, signals) === 'unknown') {
    // La condition d'entrée pèse autant que le meilleur critère : tant qu'elle
    // n'est pas tranchée, rien d'autre ne compte vraiment.
    const heaviest = Math.max(0, ...definition.criteria.map(apportPotentiel))
    open.push({ when: definition.requires, weight: heaviest, label: definition.label })
  }
  return open
}

/**
 * Classe les actions par ce qu'elles feraient bouger. Une action ne vaut que
 * par le poids qu'elle débloque sur les hypothèses encore en lice : demander
 * un signe qui ne départage rien ne sert à rien, aussi savant soit-il.
 */
function rankActions(
  scored: ScoredHypothesis[],
  definitions: HypothesisDefinition[],
  catalog: ActionDefinition[],
  signals: SignalSet,
  done: Set<string>,
  limit: number,
): SuggestedAction[] {
  const inPlay = scored.filter((hypothesis) => hypothesis.status !== 'excluded').slice(0, 5)
  if (inPlay.length === 0) return []

  /**
   * Actions rattachées à un drapeau rouge actif. Elles passent devant tout le
   * reste : quand une orientation s'impose, poser une question de plus sur le
   * rythme de la douleur n'a aucun intérêt.
   */
  const urgent = new Set<string>()
  for (const hypothesis of inPlay) {
    if (hypothesis.kind !== 'red-flag' || hypothesis.status !== 'retained') continue
    for (const actionId of byIdOf(definitions).get(hypothesis.id)?.actions ?? []) urgent.add(actionId)
  }

  const byId = byIdOf(definitions)
  /** Poids total en jeu pour chaque signal encore inconnu, et hypothèses concernées. */
  const stakes = new Map<SignalId, { value: number; hypotheses: Set<string> }>()

  for (const hypothesis of inPlay) {
    const definition = byId.get(hypothesis.id)
    if (!definition) continue
    for (const criterion of openCriteria(definition, signals)) {
      for (const signal of openSignalsOf(criterion.when, signals)) {
        if (signals[signal] !== undefined) continue
        const entry = stakes.get(signal) ?? { value: 0, hypotheses: new Set<string>() }
        entry.value += Math.abs(apportPotentiel(criterion)) || 1
        entry.hypotheses.add(hypothesis.label)
        stakes.set(signal, entry)
      }
    }
  }

  const suggestions = new Map<string, SuggestedAction>()

  // Actions du catalogue rattachées aux hypothèses en lice. Une action reste
  // proposable même si aucun critère ne dépend de ce qu'elle renseigne : un
  // questionnaire de référence ou une orientation sont des suites à donner,
  // pas seulement des moyens de départager.
  const relevant = new Set<string>()
  const leaderActions = new Set(byId.get(inPlay[0].id)?.actions ?? [])
  for (const hypothesis of inPlay) {
    for (const actionId of byId.get(hypothesis.id)?.actions ?? []) relevant.add(actionId)
  }
  for (const action of catalog) {
    if (!relevant.has(action.id) || done.has(action.id)) continue
    const resolved = (action.resolves ?? []).filter((signal) => signals[signal] === undefined)
    const value = resolved.reduce((total, signal) => total + (stakes.get(signal)?.value ?? 0), 0)
    const discriminates = new Set<string>()
    for (const signal of resolved) {
      for (const label of stakes.get(signal)?.hypotheses ?? []) discriminates.add(label)
    }
    // Un test n'existe que pour trancher : une fois ce qu'il renseigne connu,
    // le reproposer est du bruit. Un questionnaire de référence, un examen ou
    // une orientation gardent leur place, ce sont des suites à donner.
    const answered = (action.resolves?.length ?? 0) > 0 && resolved.length === 0
    if (action.kind === 'test' && answered) continue

    suggestions.set(action.id, { action, discriminates: [...discriminates], value })
  }

  // Questions déduites du vocabulaire : tout signal en jeu qui se demande.
  // Les signaux qui s'excluent se posent en une seule question à choix, sinon
  // le praticien devrait écarter les autres réponses une par une.
  const groupStakes = new Map<string, { value: number; hypotheses: Set<string> }>()

  for (const [signal, stake] of stakes) {
    const group = exclusiveGroupOf(signal)
    if (group && EXCLUSIVE_GROUPS[group]) {
      const entry = groupStakes.get(group) ?? { value: 0, hypotheses: new Set<string>() }
      // Le poids d'une question à choix est celui de toutes les branches
      // qu'elle départage : désigner le siège de la douleur tranche entre
      // plusieurs hypothèses d'un coup, là où un test n'en éclaire qu'une.
      entry.value += stake.value
      for (const label of stake.hypotheses) entry.hypotheses.add(label)
      groupStakes.set(group, entry)
      continue
    }
    const question = signalQuestion(signal)
    if (!question) continue
    const id = `question:${signal}`
    if (suggestions.has(id)) continue
    suggestions.set(id, {
      action: {
        id,
        kind: 'question',
        label: question,
        resolves: [signal],
        note: signalLabel(signal),
      },
      discriminates: [...stake.hypotheses],
      value: stake.value,
    })
  }

  for (const [group, stake] of groupStakes) {
    const options = exclusiveMembers(group).filter((member) => signals[member.id] === undefined)
    if (options.length === 0) continue
    suggestions.set(`choice:${group}`, {
      action: {
        id: `choice:${group}`,
        kind: 'choice',
        label: EXCLUSIVE_GROUPS[group],
        resolves: options.map((option) => option.id),
        options: options.map((option) => ({ signal: option.id, label: option.label })),
      },
      discriminates: [...stake.hypotheses],
      value: stake.value,
    })
  }

  /**
   * À poids égal, l'ordre naturel de la consultation : on demande, puis on
   * examine, puis on documente. Proposer un Lasègue avant d'avoir demandé où
   * siège la douleur inverse le déroulé réel.
   */
  const KIND_ORDER: Record<string, number> = {
    question: 0,
    choice: 0,
    test: 1,
    questionnaire: 2,
    exam: 3,
    referral: 4,
  }

  return [...suggestions.values()]
    .sort(
      (a, b) =>
        // Une orientation urgente d'abord, puis ce qui départage le plus, puis
        // les suites propres à l'hypothèse de tête.
        Number(urgent.has(b.action.id)) - Number(urgent.has(a.action.id)) ||
        b.value - a.value ||
        (KIND_ORDER[a.action.kind] ?? 9) - (KIND_ORDER[b.action.kind] ?? 9) ||
        Number(leaderActions.has(b.action.id)) - Number(leaderActions.has(a.action.id)) ||
        a.action.label.localeCompare(b.action.label, 'fr'),
    )
    .slice(0, limit)
}

/**
 * Hypothèses réellement en lice : celles qui reposent sur au moins un argument,
 * ou dont la porte d'entrée est franchie. Les autres ne sont pas des
 * concurrentes, seulement le reste du catalogue — les afficher ferait passer
 * pour une piste ce qui n'est qu'une case non cochée.
 */
export function activeHypotheses(result: ReasoningResult): ScoredHypothesis[] {
  return result.hypotheses.filter(
    (hypothesis) => hypothesis.score > 0 || hypothesis.status === 'retained',
  )
}

/**
 * Point d'entrée : à partir des signaux relevés, produit le différentiel, ce
 * qui a été écarté, et ce qu'il serait le plus utile de chercher ensuite.
 */
export function reason(input: ReasoningInput): ReasoningResult {
  const { signals, hypotheses, actions = [], done = [], actionLimit = 3 } = input
  const scored = hypotheses.map((definition) => scoreHypothesis(definition, signals))

  const redFlags = scored
    .filter((hypothesis) => hypothesis.kind === 'red-flag' && hypothesis.status === 'retained')
    .sort(compareHypotheses)

  const differential = scored
    .filter((hypothesis) => hypothesis.kind !== 'red-flag' && hypothesis.status !== 'excluded')
    .sort(compareHypotheses)

  const excluded = scored
    .filter((hypothesis) => hypothesis.status === 'excluded')
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  return {
    redFlags,
    hypotheses: differential,
    excluded,
    nextActions: rankActions(
      [...redFlags, ...differential],
      hypotheses,
      actions,
      signals,
      new Set(done),
      actionLimit,
    ),
  }
}
