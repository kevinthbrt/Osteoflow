import type { QuestionnaireScore } from '@/lib/consultations/questionnaires'
import type { SignalId } from './signals'

/**
 * Ce qu'un questionnaire rempli apprend au moteur.
 *
 * Un questionnaire produit d'abord un compte rendu pour le dossier ; certains
 * répondent en plus à une question que le raisonnement se posait. Le STarT
 * Back, par exemple, tranche le risque de chronicisation bien mieux qu'une
 * question fermée posée au vol.
 *
 * La table reste volontairement courte : on ne relie un score à un signal que
 * lorsque la correspondance est celle de l'échelle elle-même. Les autres
 * questionnaires valent par leur compte rendu, pas par une traduction
 * approximative.
 */
export function signalsFromQuestionnaire(
  questionnaireId: string,
  score: QuestionnaireScore,
): Partial<Record<SignalId, boolean>> {
  if (questionnaireId === 'start-back') {
    // Les trois strates de l'échelle : faible, moyen, élevé. Le sous-score
    // psychosocial, qui distingue « moyen » d'« élevé », est exactement ce que
    // le moteur appelle des drapeaux jaunes.
    if (score.level === 'low') {
      return { 'psychosocial.risque_chronicisation': false, 'psychosocial.drapeaux_jaunes_2plus': false }
    }
    if (score.level === 'moderate') {
      return { 'psychosocial.risque_chronicisation': true, 'psychosocial.drapeaux_jaunes_2plus': false }
    }
    return { 'psychosocial.risque_chronicisation': true, 'psychosocial.drapeaux_jaunes_2plus': true }
  }

  return {}
}
