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
  AlertLevel,
  Criterion,
  HypothesisDefinition,
  HypothesisKind,
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

/**
 * Paliers d'informativité du rapport de vraisemblance.
 *
 * Entre 0,5 et 2, un rapport ne déplace pas assez la probabilité pour valoir
 * mieux que du bruit : le retenir donnerait à un signe une influence que
 * l'étude ne lui reconnaît pas. La règle vaut dans les deux sens, et c'est
 * elle qui produit d'elle-même le comportement attendu de chaque test — un
 * Lasègue positif ne confirme rien (LR+ 1,28, ignoré) alors qu'un Lasègue
 * négatif écarte sérieusement (LR− 0,29, retenu) ; un Lasègue croisé fait
 * l'inverse.
 */
const LR_NEUTRE_BAS = 0.5
const LR_NEUTRE_HAUT = 2

function informatif(rapport: number): boolean {
  return rapport <= LR_NEUTRE_BAS || rapport >= LR_NEUTRE_HAUT
}

/** Contribution retenue d'un critère : des points, et le rapport dont ils dérivent. */
interface Apport {
  criterion: Criterion
  points: number
  /** Rapport de vraisemblance appliqué, ou `null` si le critère n'en porte pas. */
  rapport: number | null
}

/**
 * Points apportés par un critère.
 *
 * Deux règles de sécurité s'appliquent avant tout calcul :
 *
 *  1. Sur un drapeau rouge, seule une réponse positive compte. Une réponse
 *     négative au dépistage n'abaisse jamais la probabilité d'une pathologie
 *     grave — sur une prévalence de départ déjà très basse, le moteur n'a pas
 *     à « rassurer », il n'a qu'un seuil d'alerte à franchir ou non.
 *  2. Un rapport non informatif ne pèse pas, quel qu'en soit le sens.
 */
function apportDe(criterion: Criterion, value: Tribool, kind: HypothesisKind): Apport | null {
  if (kind === 'red-flag' && value !== 'yes') return null

  if (criterion.lr) {
    if (value === 'yes' && informatif(criterion.lr.positive)) {
      return {
        criterion,
        points: ECHELLE_LR * Math.log2(criterion.lr.positive),
        rapport: criterion.lr.positive,
      }
    }
    if (
      value === 'no' &&
      criterion.lr.negative !== undefined &&
      informatif(criterion.lr.negative)
    ) {
      return {
        criterion,
        points: ECHELLE_LR * Math.log2(criterion.lr.negative),
        rapport: criterion.lr.negative,
      }
    }
    return null
  }
  if (value === 'yes' && criterion.weight !== undefined) {
    return { criterion, points: criterion.weight, rapport: null }
  }
  // Critère purement descriptif — le cas du diagnostic d'exclusion, qui ne se
  // score pas. Il doit tout de même s'afficher : sans lui, l'hypothèse
  // résiduelle apparaîtrait sans le moindre argument, donc comme une piste
  // qu'on n'aurait pas travaillée.
  if (value === 'yes' && criterion.lr === undefined) {
    return { criterion, points: 0, rapport: null }
  }
  return null
}

/**
 * Une seule contribution par groupe de signes corrélés.
 *
 * Les signes lombaires ne sont pas conditionnellement indépendants : douleur
 * dermatomale, Lasègue et réflexe aboli décrivent largement la même
 * observation. Les enchaîner par multiplication reviendrait à la compter trois
 * fois et à fabriquer une certitude. Le rapport publié du cluster prime ; à
 * défaut, la contribution la plus ample l'emporte et les autres sont
 * abandonnées.
 */
function unSeulParGroupe<T>(apports: T[], clefDe: (item: T) => Criterion): T[] {
  const libres: T[] = []
  const groupes = new Map<string, T[]>()

  for (const apport of apports) {
    const groupe = clefDe(apport).correlation
    if (!groupe) {
      libres.push(apport)
      continue
    }
    groupes.set(groupe, [...(groupes.get(groupe) ?? []), apport])
  }

  for (const membres of groupes.values()) {
    const cluster = membres.find((membre) => clefDe(membre).cluster)
    if (cluster) {
      libres.push(cluster)
      continue
    }
    libres.push(
      membres.reduce((meilleur, candidat) =>
        enjeuDe(clefDe(candidat)) > enjeuDe(clefDe(meilleur)) ? candidat : meilleur,
      ),
    )
  }

  return libres
}

/** Meilleur apport encore atteignable par un critère indécis. */
function apportPotentiel(criterion: Criterion): number {
  if (criterion.lr) {
    if (!informatif(criterion.lr.positive)) return 0
    return Math.max(0, ECHELLE_LR * Math.log2(criterion.lr.positive))
  }
  return Math.max(0, criterion.weight ?? 0)
}

/**
 * Amplitude qu'un critère peut encore faire bouger, dans un sens ou dans
 * l'autre. Sert à classer les actions, pas à scorer : un test dont le seul
 * intérêt est d'écarter une hypothèse doit être proposé aussi volontiers qu'un
 * test qui la confirme.
 */
function enjeuDe(criterion: Criterion, kind?: HypothesisKind): number {
  if (criterion.lr) {
    const confirme = informatif(criterion.lr.positive)
      ? Math.abs(ECHELLE_LR * Math.log2(criterion.lr.positive))
      : 0
    if (kind === 'red-flag') return confirme
    const ecarte =
      criterion.lr.negative !== undefined && informatif(criterion.lr.negative)
        ? Math.abs(ECHELLE_LR * Math.log2(criterion.lr.negative))
        : 0
    return Math.max(confirme, ecarte)
  }
  return Math.abs(criterion.weight ?? 0)
}

/**
 * Probabilité post-test par chaînage des cotes.
 *
 * C'est la seule façon correcte d'accumuler des rapports : on part de la
 * prévalence dans le cadre de soins, on multiplie les cotes, on revient à une
 * probabilité. La valeur n'est produite que si la prévalence est sourcée et si
 * tout ce qui a pesé vient d'un rapport publié — un seul poids ordinal dans le
 * calcul et le résultat n'aurait plus de sens.
 */
function probabilitePostTest(
  prior: { value: number } | undefined,
  apports: Apport[],
): number | undefined {
  if (!prior) return undefined
  if (apports.some((apport) => apport.rapport === null)) return undefined
  const cote = apports.reduce(
    (courante, apport) => courante * (apport.rapport as number),
    prior.value / (1 - prior.value),
  )
  return Math.round((cote / (1 + cote)) * 10_000) / 10_000
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
  const bruts: Apport[] = []
  const indecis: Criterion[] = []

  for (const criterion of definition.criteria) {
    const value = evaluate(criterion.when, signals)
    const apport = apportDe(criterion, value, definition.kind)
    if (apport) bruts.push(apport)
    else if (value === 'unknown') indecis.push(criterion)
  }

  // Le dédoublonnage des signes corrélés s'applique aussi bien à ce qui pèse
  // déjà qu'à ce qui reste atteignable : sans cela, une hypothèse afficherait
  // un potentiel que le calcul ne lui accordera jamais.
  const retenus = unSeulParGroupe(bruts, (apport) => apport.criterion)
  const ouverts = unSeulParGroupe(indecis, (criterion) => criterion)

  const argumentsFor: string[] = []
  const argumentsAgainst: string[] = []
  let score = 0

  for (const apport of retenus) {
    score += apport.points
    if (apport.points >= 0) argumentsFor.push(apport.criterion.label)
    else argumentsAgainst.push(apport.criterion.label)
  }

  let reachable = ouverts.reduce((total, criterion) => total + apportPotentiel(criterion), 0)

  /**
   * Le diagnostic d'exclusion ne se score pas.
   *
   * La lombalgie non spécifique est ce qui reste quand rien de spécifique n'a
   * été retenu, jamais une hypothèse qui gagne des points. Lui en accorder la
   * ferait concourir avec les autres et, pire, la ferait monter à mesure que
   * l'anamnèse s'enrichit — exactement l'inverse de ce qu'elle signifie. Ses
   * critères restent affichés : ils décrivent le tableau, ils ne l'établissent
   * pas.
   */
  if (definition.kind === 'exclusion') {
    score = 0
    reachable = 0
  }

  score = Math.round(score * 10) / 10
  reachable = Math.round(reachable * 10) / 10

  /**
   * La porte d'entrée gouverne le score.
   *
   * C'est l'architecture même du document : on classe — non spécifique,
   * radiculaire, cause spécifique — avant de sous-typer. Une hypothèse dont la
   * classe n'est pas établie n'a pas à accumuler des points ; ses arguments
   * restent affichés, mais comme des pistes, pas comme un total. Sans cette
   * règle, un signe banal partagé par toute la région suffit à faire monter un
   * diagnostic dont le signe caractéristique n'a même pas été cherché.
   */
  const excluded = status === 'excluded'
  if (status !== 'retained') score = 0

  return {
    id: definition.id,
    label: definition.label,
    region: definition.region,
    kind: definition.kind,
    status,
    score: excluded ? 0 : score,
    potential: excluded ? 0 : score + reachable,
    argumentsFor,
    argumentsAgainst,
    unexplored: ouverts.map((criterion) => criterion.label),
    probability: excluded ? undefined : probabilitePostTest(definition.prior, retenus),
    alert: excluded ? undefined : niveauAlerte(definition, retenus),
    note: definition.note,
  }
}

/**
 * Niveau d'alerte d'une hypothèse à drapeau rouge : le plus haut de ses
 * critères vérifiés. Un drapeau retenu sans niveau explicite reste en
 * vigilance — c'est le cas d'un facteur isolé peu spécifique.
 */
const RANG_ALERTE: Record<AlertLevel, number> = { immediate: 0, elevee: 1, vigilance: 2 }

function niveauAlerte(
  definition: HypothesisDefinition,
  retenus: Apport[],
): AlertLevel | undefined {
  if (definition.kind !== 'red-flag') return undefined
  const niveaux = retenus
    .map((apport) => apport.criterion.alert)
    .filter((niveau): niveau is AlertLevel => niveau !== undefined)
  if (niveaux.length === 0) return 'vigilance'
  return niveaux.reduce((haut, candidat) =>
    RANG_ALERTE[candidat] < RANG_ALERTE[haut] ? candidat : haut,
  )
}

/**
 * Ordre du différentiel.
 *
 * Le diagnostic résiduel occupe un rang à lui. Il ne se score pas — il est ce
 * qui reste, pas ce qui gagne — et sans rang propre, la moindre hypothèse
 * portant un argument isolé le doublait. Or tant que rien de spécifique n'a
 * franchi sa porte d'entrée, c'est lui la réponse : neuf lombalgies sur dix.
 */
function rangDe(hypothesis: ScoredHypothesis): number {
  if (hypothesis.status === 'excluded') return 3
  if (hypothesis.status === 'retained' && hypothesis.score > 0) return 0
  if (hypothesis.kind === 'exclusion') return 1
  return 2
}

function compareHypotheses(a: ScoredHypothesis, b: ScoredHypothesis): number {
  if (rangDe(a) !== rangDe(b)) return rangDe(a) - rangDe(b)
  if (b.score !== a.score) return b.score - a.score
  if (b.potential !== a.potential) return b.potential - a.potential
  return a.label.localeCompare(b.label, 'fr')
}

/** Critères d'une hypothèse encore indécidables, avec le poids qu'ils mettent en jeu. */
function openCriteria(definition: HypothesisDefinition, signals: SignalSet): Criterion[] {
  const open = unSeulParGroupe(
    definition.criteria.filter((criterion) => evaluate(criterion.when, signals) === 'unknown'),
    (criterion) => criterion,
  )
  if (definition.requires && evaluate(definition.requires, signals) === 'unknown') {
    // La condition d'entrée pèse autant que le meilleur critère : tant qu'elle
    // n'est pas tranchée, rien d'autre ne compte vraiment.
    const heaviest = Math.max(
      0,
      ...definition.criteria.map((criterion) => enjeuDe(criterion, definition.kind)),
    )
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
  // Les drapeaux rouges et la stratification pronostique ne se font jamais
  // évincer par le différentiel : le premier parce qu'il prime sur tout, la
  // seconde parce qu'elle ne concourt pas avec lui. Seul le différentiel est
  // tronqué, sans quoi une hypothèse de second rang chasserait le questionnaire
  // de chronicisation de la liste des suites à donner.
  const enLice = (predicat: (hypothesis: ScoredHypothesis) => boolean) =>
    scored.filter((hypothesis) => hypothesis.status !== 'excluded' && predicat(hypothesis))

  const inPlay = [
    ...enLice((hypothesis) => hypothesis.kind === 'red-flag'),
    ...enLice(
      (hypothesis) => hypothesis.kind !== 'red-flag' && hypothesis.kind !== 'profil',
    ).slice(0, 5),
    ...enLice((hypothesis) => hypothesis.kind === 'profil'),
  ]
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
  /**
   * Enjeu de chaque signal encore inconnu, détaillé par hypothèse.
   *
   * Le détail n'est pas décoratif : une action qui renseigne plusieurs signaux
   * d'une même hypothèse ne la fait pas avancer plusieurs fois. Sans cette
   * ventilation, un test qui coche trois cases d'une même porte d'entrée passait
   * devant la question qui départage trois hypothèses distinctes.
   */
  const stakes = new Map<SignalId, Map<string, number>>()

  for (const hypothesis of inPlay) {
    const definition = byId.get(hypothesis.id)
    if (!definition) continue

    // Au sein d'une même hypothèse, un signal ne vaut qu'une fois : ce qu'il
    // débloque de mieux. Un signal qui figure à la fois dans la condition
    // d'entrée et dans un critère décrit un seul et même apport — l'additionner
    // ferait passer un test d'examen devant la question qui ouvre la branche.
    const parSignal = new Map<SignalId, number>()
    for (const criterion of openCriteria(definition, signals)) {
      const enjeu = enjeuDe(criterion, definition.kind) || 1
      for (const signal of openSignalsOf(criterion.when, signals)) {
        if (signals[signal] !== undefined) continue
        parSignal.set(signal, Math.max(parSignal.get(signal) ?? 0, enjeu))
      }
    }

    for (const [signal, enjeu] of parSignal) {
      const entry = stakes.get(signal) ?? new Map<string, number>()
      entry.set(hypothesis.label, Math.max(entry.get(hypothesis.label) ?? 0, enjeu))
      stakes.set(signal, entry)
    }
  }

  /**
   * Ce qu'une action débloque réellement : pour chaque hypothèse, le meilleur
   * des signaux qu'elle renseigne — puis la somme sur les hypothèses. Une
   * action vaut par le nombre de pistes qu'elle départage, pas par le nombre de
   * cases qu'elle coche.
   */
  function apportAction(resolus: SignalId[]): { value: number; discriminates: string[] } {
    const parHypothese = new Map<string, number>()
    for (const signal of resolus) {
      for (const [label, enjeu] of stakes.get(signal) ?? []) {
        parHypothese.set(label, Math.max(parHypothese.get(label) ?? 0, enjeu))
      }
    }
    return {
      value: [...parHypothese.values()].reduce((total, enjeu) => total + enjeu, 0),
      discriminates: [...parHypothese.keys()],
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
    const { value, discriminates } = apportAction(resolved)
    // Un test n'existe que pour trancher : une fois ce qu'il renseigne connu,
    // le reproposer est du bruit. Un questionnaire de référence, un examen ou
    // une orientation gardent leur place, ce sont des suites à donner.
    const answered = (action.resolves?.length ?? 0) > 0 && resolved.length === 0
    if (action.kind === 'test' && answered) continue

    suggestions.set(action.id, { action, discriminates, value })
  }

  // Questions déduites du vocabulaire : tout signal en jeu qui se demande.
  // Les signaux qui s'excluent se posent en une seule question à choix, sinon
  // le praticien devrait écarter les autres réponses une par une.
  const groupes = new Set<string>()

  for (const signal of stakes.keys()) {
    const group = exclusiveGroupOf(signal)
    if (group && EXCLUSIVE_GROUPS[group]) {
      groupes.add(group)
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
      ...apportAction([signal]),
    })
  }

  // Une question à choix vaut ce qu'elle départage : désigner le siège de la
  // douleur tranche entre plusieurs hypothèses d'un coup, là où un test n'en
  // éclaire qu'une.
  for (const group of groupes) {
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
      ...apportAction(options.map((option) => option.id)),
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

  /**
   * Sur un drapeau rouge retenu, l'ordre s'inverse. Ce qui compte alors n'est
   * plus d'affiner mais de sortir du champ de compétence : on oriente, et
   * l'imagerie vient à l'appui de l'orientation, pas à sa place.
   */
  const KIND_ORDER_URGENT: Record<string, number> = {
    referral: 0,
    exam: 1,
    test: 2,
    questionnaire: 3,
    question: 4,
    choice: 4,
  }

  const ordreDe = (action: ActionDefinition) =>
    (urgent.has(action.id) ? KIND_ORDER_URGENT[action.kind] : KIND_ORDER[action.kind]) ?? 9

  /**
   * Ce qui vient d'abord.
   *
   * Hors urgence : ce qui départage le plus, puis l'ordre naturel de la
   * consultation — on demande, on examine, on documente.
   *
   * Sous drapeau rouge, l'ordre s'inverse et passe avant la valeur. La conduite
   * est déjà décidée : proposer l'examen qui l'affine avant l'orientation
   * elle-même invite à rester dans la pièce alors qu'il faut en sortir.
   */
  const comparer = (a: SuggestedAction, b: SuggestedAction): number => {
    const urgentA = urgent.has(a.action.id)
    const urgentB = urgent.has(b.action.id)
    if (urgentA !== urgentB) return Number(urgentB) - Number(urgentA)

    const parNature = ordreDe(a.action) - ordreDe(b.action)
    const parValeur = b.value - a.value
    const departage = urgentA ? parNature || parValeur : parValeur || parNature

    return (
      departage ||
      Number(leaderActions.has(b.action.id)) - Number(leaderActions.has(a.action.id)) ||
      a.action.label.localeCompare(b.action.label, 'fr')
    )
  }

  return [...suggestions.values()].sort(comparer).slice(0, limit)
}

/**
 * Hypothèses réellement en lice : celles qui reposent sur au moins un argument,
 * ou dont la porte d'entrée est franchie. Les autres ne sont pas des
 * concurrentes, seulement le reste du catalogue — les afficher ferait passer
 * pour une piste ce qui n'est qu'une case non cochée.
 */
export function activeHypotheses(result: ReasoningResult): ScoredHypothesis[] {
  return result.hypotheses.filter(
    (hypothesis) =>
      hypothesis.score > 0 ||
      hypothesis.status === 'retained' ||
      // Un argument relevé suffit, même si l'hypothèse n'en tire aucun point :
      // c'est le cas du diagnostic d'exclusion, qui ne se score pas mais reste
      // la piste la plus probable une fois le spécifique éliminé.
      hypothesis.argumentsFor.length > 0,
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
    .filter(
      (hypothesis) =>
        hypothesis.kind !== 'red-flag' &&
        hypothesis.kind !== 'profil' &&
        hypothesis.status !== 'excluded',
    )
    .sort(compareHypotheses)

  // La stratification pronostique se lit à côté du différentiel, pas dedans :
  // la mêler reviendrait à faire concourir « risque de chronicisation » avec
  // « hernie discale », qui ne répondent pas à la même question.
  const profiles = scored
    .filter((hypothesis) => hypothesis.kind === 'profil' && hypothesis.status !== 'excluded')
    .sort(compareHypotheses)

  const excluded = scored
    .filter((hypothesis) => hypothesis.status === 'excluded')
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  return {
    redFlags,
    hypotheses: differential,
    excluded,
    profiles,
    nextActions: rankActions(
      [...redFlags, ...differential, ...profiles],
      hypotheses,
      actions,
      signals,
      new Set(done),
      actionLimit,
    ),
  }
}
