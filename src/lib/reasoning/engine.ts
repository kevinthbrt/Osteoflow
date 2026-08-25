import { type SignalId, signalQuestion, signalLabel } from './signals'
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
    if (value === 'yes') {
      score += criterion.weight
      if (criterion.weight >= 0) argumentsFor.push(criterion.label)
      else argumentsAgainst.push(criterion.label)
    } else if (value === 'unknown') {
      unexplored.push(criterion.label)
      if (criterion.weight > 0) reachable += criterion.weight
    }
  }

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
    const heaviest = Math.max(0, ...definition.criteria.map((criterion) => criterion.weight))
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
      for (const signal of signalsOf(criterion.when)) {
        if (signals[signal] !== undefined) continue
        const entry = stakes.get(signal) ?? { value: 0, hypotheses: new Set<string>() }
        entry.value += Math.abs(criterion.weight)
        entry.hypotheses.add(hypothesis.label)
        stakes.set(signal, entry)
      }
    }
  }

  const suggestions = new Map<string, SuggestedAction>()

  // Actions du catalogue rattachées aux hypothèses en lice.
  const relevant = new Set<string>()
  for (const hypothesis of inPlay) {
    for (const actionId of byId.get(hypothesis.id)?.actions ?? []) relevant.add(actionId)
  }
  for (const action of catalog) {
    if (!relevant.has(action.id)) continue
    const resolved = (action.resolves ?? []).filter((signal) => signals[signal] === undefined)
    const value = resolved.reduce((total, signal) => total + (stakes.get(signal)?.value ?? 0), 0)
    const discriminates = new Set<string>()
    for (const signal of resolved) {
      for (const label of stakes.get(signal)?.hypotheses ?? []) discriminates.add(label)
    }
    // Un examen ou une orientation garde sa place même sans signal à résoudre :
    // c'est une suite à donner, pas une question.
    const isFollowUp = action.kind === 'exam' || action.kind === 'referral'
    if (value === 0 && !isFollowUp) continue
    suggestions.set(action.id, { action, discriminates: [...discriminates], value })
  }

  // Questions déduites du vocabulaire : tout signal en jeu qui se demande.
  for (const [signal, stake] of stakes) {
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

  return [...suggestions.values()]
    .sort(
      (a, b) =>
        Number(urgent.has(b.action.id)) - Number(urgent.has(a.action.id)) ||
        b.value - a.value ||
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
  const { signals, hypotheses, actions = [], actionLimit = 3 } = input
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
    nextActions: rankActions([...redFlags, ...differential], hypotheses, actions, signals, actionLimit),
  }
}
