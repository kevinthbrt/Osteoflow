import { CERVICAL_ACTIONS, CERVICAL_HYPOTHESES } from './knowledge/cervical'
import { LUMBAR_ACTIONS, LUMBAR_HYPOTHESES } from './knowledge/lumbar'
import type { SignalId } from './signals'
import type { ActionDefinition, HypothesisDefinition, Region } from './types'

/**
 * Choix de la base de connaissance à interroger. Le motif suffit dans la
 * plupart des cas ; les signaux déjà relevés tranchent quand il est vague
 * (« il a mal partout »), et le praticien garde la main dans tous les cas.
 */

const REGION_KEYWORDS: Record<Region, string[]> = {
  lombaire: [
    'lombaire', 'lombalgie', 'lumbago', 'bas du dos', 'sciatique', 'sciatalgie',
    'cruralgie', 'hernie discale', 'sacro-iliaque', 'sacro iliaque', 'fessier',
    'l5', 's1', 'dos',
  ],
  cervical: [
    'cervical', 'cervicalgie', 'nuque', 'cou', 'torticolis', 'whiplash',
    'coup du lapin', 'névralgie cervico', 'cervico-brachiale', 'céphalée',
    'cephalee', 'mal de tête', 'mal de tete', 'migraine', 'c5', 'c6', 'c7',
  ],
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Région suggérée par le texte libre du motif, ou `null` s'il ne tranche pas. */
export function regionFromReason(reason: string): Region | null {
  const haystack = normalize(reason)
  if (!haystack.trim()) return null
  const scores = (Object.keys(REGION_KEYWORDS) as Region[]).map((region) => ({
    region,
    hits: REGION_KEYWORDS[region].filter((keyword) => haystack.includes(normalize(keyword))).length,
  }))
  const best = scores.sort((a, b) => b.hits - a.hits)[0]
  if (!best || best.hits === 0) return null
  // Une égalité ne tranche rien : mieux vaut ne rien décider que décider mal.
  const tie = scores.filter((score) => score.hits === best.hits).length > 1
  return tie ? null : best.region
}

/** Région suggérée par les signaux déjà relevés : celle qui en compte le plus. */
export function regionFromSignals(signals: Partial<Record<SignalId, boolean>>): Region | null {
  let lumbar = 0
  let cervical = 0
  for (const id of Object.keys(signals) as SignalId[]) {
    if (signals[id] === undefined) continue
    if (id.startsWith('lombaire.')) lumbar += 1
    if (id.startsWith('cervical.')) cervical += 1
  }
  if (lumbar === cervical) return null
  return lumbar > cervical ? 'lombaire' : 'cervical'
}

/** Région retenue : le motif d'abord, les signaux à défaut, le lombaire en dernier recours. */
export function detectRegion(
  reason: string,
  signals: Partial<Record<SignalId, boolean>>,
): Region {
  return regionFromReason(reason) ?? regionFromSignals(signals) ?? 'lombaire'
}

export function knowledgeFor(region: Region): {
  hypotheses: HypothesisDefinition[]
  actions: ActionDefinition[]
} {
  return region === 'cervical'
    ? { hypotheses: CERVICAL_HYPOTHESES, actions: CERVICAL_ACTIONS }
    : { hypotheses: LUMBAR_HYPOTHESES, actions: LUMBAR_ACTIONS }
}

export const REGION_LABELS: Record<Region, string> = {
  lombaire: 'Rachis lombaire',
  cervical: 'Rachis cervical',
}
